import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger, Inject, forwardRef } from '@nestjs/common'
import type { Job } from 'bullmq'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '@facturard/database'
import type { ComprobanteEstado, Tenant } from '@facturard/database'
import {
  generarECF31,
  generarECF32,
  generarECF33,
  generarECF34,
  generarECF41,
  generarECF43,
  generarECF44,
  generarECF45,
  generarECF46,
  generarECF47,
  firmarDocumento,
  autenticar,
  enviarECF,
  consultarEstado,
  generarRepresentacionImpresa,
} from '@facturard/ecf-engine'
import type {
  ECF31Input,
  ECF32Input,
  ECF33Input,
  ECF34Input,
  ECF41Input,
  ECF43Input,
  ECF44Input,
  ECF45Input,
  ECF46Input,
  ECF47Input,
  IndicadorFacturacion,
  IndicadorBienoServicio,
  TipoPago,
  TipoIngresos,
  EstadoECF,
  InformacionReferencia,
  InformacionReferenciaOpcional,
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

function buildReferencia(datos: CreateComprobanteDto): InformacionReferencia | undefined {
  if (!datos.ncfModificado || !datos.fechaNCFModificado || !datos.codigoModificacion) return undefined
  return {
    ncfModificado: datos.ncfModificado,
    fechaNCFModificado: datos.fechaNCFModificado,
    codigoModificacion: datos.codigoModificacion,
    ...(datos.rncComprador !== undefined ? { rncOtroContribuyente: datos.rncComprador } : {}),
    ...(datos.razonModificacion !== undefined ? { razonModificacion: datos.razonModificacion } : {}),
  }
}

function buildReferenciaOpcional(datos: CreateComprobanteDto): InformacionReferenciaOpcional | undefined {
  if (!datos.ncfModificado || !datos.fechaNCFModificado || !datos.codigoModificacion) return undefined
  return {
    ncfModificado: datos.ncfModificado,
    fechaNCFModificado: datos.fechaNCFModificado,
    codigoModificacion: datos.codigoModificacion,
    ...(datos.rncComprador !== undefined ? { rncOtroContribuyente: datos.rncComprador } : {}),
    ...(datos.razonModificacion !== undefined ? { razonModificacion: datos.razonModificacion } : {}),
  }
}

function mapItems(datos: CreateComprobanteDto) {
  return datos.items.map((item) => ({
    nombre: item.nombreItem,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitarioItem,
    indicadorFacturacion: mapIndicador(item.indicadorFacturacion),
    indicadorBienoServicio: item.indicadorBienoServicio as IndicadorBienoServicio,
    ...(item.unidadMedida !== undefined && { unidadMedida: item.unidadMedida }),
    ...(item.descuentoPorcentaje !== undefined && { descuentoPorcentaje: item.descuentoPorcentaje }),
  }))
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
      throw error
    }
  }

  private async emitir(comprobanteId: string, tenantId: string): Promise<void> {
    const comprobante = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobanteId } })
    const datos = comprobante.datos as CreateComprobanteDto | null
    if (!datos) throw new Error('Datos del comprobante no disponibles en DB')

    const { p12Buffer, passphrase } = await this.certificadosService.getCertificadoParaFirmar(tenantId)
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    const xml = this.generateXml(datos, tenant, comprobante.eNCF)
    this.logger.log(`[${comprobanteId}] XML generado — tipo ${datos.tipoECF}`)

    const xmlFirmado = firmarDocumento({ p12: p12Buffer, passphrase, xml })
    this.logger.log(`[${comprobanteId}] XML firmado`)

    await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: { estado: 'ENVIANDO', xmlFirmado },
    })

    this.logger.log(`[${comprobanteId}] Autenticando con DGII certecf...`)
    const token = await autenticar({ p12Buffer, passphrase, env: 'certecf' })

    this.logger.log(`[${comprobanteId}] Enviando e-CF a DGII...`)
    const recepcion = await enviarECF(xmlFirmado, token, { env: 'certecf' })

    if (!recepcion.trackId) {
      throw new Error(`DGII no retornó trackId. Error: ${recepcion.error ?? recepcion.mensaje ?? 'desconocido'}`)
    }
    this.logger.log(`[${comprobanteId}] trackId=${recepcion.trackId}`)

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

    await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: { estado: estadoFinal, trackId: recepcion.trackId, mensajeDGII },
    })

    let pdfPath: string | undefined
    if (estadoFinal === 'ACEPTADO' || estadoFinal === 'ACEPTADO_CONDICIONAL') {
      pdfPath = await this.savePdf(comprobanteId, tenantId, datos, tenant, comprobante.eNCF).catch(
        (err) => {
          this.logger.warn(`[${comprobanteId}] PDF no generado: ${(err as Error).message}`)
          return undefined
        },
      )
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        accion: 'EMITIR_ECF',
        entidad: 'comprobante',
        entidadId: comprobanteId,
        detalle: { eNCF: comprobante.eNCF, estado: estadoFinal, trackId: recepcion.trackId },
      },
    })

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
      case 'E32': return this.generateE32(datos, tenant, eNCF)
      case 'E33': return this.generateE33(datos, tenant, eNCF)
      case 'E34': return this.generateE34(datos, tenant, eNCF)
      case 'E41': return this.generateE41(datos, tenant, eNCF)
      case 'E43': return this.generateE43(datos, tenant, eNCF)
      case 'E44': return this.generateE44(datos, tenant, eNCF)
      case 'E45': return this.generateE45(datos, tenant, eNCF)
      case 'E46': return this.generateE46(datos, tenant, eNCF)
      case 'E47': return this.generateE47(datos, tenant, eNCF)
      default:    throw new Error(`Tipo de e-CF no soportado: ${datos.tipoECF}`)
    }
  }

  private buildEmisor(tenant: Tenant, fechaEmision: string) {
    return {
      rnc: tenant.rnc,
      razonSocial: tenant.razonSocial,
      ...(tenant.nombreComercial !== null && { nombreComercial: tenant.nombreComercial }),
      direccion: 'Santo Domingo, República Dominicana',
      fechaEmision,
    }
  }

  private generateE31(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const input: ECF31Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        tipoPago: (datos.tipoPago ?? 1) as TipoPago,
        tipoIngresos: (datos.tipoIngresos ?? '01') as TipoIngresos,
        indicadorMontoGravado: 0,
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      comprador: {
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador ?? '',
        ...(datos.direccionComprador !== undefined && { direccion: datos.direccionComprador }),
      },
      items: mapItems(datos),
    }
    return generarECF31(input).xml
  }

  private generateE32(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const input: ECF32Input = {
      idDoc: {
        eNCF,
        tipoPago: (datos.tipoPago ?? 1) as TipoPago,
        tipoIngresos: (datos.tipoIngresos ?? '01') as TipoIngresos,
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      ...(datos.rncComprador || datos.razonSocialComprador
        ? {
            comprador: {
              ...(datos.rncComprador !== undefined ? { rnc: datos.rncComprador } : {}),
              ...(datos.razonSocialComprador !== undefined ? { razonSocial: datos.razonSocialComprador } : {}),
              ...(datos.direccionComprador !== undefined ? { direccion: datos.direccionComprador } : {}),
            },
          }
        : {}),
      items: mapItems(datos),
    }
    return generarECF32(input).xml
  }

  private generateE33(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferencia(datos)
    if (!ref) throw new Error('E33 requiere ncfModificado, fechaNCFModificado y codigoModificacion')
    const input: ECF33Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        tipoPago: (datos.tipoPago ?? 1) as TipoPago,
        tipoIngresos: (datos.tipoIngresos ?? '01') as TipoIngresos,
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      comprador: {
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador ?? '',
      },
      items: mapItems(datos),
      referencia: ref,
    }
    return generarECF33(input).xml
  }

  private generateE34(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferencia(datos)
    if (!ref) throw new Error('E34 requiere ncfModificado, fechaNCFModificado y codigoModificacion')
    const input: ECF34Input = {
      idDoc: {
        eNCF,
        tipoPago: (datos.tipoPago ?? 1) as TipoPago,
        tipoIngresos: (datos.tipoIngresos ?? '01') as TipoIngresos,
        ...(datos.indicadorNotaCredito !== undefined ? { indicadorNotaCredito: datos.indicadorNotaCredito } : {}),
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      comprador: {
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador ?? '',
      },
      items: mapItems(datos),
      referencia: ref,
    }
    return generarECF34(input).xml
  }

  private generateE41(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferenciaOpcional(datos)
    const input: ECF41Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        ...(datos.tipoPago !== undefined ? { tipoPago: datos.tipoPago } : {}),
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      comprador: {
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador ?? '',
      },
      items: mapItems(datos),
      ...(ref !== undefined ? { referencia: ref } : {}),
    }
    return generarECF41(input).xml
  }

  private generateE43(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferenciaOpcional(datos)
    const input: ECF43Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        ...(datos.tipoPago !== undefined ? { tipoPago: datos.tipoPago } : {}),
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      items: mapItems(datos),
      ...(ref !== undefined ? { referencia: ref } : {}),
    }
    return generarECF43(input).xml
  }

  private generateE44(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferenciaOpcional(datos)
    const input: ECF44Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        ...(datos.tipoPago !== undefined ? { tipoPago: datos.tipoPago } : {}),
        ...(datos.tipoIngresos !== undefined ? { tipoIngresos: datos.tipoIngresos as TipoIngresos } : {}),
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      comprador: {
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador ?? '',
      },
      items: mapItems(datos),
      ...(ref !== undefined ? { referencia: ref } : {}),
    }
    return generarECF44(input).xml
  }

  private generateE45(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferenciaOpcional(datos)
    const input: ECF45Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        ...(datos.tipoPago !== undefined ? { tipoPago: datos.tipoPago } : {}),
        ...(datos.tipoIngresos !== undefined ? { tipoIngresos: datos.tipoIngresos as TipoIngresos } : {}),
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      comprador: {
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador ?? '',
      },
      items: mapItems(datos),
      ...(ref !== undefined ? { referencia: ref } : {}),
    }
    return generarECF45(input).xml
  }

  private generateE46(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferenciaOpcional(datos)
    const input: ECF46Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        ...(datos.tipoPago !== undefined ? { tipoPago: datos.tipoPago } : {}),
        ...(datos.tipoIngresos !== undefined ? { tipoIngresos: datos.tipoIngresos as TipoIngresos } : {}),
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      comprador: {
        ...(datos.rncComprador !== undefined ? { rnc: datos.rncComprador } : {}),
        ...(datos.identificadorExtranjero !== undefined ? { identificadorExtranjero: datos.identificadorExtranjero } : {}),
        razonSocial: datos.razonSocialComprador ?? '',
        ...(datos.paisComprador !== undefined ? { paisComprador: datos.paisComprador } : {}),
      },
      items: mapItems(datos),
      ...(ref !== undefined ? { referencia: ref } : {}),
    }
    return generarECF46(input).xml
  }

  private generateE47(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    if (!datos.paisComprador) throw new Error('E47 requiere paisComprador')
    const ref = buildReferenciaOpcional(datos)
    const input: ECF47Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: datos.fechaVencimiento ?? '31-12-2028',
        ...(datos.tipoPago !== undefined ? { tipoPago: datos.tipoPago } : {}),
      },
      emisor: this.buildEmisor(tenant, datos.fechaEmision),
      beneficiario: {
        ...(datos.identificadorExtranjero !== undefined ? { identificadorExtranjero: datos.identificadorExtranjero } : {}),
        ...(datos.razonSocialComprador !== undefined ? { razonSocial: datos.razonSocialComprador } : {}),
        paisComprador: datos.paisComprador,
      },
      items: mapItems(datos),
      ...(ref !== undefined ? { referencia: ref } : {}),
    }
    return generarECF47(input).xml
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
      nombreComprador: datos.razonSocialComprador ?? '',
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
