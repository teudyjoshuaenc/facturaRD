import { IsString, IsOptional, IsIn, Length, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GhlOnboardingDto {
  @ApiProperty({ example: 'abc123XYZ', description: 'Location ID de GoHighLevel' })
  @IsString()
  locationId!: string

  @ApiProperty({
    example: '132883225',
    description: 'RNC (9 díg.) o Cédula (11 díg.) del negocio (validado contra DGII)',
  })
  @IsString()
  @Length(9, 11)
  rnc!: string

  @ApiPropertyOptional({
    enum: ['RNC', 'CEDULA'],
    default: 'RNC',
    description: 'Tipo de identificación. Cédula → persona física (no reemplaza la certificación).',
  })
  @IsOptional()
  @IsIn(['RNC', 'CEDULA'])
  tipoIdentificacion?: 'RNC' | 'CEDULA'

  @ApiPropertyOptional({
    description:
      'Nombre/razón social manual. Solo se usa como respaldo cuando la DGII no puede ' +
      'validar la identificación (típico en cédulas de persona física fuera del padrón).',
  })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  razonSocial?: string

  @ApiPropertyOptional({
    example: 'MiPassphraseSegura123',
    description:
      'Passphrase del certificado P12. OPCIONAL: si se omite (junto con el archivo) el ' +
      'tenant se crea SIN certificado y no podrá emitir hasta certificarse.',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  passphrase?: string
}
