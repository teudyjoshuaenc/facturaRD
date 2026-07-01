import { IsOptional, IsIn, IsString, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
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
