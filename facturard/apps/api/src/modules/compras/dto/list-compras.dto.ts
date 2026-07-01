import { IsOptional, IsIn, IsString, IsDateString, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ListComprasDto {
  @ApiPropertyOptional({ enum: ['E41', 'GASTO_MENOR', 'SIN_COMPROBANTE', 'RECIBIDO_ECF'] })
  @IsIn(['E41', 'GASTO_MENOR', 'SIN_COMPROBANTE', 'RECIBIDO_ECF'])
  @IsOptional()
  tipo?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  fechaDesde?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  fechaHasta?: string

  @ApiPropertyOptional({ description: 'Busca por NCF, RNC o razón social del proveedor' })
  @IsString()
  @IsOptional()
  search?: string

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
