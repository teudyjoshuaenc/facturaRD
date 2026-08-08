import { IsNumber, Min, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Apertura de caja del día: con cuánto efectivo arranca. `monto` puede ser 0
// (día que arranca sin cambio en caja).
export class AperturaCajaDto {
  @ApiPropertyOptional({ description: 'ISO date — default hoy' })
  @IsDateString()
  @IsOptional()
  fecha?: string

  @ApiPropertyOptional({ example: 2000, description: 'Monto >= 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto!: number

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notas?: string
}
