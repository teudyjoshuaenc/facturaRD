import { BadGatewayException, ConflictException, Injectable, Logger } from '@nestjs/common'
import { prisma, TipoECF } from '@facturard/database'
import { detectarUltimaSecuencia, resolveDgiiEnv, type DgiiEnv } from '@facturard/ecf-engine'
import { CertificadosService } from '../certificados/certificados.service'
import { DgiiTrackIdsClient } from './dgii-trackids.client'
import { SecuenciasService, formatENCF } from './secuencias.service'

export type EstadoDeteccion = 'actualizada' | 'sinCambios' | 'error'

export interface DeteccionTipo {
  tipoECF: TipoECF
  /** Contador local antes de detectar. */
  antes: number
  /** Mayor número que la DGII reporta como recibido (null si hubo error). */
  detectada: number | null
  /** Contador local después de aplicar (nunca menor que `antes`). */
  despues: number
  /** Próximo e-NCF que emitirá FacturaRD para este tipo. */
  proximoENCF: string
  estado: EstadoDeteccion
  consultas: number
  error?: string
  nota?: string
}

export interface DeteccionResultado {
  ambiente: DgiiEnv
  tipos: DeteccionTipo[]
}

// Las facturas de consumo < RD$250,000 llegan a la DGII como resumen (RFCE) por
// otro servicio; la consulta de TrackIds puede no verlas.
const NOTA_E32 =
  'Las facturas de consumo menores de RD$250,000 se envían como resumen (RFCE) y pueden no ' +
  'aparecer en esta consulta. Si ya emitías E32, verifica el número.'

// Tipos consultados en paralelo (cada uno hace sus consultas en serie).
const CONCURRENCIA = 3

/**
 * Detecta, por tipo de e-CF, el último e-NCF que la DGII ya recibió de este emisor
 * y AVANZA el contador local hasta ahí. Sólo avanza: si el contador local ya va
 * más adelante (o la DGII no responde), queda igual. No consume e-NCF, no firma
 * ni envía comprobantes; sólo lee de la DGII con el certificado del tenant.
 */
@Injectable()
export class SecuenciasDgiiService {
  private readonly logger = new Logger(SecuenciasDgiiService.name)

  constructor(
    private readonly certificados: CertificadosService,
    private readonly secuencias: SecuenciasService,
    private readonly dgii: DgiiTrackIdsClient,
  ) {}

  async detectarYAplicar(tenantId: string): Promise<DeteccionResultado> {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { rnc: true } })

    let cert: { p12Buffer: Buffer; passphrase: string }
    try {
      cert = await this.certificados.getCertificadoParaFirmar(tenantId)
    } catch {
      throw new ConflictException(
        'Sube tu certificado digital para que FacturaRD pueda consultar tu numeración en la DGII.',
      )
    }

    const env = resolveDgiiEnv()
    let token: string
    try {
      token = await this.dgii.autenticar(cert.p12Buffer, cert.passphrase, env)
    } catch (err) {
      this.logger.warn(`Detección de secuencias: no se pudo autenticar con la DGII (tenant ${tenantId}): ${String(err)}`)
      throw new BadGatewayException('No pudimos conectarnos con la DGII. Intenta de nuevo en unos minutos.')
    }

    const locales = await this.secuencias.getSecuencias(tenantId)
    const tipos: DeteccionTipo[] = new Array(locales.length)
    let i = 0
    const worker = async (): Promise<void> => {
      while (i < locales.length) {
        const idx = i++
        const seq = locales[idx]!
        tipos[idx] = await this.detectarTipo(tenantId, tenant.rnc, seq.tipoECF, seq.ultimaSecuencia, token, env)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, locales.length) }, worker))

    const cambios = tipos.filter((t) => t.estado === 'actualizada')
    if (cambios.length > 0) {
      this.logger.log(
        `Secuencias avanzadas desde la DGII (tenant ${tenantId}): ` +
          cambios.map((t) => `${t.tipoECF} ${t.antes}→${t.despues}`).join(', '),
      )
    }
    return { ambiente: env, tipos }
  }

  private async detectarTipo(
    tenantId: string,
    rnc: string,
    tipoECF: TipoECF,
    antes: number,
    token: string,
    env: DgiiEnv,
  ): Promise<DeteccionTipo> {
    const nota = tipoECF === TipoECF.E32 ? NOTA_E32 : undefined
    let consultas = 0
    try {
      const r = await detectarUltimaSecuencia(
        (n) => {
          consultas++
          return this.dgii.recibido(rnc, formatENCF(tipoECF, n), token, env)
        },
        { desde: antes },
      )
      const despues = await this.secuencias.avanzarHasta(tenantId, tipoECF, r.ultimaUsada)
      return {
        tipoECF,
        antes,
        detectada: r.ultimaUsada,
        despues,
        proximoENCF: formatENCF(tipoECF, despues + 1),
        estado: despues > antes ? 'actualizada' : 'sinCambios',
        consultas,
        ...(nota !== undefined && { nota }),
      }
    } catch (err) {
      this.logger.warn(`Detección ${tipoECF} falló (tenant ${tenantId}): ${String(err)}`)
      return {
        tipoECF,
        antes,
        detectada: null,
        despues: antes,
        proximoENCF: formatENCF(tipoECF, antes + 1),
        estado: 'error',
        consultas,
        error: 'La DGII no respondió la consulta para este tipo. Verifica el número manualmente.',
        ...(nota !== undefined && { nota }),
      }
    }
  }
}
