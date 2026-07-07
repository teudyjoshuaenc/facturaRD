import { IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ConfigurarGhlDto {
  @ApiPropertyOptional({
    description:
      'Private Integration Token de GHL (se guarda cifrado AES-256-GCM). Opcional al actualizar: ' +
      'si se omite y ya hay un token guardado, se conserva. Obligatorio para conectar por primera vez.',
  })
  @IsString()
  @IsOptional()
  ghlAccessToken?: string

  @ApiPropertyOptional({ description: 'Key/ID del custom field de GHL donde el cliente guarda el RNC' })
  @IsString()
  @IsOptional()
  ghlRncFieldKey?: string
}
