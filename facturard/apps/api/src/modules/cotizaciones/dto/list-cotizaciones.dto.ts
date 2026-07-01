import { IsOptional, IsIn, IsString, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

const ESTADOS = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA', 'CONVERTIDA']

export class ListCotizacionesDto {
  @ApiPropertyOptional({ enum: ESTADOS })
  @IsIn(ESTADOS)
  @IsOptional()
  estado?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactoId?: string

  @ApiPropertyOptional({ description: 'Busca por folio o notas' })
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
