import { IsIn, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { ResumenComprobantesDto } from './resumen-comprobantes.dto'

export class VentasPorProvinciaDto extends ResumenComprobantesDto {
  @ApiPropertyOptional({ enum: ['fiscal', 'nota', 'todas'], default: 'fiscal' })
  @IsIn(['fiscal', 'nota', 'todas'])
  @IsOptional()
  clase?: 'fiscal' | 'nota' | 'todas'
}
