import { IsEmail, IsEnum, IsOptional, IsString, MinLength, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Plan } from '@facturard/database'

export class RegisterDto {
  // Tenant — razonSocial la obtenemos automáticamente de la DGII
  @ApiProperty({ example: '132883225' })
  @IsString()
  @Length(9, 11)
  rnc!: string

  @ApiPropertyOptional({ enum: Plan, default: Plan.BASICO })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan

  // User
  @ApiProperty({ example: 'wilmer@dmaia.do' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 'Test1234!' })
  @IsString()
  @MinLength(8)
  password!: string

  @ApiProperty({ example: 'Wilmer Morán' })
  @IsString()
  nombre!: string
}
