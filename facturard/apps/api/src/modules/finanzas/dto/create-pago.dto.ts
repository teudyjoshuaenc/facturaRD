import { IsEnum, IsNumber, IsPositive, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PagoTipo } from '@facturard/database'

// Cobro (sobre una factura) o pago (sobre una compra). Soporta pagos parciales.
// Registrar un Pago NO modifica el estado DGII ni el comprobante/compra.
export class CreatePagoDto {
  @ApiProperty({ enum: PagoTipo, description: 'COBRO (factura) | PAGO (compra)' })
  @IsEnum(PagoTipo)
  tipo!: PagoTipo

  @ApiPropertyOptional({ description: 'Requerido si tipo=COBRO' })
  @IsUUID()
  @IsOptional()
  comprobanteId?: string

  @ApiPropertyOptional({ description: 'Requerido si tipo=PAGO' })
  @IsUUID()
  @IsOptional()
  compraId?: string

  @ApiProperty({ example: 500, description: 'Monto positivo (abono)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number

  @ApiPropertyOptional({ default: 'DOP', description: 'Sólo DOP por ahora' })
  @IsString()
  @IsOptional()
  moneda?: string

  @ApiProperty({ description: 'Fecha del cobro/pago (ISO)' })
  @IsDateString()
  fecha!: string

  @ApiPropertyOptional({ description: 'efectivo, transferencia, cheque…' })
  @IsString()
  @IsOptional()
  metodoPago?: string
}
