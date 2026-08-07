import { IsOptional, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class GetCajaDto {
  @ApiPropertyOptional({ description: 'ISO date — default hoy' })
  @IsDateString()
  @IsOptional()
  fecha?: string
}
