import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma } from '@facturard/database'
import type { Certificado } from '@facturard/database'
import { parseCertificateInfo } from '@facturard/ecf-engine'
import { CryptoService } from '../../common/services/crypto.service'

// Campos seguros — excluye material criptográfico del output al cliente
type SafeCertificado = Omit<Certificado, 'p12Encrypted' | 'p12Iv' | 'p12Tag' | 'passphraseCifrada'>
type SafeCertificadoConVigencia = SafeCertificado & { diasRestantes: number }

function toSafe(cert: Certificado): SafeCertificado {
  const { p12Encrypted: _a, p12Iv: _b, p12Tag: _c, passphraseCifrada: _d, ...rest } = cert
  return rest
}

function conDiasRestantes(cert: SafeCertificado): SafeCertificadoConVigencia {
  const dias = Math.ceil((cert.validoHasta.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  return { ...cert, diasRestantes: dias }
}

// Datos de un certificado listos para persistir (P12 ya validado y cifrado),
// sin tenantId. Reutilizable tanto por upload() como por el onboarding atómico.
export type CertificadoData = {
  titular: string
  rnc: string
  serial: string
  emitidoPor: string
  validoDesde: Date
  validoHasta: Date
  p12Encrypted: string
  p12Iv: string
  p12Tag: string
  passphraseCifrada: string
}

@Injectable()
export class CertificadosService {
  constructor(private readonly crypto: CryptoService) {}

  /**
   * Valida el P12 (que abra con la passphrase y esté vigente) y cifra P12 +
   * passphrase con AES-256-GCM. NO toca la DB. Lanza 400 si es inválido.
   * Fuente única de la lógica de validación/cifrado de certificados.
   */
  buildCertificadoData(file: Buffer, passphrase: string): CertificadoData {
    let info: ReturnType<typeof parseCertificateInfo>
    try {
      info = parseCertificateInfo(file, passphrase)
    } catch {
      throw new BadRequestException('Certificado inválido o passphrase incorrecta')
    }

    if (info.validoHasta < new Date()) {
      throw new BadRequestException(
        `El certificado venció el ${info.validoHasta.toLocaleDateString('es-DO')}`,
      )
    }

    const { encrypted, iv, tag } = this.crypto.encryptBuffer(file)
    return {
      titular: info.titular,
      rnc: info.rnc,
      serial: info.serial,
      emitidoPor: info.emitidoPor,
      validoDesde: info.validoDesde,
      validoHasta: info.validoHasta,
      p12Encrypted: encrypted.toString('base64'),
      p12Iv: iv,
      p12Tag: tag,
      passphraseCifrada: this.crypto.encryptString(passphrase),
    }
  }

  async upload(tenantId: string, file: Buffer, passphrase: string): Promise<SafeCertificado> {
    const data = this.buildCertificadoData(file, passphrase)

    // Desactivar certificado activo anterior (solo uno activo por tenant)
    await prisma.certificado.updateMany({
      where: { tenantId, activo: true },
      data: { activo: false },
    })

    const cert = await prisma.certificado.create({ data: { tenantId, ...data } })
    return toSafe(cert)
  }

  async findAll(callerTenantId: string, callerRole: string, filterTenantId?: string): Promise<SafeCertificado[]> {
    const targetTenantId =
      callerRole === 'SUPER_ADMIN' && filterTenantId ? filterTenantId : callerTenantId

    const certs = await prisma.certificado.findMany({
      where: { tenantId: targetTenantId },
      orderBy: { createdAt: 'desc' },
    })
    return certs.map(toSafe)
  }

  async getActive(tenantId: string): Promise<SafeCertificadoConVigencia> {
    const cert = await prisma.certificado.findFirst({
      where: { tenantId, activo: true },
    })
    if (!cert) throw new NotFoundException('No hay certificado activo para este tenant')
    return conDiasRestantes(toSafe(cert))
  }

  async deactivate(tenantId: string, id: string): Promise<{ message: string }> {
    const cert = await prisma.certificado.findFirst({ where: { id, tenantId } })
    if (!cert) throw new NotFoundException(`Certificado ${id} no encontrado`)

    if (!cert.activo) return { message: 'El certificado ya estaba inactivo' }

    // No permitir desactivar si es el único activo
    const activeCount = await prisma.certificado.count({ where: { tenantId, activo: true } })
    if (activeCount <= 1) {
      throw new BadRequestException(
        'No puedes desactivar el único certificado activo. Sube uno nuevo primero.',
      )
    }

    await prisma.certificado.update({ where: { id }, data: { activo: false } })
    return { message: 'Certificado desactivado' }
  }

  /**
   * Método INTERNO — usado por el módulo de comprobantes para firmar XMLs.
   * No se expone como endpoint. NUNCA loguear el resultado.
   */
  async getCertificadoParaFirmar(tenantId: string): Promise<{ p12Buffer: Buffer; passphrase: string }> {
    const cert = await prisma.certificado.findFirst({
      where: { tenantId, activo: true },
    })
    if (!cert) throw new NotFoundException('El tenant no tiene certificado activo')

    const p12Buffer = this.crypto.decryptBuffer(
      Buffer.from(cert.p12Encrypted, 'base64'),
      cert.p12Iv,
      cert.p12Tag,
    )
    const passphrase = this.crypto.decryptString(cert.passphraseCifrada)

    return { p12Buffer, passphrase }
  }
}
