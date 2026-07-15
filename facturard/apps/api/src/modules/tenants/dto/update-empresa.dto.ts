import { IsString, IsOptional, IsEmail, Length, Matches, MaxLength, ValidateIf } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Datos del emisor editables por el usuario en el tab Empresa. RNC y razón social
 * NO se incluyen: vienen del padrón DGII y deben coincidir exacto con el certificado
 * (si se editaran, los e-CF se rechazarían). El logoUrl es una URL http(s) pública
 * (no hay almacenamiento de archivos hoy; ver CLAUDE.md).
 */
export class UpdateEmpresaDto {
  @ApiPropertyOptional({ description: 'Dirección fiscal del emisor (aparece en el PDF)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string

  @ApiPropertyOptional({ description: 'Teléfono de contacto del emisor' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  telefono?: string

  @ApiPropertyOptional({ description: 'Correo del emisor (aparece en el PDF). Cadena vacía lo borra.' })
  @IsOptional()
  @ValidateIf((o) => o.email !== '')
  @IsEmail({}, { message: 'email debe ser un correo válido' })
  @MaxLength(120)
  email?: string

  @ApiPropertyOptional({ description: 'URL http(s) pública del logo (se renderiza en el PDF). Cadena vacía lo borra.' })
  @IsOptional()
  @ValidateIf((o) => o.logoUrl !== '')
  @IsString()
  @Matches(/^https?:\/\/.+/i, { message: 'logoUrl debe ser una URL http(s) válida' })
  @MaxLength(500)
  logoUrl?: string
}
