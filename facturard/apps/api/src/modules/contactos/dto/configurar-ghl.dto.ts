import { IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ConfigurarGhlDto {
  @ApiProperty({ description: 'Access token de GHL (se guarda cifrado AES-256-GCM)' })
  @IsString()
  ghlAccessToken!: string

  @ApiPropertyOptional({ description: 'Key/ID del custom field de GHL donde el cliente guarda el RNC' })
  @IsString()
  @IsOptional()
  ghlRncFieldKey?: string
}
