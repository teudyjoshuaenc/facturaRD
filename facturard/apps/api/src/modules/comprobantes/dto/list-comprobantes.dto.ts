import { IsOptional, IsEnum, IsDateString, IsNumber, IsString, IsIn, Min, Max } from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { ComprobanteEstado, TipoECF } from '@facturard/database'

export class ListComprobantesDto {
  /**
   * Uno o VARIOS estados separados por coma. El agrupado "En proceso" de la UI
   * es `PENDIENTE,EN_COLA,ENVIANDO` — se filtra en el servidor para que la
   * paginación sea correcta (antes se filtraba en el cliente sobre la página
   * traída y con >100 comprobantes devolvía resultados incompletos en silencio).
   * Un solo valor (`?estado=ACEPTADO`) sigue funcionando igual.
   */
  @ApiPropertyOptional({
    enum: ComprobanteEstado,
    isArray: true,
    description: 'Uno o varios estados separados por coma (ej. PENDIENTE,EN_COLA,ENVIANDO)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((v) => v.trim()).filter((v) => v !== '')
      : value,
  )
  @IsEnum(ComprobanteEstado, { each: true })
  estado?: ComprobanteEstado[]

  @ApiPropertyOptional({
    enum: ['cotizacion'],
    description: 'Procedencia del documento. `cotizacion` = comprobantes convertidos desde una cotización.',
  })
  @IsIn(['cotizacion'])
  @IsOptional()
  origen?: 'cotizacion'

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
