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
// [{id,value}] o como objeto {id: value}; soportamos ambos.
interface GhlContacto {
  id: string
  name?: string
  companyName?: string
  email?: string
  phone?: string
  customFields?: Array<{ id: string; value?: unknown }> | Record<string, unknown>
}

interface GhlPage {
  contacts?: GhlContacto[]
  meta?: { nextPageUrl?: string | null }
}

@Injectable()
export class GhlContactosService {
  private readonly logger = new Logger(GhlContactosService.name)

  constructor(
    private readonly crypto: CryptoService,
    private readonly dgii: DgiiContribuyentesService,
  ) {}

  async configurar(tenantId: string, dto: ConfigurarGhlDto): Promise<{ ok: true }> {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ghlAccessToken: this.crypto.encryptString(dto.ghlAccessToken),
        ghlRncFieldKey: dto.ghlRncFieldKey ?? null,
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

    const resultado: SyncResultado = { importados: 0, actualizados: 0, sinRnc: 0 }
    let url: string | null = `${GHL_CONTACTS_URL}?limit=100`

    while (url) {
      let page: GhlPage
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION },
        })
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
        await this.upsertContacto(tenantId, c, rncFieldKey, resultado)
      }

      url = page.meta?.nextPageUrl ?? null
    }

    this.logger.log(
      `[GHL] Sync tenant ${tenantId}: ${resultado.importados} importados, ${resultado.actualizados} actualizados, ${resultado.sinRnc} sin RNC`,
    )
    return resultado
  }

  private async upsertContacto(
    tenantId: string,
    c: GhlContacto,
    rncFieldKey: string | undefined,
    resultado: SyncResultado,
  ): Promise<void> {
    const rnc = rncFieldKey ? this.extraerRnc(c, rncFieldKey) : undefined
    if (!rnc) resultado.sinRnc += 1

    let rncValidado = false
    if (rnc) {
      try {
        await this.dgii.buscarPorRNC(rnc)
        rncValidado = true
      } catch {
        rncValidado = false
      }
    }

    const data = {
      tipo: 'CLIENTE',
      origen: 'GHL',
      razonSocial: c.companyName ?? c.name ?? '(sin nombre)',
      rncValidado,
      ...(rnc !== undefined && { rnc }),
      ...(c.email !== undefined && { email: c.email }),
      ...(c.phone !== undefined && { telefono: c.phone }),
    }

    const existing = await prisma.contacto.findFirst({ where: { tenantId, ghlContactId: c.id } })
    if (existing) {
      await prisma.contacto.update({ where: { id: existing.id }, data })
      resultado.actualizados += 1
    } else {
      await prisma.contacto.create({ data: { tenantId, ghlContactId: c.id, ...data } })
      resultado.importados += 1
    }
  }

  private extraerRnc(c: GhlContacto, key: string): string | undefined {
    const cf = c.customFields
    if (!cf) return undefined
    let raw: unknown
    if (Array.isArray(cf)) {
      raw = cf.find((f) => f.id === key)?.value
    } else {
      raw = cf[key]
    }
    const value = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw) : ''
    return value === '' ? undefined : value
  }
}
