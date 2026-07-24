import { Injectable, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { prisma } from '@facturard/database'
import type { Comprobante, Contacto, EnvioComprobante, Tenant } from '@facturard/database'
import { CryptoService } from '../../common/services/crypto.service'
import { GhlHttpService, GHL_BASE_URL } from '../../common/services/ghl-http.service'
import { ComprobantesService } from './comprobantes.service'
import type { EnviarComprobanteDto } from './dto/enviar-comprobante.dto'
import {
  MAX_ADJUNTO_BYTES,
  MAX_ADJUNTOS_TOTAL_BYTES,
  MAX_COMPROBANTES_POR_CORREO,
  type EnviarLoteDto,
} from './dto/enviar-lote.dto'

const GHL_UPLOAD_URL = `${GHL_BASE_URL}/conversations/messages/upload`
const GHL_MESSAGES_URL = `${GHL_BASE_URL}/conversations/messages`
const GHL_CONTACTS_URL = `${GHL_BASE_URL}/contacts/`
const GHL_DUPLICADO_URL = `${GHL_BASE_URL}/contacts/search/duplicate`

/**
 * Etiqueta con la que se marca TODO contacto creado por FacturaRD. Existe para
 * que un admin del CRM pueda filtrarlos, auditarlos y limpiarlos. Junto con
 * `source`, son las dos vías por las que se puede rastrear qué escribimos.
 */
const TAG_CONTACTO_CREADO = 'facturard-envio'
const SOURCE_CONTACTO_CREADO = 'FacturaRD'

/** Scopes de la Private Integration, para nombrar el que falta en cada fallo. */
const SCOPE_MENSAJES = 'conversations/message.write'
const SCOPE_CONTACTOS_LECTURA = 'contacts.readonly'
const SCOPE_CONTACTOS_ESCRITURA = 'contacts.write'

const MENSAJE_CANAL_NO_DISPONIBLE =
  'El envío por WhatsApp aún no está disponible (requiere plantillas aprobadas por Meta). Usa canal="email".'

/**
 * De dónde salió el contacto de GHL bajo el que queda el hilo del correo.
 * El orden de la cascada va de más barato y menos invasivo a más:
 *  - `contactoLocal`     → un destinatario ya es Contacto nuestro sincronizado
 *  - `contactoGhl`       → existe en GHL aunque nuestra DB no lo tenga
 *  - `primerComprobante` → el cliente de la factura; evita escribir en el CRM
 *  - `creado`            → último recurso: se creó un contacto mínimo
 */
export type OrigenAncla = 'contactoLocal' | 'contactoGhl' | 'primerComprobante' | 'creado'

export interface Ancla {
  ghlContactId: string
  razonSocial: string
  origen: OrigenAncla
  /** Correo bajo el que se resolvió (o con el que se creó) el contacto. */
  email: string | null
  /** true SÓLO si esta llamada creó un contacto nuevo en el CRM del cliente. */
  creado: boolean
}

export interface EnvioResultado {
  canal: 'EMAIL'
  estado: 'ENVIADO'
  destino: string
  ancla: Ancla
  ghlMessageId: string | null
  ghlConversationId: string | null
  enviadoEn: Date
}

export interface EnvioLoteResultado {
  canal: 'EMAIL'
  estado: 'ENVIADO'
  /** Agrupa las N filas de `envios_comprobante` que dejó este correo. */
  loteId: string
  destinatarios: string[]
  /**
   * Contacto de GHL bajo cuya conversación quedó el correo. Se devuelve
   * explícito a propósito: el usuario tiene que poder ver dónde aterrizó el
   * hilo, no adivinarlo.
   */
  ancla: Ancla
  comprobantes: { id: string; referencia: string }[]
  adjuntos: number
  ghlMessageId: string | null
  ghlConversationId: string | null
  enviadoEn: Date
}

interface AdjuntoListo {
  comprobanteId: string
  referencia: string
  filename: string
  buffer: Buffer
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
      throw new BadRequestException(MENSAJE_CANAL_NO_DISPONIBLE)
    }

    // 404 si no existe / es de otro tenant / está eliminado.
    const comprobante = await this.comprobantes.findOne(tenantId, comprobanteId)
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    const token = this.tokenGhl(tenant)

    // El destinatario sale del Contacto local: hoy es la ÚNICA fuente de correo
    // del comprador (el comprobante no guarda ninguno). Cuando el envío
    // individual acepte destinatarios libres, esta línea es lo único que cambia
    // — el ancla de abajo ya funciona igual para los dos flujos.
    const contacto = await this.buscarContactoLocal(tenantId, comprobante)
    if (!contacto) {
      throw new BadRequestException(
        `No encontramos al cliente "${comprobante.razonSocial}" (RNC ${comprobante.rnc}) en tus contactos, ` +
          'así que no sabemos a qué correo enviarle. Créalo en Contactos con su correo (o sincroniza con ' +
          'GoHighLevel) y vuelve a intentarlo.',
      )
    }
    const destino = contacto.email?.trim()
    if (!destino) {
      throw new BadRequestException(
        `El cliente "${contacto.razonSocial}" no tiene correo registrado. Agrégalo en Contactos o sincroniza de nuevo con GoHighLevel.`,
      )
    }

    // MISMA cascada que el lote: contacto local → GHL → contacto de la factura →
    // crear. Un contacto sin sincronizar ya no es un callejón sin salida.
    const ancla = await this.resolverAncla(tenantId, token, [destino], [comprobante])

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
      const adjuntoUrl = await this.subirPdf(ancla.ghlContactId, token, buffer, filename)
      const { messageId, conversationId } = await this.enviarEmail(token, {
        ghlContactId: ancla.ghlContactId, emailTo: destino, asunto, mensaje, adjuntos: [adjuntoUrl],
      })

      const envio = await this.registrar({
        tenantId, comprobanteId, estado: 'ENVIADO', destino,
        ghlMessageId: messageId, ghlConversationId: conversationId,
      })
      this.logger.log(`[GHL] Comprobante ${comprobanteId} enviado por email a ${destino} (messageId=${messageId ?? 'n/d'})`)

      return {
        canal: 'EMAIL',
        estado: 'ENVIADO',
        destino,
        ancla,
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

  /**
   * Envío EN LOTE: UN SOLO correo con los PDFs de N comprobantes adjuntos.
   * NO es un correo por comprobante.
   *
   * Todo-o-nada por diseño. El orden importa:
   *   1. resolver los comprobantes y GENERAR TODOS LOS PDFs (sin efectos: si
   *      uno falla se responde 400 con la lista y no se subió ni envió nada),
   *   2. subir los adjuntos,
   *   3. un único POST /conversations/messages.
   * Como el paso 3 es un solo mensaje, no existe el estado "medio enviado".
   */
  async enviarLote(tenantId: string, dto: EnviarLoteDto): Promise<EnvioLoteResultado> {
    if (dto.canal !== 'email') {
      throw new BadRequestException(MENSAJE_CANAL_NO_DISPONIBLE)
    }
    // El DTO ya lo valida; se repite aquí porque este servicio es el que sostiene
    // la regla, no el formulario ni el decorador.
    if (dto.comprobanteIds.length > MAX_COMPROBANTES_POR_CORREO) {
      throw new BadRequestException(
        `Máximo ${MAX_COMPROBANTES_POR_CORREO} comprobantes por correo (es el límite de adjuntos de GoHighLevel); seleccionaste ${dto.comprobanteIds.length}.`,
      )
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    const token = this.tokenGhl(tenant)

    // 404 si alguno no existe / es de otro tenant / está eliminado.
    const comprobantes: Comprobante[] = []
    for (const id of dto.comprobanteIds) {
      comprobantes.push(await this.comprobantes.findOne(tenantId, id))
    }

    // ── Punto de no retorno: todo lo que puede fallar por datos, falla ACÁ ──
    const adjuntos = await this.generarAdjuntos(tenantId, comprobantes)
    const ancla = await this.resolverAncla(tenantId, token, dto.destinatarios, comprobantes)

    const [emailTo, ...emailCc] = dto.destinatarios
    const asunto = dto.asunto?.trim() || this.asuntoLotePorDefecto(comprobantes, tenant)
    const mensaje = dto.mensaje?.trim() || this.mensajeLotePorDefecto(comprobantes, tenant)
    const destino = dto.destinatarios.join(', ')
    const loteId = randomUUID()

    try {
      // Un upload por PDF (5 requests como mucho, irrelevante contra el rate
      // limit de GHL: 100 req/10s). Se reusa tal cual el upload ya verificado.
      const urls: string[] = []
      for (const adjunto of adjuntos) {
        urls.push(await this.subirPdf(ancla.ghlContactId, token, adjunto.buffer, adjunto.filename))
      }

      const { messageId, conversationId } = await this.enviarEmail(token, {
        ghlContactId: ancla.ghlContactId,
        emailTo: emailTo!,
        emailCc,
        asunto,
        mensaje,
        adjuntos: urls,
      })

      // Una fila POR COMPROBANTE, todas con el mismo loteId y el mismo
      // ghlMessageId: cada factura conserva su propio "enviada el X" y el
      // historial de su detalle sigue funcionando sin saber del lote.
      const enviadoEn = new Date()
      await prisma.envioComprobante.createMany({
        data: adjuntos.map((a) => ({
          tenantId,
          comprobanteId: a.comprobanteId,
          canal: 'EMAIL' as const,
          estado: 'ENVIADO' as const,
          destino,
          ghlMessageId: messageId,
          ghlConversationId: conversationId,
          loteId,
          createdAt: enviadoEn,
        })),
      })

      this.logger.log(
        `[GHL] Lote ${loteId}: ${adjuntos.length} comprobante(s) enviados en un correo a ${destino} (messageId=${messageId ?? 'n/d'})`,
      )

      return {
        canal: 'EMAIL',
        estado: 'ENVIADO',
        loteId,
        destinatarios: dto.destinatarios,
        ancla,
        comprobantes: adjuntos.map((a) => ({ id: a.comprobanteId, referencia: a.referencia })),
        adjuntos: adjuntos.length,
        ghlMessageId: messageId,
        ghlConversationId: conversationId,
        enviadoEn,
      }
    } catch (err) {
      // El correo es uno solo: si falló, falló para TODOS. Se registra el fallo
      // en las N filas (mismo loteId) antes de propagar.
      const motivo = err instanceof Error ? err.message : String(err)
      await prisma.envioComprobante.createMany({
        data: adjuntos.map((a) => ({
          tenantId,
          comprobanteId: a.comprobanteId,
          canal: 'EMAIL' as const,
          estado: 'FALLIDO' as const,
          destino,
          loteId,
          error: motivo,
        })),
      })
      throw err
    }
  }

  /**
   * Genera los PDFs de TODOS los comprobantes antes de tocar GHL. Si alguno no
   * se puede generar (rechazado, error, sin datos) o excede el peso, no se
   * envía NADA: 400 nombrando cuáles y por qué. Nunca un éxito parcial
   * disfrazado de éxito.
   */
  private async generarAdjuntos(tenantId: string, comprobantes: Comprobante[]): Promise<AdjuntoListo[]> {
    const listos: AdjuntoListo[] = []
    const fallidos: string[] = []

    for (const comprobante of comprobantes) {
      const referencia = this.referencia(comprobante)
      try {
        const { buffer, filename } = await this.comprobantes.regenerarPdfBuffer(tenantId, comprobante.id)
        if (buffer.byteLength > MAX_ADJUNTO_BYTES) {
          fallidos.push(`${referencia}: el PDF pesa ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB y GoHighLevel acepta hasta 5 MB`)
          continue
        }
        listos.push({ comprobanteId: comprobante.id, referencia, filename, buffer })
      } catch (err) {
        fallidos.push(`${referencia}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (fallidos.length > 0) {
      throw new BadRequestException(
        `No se envió nada: ${fallidos.length} de ${comprobantes.length} comprobante(s) no se pudieron adjuntar. ` +
          `Quítalos de la selección y vuelve a intentarlo — ${fallidos.join('; ')}.`,
      )
    }

    const total = listos.reduce((suma, a) => suma + a.buffer.byteLength, 0)
    if (total > MAX_ADJUNTOS_TOTAL_BYTES) {
      throw new BadRequestException(
        `Los ${listos.length} PDFs suman ${(total / 1024 / 1024).toFixed(1)} MB y un correo de GoHighLevel admite hasta 20 MB de adjuntos. ` +
          'Envíalos en dos tandas.',
      )
    }
    return listos
  }

  /**
   * Contacto de GHL bajo el que queda el hilo del correo.
   *
   * La API v2 de GHL es CONTACT-FIRST: enviar exige un `contactId`, no se puede
   * mandar a alguien que no exista como contacto (la v1 sí lo permitía). Sólo el
   * ANCLA tiene esa restricción — los demás destinatarios viajan en `emailCc`,
   * que acepta direcciones cualesquiera.
   *
   * Cascada, de menos a más invasiva. Crear un contacto ESCRIBE en el CRM del
   * cliente, así que es el último recurso y sólo cuando no hay alternativa:
   *   1. algún destinatario ya es Contacto nuestro sincronizado  (0 llamadas)
   *   2. algún destinatario existe en GHL aunque no lo tengamos  (1 GET c/u)
   *   3. el contacto del primer comprobante                      (0 llamadas)
   *   4. crear un contacto mínimo con el primer destinatario     (1 POST, escribe)
   */
  private async resolverAncla(
    tenantId: string,
    token: string,
    destinatarios: string[],
    comprobantes: Comprobante[],
  ): Promise<Ancla> {
    // ── 1. Contacto local sincronizado ────────────────────────────────────────
    for (const email of destinatarios) {
      const local = await prisma.contacto.findFirst({
        where: { tenantId, activo: true, ghlContactId: { not: null }, email: { equals: email, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      })
      if (local?.ghlContactId) {
        return { ghlContactId: local.ghlContactId, razonSocial: local.razonSocial, origen: 'contactoLocal', email, creado: false }
      }
    }

    // ── 2. ¿Existe en GHL aunque nuestra DB no lo tenga? ─────────────────────
    // Nuestra copia puede estar desincronizada; GHL es la autoridad. Es lectura
    // pura (contacts.readonly) y evita duplicar un contacto que ya existe.
    const locationId = await this.locationIdDe(tenantId)
    if (locationId) {
      for (const email of destinatarios) {
        const enGhl = await this.buscarContactoEnGhl(locationId, token, email)
        if (enGhl) {
          return { ghlContactId: enGhl.id, razonSocial: enGhl.nombre ?? email, origen: 'contactoGhl', email, creado: false }
        }
      }
    }

    // ── 3. Contacto de la factura ────────────────────────────────────────────
    // Antes de escribir en el CRM: si el cliente de la factura ya está
    // sincronizado, es una alternativa válida. El hilo queda en su conversación
    // en vez de la de quien pidió el correo — subóptimo, pero no escribe nada, y
    // el destinatario lo recibe igual por Cc.
    const primero = comprobantes[0]
    if (primero) {
      const delComprobante = await this.buscarContactoLocal(tenantId, primero)
      if (delComprobante?.ghlContactId) {
        return {
          ghlContactId: delComprobante.ghlContactId,
          razonSocial: delComprobante.razonSocial,
          origen: 'primerComprobante',
          email: delComprobante.email,
          creado: false,
        }
      }
    }

    // ── 4. Último recurso: crear ─────────────────────────────────────────────
    if (!locationId) {
      throw new BadRequestException(
        'El tenant no tiene un location de GoHighLevel vinculado, así que no podemos resolver el contacto del correo. ' +
          'Reconecta GoHighLevel desde Configuración.',
      )
    }
    const email = destinatarios[0]!
    const nuevo = await this.crearContactoGhl(locationId, token, email)
    this.logger.warn(
      `[GHL] Tenant ${tenantId}: se CREÓ el contacto ${nuevo} para "${email}" ` +
        `(tag "${TAG_CONTACTO_CREADO}", source "${SOURCE_CONTACTO_CREADO}") porque ningún destinatario existía como contacto.`,
    )
    return { ghlContactId: nuevo, razonSocial: email, origen: 'creado', email, creado: true }
  }

  /** Location de GHL del tenant (del onboarding). Null si no hay vínculo. */
  private async locationIdDe(tenantId: string): Promise<string | null> {
    const loc = await prisma.ghlLocation.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
    return loc?.locationId ?? null
  }

  /**
   * Busca un contacto por correo en GHL. Es LECTURA (`contacts.readonly`, que ya
   * teníamos) y corre SIEMPRE antes de crear, para no duplicar un contacto que
   * ya existe en el CRM.
   *
   * Un fallo de la búsqueda NO se traga: si GHL no puede responder, preferimos
   * fallar antes que crear un duplicado a ciegas.
   */
  private async buscarContactoEnGhl(
    locationId: string,
    token: string,
    email: string,
  ): Promise<{ id: string; nombre: string | null } | null> {
    const url = `${GHL_DUPLICADO_URL}?locationId=${encodeURIComponent(locationId)}&email=${encodeURIComponent(email)}`
    const res = await this.pedirAGhl(url, token, { method: 'GET' }, 'buscar el contacto', SCOPE_CONTACTOS_LECTURA, [404])
    // 404 = no hay duplicado. Es una respuesta válida, no un error.
    if (res.status === 404) return null

    const body = (await res.json().catch(() => ({}))) as { contact?: { id?: string; contactName?: string; name?: string } }
    const id = body.contact?.id
    if (!id) return null
    return { id, nombre: body.contact?.contactName ?? body.contact?.name ?? null }
  }

  /**
   * Crea un contacto MÍNIMO en el CRM del cliente. Es la única escritura que
   * FacturaRD hace sobre contactos y está deliberadamente limitada:
   *  - SÓLO el correo. No se inventa nombre, teléfono ni ningún dato de la persona.
   *  - Con tag y source propios, para que un admin pueda auditar y limpiar lo
   *    que creamos por dos vías distintas.
   *  - Nunca actualiza un contacto existente (por eso no se usa /contacts/upsert,
   *    que sí lo haría).
   */
  private async crearContactoGhl(locationId: string, token: string, email: string): Promise<string> {
    const res = await this.pedirAGhl(
      GHL_CONTACTS_URL,
      token,
      {
        method: 'POST',
        json: { locationId, email, tags: [TAG_CONTACTO_CREADO], source: SOURCE_CONTACTO_CREADO },
      },
      'crear el contacto en GoHighLevel',
      SCOPE_CONTACTOS_ESCRITURA,
    )
    const body = (await res.json().catch(() => ({}))) as { contact?: { id?: string } }
    const id = body.contact?.id
    if (!id) {
      throw new ServiceUnavailableException(
        'GoHighLevel aceptó la creación del contacto pero no devolvió su id. No se envió el correo; intenta de nuevo.',
      )
    }
    return id
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
    token: string,
    params: {
      ghlContactId: string
      emailTo: string
      /** Destinatarios en copia. GHL sólo admite UN `emailTo`; el resto va en Cc. */
      emailCc?: string[]
      asunto: string
      mensaje: string
      adjuntos: string[]
    },
  ): Promise<{ messageId: string | null; conversationId: string | null }> {
    const { ghlContactId, emailTo, emailCc = [], asunto, mensaje, adjuntos } = params
    const res = await this.pedirAGhl(
      GHL_MESSAGES_URL,
      token,
      {
        method: 'POST',
        json: {
          type: 'Email',
          contactId: ghlContactId,
          emailTo,
          // Sólo se manda la clave si hay copias: un array vacío es ruido que
          // algunos backends interpretan distinto a la ausencia del campo.
          ...(emailCc.length > 0 ? { emailCc } : {}),
          subject: asunto,
          html: this.htmlCuerpo(mensaje),
          message: mensaje, // texto plano de respaldo
          attachments: adjuntos,
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
    /** Permiso que hay que nombrar si GHL responde 401/403. */
    scope: string = SCOPE_MENSAJES,
    /** Códigos que NO son un error para quien llama (ej. 404 = "no existe"). */
    statusEsperados: number[] = [],
  ): Promise<Response> {
    let res: Response
    try {
      res = await this.ghlHttp.request(url, token, init)
    } catch (err) {
      // Error de red/DNS/timeout: transitorio, tiene sentido reintentar.
      const msg = err instanceof Error ? err.message : String(err)
      throw new ServiceUnavailableException(`No se pudo contactar a GoHighLevel para ${accion} (${msg}). Intenta de nuevo.`)
    }

    if (res.ok || statusEsperados.includes(res.status)) return res

    const detalle = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) {
      // El permiso se nombra POR LLAMADA: decir siempre "conversations/message.write"
      // mandaría al usuario a revisar el scope equivocado.
      throw new BadRequestException(
        `GoHighLevel rechazó la autorización al ${accion}: falta el permiso "${scope}" en tu Private Integration ` +
          '(Settings → Integrations → Private Integrations → Edit → Scopes → Update). El token actual sigue valiendo.',
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
   * Contacto local del comprador, o null si no lo tenemos.
   *
   * El comprobante guarda un SNAPSHOT del comprador (rnc/razonSocial) y sólo a
   * veces la referencia `contactoId` (es nullable y sin FK). Por eso: primero
   * por id, y si no hay, se cae al RNC del snapshot.
   *
   * Ya NO exige `ghlContactId`: que el contacto no esté sincronizado dejó de ser
   * un callejón sin salida — la cascada del ancla lo busca en GHL y, si tampoco
   * está allá, crea uno mínimo.
   */
  private async buscarContactoLocal(tenantId: string, comprobante: Comprobante): Promise<Contacto | null> {
    return comprobante.contactoId
      ? prisma.contacto.findFirst({ where: { id: comprobante.contactoId, tenantId } })
      // orderBy explícito: con varios contactos del mismo RNC, gana el más
      // antiguo — determinista y, sobre todo, el MISMO que muestra la UI
      // (ComprobantesService.conContactoEmail). Sin esto el orden lo elegía Postgres.
      : prisma.contacto.findFirst({ where: { tenantId, rnc: comprobante.rnc, activo: true }, orderBy: { createdAt: 'asc' } })
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

  private asuntoLotePorDefecto(comprobantes: Comprobante[], tenant: Tenant): string {
    if (comprobantes.length === 1) return this.asuntoPorDefecto(comprobantes[0]!, tenant)
    // "comprobantes" y no "facturas": un lote puede mezclar e-CF con notas de venta.
    return `${comprobantes.length} comprobantes de ${tenant.razonSocial}`
  }

  private mensajeLotePorDefecto(comprobantes: Comprobante[], tenant: Tenant): string {
    if (comprobantes.length === 1) return this.mensajePorDefecto(comprobantes[0]!, tenant)
    const lista = comprobantes
      .map((c) => `- ${this.referencia(c)} por RD$ ${c.montoTotal.toString()}`)
      .join('\n')
    return (
      `Hola,\n\n` +
      `Adjuntamos ${comprobantes.length} comprobantes:\n\n${lista}\n\n` +
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
