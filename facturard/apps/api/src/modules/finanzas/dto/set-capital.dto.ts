import { IsNumber, Min, IsOptional, IsString, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Saldo de partida del negocio (uno por tenant). Punto de arranque del capital
// acumulado. Se permite 0 (negocio que arranca sin capital).
export class SetCapitalDto {
  @ApiProperty({ example: 100000, description: 'Monto >= 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto!: number

  @ApiPropertyOptional({ default: 'DOP', description: 'Sólo DOP por ahora' })
  @IsString()
  @IsOptional()
  moneda?: string

  @ApiProperty({ description: 'Fecha de partida (ISO)' })
  @IsDateString()
  fecha!: string
}
