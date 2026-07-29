import { IsString, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ComparacionDto {
  @ApiProperty({ example: '2026-07', description: 'Mes a comparar, formato YYYY-MM' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'mes debe tener formato YYYY-MM' })
  mes!: string
}
