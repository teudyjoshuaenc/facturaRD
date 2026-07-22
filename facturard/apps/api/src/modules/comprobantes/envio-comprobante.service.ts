import { Injectable, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common'
import { prisma } from '@facturard/database'
import type { Comprobante, Contacto, EnvioComprobante, Tenant } from '@facturard/database'
import { CryptoService } from '../../common/services/crypto.service'
import { GhlHttpService, GHL_BASE_URL } from '../../common/services/ghl-http.service'
import { ComprobantesService } from './comprobantes.service'
import type { EnviarComprobanteDto } from './dto/enviar-comprobante.dto'

const GHL_UPLOAD_URL = `${GHL_BASE_URL}/conversations/messages/upload`
const GHL_MESSAGES_URL = `${GHL_BASE_URL}/conversations/messages`

// Límite documentado por GHL para el endpoint de adjuntos.
const MAX_ADJUNTO_BYTES = 5 * 1024 * 1024

export interface EnvioResultado {
  canal: 'EMAIL'
  estado: 'ENVIADO'
  destino: string
  ghlMessageId: string | null
  ghlConversationId: string | null
  enviadoEn: Date
}

// Respuesta del upload: { uploadedFiles: { "<nombre>": "<url>" }, traceId }
interface GhlUploadResponse {
  uploadedFiles?: Record<string, string>
}

interface GhlSendResponse {
  messageId?: string
  /** Alias que GHL devuelve para email; mismo valor que messageId. */
  emailMessageId?: string
  conversationId?: string
  /** Texto humano ("Email queued successfully."), NO un id. Sólo informativo. */
  msg?: string
}

/**
 * Entrega de comprobantes al cliente a través de GoHighLevel (email hoy).
 *
 * ES POST-EMISIÓN Y NO FISCAL. No importa el ecf-engine, no toca `estado`,
 * `eNCF`, `xmlFirmado` ni `trackId` del comprobante, y no participa de los
 * reportes 606/607/608. Lo único que escribe es la tabla `envios_comprobante`.
 */
@Injectable()
export class EnvioComprobanteService {
  private readonly logger = new Logger(EnvioComprobanteService.name)

  constructor(
    private readonly comprobantes: ComprobantesService,
    private readonly crypto: CryptoService,
    private readonly ghlHttp: GhlHttpService,
  ) {}

  async enviar(tenantId: string, comprobanteId: string, dto: EnviarComprobanteDto): Promise<EnvioResultado> {
    // WhatsApp todavía no existe: la WhatsApp Business Platform exige una
    // plantilla aprobada por Meta para mensajes iniciados por el negocio fuera
    // de la ventana de 24h. Se rechaza explícitamente en vez de intentar un
    // free-form que Meta descartaría (o peor, fingir que salió).
    if (dto.canal !== 'email') {
      throw new BadRequestException(
        'El envío por WhatsApp aún no está disponible (requiere plantillas aprobadas por Meta). Usa canal="email".',
      )
    }

    // 404 si no existe / es de otro tenant / está eliminado.
    const comprobante = await this.comprobantes.findOne(tenantId, comprobanteId)
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    const token = this.tokenGhl(tenant)
    const contacto = await this.resolverContacto(tenantId, comprobante)
    const destino = contacto.email?.trim()
    if (!destino) {
      throw new BadRequestException(
        `El cliente "${contacto.razonSocial}" no tiene correo registrado. Agrégalo en Contactos o sincroniza de nuevo con GoHighLevel.`,
      )
    }
    const ghlContactId = contacto.ghlContactId as string // garantizado por resolverContacto

    // El PDF se regenera al vuelo con el mismo método que sirve GET :id/pdf
    // (404 si el comprobante fue rechazado o falló). No se re-emite nada.
    const { buffer, filename } = await this.comprobantes.regenerarPdfBuffer(tenantId, comprobanteId)
    if (buffer.byteLength > MAX_ADJUNTO_BYTES) {
      throw new BadRequestException(
        `El PDF pesa ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB y GoHighLevel acepta hasta 5 MB como adjunto.`,
      )
    }

    const asunto = dto.asunto?.trim() || this.asuntoPorDefecto(comprobante, tenant)
    const mensaje = dto.mensaje?.trim() || this.mensajePorDefecto(comprobante, tenant)

    try {
      const adjuntoUrl = await this.subirPdf(ghlContactId, token, buffer, filename)
      const { messageId, conversationId } = await this.enviarEmail(
        ghlContactId, token, destino, asunto, mensaje, adjuntoUrl,
      )

      const envio = await this.registrar({
        tenantId, comprobanteId, estado: 'ENVIADO', destino,
        ghlMessageId: messageId, ghlConversationId: conversationId,
      })
      this.logger.log(`[GHL] Comprobante ${comprobanteId} enviado por email a ${destino} (messageId=${messageId ?? 'n/d'})`)

      return {
        canal: 'EMAIL',
        estado: 'ENVIADO',
        destino,
        ghlMessageId: envio.ghlMessageId,
        ghlConversationId: envio.ghlConversationId,
        enviadoEn: envio.createdAt,
      }
    } catch (err) {
      // El fallo se persiste ANTES de propagar: un envío que no salió tiene que
      // quedar visible y auditable, no desaparecer con la excepción.
      const motivo = err instanceof Error ? err.message : String(err)
      await this.registrar({ tenantId, comprobanteId, estado: 'FALLIDO', destino, error: motivo })
      throw err
    }
  }

  /** Historial de envíos del comprobante, del más reciente al más antiguo. */
  async historial(tenantId: string, comprobanteId: string): Promise<EnvioComprobante[]> {
    await this.comprobantes.findOne(tenantId, comprobanteId) // 404 + scoping por tenant
    return prisma.envioComprobante.findMany({
      where: { tenantId, comprobanteId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ─── GHL ────────────────────────────────────────────────────────────────────

  /** Sube el PDF como buffer (multipart, key `fileAttachment`) y devuelve su URL en GHL. */
  private async subirPdf(ghlContactId: string, token: string, buffer: Buffer, filename: string): Promise<string> {
    const form = new FormData()
    form.append('contactId', ghlContactId)
    // Uint8Array.from copia a un ArrayBuffer propio: un Buffer de Node puede
    // estar respaldado por un SharedArrayBuffer, que no es un BlobPart válido.
    form.append('fileAttachment', new Blob([Uint8Array.from(buffer)], { type: 'application/pdf' }), filename)

    const res = await this.pedirAGhl(GHL_UPLOAD_URL, token, { method: 'POST', form }, 'subir el PDF')
    const body = (await res.json().catch(() => ({}))) as GhlUploadResponse

    // GHL devuelve { uploadedFiles: { "<nombre>": "<url>" } }. Se toma la primera
    // URL en vez de indexar por filename: el nombre puede volver normalizado.
    const url = Object.values(body.uploadedFiles ?? {}).find((u) => typeof u === 'string' && u.length > 0)
    if (!url) {
      throw new ServiceUnavailableException(
        'GoHighLevel aceptó el archivo pero no devolvió la URL del adjunto. No se envió el correo; intenta de nuevo.',
      )
    }
    return url
  }

  private async enviarEmail(
    ghlContactId: string,
    token: string,
    destino: string,
    asunto: string,
    mensaje: string,
    adjuntoUrl: string,
  ): Promise<{ messageId: string | null; conversationId: string | null }> {
    const res = await this.pedirAGhl(
      GHL_MESSAGES_URL,
      token,
      {
        method: 'POST',
        json: {
          type: 'Email',
          contactId: ghlContactId,
          emailTo: destino,
          subject: asunto,
          html: this.htmlCuerpo(mensaje),
          message: mensaje, // texto plano de respaldo
          attachments: [adjuntoUrl],
        },
      },
      'enviar el correo',
    )
    const raw = await res.text().catch(() => '')
    this.logger.debug(`[GHL] Respuesta de send: HTTP ${res.status} :: ${raw}`)
    let body: GhlSendResponse = {}
    try {
      body = JSON.parse(raw) as GhlSendResponse
    } catch {
      /* respuesta no-JSON: se deja el body vacío y el id queda null */
    }
    // Forma real verificada contra GHL (HTTP 201):
    //   { threadId, messageId, emailMessageId, msg: "Email queued successfully.",
    //     conversationId, traceId }
    // OJO: `msg` es un texto humano, NO un identificador — no sirve de fallback.
    return {
      messageId: body.messageId ?? body.emailMessageId ?? null,
      conversationId: body.conversationId ?? null,
    }
  }

  /**
   * Llama a GHL y traduce el fallo. Se distingue lo ACCIONABLE por el usuario
   * (400/401/403 → BadRequest con instrucción concreta) de lo TRANSITORIO
   * (5xx/red → ServiceUnavailable). Nunca se da por bueno un envío que GHL
   * no confirmó con 2xx.
   */
  private async pedirAGhl(
    url: string,
    token: string,
    init: Parameters<GhlHttpService['request']>[2],
    accion: string,
  ): Promise<Response> {
    let res: Response
    try {
      res = await this.ghlHttp.request(url, token, init)
    } catch (err) {
      // Error de red/DNS/timeout: transitorio, tiene sentido reintentar.
      const msg = err instanceof Error ? err.message : String(err)
      throw new ServiceUnavailableException(`No se pudo contactar a GoHighLevel para ${accion} (${msg}). Intenta de nuevo.`)
    }

    if (res.ok) return res

    const detalle = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) {
      throw new BadRequestException(
        `GoHighLevel rechazó la autorización al ${accion}. Verifica que tu Private Integration tenga el permiso ` +
          '"conversations/message.write" (Settings → Integrations → Private Integrations → Edit → Scopes).',
      )
    }
    if (res.status >= 500) {
      throw new ServiceUnavailableException(
        `GoHighLevel falló al ${accion} (HTTP ${res.status}). Es un problema temporal de su lado; intenta de nuevo.`,
      )
    }
    throw new BadRequestException(`GoHighLevel rechazó la solicitud al ${accion} (HTTP ${res.status}): ${detalle.slice(0, 300)}`)
  }

  // ─── Resolución de datos ────────────────────────────────────────────────────

  private tokenGhl(tenant: Tenant): string {
    if (!tenant.ghlAccessToken) {
      throw new BadRequestException(
        'GoHighLevel no está conectado. Configúralo en Configuración → Integración con GoHighLevel.',
      )
    }
    return this.crypto.decryptString(tenant.ghlAccessToken)
  }

  /**
   * El comprobante guarda un SNAPSHOT del comprador (rnc/razonSocial) y sólo a
   * veces la referencia `contactoId` (es nullable y sin FK). Por eso: primero
   * por id, y si no hay, se cae al RNC del snapshot.
   */
  private async resolverContacto(tenantId: string, comprobante: Comprobante): Promise<Contacto> {
    const contacto = comprobante.contactoId
      ? await prisma.contacto.findFirst({ where: { id: comprobante.contactoId, tenantId } })
      : await prisma.contacto.findFirst({ where: { tenantId, rnc: comprobante.rnc, activo: true } })

    if (!contacto) {
      throw new BadRequestException(
        `No encontramos al cliente "${comprobante.razonSocial}" (RNC ${comprobante.rnc}) en tus contactos. ` +
          'Créalo en Contactos o sincroniza con GoHighLevel antes de enviarlo.',
      )
    }
    if (!contacto.ghlContactId) {
      throw new BadRequestException(
        `El cliente "${contacto.razonSocial}" no está sincronizado con GoHighLevel. ` +
          'Ve a Contactos → "Sincronizar con GoHighLevel" y vuelve a intentarlo.',
      )
    }
    return contacto
  }

  private async registrar(data: {
    tenantId: string
    comprobanteId: string
    estado: 'ENVIADO' | 'FALLIDO'
    destino: string | null
    ghlMessageId?: string | null
    ghlConversationId?: string | null
    error?: string
  }): Promise<EnvioComprobante> {
    return prisma.envioComprobante.create({
      data: {
        tenantId: data.tenantId,
        comprobanteId: data.comprobanteId,
        canal: 'EMAIL',
        estado: data.estado,
        destino: data.destino,
        ghlMessageId: data.ghlMessageId ?? null,
        ghlConversationId: data.ghlConversationId ?? null,
        error: data.error ?? null,
      },
    })
  }

  // ─── Textos por defecto ─────────────────────────────────────────────────────

  /** Identificador visible: e-NCF si es fiscal, folio NV-xxxx si es nota de venta. */
  private referencia(comprobante: Comprobante): string {
    if (comprobante.esFiscal) return comprobante.eNCF ?? 'borrador'
    return comprobante.folioInterno ?? 'sin folio'
  }

  private asuntoPorDefecto(comprobante: Comprobante, tenant: Tenant): string {
    const tipo = comprobante.esFiscal ? 'Factura' : 'Nota de venta'
    return `${tipo} ${this.referencia(comprobante)} de ${tenant.razonSocial}`
  }

  private mensajePorDefecto(comprobante: Comprobante, tenant: Tenant): string {
    const tipo = comprobante.esFiscal ? 'la factura' : 'la nota de venta'
    return (
      `Hola ${comprobante.razonSocial},\n\n` +
      `Adjuntamos ${tipo} ${this.referencia(comprobante)} por un monto de RD$ ${comprobante.montoTotal.toString()}.\n\n` +
      `Gracias por tu preferencia.\n${tenant.razonSocial}`
    )
  }

  private htmlCuerpo(mensaje: string): string {
    const escapado = mensaje
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<p>${escapado.replace(/\n/g, '<br/>')}</p>`
  }
}
