import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@facturard/database'

/** Roles que un ADMIN de un tenant puede asignar a sus usuarios. */
export const ROLES_ASIGNABLES: UserRole[] = [UserRole.ADMIN, UserRole.USUARIO, UserRole.CONTADOR]

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string

  @ApiProperty()
  @IsString()
  nombre!: string

  // SUPER_ADMIN nunca se asigna por la API: sólo existe por seed/operación interna.
  @ApiPropertyOptional({ enum: ROLES_ASIGNABLES })
  @IsIn(ROLES_ASIGNABLES)
  @IsOptional()
  role?: UserRole
}
