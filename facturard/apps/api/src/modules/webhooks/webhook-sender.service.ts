import { Injectable, Logger } from '@nestjs/common'
import * as crypto from 'crypto'
import { prisma } from '@facturard/database'
import type { Webhook } from '@facturard/database'

// ─── Eventos disponibles ──────────────────────────────────────────────────────

export const WEBHOOK_EVENTOS = {
  COMPROBANTE_ACEPTADO: 'comprobante.aceptado',
  COMPROBANTE_RECHAZADO: 'comprobante.rechazado',
  COMPROBANTE_ERROR: 'comprobante.error',
} as const

export type WebhookEvento = (typeof WEBHOOK_EVENTOS)[keyof typeof WEBHOOK_EVENTOS]

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WebhookSenderService {
  private readonly logger = new Logger(WebhookSenderService.name)

  private static readonly MAX_INTENTOS = 3
  private static readonly TIMEOUT_MS = 10_000

  /**
   * Busca todos los webhooks SALIENTES activos del tenant que tengan el evento
   * registrado y los dispara en paralelo (con reintentos y backoff exponencial).
   */
  async enviarWebhook(tenantId: string, evento: string, payload: object): Promise<void> {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId, tipo: 'SALIENTE', activo: true },
    })

    const relevantes = webhooks.filter((w) => w.eventos.includes(evento))

    if (relevantes.length === 0) {
      this.logger.debug(
        `[Sender] Sin webhooks para evento="${evento}" en tenant ${tenantId}`,
      )
      return
    }

    this.logger.log(
      `[Sender] Disparando ${relevantes.length} webhook(s) para evento="${evento}" (tenant ${tenantId})`,
    )

    // Disparamos todos en paralelo — cada uno maneja sus propios reintentos
    await Promise.allSettled(
      relevantes.map((webhook) =>
        this.enviarConRetry(webhook, evento, payload, tenantId),
      ),
    )
  }

  // ─── Privado ────────────────────────────────────────────────────────────────

  private async enviarConRetry(
    webhook: Webhook,
    evento: string,
    payload: object,
    tenantId: string,
  ): Promise<void> {
    const envolvente = {
      evento,
      timestamp: new Date().toISOString(),
      data: payload,
    }
    const body = JSON.stringify(envolvente)

    const firma = crypto
      .createHmac('sha256', webhook.secretoHMAC)
      .update(body)
      .digest('hex')

    let exito = false
    let ultimoError = ''

    for (let intento = 1; intento <= WebhookSenderService.MAX_INTENTOS; intento++) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(
          () => controller.abort(),
          WebhookSenderService.TIMEOUT_MS,
        )

        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FacturaRD-Signature': `sha256=${firma}`,
            'X-FacturaRD-Event': evento,
          },
          body,
          signal: controller.signal,
        })

        clearTimeout(timer)

        if (res.ok) {
          exito = true
          this.logger.log(
            `[Sender] ✓ Webhook ${webhook.id} OK — evento="${evento}", status=${res.status}`,
          )
          break
        }

        ultimoError = `HTTP ${res.status} ${res.statusText}`
        this.logger.warn(
          `[Sender] Webhook ${webhook.id} — ${ultimoError} (intento ${intento}/${WebhookSenderService.MAX_INTENTOS})`,
        )
      } catch (err) {
        ultimoError =
          err instanceof Error
            ? err.name === 'AbortError'
              ? `Timeout (>${WebhookSenderService.TIMEOUT_MS}ms)`
              : err.message
            : String(err)

        this.logger.warn(
          `[Sender] Webhook ${webhook.id} — Error: ${ultimoError} (intento ${intento}/${WebhookSenderService.MAX_INTENTOS})`,
        )
      }

      // Backoff exponencial: 1s → 2s → 4s antes de cada reintento
      if (intento < WebhookSenderService.MAX_INTENTOS) {
        const delay = 1000 * Math.pow(2, intento - 1)
        await new Promise((r) => setTimeout(r, delay))
      }
    }

    // ── Registrar resultado en audit_log ──────────────────────────────────────
    await prisma.auditLog
      .create({
        data: {
          tenantId,
          accion: exito ? 'WEBHOOK_SALIENTE_OK' : 'WEBHOOK_SALIENTE_ERROR',
          entidad: 'webhook',
          entidadId: webhook.id,
          detalle: {
            evento,
            url: webhook.url,
            exito,
            ...(exito ? {} : { error: ultimoError }),
          },
        },
      })
      .catch((e) =>
        this.logger.warn(`[Sender] Audit log fallido: ${String(e)}`),
      )

    if (!exito) {
      this.logger.error(
        `[Sender] ✗ Webhook ${webhook.id} falló tras ${WebhookSenderService.MAX_INTENTOS} intentos — ${ultimoError}`,
      )
    }
  }
}
