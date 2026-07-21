import { IsOptional, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Rango de fechas para resumen / categorías. Ambos opcionales (sin rango = todo).
export class RangoDto {
  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  desde?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  hasta?: string
}
