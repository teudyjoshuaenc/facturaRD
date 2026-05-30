import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido por email (hex de 64 chars)' })
  @IsString()
  token!: string

  @ApiProperty({ example: 'NuevaContraseña1!' })
  @IsString()
  @MinLength(8)
  password!: string
}
