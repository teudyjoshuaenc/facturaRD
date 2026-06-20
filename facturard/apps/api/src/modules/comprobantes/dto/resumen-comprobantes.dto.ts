import { IsOptional, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ResumenComprobantesDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  fechaDesde?: string

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  fechaHasta?: string
}
