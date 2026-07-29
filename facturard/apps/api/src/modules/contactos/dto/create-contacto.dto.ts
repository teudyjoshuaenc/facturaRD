import { IsString, IsIn, IsOptional, IsEmail } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateContactoDto {
  @ApiProperty({ enum: ['CLIENTE', 'PROVEEDOR', 'CONSUMIDOR_FINAL'] })
  @IsIn(['CLIENTE', 'PROVEEDOR', 'CONSUMIDOR_FINAL'])
  tipo!: string

  @ApiPropertyOptional({ description: 'RNC/cédula. Si se envía y no es CONSUMIDOR_FINAL se valida contra la DGII.' })
  @IsString()
  @IsOptional()
  rnc?: string

  @ApiPropertyOptional({ description: 'Requerido salvo que la DGII lo autocomplete desde el RNC' })
  @IsString()
  @IsOptional()
  razonSocial?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nombreComercial?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  identificadorExtranjero?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paisExtranjero?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  direccion?: string

  @ApiPropertyOptional({ description: 'Provincia de RD donde está el contacto' })
  @IsString()
  @IsOptional()
  provincia?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  municipio?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telefono?: string

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string
}
