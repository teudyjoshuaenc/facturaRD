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
  generarECF32ParaRFCE,
  generarRFCE32,
  MONTO_LIMITE_RFCE,
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
  enviarResumenFC,
  consultarEstado,
  generarRepresentacionImpresa,
  resolveDgiiEnv,
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
  DgiiEnv,
  InformacionReferencia,
  InformacionReferenciaOpcional,
} from '@facturard/ecf-engine'
import { CertificadosService } from '../certificados/certificados.service'
import { WebhookSenderService } from '../webhooks/webhook-sender.service'
import type { CreateComprobanteDto } from './dto/create-comprobante.dto'
import { buildEcfPdfInput } from './pdf-input.builder'
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

function formatMensajesDGII(mensajes: { valor: string | null; codigo: number | null }[] | null): string | null {
  return (
      mensajes
          ?.filter((m) => m.valor)
          .map((m) => `[${m.codigo}] ${m.valor}`)
          .join(' | ')
          .substring(0, 1000) ?? null
  )
}

// FechaVencimientoSecuencia: el servicio ya la resuelve (payload → secuencia →
// error) antes de encolar. Aquí es la última barrera: NUNCA se emite con un
// default silencioso — si faltara, se falla con un mensaje claro (error 145 DGII).
function requireFechaVenc(datos: CreateComprobanteDto): string {
  if (!datos.fechaVencimiento) {
    throw new Error(
        `Falta FechaVencimientoSecuencia para ${datos.tipoECF}; configúrala en Empresa/Secuencias.`,
    )
  }
  return datos.fechaVencimiento
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
  // Los items ya vienen resueltos (snapshot de producto) desde el servicio; los
  // coalesce son sólo para estrechar los tipos opcionales del DTO.
  return datos.items.map((item) => ({
    nombre: item.nombreItem ?? '',
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitarioItem ?? 0,
    indicadorFacturacion: mapIndicador(item.indicadorFacturacion ?? 'E'),
    indicadorBienoServicio: (item.indicadorBienoServicio ?? 2) as IndicadorBienoServicio,
    ...(item.unidadMedida !== undefined && { unidadMedida: item.unidadMedida }),
    ...(item.descripcion !== undefined && { descripcion: item.descripcion }),
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
    // Un DRAFT nunca llega al worker; para cuando lo hace, el e-NCF ya fue
    // asignado por emitir(). Este guard estrecha el tipo (eNCF es nullable en DB).
    const eNCF = comprobante.eNCF
    if (!eNCF) throw new Error('Comprobante sin e-NCF asignado; no puede emitirse')

    const { p12Buffer, passphrase } = await this.certificadosService.getCertificadoParaFirmar(tenantId)
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    // Ambiente DGII: 'certecf' (default seguro) o 'ecf' si DGII_ENV=production.
    const env = resolveDgiiEnv()

    // E32 < RD$250,000 sigue el flujo RFCE (resumen a fc.dgii.gov.do), no el
    // flujo normal de recepción. El e-CF completo firmado se conserva igual
    // (almacenamiento, PDF y QR); solo cambia QUÉ se envía a la DGII y a dónde.
    const montoTotal = Number(comprobante.montoTotal)
    const esRFCE = datos.tipoECF === 'E32' && montoTotal < MONTO_LIMITE_RFCE

    // Generar y firmar el e-CF completo. Para el flujo RFCE se usa el generador
    // "plano" (sin InformacionReferencia), idéntico a lo aceptado en certificación.
    const xml = esRFCE
        ? generarECF32ParaRFCE(this.buildE32Input(datos, tenant, eNCF)).xml
        : this.generateXml(datos, tenant, eNCF)
    this.logger.log(`[${comprobanteId}] XML generado — tipo ${datos.tipoECF}${esRFCE ? ' (RFCE <250K)' : ''}`)

    const xmlFirmado = firmarDocumento({ p12: p12Buffer, passphrase, xml })
    this.logger.log(`[${comprobanteId}] XML firmado`)

    await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: { estado: 'ENVIANDO', xmlFirmado },
    })

    this.logger.log(`[${comprobanteId}] Autenticando con DGII ${env}...`)
    const token = await autenticar({ p12Buffer, passphrase, env })

    let estadoFinal: ComprobanteEstado
    let mensajeDGII: string | null
    let trackId: string | null

    if (esRFCE) {
      // Flujo RFCE-32: CodigoSeguridadeCF = primeros 6 chars del SignatureValue
      // del e-CF ya firmado. Con él se construye el resumen, se firma con raíz
      // <RFCE> y se envía a fc.dgii.gov.do (respuesta SINCRÓNICA, sin trackId).
      const codigoSeguridad =
          xmlFirmado.match(/<SignatureValue[^>]*>([A-Za-z0-9+/=]+)/)?.[1]?.slice(0, 6) ?? '000000'

      const rfceXml = generarRFCE32({
        ...this.buildE32Input(datos, tenant, eNCF),
        codigoSeguridadeCF: codigoSeguridad,
      }).xml
      const rfceFirmado = firmarDocumento({
        p12: p12Buffer,
        passphrase,
        xml: rfceXml,
        signOptions: { referenceXPath: "//*[local-name(.)='RFCE']" },
      })

      this.logger.log(`[${comprobanteId}] Enviando RFCE a fc.dgii.gov.do...`)
      const fc = await enviarResumenFC(rfceFirmado, token, { env })

      estadoFinal = mapEstadoDGII(fc.estado)
      mensajeDGII = formatMensajesDGII(fc.mensajes)
      trackId = null
      this.logger.log(`[${comprobanteId}] RFCE estado: ${fc.estado} (código ${fc.codigo})`)
    } else {
      this.logger.log(`[${comprobanteId}] Enviando e-CF a DGII...`)
      const recepcion = await enviarECF(xmlFirmado, token, { env })

      if (!recepcion.trackId) {
        throw new Error(`DGII no retornó trackId. Error: ${recepcion.error ?? recepcion.mensaje ?? 'desconocido'}`)
      }
      this.logger.log(`[${comprobanteId}] trackId=${recepcion.trackId}`)

      this.logger.log(`[${comprobanteId}] Consultando estado...`)
      const resultado = await consultarEstado(recepcion.trackId, token, { env })

      estadoFinal = mapEstadoDGII(resultado.estado)
      mensajeDGII = formatMensajesDGII(resultado.mensajes)
      trackId = recepcion.trackId
    }

    this.logger.log(`[${comprobanteId}] Estado final: ${estadoFinal}`)

    await prisma.comprobante.update({
      where: { id: comprobanteId },
      data: { estado: estadoFinal, trackId, mensajeDGII },
    })

    let pdfPath: string | undefined
    if (estadoFinal === 'ACEPTADO' || estadoFinal === 'ACEPTADO_CONDICIONAL') {
      pdfPath = await this.savePdf(comprobanteId, tenantId, datos, tenant, eNCF, env, xmlFirmado).catch(
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
        detalle: { eNCF: eNCF, estado: estadoFinal, trackId },
      },
    })

    if (estadoFinal === 'ACEPTADO' || estadoFinal === 'ACEPTADO_CONDICIONAL') {
      this.webhookSenderService
          .enviarWebhook(tenantId, 'comprobante.aceptado', {
            eNCF: eNCF,
            tipoECF: comprobante.tipoECF,
            montoTotal: comprobante.montoTotal,
            trackId,
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
            eNCF: eNCF,
            tipoECF: comprobante.tipoECF,
            mensajeDGII,
          })
          .catch((err) =>
              this.logger.warn(`[${comprobanteId}] Webhook saliente error: ${(err as Error).message}`),
          )
    } else if (estadoFinal === 'ERROR') {
      this.webhookSenderService
          .enviarWebhook(tenantId, 'comprobante.error', {
            eNCF: eNCF,
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
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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

  private buildE32Input(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): ECF32Input {
    return {
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
  }

  private generateE32(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    // Flujo A (≥ 250 K). El flujo B (< 250 K / RFCE) se maneja aparte en emitir().
    return generarECF32(this.buildE32Input(datos, tenant, eNCF)).xml
  }

  private generateE33(datos: CreateComprobanteDto, tenant: Tenant, eNCF: string): string {
    const ref = buildReferencia(datos)
    if (!ref) throw new Error('E33 requiere ncfModificado, fechaNCFModificado y codigoModificacion')
    const input: ECF33Input = {
      idDoc: {
        eNCF,
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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
        fechaVencimientoSecuencia: requireFechaVenc(datos),
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
      env: DgiiEnv,
      xmlFirmado: string,
  ): Promise<string> {
    const outDir = join('/tmp', 'pdfs', tenantId)
    mkdirSync(outDir, { recursive: true })
    const pdfPath = join(outDir, `${eNCF}.pdf`)

    // codigoSeguridad + fechaHoraFirma se extraen del XML firmado (van en el QR).
    const pdfInput = buildEcfPdfInput(datos, tenant, eNCF, env, xmlFirmado)
    await generarRepresentacionImpresa(pdfInput, pdfPath)

    await prisma.comprobante.update({ where: { id: comprobanteId }, data: { pdfUrl: pdfPath } })
    this.logger.log(`[${comprobanteId}] PDF generado: ${pdfPath}`)

    return pdfPath
  }
}
