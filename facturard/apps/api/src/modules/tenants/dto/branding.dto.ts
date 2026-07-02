import { IsString, IsOptional, Matches } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

const HEX = /^#[0-9A-Fa-f]{6}$/

export class BrandingDto {
  @ApiPropertyOptional({ description: 'URL http(s) del logo (o ruta local en dev)' })
  @IsString()
  @IsOptional()
  logoUrl?: string

  @ApiPropertyOptional({ example: '#1A73E8', description: 'Color hex #RRGGBB' })
  @Matches(HEX, { message: 'colorPrimario debe ser hex #RRGGBB' })
  @IsOptional()
  colorPrimario?: string

  @ApiPropertyOptional({ example: '#E8E8E8', description: 'Color hex #RRGGBB' })
  @Matches(HEX, { message: 'colorSecundario debe ser hex #RRGGBB' })
  @IsOptional()
  colorSecundario?: string
}
