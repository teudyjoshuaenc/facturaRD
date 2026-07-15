import { IsOptional, IsIn, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ListContactosDto {
  @ApiPropertyOptional({ enum: ['CLIENTE', 'PROVEEDOR', 'CONSUMIDOR_FINAL'] })
  @IsIn(['CLIENTE', 'PROVEEDOR', 'CONSUMIDOR_FINAL'])
  @IsOptional()
  tipo?: string

  @ApiPropertyOptional({ description: 'Busca por razón social, RNC o email' })
  @IsString()
  @IsOptional()
  search?: string

  @ApiPropertyOptional({ enum: ['MANUAL', 'GHL'] })
  @IsIn(['MANUAL', 'GHL'])
  @IsOptional()
  origen?: string

  @ApiPropertyOptional({ description: 'Filtro de 3 estados: omitir → todos; true → sólo activos; false → sólo inactivos.' })
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  @IsOptional()
  activo?: boolean

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
