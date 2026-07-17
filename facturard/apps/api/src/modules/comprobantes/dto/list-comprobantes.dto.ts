import { IsOptional, IsEnum, IsDateString, IsNumber, IsString, IsIn, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { ComprobanteEstado, TipoECF } from '@facturard/database'

export class ListComprobantesDto {
  @ApiPropertyOptional({ enum: ComprobanteEstado })
  @IsEnum(ComprobanteEstado)
  @IsOptional()
  estado?: ComprobanteEstado

  @ApiPropertyOptional({
    enum: ['fiscal', 'borrador', 'nota'],
    description: 'Clase de documento: fiscal (e-CF emitido/en proceso), borrador (DRAFT fiscal), nota (Nota de venta interna).',
  })
  @IsIn(['fiscal', 'borrador', 'nota'])
  @IsOptional()
  clase?: 'fiscal' | 'borrador' | 'nota'

  @ApiPropertyOptional({ enum: TipoECF })
  @IsEnum(TipoECF)
  @IsOptional()
  tipoECF?: TipoECF

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  fechaDesde?: string

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  fechaHasta?: string

  @ApiPropertyOptional({ example: 'E310000000001', description: 'Busca por eNCF o razón social del comprador' })
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
