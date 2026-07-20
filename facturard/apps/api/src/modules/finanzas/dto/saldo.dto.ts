import { IsOptional, IsUUID } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Saldo pendiente de un documento. Exactamente uno de los dos (validado en el
// servicio → 400 si faltan/sobran).
export class SaldoDto {
  @ApiPropertyOptional({ description: 'Factura (comprobante) a consultar' })
  @IsUUID()
  @IsOptional()
  comprobanteId?: string

  @ApiPropertyOptional({ description: 'Compra a consultar' })
  @IsUUID()
  @IsOptional()
  compraId?: string
}
