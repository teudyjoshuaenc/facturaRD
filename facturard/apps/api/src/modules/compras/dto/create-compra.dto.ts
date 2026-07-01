import { IsString, IsIn, IsOptional, IsNumber, IsDateString, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Registro manual de compra. RECIBIDO_ECF no se crea por aquí (llega por el
// bridge del receptor /fe/recepcion).
export class CreateCompraDto {
  @ApiProperty({ enum: ['E41', 'GASTO_MENOR', 'SIN_COMPROBANTE'] })
  @IsIn(['E41', 'GASTO_MENOR', 'SIN_COMPROBANTE'])
  tipo!: string

  @ApiPropertyOptional({ description: 'Proveedor por Contacto (tipo PROVEEDOR). Copia RNC/razón social.' })
  @IsString()
  @IsOptional()
  contactoId?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rncProveedor?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  razonSocialProveedor?: string

  @ApiPropertyOptional({ description: 'NCF/e-NCF del proveedor' })
  @IsString()
  @IsOptional()
  ncf?: string

  @ApiPropertyOptional({ description: 'Fecha del comprobante (ISO)' })
  @IsDateString()
  @IsOptional()
  fechaComprobante?: string

  @ApiProperty({ example: 1000, description: 'Base imponible' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal!: number

  @ApiPropertyOptional({ default: 0, description: 'ITBIS facturado' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  itbis?: number

  @ApiPropertyOptional({ default: 0, description: 'ITBIS retenido (compras a personas físicas)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  itbisRetenido?: number
}
