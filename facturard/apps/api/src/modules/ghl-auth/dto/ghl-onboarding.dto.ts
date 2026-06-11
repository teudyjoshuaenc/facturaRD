import { IsString, Length, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class GhlOnboardingDto {
  @ApiProperty({ example: 'abc123XYZ', description: 'Location ID de GoHighLevel' })
  @IsString()
  locationId!: string

  @ApiProperty({ example: '132883225', description: 'RNC del negocio (validado contra DGII)' })
  @IsString()
  @Length(9, 11)
  rnc!: string

  @ApiProperty({ example: 'MiPassphraseSegura123', description: 'Passphrase del certificado P12 (se sube después)' })
  @IsString()
  @MinLength(4)
  passphrase!: string
}
