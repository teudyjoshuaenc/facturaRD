import { IsEnum, IsNumber, IsPositive, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MovimientoTipo, MovimientoCategoria } from '@facturard/database'

// Movimiento manual de caja (nómina, alquiler, aporte de capital, impuestos…).
export class CreateMovimientoDto {
  @ApiProperty({ enum: MovimientoTipo })
  @IsEnum(MovimientoTipo)
  tipo!: MovimientoTipo

  @ApiProperty({ enum: MovimientoCategoria })
  @IsEnum(MovimientoCategoria)
  categoria!: MovimientoCategoria

  @ApiProperty({ example: 15000, description: 'Monto positivo' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number

  @ApiPropertyOptional({ default: 'DOP', description: 'Sólo DOP por ahora' })
  @IsString()
  @IsOptional()
  moneda?: string

  @ApiProperty({ description: 'Fecha del movimiento (ISO)' })
  @IsDateString()
  fecha!: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string

  @ApiPropertyOptional({ description: 'efectivo, transferencia, cheque…' })
  @IsString()
  @IsOptional()
  metodoPago?: string
}
