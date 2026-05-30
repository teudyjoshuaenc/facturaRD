import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin@empresa.com.do' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 'contraseña-segura' })
  @IsString()
  @MinLength(8)
  password!: string
}
