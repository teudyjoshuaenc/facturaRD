import { IsOptional, IsDateString, IsIn, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

const ORIGENES = ['FACTURA', 'NOTA_VENTA', 'NOTA_CREDITO', 'COMPRA', 'MOVIMIENTO', 'COBRO', 'PAGO'] as const

// Feed unificado de transacciones (facturas, compras, notas, movimientos, pagos).
export class ListTransaccionesDto {
  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  desde?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  hasta?: string

  @ApiPropertyOptional({ enum: ['INGRESO', 'EGRESO'] })
  @IsIn(['INGRESO', 'EGRESO'])
  @IsOptional()
  tipo?: 'INGRESO' | 'EGRESO'

  @ApiPropertyOptional({ enum: ORIGENES })
  @IsIn(ORIGENES as unknown as string[])
  @IsOptional()
  origen?: (typeof ORIGENES)[number]

  @ApiPropertyOptional({ enum: ['devengado', 'cobrado'], default: 'devengado' })
  @IsIn(['devengado', 'cobrado'])
  @IsOptional()
  vista?: 'devengado' | 'cobrado' = 'devengado'

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1

  // Límite alto permitido para exportación (Excel/CSV) del período completo.
  @ApiPropertyOptional({ default: 15 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  @IsOptional()
  limit?: number = 15
}
