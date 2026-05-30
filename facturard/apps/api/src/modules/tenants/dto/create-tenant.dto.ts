import { IsString, IsOptional, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateTenantDto {
  @ApiProperty({ example: '101234567' })
  @IsString()
  @Length(9, 11)
  rnc!: string

  @ApiProperty({ example: 'Mi Empresa SRL' })
  @IsString()
  razonSocial!: string

  @ApiPropertyOptional({ example: 'Mi Empresa' })
  @IsString()
  @IsOptional()
  nombreComercial?: string
}
