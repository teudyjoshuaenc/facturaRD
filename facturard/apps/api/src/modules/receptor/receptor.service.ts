import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Inject, OnModuleDestroy } from '@nestjs/common'
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
  estado: '0' | '1'
  motivo?: MotivoNoRecibido
}

// ─── Helpers XML ─────────────────────────────────────────────────────────────

/** Formatea fecha en DD-MM-YYYY HH:MM:SS (formato DGII), en hora de República Dominicana. */
function formatDGIIDateTime(d: Date): string {
  const p: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d)) p[part.type] = part.value
  const hora = p['hour'] === '24' ? '00' : p['hour']
  return `${p['day']}-${p['month']}-${p['year']} ${hora}:${p['minute']}:${p['second']}`
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

/**
 * Estado del acuse según el XSD ARECF: 0 = e-CF Recibido, 1 = e-CF No Recibido.
 * Motivo (sólo con estado 1): 1 Error de especificación, 2 Error de firma digital,
 * 3 Envío duplicado, 4 RNC comprador no corresponde.
 */
export type MotivoNoRecibido = 1 | 2 | 3 | 4

/** Construye el XML de Acuse de Recibo (ARECF) */
function buildArecfXml(
  rncEmisor: string,
  rncComprador: string,
  eNCF: string,
  estado: '0' | '1',
  motivo?: MotivoNoRecibido,
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
    ...(estado === '1' && motivo ? [`    <CodigoMotivoNoRecibido>${motivo}</CodigoMotivoNoRecibido>`] : []),
    `    <FechaHoraAcuseRecibo>${ahora}</FechaHoraAcuseRecibo>`,
    '  </DetalleAcusedeRecibo>',
    '</ARECF>',
  ].join('\n')
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReceptorService implements OnModuleDestroy {
  private readonly logger = new Logger(ReceptorService.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly certificadosService: CertificadosService,
  ) {}

  /**
   * Cierra la conexión Redis al destruir el módulo (lo dispara `app.close()`).
   * Sin esto, el cliente ioredis (lazyConnect) queda como handle abierto entre
   * specs e2e y se acumula a lo largo de la suite. `disconnect()` es síncrono y
   * seguro aunque la conexión nunca se haya abierto.
   */
  onModuleDestroy(): void {
    this.redis.disconnect()
  }

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

    // 2. Verificar la firma XMLDSig de la semilla ANTES de consumirla.
    //    Sin esto cualquiera obtenía un token enviando la semilla sin firmar.
    const firma = verificarFirmaEcf(xmlRaw)
    if (!firma.valida) {
      this.logger.warn(`[Receptor][Auth] Semilla con firma inválida: ${firma.error ?? 'sin detalle'}`)
      throw new UnauthorizedException(`La semilla no está firmada correctamente: ${firma.error ?? 'firma inválida'}`)
    }

    // 3. Verificar que la semilla existe en Redis (no expirada)
    const redisKey = `semilla:${semilla}`
    const stored = await this.redis.get(redisKey)
    if (!stored) {
      throw new UnauthorizedException(
        'Semilla expirada o inválida. Solicite una nueva semilla con GET /fe/autenticacion/api/semilla',
      )
    }

    // 4. Consumir la semilla (evitar replay attacks — una semilla = un uso)
    await this.redis.del(redisKey)

    // 5. Identidad del emisor: del XML si viene, si no del certificado que firmó
    const rncEmisor =
      extractXmlTag(xmlRaw, 'RNCEmisor') ??
      extractXmlTag(xmlRaw, 'rncEmisor') ??
      extractXmlTag(xmlRaw, 'RNC') ??
      firma.infoCert?.rncEmisor ??
      'DESCONOCIDO'

    // 6. Emitir JWT de sesión receptor (1 hora)
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

    // 3. Tenant receptor: SÓLO por el RNC del comprador. Nunca se guarda en otro
    //    cliente: un e-CF que no es para nadie aquí no se almacena.
    const tenant = rncComprador
      ? await prisma.tenant.findFirst({ where: { rnc: rncComprador, estado: 'ACTIVO' }, select: { id: true } })
      : null
    if (!tenant) {
      this.logger.warn(`[Receptor] rncComprador="${rncComprador}" no es cliente activo; e-CF ${eNCF} no se almacena`)
      throw new NotFoundException(`El RNC comprador ${rncComprador || '(vacío)'} no es un receptor registrado en FacturaRD`)
    }
    const tenantId = tenant.id

    // 4. Certificado para firmar el acuse. Sin él no se responde (ni se guarda nada):
    //    un ARECF sin firmar no es válido para la DGII; con 503 el emisor reintenta.
    let certTenant: { p12Buffer: Buffer; passphrase: string }
    try {
      certTenant = await this.certificadosService.getCertificadoParaFirmar(tenantId)
    } catch (err) {
      this.logger.error(`[Receptor] Tenant ${tenantId} sin certificado para firmar el ARECF: ${String(err)}`)
      throw new ServiceUnavailableException('El receptor no tiene un certificado activo para firmar el acuse de recibo')
    }
    const responder = (estado: '0' | '1', motivo?: MotivoNoRecibido): RecepcionResult => {
      const xml = firmarDocumento({
        p12: certTenant.p12Buffer,
        passphrase: certTenant.passphrase,
        xml: buildArecfXml(rncEmisor, rncComprador, eNCF, estado, motivo),
        signOptions: { referenceXPath: "//*[local-name(.)='ARECF']" },
      })
      return { xml, rncEmisor, eNCF, estado, ...(motivo ? { motivo } : {}) }
    }

    // 5. Firma XMLDSig del e-CF. Inválida → acuse "No recibido" motivo 2 (no se guarda).
    const verificacion = verificarFirmaEcf(xmlRaw)
    this.logger.log(
      `[Receptor][Firma] eNCF=${eNCF} | firmaValida=${verificacion.valida} ` +
      `| cert.rncEmisor=${verificacion.infoCert?.rncEmisor ?? 'N/A'} | cert.issuer=${verificacion.infoCert?.issuer ?? 'N/A'}`,
    )
    if (!verificacion.valida) {
      this.logger.warn(`[Receptor][Firma] Firma inválida para eNCF=${eNCF}: ${verificacion.error ?? 'error desconocido'}`)
      await this.auditar(tenantId, 'ECF_NO_RECIBIDO', { rncEmisor, eNCF, rncComprador, motivo: 2 })
      return responder('1', 2)
    }
    if (verificacion.error?.startsWith('ADVERTENCIA:')) {
      this.logger.warn(`[Receptor][Firma] ${verificacion.error} | eNCF=${eNCF}`)
    }

    // 6. Duplicados: el mismo documento otra vez (reintento) recibe la misma respuesta;
    //    OTRO documento con el mismo e-NCF y emisor es un envío duplicado (motivo 3).
    const existente = await prisma.comprobanteRecibido.findUnique({
      where: { tenantId_eNCF_rncEmisor: { tenantId, eNCF, rncEmisor } },
      select: { xmlFirmado: true },
    })
    if (existente) {
      if (existente.xmlFirmado === xmlRaw) {
        this.logger.log(`[Receptor] Reintento del mismo e-CF ${eNCF}; se repite el acuse`)
        return responder('0')
      }
      this.logger.warn(`[Receptor] e-NCF ${eNCF} de ${rncEmisor} ya recibido con otro contenido → duplicado`)
      await this.auditar(tenantId, 'ECF_NO_RECIBIDO', { rncEmisor, eNCF, rncComprador, motivo: 3 })
      return responder('1', 3)
    }

    // 7. Guardar el e-CF recibido
    const tipoECF = tipoECFRaw ? tipoECFRaw.replace(/\D/g, '').padStart(2, '0') : '31'
    await prisma.comprobanteRecibido.create({
      data: { tenantId, rncEmisor, eNCF, tipoECF, xmlFirmado: xmlRaw, estado: 'RECIBIDO' },
    })

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

    await this.auditar(tenantId, 'ECF_RECIBIDO', { rncEmisor, eNCF, tipoECF, rncComprador })
    this.logger.log(`[Receptor] e-CF recibido: ${eNCF} de RNC ${rncEmisor} → tenant ${tenantId}`)

    // 8. Acuse de recibo firmado con el P12 del tenant
    return responder('0')
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
    const rncComprador = extractXmlTag(xmlRaw, 'RNCComprador') ?? ''

    if (!eNCF) {
      throw new BadRequestException('No se encontró eNCF en el XML de aprobación')
    }

    // La DGII define HTTP 400 como respuesta "insatisfactoria".
    const firma = verificarFirmaEcf(xmlRaw)
    if (!firma.valida) {
      throw new BadRequestException(`Firma de la aprobación comercial inválida: ${firma.error ?? 'firma inválida'}`)
    }

    // Tenant: el comprador (aprobación de un e-CF que recibimos) o el emisor
    // (aprobación de un e-CF que emitimos). Nunca un tenant "de respaldo".
    const rncs = [rncComprador, rncEmisor].filter(Boolean)
    const tenants = await prisma.tenant.findMany({
      where: { rnc: { in: rncs }, estado: 'ACTIVO' },
      select: { id: true, rnc: true },
    })
    const tenant = tenants.find((t) => t.rnc === rncComprador) ?? tenants.find((t) => t.rnc === rncEmisor)
    if (!tenant) {
      throw new BadRequestException('Ni el RNC comprador ni el emisor de la aprobación son clientes de FacturaRD')
    }

    const comprobante = await prisma.comprobanteRecibido.findFirst({
      where: { tenantId: tenant.id, eNCF, rncEmisor },
    })
    if (comprobante) {
      await prisma.comprobanteRecibido.update({
        where: { id: comprobante.id },
        data: { aprobacion: xmlRaw, estado: 'ACEPTADO' },
      })
      this.logger.log(`[Receptor] Aprobación comercial registrada para ${eNCF}`)
    } else {
      this.logger.log(`[Receptor] Aprobación para eNCF ${eNCF} sin comprobante recibido previo (tenant ${tenant.id})`)
    }

    await this.auditar(
      tenant.id,
      'APROBACION_COMERCIAL_RECIBIDA',
      { rncEmisor, rncComprador, eNCF, estado: extractXmlTag(xmlRaw, 'Estado') ?? null },
      comprobante?.id,
    )
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

  private async auditar(
    tenantId: string,
    accion: string,
    detalle: Record<string, string | number | null>,
    entidadId?: string,
  ): Promise<void> {
    await prisma.auditLog
      .create({
        data: {
          tenantId,
          accion,
          entidad: 'comprobante_recibido',
          ...(entidadId !== undefined ? { entidadId } : {}),
          detalle,
        },
      })
      .catch((e) => this.logger.warn(`[Receptor] Audit log error: ${String(e)}`))
  }
}
