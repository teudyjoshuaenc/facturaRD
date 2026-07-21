import { IsOptional, IsDateString, IsIn } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class FlujoDto {
  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  desde?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  hasta?: string

  @ApiPropertyOptional({ enum: ['mes', 'semana'], default: 'mes' })
  @IsIn(['mes', 'semana'])
  @IsOptional()
  agrupacion?: 'mes' | 'semana' = 'mes'

  @ApiPropertyOptional({
    enum: ['devengado', 'cobrado'],
    default: 'devengado',
    description: 'devengado = al emitir/registrar; cobrado = flujo de caja real',
  })
  @IsIn(['devengado', 'cobrado'])
  @IsOptional()
  vista?: 'devengado' | 'cobrado' = 'devengado'
}
