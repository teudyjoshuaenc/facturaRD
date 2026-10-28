import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AmbienteDgii, RolAdmin, TenantEstado } from '@facturard/database'

// 12+ caracteres con mayúscula, minúscula, número y símbolo (personal con acceso a todos los clientes).
const CLAVE_ADMIN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/
const MENSAJE_CLAVE = 'La contraseña debe tener 12+ caracteres, con mayúscula, minúscula, número y símbolo'

export class LoginAdminDto {
  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  password!: string
}

export class CodigoAdminDto {
  @ApiProperty({ description: 'Código de 6 dígitos de Google Authenticator' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  codigo!: string
}

export class ListarClientesDto {
  @ApiPropertyOptional({ description: 'RNC, razón social, nombre comercial o correo' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  buscar?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number

  @ApiPropertyOptional({ enum: ['conErrores', 'sinCertificado', 'registroIncompleto'] })
  @IsOptional()
  @IsIn(['conErrores', 'sinCertificado', 'registroIncompleto'])
  filtro?: 'conErrores' | 'sinCertificado' | 'registroIncompleto'
}

export class ActualizarClienteDto {
  @ApiPropertyOptional({ enum: [TenantEstado.ACTIVO, TenantEstado.SUSPENDIDO] })
  @IsOptional()
  @IsIn([TenantEstado.ACTIVO, TenantEstado.SUSPENDIDO])
  estado?: TenantEstado

  @ApiPropertyOptional({ enum: AmbienteDgii, nullable: true, description: 'null = usar el del servidor' })
  @IsOptional()
  @IsIn([...Object.values(AmbienteDgii), null])
  ambienteDgii?: AmbienteDgii | null
}

export class CrearAdminDto {
  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  nombre!: string

  @ApiProperty({ enum: RolAdmin })
  @IsIn(Object.values(RolAdmin))
  rol!: RolAdmin

  @ApiProperty({ description: 'Contraseña inicial (la persona configura su 2FA al entrar)' })
  @Matches(CLAVE_ADMIN, { message: MENSAJE_CLAVE })
  password!: string
}

export class ActualizarAdminDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean

  @ApiPropertyOptional({ enum: RolAdmin })
  @IsOptional()
  @IsIn(Object.values(RolAdmin))
  rol?: RolAdmin
}

export class AuditoriaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number
}

export { CLAVE_ADMIN, MENSAJE_CLAVE }
