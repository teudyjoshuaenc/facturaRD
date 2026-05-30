import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { prisma } from '@facturard/database'
import type { Webhook } from '@facturard/database'
import type { CreateWebhookDto } from './dto/create-webhook.dto'

// Tipo de retorno que puede incluir secretoHMAC para GHL_ENTRADA
export type WebhookPublico = Omit<Webhook, 'secretoHMAC'> & {
  secretoHMAC?: string          // sólo para GHL_ENTRADA
  urlReceiverGHL?: string       // sólo para GHL_ENTRADA
}

@Injectable()
export class WebhooksService {
  constructor(private readonly config: ConfigService) {}

  // ── Crear webhook (SALIENTE o GHL_ENTRADA) ──────────────────────────────────
  async create(tenantId: string, dto: CreateWebhookDto): Promise<WebhookPublico> {
    const secretoHMAC = crypto.randomBytes(32).toString('hex')
    const webhook = await prisma.webhook.create({
      data: {
        tenantId,
        url: dto.url,
        secretoHMAC,
        eventos: dto.eventos,
        tipo: dto.tipo ?? 'SALIENTE',
        nombre: dto.nombre ?? null,
      },
    })
    // Nunca devolvemos el secreto de webhooks SALIENTES
    const { secretoHMAC: _s, ...rest } = webhook
    return rest
  }

  // ── Listar webhooks del tenant ──────────────────────────────────────────────
  async findAll(tenantId: string): Promise<WebhookPublico[]> {
    const hooks = await prisma.webhook.findMany({ where: { tenantId, activo: true } })
    const appUrl = this.appUrl()

    return hooks.map((hook): WebhookPublico => {
      if (hook.tipo === 'GHL_ENTRADA') {
        // Para GHL_ENTRADA exponemos secreto y URL receiver (el usuario los necesita para configurar GHL)
        return {
          ...hook,
          secretoHMAC: hook.secretoHMAC,
          urlReceiverGHL: `${appUrl}/api/v1/webhooks/ghl/${tenantId}`,
        }
      }
      // Webhooks salientes: nunca exponemos el secreto
      const { secretoHMAC: _s, ...rest } = hook
      return rest
    })
  }

  // ── Eliminar (desactivar) webhook ───────────────────────────────────────────
  async remove(tenantId: string, id: string): Promise<void> {
    const hook = await prisma.webhook.findFirst({ where: { id, tenantId } })
    if (!hook) throw new NotFoundException(`Webhook ${id} no encontrado`)
    await prisma.webhook.update({ where: { id }, data: { activo: false } })
  }

  // ── Configurar / renovar webhook receiver de GHL ───────────────────────────
  async configurarGHL(tenantId: string): Promise<{
    urlReceiver: string
    secretoHMAC: string
    webhookId: string
    mensaje: string
  }> {
    const appUrl = this.appUrl()
    const urlReceiver = `${appUrl}/api/v1/webhooks/ghl/${tenantId}`
    const secretoHMAC = crypto.randomBytes(32).toString('hex')

    // Si ya existe uno, regeneramos su secreto y lo reactivamos
    const existente = await prisma.webhook.findFirst({
      where: { tenantId, tipo: 'GHL_ENTRADA' },
    })

    if (existente) {
      const actualizado = await prisma.webhook.update({
        where: { id: existente.id },
        data: { activo: true, secretoHMAC },
      })

      await prisma.auditLog.create({
        data: {
          tenantId,
          accion: 'GHL_WEBHOOK_CONFIGURADO',
          entidad: 'webhook',
          entidadId: existente.id,
          detalle: { accion: 'secreto_renovado', urlReceiver },
        },
      })

      return {
        urlReceiver,
        secretoHMAC,
        webhookId: actualizado.id,
        mensaje: 'Webhook GHL actualizado con nuevo secreto HMAC. Actualiza el secreto en GoHighLevel.',
      }
    }

    // Crear nuevo webhook GHL_ENTRADA
    const nuevo = await prisma.webhook.create({
      data: {
        tenantId,
        url: urlReceiver, // URL del receiver (campo requerido, no se usa para entrantes)
        secretoHMAC,
        eventos: ['comprobante.creado'], // informativo para GHL_ENTRADA
        tipo: 'GHL_ENTRADA',
        nombre: 'GoHighLevel Receiver',
      },
    })

    await prisma.auditLog.create({
      data: {
        tenantId,
        accion: 'GHL_WEBHOOK_CONFIGURADO',
        entidad: 'webhook',
        entidadId: nuevo.id,
        detalle: { accion: 'creado', urlReceiver },
      },
    })

    return {
      urlReceiver,
      secretoHMAC,
      webhookId: nuevo.id,
      mensaje:
        '✅ Webhook GHL configurado. Copia la urlReceiver y el secretoHMAC en la configuración de GoHighLevel.',
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000'
  }
}
