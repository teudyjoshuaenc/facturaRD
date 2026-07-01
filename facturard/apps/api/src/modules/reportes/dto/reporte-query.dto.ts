import { IsDateString, IsIn, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ReporteQueryDto {
  @ApiProperty({ example: '2026-07-01', description: 'Desde (inclusivo, hora RD)' })
  @IsDateString()
  desde!: string

  @ApiProperty({ example: '2026-07-31', description: 'Hasta (inclusivo, hora RD)' })
  @IsDateString()
  hasta!: string

  @ApiPropertyOptional({ enum: ['json', 'txt'], default: 'json' })
  @IsIn(['json', 'txt'])
  @IsOptional()
  formato?: 'json' | 'txt'
}
