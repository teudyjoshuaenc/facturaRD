import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Redis } from 'ioredis'
import { randomUUID } from 'crypto'
import { prisma } from '@facturard/database'
import { verificarFirmaEcf, firmarDocumento } from '@facturard/ecf-engine'
import { CertificadosService } from '../certificados/certificados.service'

export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

// TTL de la semilla en Redis: 5 minutos
const SEMILLA_TTL_SECONDS = 300

// ─── Tipos internos ──────────────────────────────────────────────────────────

export interface SemillaResult {
  valor: string
  fecha: string
  xml: string
}

export interface TokenResult {
  token: string
  expira: string
  expedido: string
}

export interface RecepcionResult {
  xml: string
  rncEmisor: string
  eNCF: string
}

// ─── Helpers XML ─────────────────────────────────────────────────────────────

/** Formatea fecha en DD-MM-YYYY HH:MM:SS (formato DGII) */
function formatDGIIDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** Extrae el contenido de una etiqueta XML (primera ocurrencia) */
function extractXmlTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
  return re.exec(xml)?.[1]?.trim()
}

/** Construye el XML de semilla según spec DGII */
function buildSemillaXml(valor: string, fecha: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<SemillaModel',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    `  <valor>${valor}</valor>`,
    `  <fecha>${fecha}</fecha>`,
    '</SemillaModel>',
  ].join('\n')
}

/** Construye el XML de Acuse de Recibo (ARECF) */
function buildArecfXml(
  rncEmisor: string,
  rncComprador: string,
  eNCF: string,
  estado: string,
): string {
  const ahora = formatDGIIDateTime(new Date())
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<ARECF',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    '  <DetalleAcusedeRecibo>',
    '    <Version>1.0</Version>',
    `    <RNCEmisor>${rncEmisor}</RNCEmisor>`,
    `    <RNCComprador>${rncComprador}</RNCComprador>`,
    `    <eNCF>${eNCF}</eNCF>`,
    `    <Estado>${estado}</Estado>`,
    `    <FechaHoraAcuseRecibo>${ahora}</FechaHoraAcuseRecibo>`,
    '  </DetalleAcusedeRecibo>',
    '</ARECF>',
  ].join('\n')
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReceptorService {
  private readonly logger = new Logger(ReceptorService.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly certificadosService: CertificadosService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // TAREA 1A — Generar semilla
  // ══════════════════════════════════════════════════════════════════════════

  async generarSemilla(): Promise<SemillaResult> {
    const valor = randomUUID()
    const fecha = new Date().toISOString()

    // Guardar en Redis con TTL 5 min
    const redisKey = `semilla:${valor}`
    await this.redis.setex(redisKey, SEMILLA_TTL_SECONDS, fecha)

    this.logger.log(`[Semilla] Generada: ${valor}`)

    return {
      valor,
      fecha,
      xml: buildSemillaXml(valor, fecha),
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAREA 1B — Validar certificado y emitir token de sesión receptor
  // ══════════════════════════════════════════════════════════════════════════

  async validarCertificado(xmlRaw: string): Promise<TokenResult> {
    if (!xmlRaw?.trim()) {
      throw new BadRequestException('El campo xml es obligatorio')
    }

    // 1. Extraer semilla del XML firmado
    //    El emisor envía la semilla dentro de su XML firmado
    //    Intentamos múltiples nombres de tag usados por distintas implementaciones DGII
    const semilla =
      extractXmlTag(xmlRaw, 'Semilla') ??
      extractXmlTag(xmlRaw, 'semilla') ??
      extractXmlTag(xmlRaw, 'valor') ??
      extractXmlTag(xmlRaw, 'Valor')

    if (!semilla) {
      throw new BadRequestException(
        'No se encontró la semilla en el XML. Asegúrese de incluir la etiqueta <Semilla>.',
      )
    }

    // 2. Verificar que la semilla existe en Redis (no expirada)
    const redisKey = `semilla:${semilla}`
    const stored = await this.redis.get(redisKey)
    if (!stored) {
      throw new UnauthorizedException(
        'Semilla expirada o inválida. Solicite una nueva semilla con GET /fe/autenticacion/api/semilla',
      )
    }

    // 3. Consumir la semilla (evitar replay attacks — una semilla = un uso)
    await this.redis.del(redisKey)

    // 4. Extraer RNC del emisor del XML (si está disponible)
    const rncEmisor =
      extractXmlTag(xmlRaw, 'RNCEmisor') ??
      extractXmlTag(xmlRaw, 'rncEmisor') ??
      extractXmlTag(xmlRaw, 'RNC') ??
      'DESCONOCIDO'

    // 5. Emitir JWT de sesión receptor (1 hora)
    //    NOTA: Para producción se debe verificar la firma XMLDSig del emisor
    //    contra su certificado registrado en la DGII. Esto está fuera del scope
    //    del ambiente de certificación.
    const expedido = new Date()
    const expira = new Date(expedido.getTime() + 60 * 60 * 1000)

    const token = this.jwtService.sign(
      {
        sub: rncEmisor,
        type: 'receptor-session',
      },
      {
        expiresIn: '1h',
        issuer: 'facturard-receptor-ecf',
      },
    )

    this.logger.log(`[Receptor] Token emitido para RNC emisor: ${rncEmisor}`)

    return {
      token,
      expira: expira.toISOString(),
      expedido: expedido.toISOString(),
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAREA 2 — Recepción de e-CF
  // ══════════════════════════════════════════════════════════════════════════

  async recibirEcf(xmlRaw: string, rncEmisorToken: string): Promise<RecepcionResult> {
    if (!xmlRaw?.trim()) {
      throw new BadRequestException('El campo xml es obligatorio')
    }

    // 1. Extraer campos clave del XML del e-CF
    const rncEmisor =
      extractXmlTag(xmlRaw, 'RNCEmisor') ??
      extractXmlTag(xmlRaw, 'rncEmisor') ??
      rncEmisorToken // fallback al RNC del token si no está en el XML

    const eNCF =
      extractXmlTag(xmlRaw, 'eNCF') ??
      extractXmlTag(xmlRaw, 'ENCF')

    const tipoECFRaw =
      extractXmlTag(xmlRaw, 'TipoeCF') ??
      extractXmlTag(xmlRaw, 'TipoECF') ??
      extractXmlTag(xmlRaw, 'tipoECF') ??
      ''

    const rncComprador =
      extractXmlTag(xmlRaw, 'RNCComprador') ??
      extractXmlTag(xmlRaw, 'rncComprador') ??
      ''

    const razonSocialEmisor =
      extractXmlTag(xmlRaw, 'RazonSocialEmisor') ??
      extractXmlTag(xmlRaw, 'razonSocialEmisor')
    const montoTotalXml = extractXmlTag(xmlRaw, 'MontoTotal')
    const itbisXml = extractXmlTag(xmlRaw, 'TotalITBIS') ?? extractXmlTag(xmlRaw, 'TotalITBIS1')
    const fechaEmisionXml = extractXmlTag(xmlRaw, 'FechaEmision')

    if (!eNCF) {
      throw new BadRequestException('No se encontró eNCF en el XML del e-CF')
    }
    if (!rncEmisor) {
      throw new BadRequestException('No se encontró RNCEmisor en el XML del e-CF')
    }

    // 2. Log detallado de lo que llegó (Paso 8 — debugging DGII)
    this.logger.log(
      `[Receptor][Paso8] Recibido e-CF: eNCF=${eNCF} | tipoECF=${tipoECFRaw || '(no encontrado)'} ` +
      `| rncEmisor=${rncEmisor} | rncComprador=${rncComprador || '(no encontrado)'} ` +
      `| xmlLength=${xmlRaw.length}`,
    )

    // 3. Verificar firma XMLDSig + cadena de certificados (Paso 8)
    const verificacion = verificarFirmaEcf(xmlRaw)
    this.logger.log(
      `[Receptor][Firma] eNCF=${eNCF} | firmaValida=${verificacion.valida} ` +
      `| cert.rncEmisor=${verificacion.infoCert?.rncEmisor ?? 'N/A'} ` +
      `| cert.nombreEmisor=${verificacion.infoCert?.nombreEmisor ?? 'N/A'} ` +
      `| cert.issuer=${verificacion.infoCert?.issuer ?? 'N/A'} ` +
      `| cert.validoHasta=${verificacion.infoCert?.validoHasta?.toISOString() ?? 'N/A'}`,
    )

    if (!verificacion.valida) {
      this.logger.warn(
        `[Receptor][Firma] Firma inválida para eNCF=${eNCF}: ${verificacion.error ?? 'error desconocido'} ` +
        `| erroresXmlDsig=${JSON.stringify(verificacion.erroresXmlDsig ?? [])}`,
      )
      throw new BadRequestException(
        `Firma XMLDSig no válida: ${verificacion.error ?? 'error desconocido'}`,
      )
    }

    // Si hay advertencia de CA (VIAFIRMA u otra CA sin PEM embebido), loguear pero continuar
    if (verificacion.error?.startsWith('ADVERTENCIA:')) {
      this.logger.warn(`[Receptor][Firma] ${verificacion.error} | eNCF=${eNCF}`)
    }

    // 4. Buscar el tenant receptor (por RNC del comprador)
    this.logger.log(`[Receptor][Paso4] Buscando tenant para rncComprador="${rncComprador}"`)
    let tenantId: string | null = null
    if (rncComprador) {
      const tenant = await prisma.tenant.findFirst({
        where: { rnc: rncComprador, estado: 'ACTIVO' },
        select: { id: true, rnc: true },
      })
      if (tenant) {
        tenantId = tenant.id
        this.logger.log(`[Receptor][Paso4] Tenant encontrado por RNC: ${tenantId}`)
      }
    }

    // Si no encontramos tenant por RNC, buscamos el primer tenant activo
    if (!tenantId) {
      this.logger.log(`[Receptor][Paso4] RNC no coincide, buscando tenant fallback`)
      const fallback = await prisma.tenant.findFirst({
        where: { estado: 'ACTIVO' },
        select: { id: true, rnc: true },
      })
      if (!fallback) {
        this.logger.error(`[Receptor][Paso4] No hay tenants activos — lanzando NotFoundException`)
        throw new NotFoundException('No hay tenants activos para recibir e-CFs')
      }
      tenantId = fallback.id
      this.logger.warn(
        `[Receptor] rncComprador="${rncComprador}" no coincide con ningún tenant. ` +
        `Usando tenant de fallback ${tenantId}`,
      )
    }

    // 5. Guardar el e-CF recibido en DB (upsert por clave única)
    const tipoECF = tipoECFRaw ? tipoECFRaw.replace(/\D/g, '').padStart(2, '0') : '31'
    this.logger.log(
      `[Receptor][Paso5] Guardando en DB: eNCF=${eNCF} | tipoECF=${tipoECF} | tenantId=${tenantId}`,
    )
    try {
      await prisma.comprobanteRecibido.upsert({
        where: {
          tenantId_eNCF_rncEmisor: { tenantId, eNCF, rncEmisor },
        },
        create: {
          tenantId,
          rncEmisor,
          eNCF,
          tipoECF,
          xmlFirmado: xmlRaw,
          estado: 'RECIBIDO',
        },
        update: {
          xmlFirmado: xmlRaw,
          estado: 'RECIBIDO',
          fechaRecepcion: new Date(),
        },
      })
      this.logger.log(`[Receptor][Paso5] DB upsert OK: ${eNCF}`)
    } catch (dbErr) {
      this.logger.error(`[Receptor][Paso5] ERROR en DB upsert: ${String(dbErr)}`)
      throw dbErr
    }

    // Bridge Sprint 7: además del comprobante_recibido, se persiste una
    // CompraRecibida (feed 606) para que el tenant la vea en su módulo de compras.
    // Es una escritura ADICIONAL — no altera la respuesta ARECF a la DGII, por eso
    // va en try/catch: si falla, se loguea y el receptor responde igual.
    await this.persistirCompraRecibida({
      tenantId,
      rncEmisor,
      eNCF,
      razonSocialProveedor: razonSocialEmisor,
      montoTotal: this.parseNum(montoTotalXml),
      itbis: this.parseNum(itbisXml),
      fechaEmision: this.parseFechaDGII(fechaEmisionXml),
    }).catch((e) => this.logger.warn(`[Receptor][Bridge] CompraRecibida no persistida: ${String(e)}`))

    this.logger.log(
      `[Receptor] e-CF recibido: ${eNCF} de RNC ${rncEmisor} → tenant ${tenantId}`,
    )

    // 6. Audit log
    this.logger.log(`[Receptor][Paso6] Creando audit log`)
    await prisma.auditLog
      .create({
        data: {
          tenantId,
          accion: 'ECF_RECIBIDO',
          entidad: 'comprobante_recibido',
          detalle: { rncEmisor, eNCF, tipoECF, rncComprador },
        },
      })
      .catch((e) => this.logger.warn(`[Receptor] Audit log error: ${String(e)}`))

    // 7. Generar XML de acuse de recibo (ARECF) y firmarlo con el P12 del tenant
    this.logger.log(`[Receptor][Paso7] Generando ARECF para eNCF=${eNCF}`)
    const nuestroRnc = rncComprador || (await this.obtenerNuestroRnc(tenantId))
    const arecfXml = buildArecfXml(rncEmisor, nuestroRnc, eNCF, '0')

    let xmlFinal = arecfXml
    try {
      const { p12Buffer, passphrase } = await this.certificadosService.getCertificadoParaFirmar(tenantId)
      xmlFinal = firmarDocumento({
        p12: p12Buffer,
        passphrase,
        xml: arecfXml,
        signOptions: { referenceXPath: "//*[local-name(.)='ARECF']" },
      })
      this.logger.log(`[Receptor][Paso7] ARECF firmado con certificado del tenant ${tenantId}`)
    } catch (err) {
      this.logger.warn(
        `[Receptor][Paso7] No se pudo firmar el ARECF (sin certificado activo): ${String(err)} — retornando sin firma`,
      )
    }

    this.logger.log(
      `[Receptor][Paso7] ARECF listo — retornando respuesta: eNCF=${eNCF} | rncEmisor=${rncEmisor} | xmlLength=${xmlFinal.length}`,
    )
    return { xml: xmlFinal, rncEmisor, eNCF }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAREA 3 — Recepción de aprobación comercial (ACECF)
  // ══════════════════════════════════════════════════════════════════════════

  async registrarAprobacion(xmlRaw: string, rncEmisorToken: string): Promise<void> {
    if (!xmlRaw?.trim()) {
      throw new BadRequestException('El campo xml de aprobación es obligatorio')
    }

    const eNCF =
      extractXmlTag(xmlRaw, 'eNCF') ??
      extractXmlTag(xmlRaw, 'ENCF')

    const rncEmisor =
      extractXmlTag(xmlRaw, 'RNCEmisor') ??
      extractXmlTag(xmlRaw, 'rncEmisor') ??
      rncEmisorToken

    if (!eNCF) {
      throw new BadRequestException('No se encontró eNCF en el XML de aprobación')
    }

    // Buscar el comprobante recibido y actualizar con la aprobación
    const comprobante = await prisma.comprobanteRecibido.findFirst({
      where: { eNCF, rncEmisor },
    })

    if (comprobante) {
      await prisma.comprobanteRecibido.update({
        where: { id: comprobante.id },
        data: { aprobacion: xmlRaw, estado: 'ACEPTADO' },
      })
      this.logger.log(`[Receptor] Aprobación comercial registrada para ${eNCF}`)
    } else {
      // Si no existe el comprobante recibido, puede que llegó la aprobación antes
      // En ese caso la guardamos de todas formas en audit log
      this.logger.warn(
        `[Receptor] Aprobación para eNCF ${eNCF} sin comprobante previo. RNC: ${rncEmisor}`,
      )
    }

    // Audit log
    await prisma.auditLog
      .create({
        data: {
          tenantId: comprobante?.tenantId ?? (await this.obtenerTenantFallback()),
          accion: 'APROBACION_COMERCIAL_RECIBIDA',
          entidad: 'comprobante_recibido',
          // exactOptionalPropertyTypes: usar null en lugar de undefined para campos opcionales de Prisma
          ...(comprobante?.id !== undefined ? { entidadId: comprobante.id } : {}),
          detalle: { rncEmisor, eNCF },
        },
      })
      .catch((e) => this.logger.warn(`[Receptor] Audit log error: ${String(e)}`))
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  /**
   * Bridge receptor → compras (Sprint 7). Crea una CompraRecibida por cada e-CF
   * entrante aceptado (origen RECEPCION_DGII, tipo RECIBIDO_ECF, estadoAprobacion
   * PENDIENTE). Idempotente: si ya existe (mismo tenant/ncf/rncProveedor) no duplica.
   */
  private async persistirCompraRecibida(data: {
    tenantId: string
    rncEmisor: string
    eNCF: string
    razonSocialProveedor: string | undefined
    montoTotal: number
    itbis: number
    fechaEmision: Date | undefined
  }): Promise<void> {
    const existente = await prisma.compraRecibida.findFirst({
      where: { tenantId: data.tenantId, ncf: data.eNCF, rncProveedor: data.rncEmisor, origen: 'RECEPCION_DGII' },
      select: { id: true },
    })
    if (existente) return

    const subtotal = Math.max(0, Math.round((data.montoTotal - data.itbis) * 100) / 100)
    await prisma.compraRecibida.create({
      data: {
        tenantId: data.tenantId,
        tipo: 'RECIBIDO_ECF',
        origen: 'RECEPCION_DGII',
        estadoAprobacion: 'PENDIENTE',
        ncf: data.eNCF,
        rncProveedor: data.rncEmisor,
        subtotal,
        itbis: data.itbis,
        itbisRetenido: 0,
        total: data.montoTotal,
        ...(data.razonSocialProveedor !== undefined && { razonSocialProveedor: data.razonSocialProveedor }),
        ...(data.fechaEmision !== undefined && { fechaComprobante: data.fechaEmision }),
      },
    })
  }

  private parseNum(v: string | undefined): number {
    const n = Number((v ?? '').replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  /** Convierte DD-MM-YYYY (formato DGII) a Date; undefined si no parsea. */
  private parseFechaDGII(v: string | undefined): Date | undefined {
    if (!v) return undefined
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v.trim())
    if (!m) return undefined
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00.000-04:00`)
    return Number.isNaN(d.getTime()) ? undefined : d
  }

  private async obtenerNuestroRnc(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { rnc: true },
    })
    return tenant?.rnc ?? '000000000'
  }

  private async obtenerTenantFallback(): Promise<string> {
    const t = await prisma.tenant.findFirst({
      where: { estado: 'ACTIVO' },
      select: { id: true },
    })
    return t?.id ?? 'unknown'
  }
}
