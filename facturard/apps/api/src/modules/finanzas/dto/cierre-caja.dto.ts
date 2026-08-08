import { IsNumber, Min, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Cierre de caja del día: cuánto efectivo se contó. El "esperado" y la
// diferencia los calcula el servidor (no se toman del caller).
export class CierreCajaDto {
  @ApiPropertyOptional({ description: 'ISO date — default hoy' })
  @IsDateString()
  @IsOptional()
  fecha?: string

  @ApiPropertyOptional({ example: 15400, description: 'Monto contado >= 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoContado!: number

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notas?: string
}
