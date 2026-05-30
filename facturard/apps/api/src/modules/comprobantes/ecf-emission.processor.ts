import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger, Inject, forwardRef } from '@nestjs/common'
import type { Job } from 'bullmq'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '@facturard/database'
import type { ComprobanteEstado, Tenant } from '@facturard/database'
import {
  generarECF31,
  firmarDocumento,
  autenticar,
  enviarECF,
  consultarEstado,
  generarRepresentacionImpresa,
} from '@facturard/ecf-engine'
import type {
  ECF31Input,
  IndicadorFacturacion,
  IndicadorBienoServicio,
  TipoPago,
  TipoIngresos,
  EstadoECF,
} from '@facturard/ecf-engine'
import { CertificadosService } from '../certificados/certificados.service'
import { WebhookSenderService } from '../webhooks/webhook-sender.service'
import type { CreateComprobanteDto, CreateItemDto } from './dto/create-comprobante.dto'
import type { EcfJobData } from './comprobantes.service'

function mapIndicador(ind: string): IndicadorFacturacion {
  const map: Record<string, IndicadorFacturacion> = { I1: 1, I2: 2, I3: 3, I4: 4, E: 4 }
  const result = map[ind]
  if (!result) throw new Error(`Indicador de facturación desconocido: ${ind}`)
  return result
}

function mapEstadoDGII(estado: EstadoECF | string | null): ComprobanteEstado {
  if (!estado) return 'ERROR'
  const s = estado.toLowerCase().replace(/\s+/g, '')
  if (s === 'aceptado') return 'ACEPTADO'
  if (s === 'aceptadocondicional') return 'ACEPTADO_CONDICIONAL'
  if (s === 'rechazado') return 'RECHAZADO'
  return 'ERROR'
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function calcularMontoItem(item: CreateItemDto): number {
  const bruto = r2(item.cantidad * item.precioUnitarioItem)
  return r2(bruto - r2(bruto * ((item.descuentoPorcentaje ?? 0) / 100)))
}

@Processor('ecf-emission')
export class EcfEmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(EcfEmissionProcessor.name)

  constructor(
    private readonly certificadosService: CertificadosService,
    @Inject(forwardRef(() => WebhookSenderService))
    private readonly webhookSenderService: WebhookSenderService,
  ) {
    super()
  }

  async process(job: Job<EcfJobData>): Promise<void> {
    const { comprobanteId, tenantId } = job.data
    this.logger.log(`[Job ${job.id}] Iniciando emisión de ${comprobanteId} (intento ${job.attemptsMade + 1})`)

    // 1. Marcar EN_COLA
    await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: { estado: 'EN_COLA', intentos: { increment: 1 } },
    })

    try {
      await this.emitir(comprobanteId, tenantId)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`[Job ${job.id}] Error: ${msg}`)
      await prisma.comprobante
        .update({ where: { id: comprobanteId }, data: { estado: 'ERROR', mensajeDGII: msg.substring(0, 500) } })
        .catch(() => undefined)
      throw error // Re-throw → BullMQ reintenta
    }
  }

  private async emitir(comprobanteId: string, tenantId: string): Promise<void> {
    // 2. Obtener comprobante con datos originales
    const comprobante = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobanteId } })
    const datos = comprobante.datos as CreateComprobanteDto | null
    if (!datos) throw new Error('Datos del comprobante no disponibles en DB')

    // 3. Obtener certificado (descifrado)
    const { p12Buffer, passphrase } = await this.certificadosService.getCertificadoParaFirmar(tenantId)

    // 4. Obtener tenant para datos del emisor
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    // 5. Generar XML según tipo (eNCF viene de la columna del comprobante, no del DTO)
    const xml = this.generateXml(datos, tenant, comprobante.eNCF)
    this.logger.log(`[${comprobanteId}] XML generado — tipo ${datos.tipoECF}`)

    // 6. Firmar XML
    const xmlFirmado = firmarDocumento({ p12: p12Buffer, passphrase, xml })
    this.logger.log(`[${comprobanteId}] XML firmado`)

    // 7. Guardar XML firmado y pasar a ENVIANDO
    await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: { estado: 'ENVIANDO', xmlFirmado },
    })

    // 8. Autenticar con DGII
    this.logger.log(`[${comprobanteId}] Autenticando con DGII certecf...`)
    const token = await autenticar({ p12Buffer, passphrase, env: 'certecf' })

    // 9. Enviar e-CF
    this.logger.log(`[${comprobanteId}] Enviando e-CF a DGII...`)
    const recepcion = await enviarECF(xmlFirmado, token, { env: 'certecf' })

    if (!recepcion.trackId) {
      throw new Error(`DGII no retornó trackId. Error: ${recepcion.error ?? recepcion.mensaje ?? 'desconocido'}`)
    }
    this.logger.log(`[${comprobanteId}] trackId=${recepcion.trackId}`)

    // 10. Polling de estado (la función ya reintenta internamente)
    this.logger.log(`[${comprobanteId}] Consultando estado...`)
    const resultado = await consultarEstado(recepcion.trackId, token, { env: 'certecf' })

    const estadoFinal = mapEstadoDGII(resultado.estado)
    const mensajeDGII =
      resultado.mensajes
        ?.filter((m) => m.valor)
        .map((m) => `[${m.codigo}] ${m.valor}`)
        .join(' | ')
        .substring(0, 1000) ?? null

    this.logger.log(`[${comprobanteId}] Estado final: ${estadoFinal}`)

    // 11. Actualizar comprobante con resultado
    await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: { estado: estadoFinal, trackId: recepcion.trackId, mensajeDGII },
    })

    // 12. Generar PDF si fue aceptado
    let pdfPath: string | undefined
    if (estadoFinal === 'ACEPTADO' || estadoFinal === 'ACEPTADO_CONDICIONAL') {
      pdfPath = await this.savePdf(comprobanteId, tenantId, datos, tenant, comprobante.eNCF).catch(
        (err) => {
          this.logger.warn(`[${comprobanteId}] PDF no generado: ${(err as Error).message}`)
          return undefined
        },
      )
    }

    // 13. Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        accion: 'EMITIR_ECF',
        entidad: 'comprobante',
        entidadId: comprobanteId,
        detalle: { eNCF: comprobante.eNCF, estado: estadoFinal, trackId: recepcion.trackId },
      },
    })

    // 14. Disparar webhooks salientes ─────────────────────────────────────────
    if (estadoFinal === 'ACEPTADO' || estadoFinal === 'ACEPTADO_CONDICIONAL') {
      this.webhookSenderService
        .enviarWebhook(tenantId, 'comprobante.aceptado', {
          eNCF: comprobante.eNCF,
          tipoECF: comprobante.tipoECF,
          montoTotal: comprobante.montoTotal,
          trackId: recepcion.trackId,
          pdfUrl: pdfPath ?? null,
          rncComprador: comprobante.rnc,
          razonSocial: comprobante.razonSocial,
        })
        .catch((err) =>
          this.logger.warn(`[${comprobanteId}] Webhook saliente error: ${(err as Error).message}`),
        )
    } else if (estadoFinal === 'RECHAZADO') {
      this.webhookSenderService
        .enviarWebhook(tenantId, 'comprobante.rechazado', {
          eNCF: comprobante.eNCF,
          tipoECF: comprobante.tipoECF,
          mensajeDGII,
        })
        .catch((err) =>
          this.logger.warn(`[${comprobanteId}] Webhook saliente error: ${(err as Error).message}`),
        )
    } else if (estadoFinal === 'ERROR') {
      this.webhookSenderService
        .enviarWebhook(tenantId, 'comprobante.error', {
          eNCF: comprobante.eNCF,
          tipoECF: comprobante.tipoECF,
          mensajeDGII,
        })
        .catch((err) =>
          this.logger.warn(`[${comprobanteId}] Webhook saliente error: ${(err as Error).message}`),
        )
    }
  }

  private generateXml(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    switch (datos.tipoECF) {
      case 'E31': return this.generateE31(datos, tenant, eNCF)
      case 'E32': throw new Error('E32 no implementado aún — usar E31')
      case 'E33': throw new Error('E33 no implementado aún — usar E31')
      case 'E34': throw new Error('E34 no implementado aún — usar E31')
      default:    throw new Error(`Tipo de e-CF no soportado: ${datos.tipoECF}`)
    }
  }

  private generateE31(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const input: ECF31Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        tipoPago: datos.tipoPago as TipoPago,
        tipoIngresos: datos.tipoIngresos as TipoIngresos,
        indicadorMontoGravado: 0,
      },
      emisor: {
        rnc: tenant.rnc,
        razonSocial: tenant.razonSocial,
        ...(tenant.nombreComercial !== null && { nombreComercial: tenant.nombreComercial }),
        direccion: 'Santo Domingo, República Dominicana',
        fechaEmision: datos.fechaEmision,
      },
      comprador: {
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador,
        ...(datos.direccionComprador !== undefined && { direccion: datos.direccionComprador }),
      },
      items: datos.items.map((item) => ({
        nombre: item.nombreItem,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitarioItem,
        indicadorFacturacion: mapIndicador(item.indicadorFacturacion),
        indicadorBienoServicio: item.indicadorBienoServicio as IndicadorBienoServicio,
        ...(item.unidadMedida !== undefined && { unidadMedida: item.unidadMedida }),
        ...(item.descuentoPorcentaje !== undefined && { descuentoPorcentaje: item.descuentoPorcentaje }),
      })),
    }

    return generarECF31(input).xml
  }

  private async savePdf(
    comprobanteId: string,
    tenantId: string,
    datos: CreateComprobanteDto,
    tenant: Tenant,
    eNCF: string,
  ): Promise<string> {
    const outDir = join('/tmp', 'pdfs', tenantId)
    mkdirSync(outDir, { recursive: true })
    const pdfPath = join(outDir, `${eNCF}.pdf`)

    const items = datos.items.map((item) => ({
      descripcion: item.nombreItem,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitarioItem,
      valor: calcularMontoItem(item),
    }))

    const montoTotal = items.reduce((s, i) => s + i.valor, 0)
    const itbisTotal = datos.items.reduce((s, item) => {
      const monto = calcularMontoItem(item)
      if (item.indicadorFacturacion === 'I1') return s + r2(monto * 0.18)
      if (item.indicadorFacturacion === 'I2') return s + r2(monto * 0.16)
      return s
    }, 0)

    const pdfInput = {
      rncEmisor: tenant.rnc,
      nombreEmisor: tenant.razonSocial,
      eNCF,
      tipoECF: datos.tipoECF,
      fechaEmision: datos.fechaEmision,
      nombreComprador: datos.razonSocialComprador,
      items,
      montoTotal: r2(montoTotal + itbisTotal),
      itbisTotal,
      montoGravadoTotal: montoTotal,
      ...(tenant.nombreComercial !== null ? { nombreComercial: tenant.nombreComercial } : {}),
      ...(datos.fechaVencimiento !== undefined ? { fechaVencimiento: datos.fechaVencimiento } : {}),
      ...(datos.rncComprador !== undefined ? { rncComprador: datos.rncComprador } : {}),
    }
    await generarRepresentacionImpresa(pdfInput, pdfPath)

    await prisma.comprobante.update({ where: { id: comprobanteId }, data: { pdfUrl: pdfPath } })
    this.logger.log(`[${comprobanteId}] PDF generado: ${pdfPath}`)

    return pdfPath
  }
}
