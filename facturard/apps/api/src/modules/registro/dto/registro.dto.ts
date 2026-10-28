import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TipoECF } from '@facturard/database'

const SOLO_DIGITOS_RNC = /^(\d{9}|\d{11})$/
const CODIGO_GEO = /^\d{6}$/
const TELEFONO = /^[\d\s()+-]{7,20}$/
const CODIGO_2FA = /^\d{6}$/

export const TIPOS_REGISTRO = ['EMISOR_ELECTRONICO', 'PROVEEDOR_SERVICIOS'] as const

export class IniciarRegistroDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(150)
  email!: string
}

export class LoginRegistroDto {
  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty({ description: 'Código de 6 dígitos de Google Authenticator' })
  @IsString()
  @Matches(CODIGO_2FA, { message: 'El código debe tener 6 dígitos' })
  codigo!: string
}

export class CodigoDosPasosDto {
  @ApiProperty({ description: 'Código de 6 dígitos de Google Authenticator' })
  @IsString()
  @Matches(CODIGO_2FA, { message: 'El código debe tener 6 dígitos' })
  codigo!: string
}

class UbicacionDto {
  @ApiProperty({ description: 'Código de provincia de la Tabla III DGII (6 dígitos)' })
  @Matches(CODIGO_GEO)
  provincia!: string

  @ApiProperty({ description: 'Código de municipio de la Tabla III DGII (6 dígitos)' })
  @Matches(CODIGO_GEO)
  municipio!: string

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  sector!: string

  @ApiProperty()
  @IsString()
  @Length(5, 250)
  direccion!: string

  @ApiProperty()
  @Matches(TELEFONO, { message: 'Teléfono inválido' })
  telefono!: string

  @ApiProperty()
  @IsEmail()
  email!: string
}

export class ContribuyenteDto extends UbicacionDto {
  @ApiProperty({ enum: TIPOS_REGISTRO })
  @IsIn(TIPOS_REGISTRO)
  tipoRegistro!: (typeof TIPOS_REGISTRO)[number]

  @ApiProperty({ enum: TipoECF, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(Object.values(TipoECF), { each: true })
  tiposComprobante!: TipoECF[]

  @ApiProperty({ enum: ['RNC', 'CEDULA'] })
  @IsIn(['RNC', 'CEDULA'])
  tipoIdentificacion!: 'RNC' | 'CEDULA'

  @ApiProperty({ description: 'RNC (9) o cédula (11), sólo dígitos' })
  @Matches(SOLO_DIGITOS_RNC, { message: 'El RNC tiene 9 dígitos y la cédula 11' })
  rnc!: string

  @ApiPropertyOptional({ description: 'Sólo se usa si la cédula no figura en el padrón de la DGII' })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  razonSocial?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreComercial?: string

  @ApiProperty()
  @IsString()
  @Length(3, 200)
  actividadEconomica!: string
}

export class RepresentanteDto extends UbicacionDto {
  @ApiProperty({ description: 'Cédula (11) si es dominicano; RNC asignado (9) si es extranjero' })
  @Matches(SOLO_DIGITOS_RNC, { message: 'La identificación del representante tiene 9 u 11 dígitos' })
  identificacion!: string

  @ApiPropertyOptional({ description: 'Sólo si es extranjero' })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  pasaporte?: string

  @ApiProperty()
  @IsString()
  @Length(3, 150)
  nombreCompleto!: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TELEFONO, { message: 'Celular inválido' })
  celular?: string
}

export class DatosRegistroDto {
  @ApiProperty({ type: ContribuyenteDto })
  @ValidateNested()
  @Type(() => ContribuyenteDto)
  contribuyente!: ContribuyenteDto

  @ApiProperty({ type: RepresentanteDto })
  @ValidateNested()
  @Type(() => RepresentanteDto)
  representante!: RepresentanteDto
}

export class OfvDto extends CodigoDosPasosDto {
  @ApiProperty({ description: 'Usuario o correo de la Oficina Virtual de la DGII' })
  @IsString()
  @Length(3, 150)
  usuario!: string

  @ApiProperty()
  @IsString()
  @Length(4, 200)
  clave!: string
}
