import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateComprobanteDto } from './create-comprobante.dto'

/**
 * Edición de un comprobante en estado DRAFT. Todos los campos son opcionales;
 * si se envían `items`, los totales se recalculan con la misma función que la
 * emisión directa. `emitir` no aplica aquí (se emite vía POST /:id/emitir).
 */
export class UpdateComprobanteDto extends PartialType(
  OmitType(CreateComprobanteDto, ['emitir'] as const),
) {}
