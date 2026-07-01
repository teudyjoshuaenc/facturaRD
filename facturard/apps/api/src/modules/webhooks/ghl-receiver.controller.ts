import {
  Controller,
  Post,
  Param,
  Req,
  Inject,
  forwardRef,
  UnauthorizedException,
  BadRequestException,
  Logger,
  HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import * as crypto from 'crypto'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { prisma } from '@facturard/database'
import { TipoECF } from '@facturard/database'
import { ComprobantesService } from '../comprobantes/comprobantes.service'
import type { CreateComprobanteDto } from '../comprobantes/dto/create-comprobante.dto'

// ─── Tipos del payload de GHL ────────────────────────────────────────────────

interface GhlCustomFields {
  rnc?: string
  direccion?: string
  [key: string]: string | undefined
}

interface GhlWebhookBody {
  contact?: {
    id?: string
    name?: string
    email?: string
    customFields?: GhlCustomFields
  }
  opportunity?: {
    monetaryValue?: number
    name?: string
  }
  pipeline?: { name?: string }
}

// ─── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Webhooks')
@Controller('webhooks/ghl')
export class GhlReceiverController {
  private readonly logger = new Logger(GhlReceiverController.name)

  constructor(
    @Inject(forwardRef(() => ComprobantesService))
    private readonly comprobantesService: ComprobantesService,
  ) {}

  /**
   * POST /api/v1/webhooks/ghl/:tenantId
   *
   * Endpoint PÚBLICO — no requiere JWT.
   * Cada tenant tiene su propio endpoint identificado por su tenantId.
   *
   * GHL firma el body con HMAC-SHA256 y lo envía en el header X-GHL-Signature.
   * Nosotros validamos esa firma contra el secreto guardado en la DB.
   */
  @Post(':tenantId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receptor público de webhooks de GoHighLevel',
    description:
      'GHL envía este webhook cuando se cierra una venta. ' +
      'Valida la firma HMAC y crea un comprobante automáticamente.',
  })
  async receive(
    @Param('tenantId') tenantId: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: boolean; mensaje: string; eNCF?: string }> {
    // ── 1. Buscar webhook GHL_ENTRADA activo del tenant ──────────────────────
    const webhook = await prisma.webhook.findFirst({
      where: { tenantId, tipo: 'GHL_ENTRADA', activo: true },
    })
    if (!webhook) {
      this.logger.warn(`[GHL] Webhook no configurado para tenant ${tenantId}`)
      throw new UnauthorizedException('No hay webhook GHL configurado para este tenant')
    }

    // ── 2. Obtener body crudo para validar HMAC ───────────────────────────────
    const rawBody = req.rawBody
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Cuerpo de la petición vacío')
    }

    // ── 3. Validar firma HMAC-SHA256 ──────────────────────────────────────────
    const signatureHeader = (req.headers['x-ghl-signature'] as string | undefined) ?? ''
    if (!signatureHeader) {
      throw new UnauthorizedException('Header X-GHL-Signature no encontrado')
    }

    const expectedHmac = crypto
      .createHmac('sha256', webhook.secretoHMAC)
      .update(rawBody)
      .digest('hex')

    // Comparación en tiempo constante — evita timing attacks
    let signaturesMatch = false
    try {
      signaturesMatch = crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'hex'),
        Buffer.from(expectedHmac, 'hex'),
      )
    } catch {
      // timingSafeEqual lanza si los buffers tienen distinta longitud
      signaturesMatch = false
    }

    if (!signaturesMatch) {
      this.logger.warn(`[GHL] Firma HMAC inválida para tenant ${tenantId}`)
      throw new UnauthorizedException('Firma HMAC inválida')
    }

    // ── 4. Parsear body JSON ──────────────────────────────────────────────────
    let body: GhlWebhookBody
    try {
      body = JSON.parse(rawBody.toString('utf8')) as GhlWebhookBody
    } catch {
      throw new BadRequestException('El body no es JSON válido')
    }

    // ── 5. Verificar plan activo del tenant ───────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planActivo: true, trialEndsAt: true, estado: true },
    })

    if (!tenant || tenant.estado !== 'ACTIVO') {
      this.logger.warn(`[GHL] Tenant ${tenantId} suspendido/cancelado`)
      return { ok: false, mensaje: 'Cuenta suspendida o cancelada' }
    }
    if (tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
      this.logger.warn(`[GHL] Tenant ${tenantId} — trial vencido`)
      return { ok: false, mensaje: 'Período de prueba vencido' }
    }
    if (!tenant.planActivo) {
      return { ok: false, mensaje: 'Plan inactivo' }
    }

    // ── 6. Mapear datos de GHL → CreateComprobanteDto ─────────────────────────
    const hoy = new Date()
    const dd = String(hoy.getDate()).padStart(2, '0')
    const mm = String(hoy.getMonth() + 1).padStart(2, '0')
    const yyyy = hoy.getFullYear()
    const fechaEmision = `${dd}-${mm}-${yyyy}`

    // exactOptionalPropertyTypes: los campos opcionales sólo se incluyen si tienen valor
    const dto: CreateComprobanteDto = {
      tipoECF: TipoECF.E31,
      tipoPago: 1,        // contado por defecto
      tipoIngresos: '01', // ingresos por operaciones (servicios)
      fechaEmision,
      razonSocialComprador: body.contact?.name ?? 'Consumidor Final',
      ...(body.contact?.customFields?.rnc !== undefined
        ? { rncComprador: body.contact.customFields.rnc }
        : {}),
      ...(body.contact?.customFields?.direccion !== undefined
        ? { direccionComprador: body.contact.customFields.direccion }
        : {}),
      items: [
        {
          numeroLinea: 1,
          indicadorFacturacion: 'I1', // gravado 18% ITBIS
          nombreItem: body.opportunity?.name ?? 'Servicio',
          indicadorBienoServicio: 2,   // servicio
          cantidad: 1,
          precioUnitarioItem: body.opportunity?.monetaryValue ?? 0,
        },
      ],
    }

    // ── 7. Crear comprobante → BullMQ → worker → DGII ────────────────────────
    try {
      const comprobante = await this.comprobantesService.crear(tenantId, dto)
      this.logger.log(
        `[GHL] Comprobante ${comprobante.eNCF} creado para tenant ${tenantId} ` +
        `(contacto: ${body.contact?.name ?? '?'}, monto: ${body.opportunity?.monetaryValue ?? 0})`,
      )

      // ── 8. Audit log ──────────────────────────────────────────────────────────
      await prisma.auditLog
        .create({
          data: {
            tenantId,
            accion: 'GHL_WEBHOOK_RECIBIDO',
            entidad: 'comprobante',
            entidadId: comprobante.id,
            detalle: {
              ghlContactId: body.contact?.id,
              contactName: body.contact?.name,
              opportunityName: body.opportunity?.name,
              monetaryValue: body.opportunity?.monetaryValue,
              eNCF: comprobante.eNCF,
            },
          },
        })
        .catch((err) => this.logger.warn(`[GHL] Audit log fallido: ${String(err)}`))

      return {
        ok: true,
        mensaje: `Comprobante ${comprobante.eNCF} en proceso de emisión`,
        eNCF: comprobante.eNCF ?? '',
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`[GHL] Error creando comprobante para tenant ${tenantId}: ${msg}`)
      throw new BadRequestException(`Error al procesar el webhook: ${msg}`)
    }
  }
}
