import { Injectable, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common'
import { prisma } from '@facturard/database'
import { CryptoService } from '../../common/services/crypto.service'
import { GhlHttpService, GHL_BASE_URL } from '../../common/services/ghl-http.service'
import { DgiiContribuyentesService } from '../tenants/dgii-contribuyentes.service'
import type { ConfigurarGhlDto } from './dto/configurar-ghl.dto'

const GHL_CONTACTS_URL = `${GHL_BASE_URL}/contacts/`

export interface SyncResultado {
  importados: number
  actualizados: number
  sinRnc: number
}

export interface GhlContactoResumen {
  ghlContactId: string
  nombre: string
  email: string | null
  telefono: string | null
  rnc: string | null
  yaImportado: boolean
}

export interface BuscarGhlResultado {
  contactos: GhlContactoResumen[]
  nextCursor: { id: string; date: string } | null
}

// Shape parcial de un contacto de GHL (v2). customFields puede venir como arreglo
// customFields en la lista de contactos v2 llega como [{ id, value }] (keyed por
// el id del campo, NO por el nombre visible). Se toleran variantes por robustez.
interface GhlCustomFieldEntry {
  id?: string
  key?: string
  fieldKey?: string
  value?: unknown
  field_value?: unknown
}
interface GhlContacto {
  id: string
  contactName?: string | null
  firstName?: string | null
  lastName?: string | null
  firstNameRaw?: string | null
  lastNameRaw?: string | null
  name?: string | null
  companyName?: string | null
  email?: string | null
  phone?: string | null
  customFields?: GhlCustomFieldEntry[] | Record<string, unknown>
}

interface GhlPage {
  contacts?: GhlContacto[]
  meta?: { nextPageUrl?: string | null; startAfterId?: string; startAfter?: number | string }
}

// Definición de custom field (GET /locations/{id}/customFields).
interface GhlCustomFieldDef {
  id?: string
  name?: string
  fieldKey?: string
}

@Injectable()
export class GhlContactosService {
  private readonly logger = new Logger(GhlContactosService.name)

  constructor(
    private readonly crypto: CryptoService,
    private readonly dgii: DgiiContribuyentesService,
    private readonly ghlHttp: GhlHttpService,
  ) {}

  async configurar(tenantId: string, dto: ConfigurarGhlDto): Promise<{ ok: true }> {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    const nuevoToken = dto.ghlAccessToken?.trim()

    // Se puede actualizar solo el campo RNC sin re-pegar el token: si no llega un
    // token nuevo se conserva el existente. Pero para CONECTAR por primera vez el
    // token es obligatorio.
    if (!nuevoToken && !tenant.ghlAccessToken) {
      throw new BadRequestException('Falta el Private Integration Token para conectar GoHighLevel.')
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(nuevoToken ? { ghlAccessToken: this.crypto.encryptString(nuevoToken) } : {}),
        ghlRncFieldKey: dto.ghlRncFieldKey?.trim() || null,
      },
    })
    return { ok: true }
  }

  /**
   * Setup compartido: token descifrado + location vinculado + resolución de
   * los ids del custom field de RNC. Usado tanto por la sincronización (total
   * o selectiva) como por la búsqueda en vivo del modal.
   */
  private async setup(tenantId: string): Promise<{ token: string; loc: { locationId: string }; rncFieldIds: Set<string> }> {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    if (!tenant.ghlAccessToken) {
      throw new BadRequestException('GHL no está configurado. Guarda el access token con PATCH /contactos/configurar-ghl')
    }
    const token = this.crypto.decryptString(tenant.ghlAccessToken)

    // La API v2 de GHL EXIGE el locationId (?locationId=) para /contacts/.
    // Lo tomamos del vínculo GhlLocation del tenant (guardado en el onboarding),
    // no del usuario.
    const loc = await prisma.ghlLocation.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
    if (!loc) {
      throw new BadRequestException('El tenant no tiene un location de GoHighLevel vinculado.')
    }

    // El customField del RNC en el contacto viene keyed por el id del campo.
    // El tenant configura el NOMBRE visible (p.ej. "RNC / Cedula"), así que
    // resolvemos nombre → id(s) contra la API de custom fields de GHL.
    const rncFieldIds = await this.resolverRncFieldIds(loc.locationId, token, tenant.ghlRncFieldKey ?? undefined)

    return { token, loc, rncFieldIds }
  }

  /**
   * Sincroniza contactos desde GHL. Sin `ghlContactIds` → recorre TODO el
   * location (comportamiento histórico, botón "Importar todos"). Con
   * `ghlContactIds` → solo esos, uno por uno (modal de importación selectiva).
   */
  async sincronizar(tenantId: string, ghlContactIds?: string[]): Promise<SyncResultado> {
    const { token, loc, rncFieldIds } = await this.setup(tenantId)
    const resultado: SyncResultado = { importados: 0, actualizados: 0, sinRnc: 0 }

    if (ghlContactIds && ghlContactIds.length > 0) {
      await this.sincronizarSeleccionados(tenantId, ghlContactIds, token, rncFieldIds, resultado)
      this.logger.log(
        `[GHL] Sync selectivo tenant ${tenantId} (${ghlContactIds.length} ids): ${resultado.importados} importados, ` +
          `${resultado.actualizados} actualizados, ${resultado.sinRnc} sin RNC`,
      )
      return resultado
    }

    let url: string | null = `${GHL_CONTACTS_URL}?locationId=${encodeURIComponent(loc.locationId)}&limit=100`

    while (url) {
      let page: GhlPage
      try {
        const res = await this.fetchGhl(url, token)
        if (!res.ok) throw new Error(`GHL respondió ${res.status}`)
        page = (await res.json()) as GhlPage
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // No hay escrituras silenciosas: se reporta cuánto se alcanzó a procesar.
        throw new ServiceUnavailableException(
          `Error al sincronizar con GHL (${msg}). Procesados: ${resultado.importados} importados, ` +
            `${resultado.actualizados} actualizados, ${resultado.sinRnc} sin RNC.`,
        )
      }

      for (const c of page.contacts ?? []) {
        await this.upsertContacto(tenantId, c, rncFieldIds, resultado)
      }

      url = page.meta?.nextPageUrl ?? null
    }

    this.logger.log(
      `[GHL] Sync tenant ${tenantId}: ${resultado.importados} importados, ${resultado.actualizados} actualizados, ${resultado.sinRnc} sin RNC`,
    )
    return resultado
  }

  /** Trae cada contacto seleccionado por id (concurrencia acotada) y los aplica con upsertContacto. */
  private async sincronizarSeleccionados(
    tenantId: string,
    ghlContactIds: string[],
    token: string,
    rncFieldIds: Set<string>,
    resultado: SyncResultado,
  ): Promise<void> {
    const CONCURRENCIA = 10
    for (let i = 0; i < ghlContactIds.length; i += CONCURRENCIA) {
      const lote = ghlContactIds.slice(i, i + CONCURRENCIA)
      const contactos = await Promise.all(
        lote.map(async (id) => {
          try {
            const res = await this.fetchGhl(`${GHL_CONTACTS_URL}${encodeURIComponent(id)}`, token)
            if (!res.ok) throw new Error(`GHL respondió ${res.status} para el contacto ${id}`)
            const body = (await res.json()) as { contact?: GhlContacto }
            return body.contact ?? null
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new ServiceUnavailableException(
              `Error al importar contacto ${id} de GHL (${msg}). Procesados: ${resultado.importados} importados, ` +
                `${resultado.actualizados} actualizados, ${resultado.sinRnc} sin RNC.`,
            )
          }
        }),
      )
      for (const c of contactos) {
        if (c) await this.upsertContacto(tenantId, c, rncFieldIds, resultado)
      }
    }
  }

  /**
   * Búsqueda en vivo sobre GHL para el modal de importación selectiva —
   * NO escribe en la DB. `query` busca por nombre/email/teléfono (limitación
   * de la API de GHL: no indexa custom fields, así que RNC no es buscable).
   * Paginación por cursor (GHL no soporta offset/número de página).
   */
  async buscar(
    tenantId: string,
    params: { query?: string | undefined; cursorId?: string | undefined; cursorDate?: string | undefined; limit: number },
  ): Promise<BuscarGhlResultado> {
    const { token, loc, rncFieldIds } = await this.setup(tenantId)

    const qs = new URLSearchParams({ locationId: loc.locationId, limit: String(params.limit) })
    if (params.query?.trim()) qs.set('query', params.query.trim())
    if (params.cursorId) qs.set('startAfterId', params.cursorId)
    if (params.cursorDate) qs.set('startAfter', params.cursorDate)

    let page: GhlPage
    try {
      const res = await this.fetchGhl(`${GHL_CONTACTS_URL}?${qs.toString()}`, token)
      if (!res.ok) throw new Error(`GHL respondió ${res.status}`)
      page = (await res.json()) as GhlPage
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new ServiceUnavailableException(`Error al buscar contactos en GHL (${msg}).`)
    }

    const contactos = page.contacts ?? []
    const ids = contactos.map((c) => c.id)
    const yaImportados =
      ids.length > 0
        ? await prisma.contacto.findMany({ where: { tenantId, ghlContactId: { in: ids } }, select: { ghlContactId: true } })
        : []
    const importadosSet = new Set(yaImportados.map((c) => c.ghlContactId))

    return {
      contactos: contactos.map((c) => ({
        ghlContactId: c.id,
        nombre: this.nombreDeGhlContacto(c) ?? '(sin nombre)',
        email: c.email ?? null,
        telefono: c.phone ?? null,
        rnc: this.extraerRnc(c, rncFieldIds) ?? null,
        yaImportado: importadosSet.has(c.id),
      })),
      nextCursor:
        page.meta?.startAfterId && page.meta?.startAfter !== undefined
          ? { id: page.meta.startAfterId, date: String(page.meta.startAfter) }
          : null,
    }
  }

  /**
   * Llama a GHL con el token. La lógica de auth (Bearer con fallback sin Bearer
   * ante 401/403 + header Version) vive en GhlHttpService, compartida con el
   * envío de comprobantes.
   */
  private async fetchGhl(url: string, token: string): Promise<Response> {
    return this.ghlHttp.request(url, token)
  }

  /** Empresa → nombre completo (versión "Raw") → contactName → name. undefined si GHL no trae nada útil. */
  private nombreDeGhlContacto(c: GhlContacto): string | undefined {
    const nombreCompleto = [c.firstNameRaw ?? c.firstName, c.lastNameRaw ?? c.lastName]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    return c.companyName?.trim() || nombreCompleto || c.contactName?.trim() || c.name?.trim() || undefined
  }

  /**
   * REGLA DE DISEÑO: en una re-sincronización, GHL puede AGREGAR o MEJORAR datos,
   * pero NUNCA degradar ni revertir lo que el usuario editó a mano en FacturaRD.
   *  - CREATE inicial: aplica los defaults (tipo CLIENTE, origen GHL, fallback de nombre).
   *  - UPDATE de un contacto existente: solo escribe los campos que GHL trae con dato
   *    real; conserva rnc/rncValidado si GHL viene sin RNC, no pisa el nombre si GHL no
   *    trae uno útil y NO toca el tipo (respeta PROVEEDOR/CONSUMIDOR_FINAL manuales).
   */
  private async upsertContacto(
    tenantId: string,
    c: GhlContacto,
    rncFieldIds: Set<string>,
    resultado: SyncResultado,
  ): Promise<void> {
    const rnc = this.extraerRnc(c, rncFieldIds)
    if (!rnc) resultado.sinRnc += 1

    // rncValidado solo se calcula (llamada a DGII) cuando GHL trae un RNC. Refleja
    // el RNC que llega de GHL, no un vacío.
    const rncValidado = rnc !== undefined ? await this.validarRnc(rnc) : false

    // Nombre: undefined si GHL no trae nada útil (no forzamos '(sin nombre)' en el update).
    const razonSocialGhl = this.nombreDeGhlContacto(c)

    const existing = await prisma.contacto.findFirst({ where: { tenantId, ghlContactId: c.id } })

    if (!existing) {
      // CREATE inicial → defaults.
      await prisma.contacto.create({
        data: {
          tenantId,
          ghlContactId: c.id,
          tipo: 'CLIENTE',
          origen: 'GHL',
          razonSocial: razonSocialGhl ?? '(sin nombre)',
          rncValidado,
          ...(rnc !== undefined && { rnc }),
          ...(c.email ? { email: c.email } : {}),
          ...(c.phone ? { telefono: c.phone } : {}),
        },
      })
      resultado.importados += 1
      return
    }

    // UPDATE → solo agrega/mejora, nunca degrada:
    //  - rnc + rncValidado: solo si GHL trae RNC (vacío → se conservan ambos).
    //  - razonSocial: solo si GHL trae un nombre real (vacío → se conserva el manual).
    //  - email/telefono: solo si GHL los trae.
    //  - tipo/origen: NO se tocan.
    const data = {
      ...(rnc !== undefined && { rnc, rncValidado }),
      ...(razonSocialGhl !== undefined && { razonSocial: razonSocialGhl }),
      ...(c.email ? { email: c.email } : {}),
      ...(c.phone ? { telefono: c.phone } : {}),
    }
    await prisma.contacto.update({ where: { id: existing.id }, data })
    resultado.actualizados += 1
  }

  /** true si la DGII valida el RNC; false si no existe o la DGII no responde. */
  private async validarRnc(rnc: string): Promise<boolean> {
    try {
      await this.dgii.buscarPorRNC(rnc)
      return true
    } catch {
      return false
    }
  }

  private extraerRnc(c: GhlContacto, fieldIds: Set<string>): string | undefined {
    const cf = c.customFields
    if (!cf || fieldIds.size === 0) return undefined
    let raw: unknown
    if (Array.isArray(cf)) {
      // Entradas keyed por id (v2). Se toleran también key/fieldKey.
      const hit = cf.find(
        (f) => (f.id && fieldIds.has(f.id)) || (f.key && fieldIds.has(f.key)) || (f.fieldKey && fieldIds.has(f.fieldKey)),
      )
      raw = hit?.value ?? hit?.field_value
    } else {
      for (const k of fieldIds) {
        if (cf[k] != null) { raw = cf[k]; break }
      }
    }
    const value = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw) : ''
    return value === '' ? undefined : value.replace(/\D/g, '') || undefined
  }

  /**
   * Resuelve el/los identificadores del custom field del RNC. El tenant configura
   * el NOMBRE visible (p.ej. "RNC / Cedula"), pero el contacto trae customFields
   * keyed por el id del campo. Se consulta GET /locations/{id}/customFields y se
   * hace match tolerante (id, fieldKey o nombre normalizado sin acentos). Si la
   * consulta falla, se usa el valor configurado tal cual (por si ya es id/fieldKey).
   */
  private async resolverRncFieldIds(
    locationId: string,
    token: string,
    configurado: string | undefined,
  ): Promise<Set<string>> {
    const ids = new Set<string>()
    if (!configurado?.trim()) return ids
    const objetivo = normalizar(configurado)
    ids.add(configurado.trim()) // por si ya es id o fieldKey

    try {
      const res = await this.fetchGhl(
        `${GHL_BASE_URL}/locations/${encodeURIComponent(locationId)}/customFields`,
        token,
      )
      if (res.ok) {
        const body = (await res.json()) as { customFields?: GhlCustomFieldDef[] }
        for (const f of body.customFields ?? []) {
          const match =
            (f.id && f.id === configurado.trim()) ||
            (f.fieldKey && (f.fieldKey === configurado.trim() || normalizar(f.fieldKey) === objetivo)) ||
            (f.name && normalizar(f.name) === objetivo)
          if (match) {
            if (f.id) ids.add(f.id)
            if (f.fieldKey) ids.add(f.fieldKey)
          }
        }
      } else {
        this.logger.warn(`[GHL] No se pudo listar customFields (${res.status}); se usa el valor configurado tal cual`)
      }
    } catch (err) {
      this.logger.warn(`[GHL] Error resolviendo customFields del RNC: ${String(err)}`)
    }
    return ids
  }
}

// Normaliza para comparar nombres: minúsculas, sin acentos, separadores colapsados.
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s/_-]+/g, ' ')
    .trim()
}
