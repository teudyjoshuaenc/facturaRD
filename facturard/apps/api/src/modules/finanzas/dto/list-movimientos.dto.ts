import { IsOptional, IsEnum, IsDateString, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { MovimientoTipo, MovimientoCategoria } from '@facturard/database'

export class ListMovimientosDto {
  @ApiPropertyOptional({ enum: MovimientoTipo })
  @IsEnum(MovimientoTipo)
  @IsOptional()
  tipo?: MovimientoTipo

  @ApiPropertyOptional({ enum: MovimientoCategoria })
  @IsEnum(MovimientoCategoria)
  @IsOptional()
  categoria?: MovimientoCategoria

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  desde?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  hasta?: string

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20
}
