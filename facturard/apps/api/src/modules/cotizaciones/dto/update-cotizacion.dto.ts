import { PartialType } from '@nestjs/swagger'
import { CreateCotizacionDto } from './create-cotizacion.dto'

// Edición de cotización. Todos los campos opcionales; si llegan `items` se
// reemplazan y se recalculan los totales. Bloqueada si estado = CONVERTIDA.
export class UpdateCotizacionDto extends PartialType(CreateCotizacionDto) {}
