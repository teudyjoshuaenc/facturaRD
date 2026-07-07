import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as forge from 'node-forge'
import { prisma, TipoECF } from '@facturard/database'
import type { Tenant } from '@facturard/database'
import { CertificadosService } from '../../src/modules/certificados/certificados.service'

const jwt = new JwtService({ secret: process.env['JWT_SECRET'] ?? 'change-me-in-production' })

// Base aleatoria por archivo de test (cada spec tiene su propio registro de
// módulos en Jest, así que un contador fijo colisionaría entre archivos).
let rncCounter = 100_000_000 + Math.floor(Math.random() * 800_000_000)

/** RNC único por invocación para aislar tenants entre tests. */
export function nextRnc(): string {
  rncCounter += 1
  return String(rncCounter)
}

export interface TestTenant {
  tenant: Tenant
  token: string
}

/**
 * Crea un tenant ACTIVO (sin trial vencido → pasa PlanActivoGuard) y devuelve un
 * JWT firmado con el mismo secreto que valida la app. rol ADMIN por defecto.
 */
export async function createTenant(overrides?: Partial<Tenant>): Promise<TestTenant> {
  const rnc = overrides?.rnc ?? nextRnc()
  const tenant = await prisma.tenant.create({
    data: {
      rnc,
      razonSocial: overrides?.razonSocial ?? `TENANT ${rnc} SRL`,
      nombreComercial: overrides?.nombreComercial ?? null,
      estado: 'ACTIVO',
      planActivo: true,
    },
  })
  const token = jwt.sign({ sub: tenant.id, tenantId: tenant.id, role: 'ADMIN' })
  return { tenant, token }
}

/** Inicializa las secuencias de todos los tipos e-CF para el tenant. */
export async function initSequences(tenantId: string): Promise<void> {
  const tipos: TipoECF[] = ['E31', 'E32', 'E33', 'E34', 'E41', 'E43', 'E44', 'E45', 'E46', 'E47']
  const prefijo: Record<string, string> = {
    E31: '31', E32: '32', E33: '33', E34: '34', E41: '41',
    E43: '43', E44: '44', E45: '45', E46: '46', E47: '47',
  }
  // Fecha de vencimiento del rango, como la tendría un tenant real tras el
  // onboarding/sync. Sin ella, los tipos que exigen FechaVencimientoSecuencia
  // (E31, E33, E41...) fallarían al emitir (comportamiento correcto: sin fecha
  // no se emite). Mediodía UTC para que el día no se corra por zona horaria.
  const fechaVencimiento = new Date('2028-12-31T12:00:00.000Z')
  for (const tipoECF of tipos) {
    await prisma.secuencia.create({
      data: { tenantId, tipoECF, prefijo: `E${prefijo[tipoECF]}`, ultimaSecuencia: 0, activo: true, fechaVencimiento },
    })
  }
}

export interface TestCert {
  p12Buffer: Buffer
  passphrase: string
  /** commonName del subject — lo verificamos en la firma XMLDSig. */
  commonName: string
}

/**
 * Genera un P12 autofirmado (RSA-2048) con un commonName dado. Sirve para probar
 * que cada tenant firma con SU propio certificado.
 */
export function generateP12(commonName: string, passphrase = 'test-pass-1234'): TestCert {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  const attrs = [
    { name: 'commonName', value: commonName },
    { name: 'organizationName', value: commonName },
    { shortName: 'C', value: 'DO' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' })
  return {
    p12Buffer: Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary'),
    passphrase,
    commonName,
  }
}

/** Sube y persiste un P12 cifrado para el tenant usando el servicio real. */
export async function uploadCert(app: INestApplication, tenantId: string, cert: TestCert): Promise<void> {
  const service = app.get(CertificadosService)
  await service.upload(tenantId, cert.p12Buffer, cert.passphrase)
}
