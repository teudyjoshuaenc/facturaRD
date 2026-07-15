import { Injectable, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common'
import { prisma } from '@facturard/database'
import { CryptoService } from '../../common/services/crypto.service'
import { DgiiContribuyentesService } from '../tenants/dgii-contribuyentes.service'
import type { ConfigurarGhlDto } from './dto/configurar-ghl.dto'

const GHL_CONTACTS_URL = 'https://services.leadconnectorhq.com/contacts/'
const GHL_VERSION = '2021-07-28'

export interface SyncResultado {
  importados: number
  actualizados: number
  sinRnc: number
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
  meta?: { nextPageUrl?: string | null }
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

  async sincronizar(tenantId: string): Promise<SyncResultado> {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    if (!tenant.ghlAccessToken) {
      throw new BadRequestException('GHL no está configurado. Guarda el access token con PATCH /contactos/configurar-ghl')
    }
    const token = this.crypto.decryptString(tenant.ghlAccessToken)
    const rncFieldKey = tenant.ghlRncFieldKey ?? undefined

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
    const rncFieldIds = await this.resolverRncFieldIds(loc.locationId, token, rncFieldKey)

    const resultado: SyncResultado = { importados: 0, actualizados: 0, sinRnc: 0 }
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

  /**
   * Llama a GHL con el token. Los Private Integration Tokens se documentan tanto
   * con 'Authorization: Bearer <token>' como con 'Authorization: <token>'; se
   * intenta Bearer y, si devuelve 401/403, se reintenta sin 'Bearer'.
   */
  private async fetchGhl(url: string, token: string): Promise<Response> {
    const headers = (auth: string): Record<string, string> => ({ Authorization: auth, Version: GHL_VERSION })
    let res = await fetch(url, { headers: headers(`Bearer ${token}`) })
    if (res.status === 401 || res.status === 403) {
      res = await fetch(url, { headers: headers(token) })
    }
    return res
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

    // Nombre: empresa → nombre completo (versión "Raw" con mayúsculas) → contactName.
    // undefined si GHL no trae nada útil (no forzamos '(sin nombre)' en el update).
    const nombreCompleto = [c.firstNameRaw ?? c.firstName, c.lastNameRaw ?? c.lastName]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    const razonSocialGhl =
      c.companyName?.trim() || nombreCompleto || c.contactName?.trim() || c.name?.trim() || undefined

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
        `https://services.leadconnectorhq.com/locations/${encodeURIComponent(locationId)}/customFields`,
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
