import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Integración ERP' })
  @IsString()
  @MinLength(3)
  nombre!: string
}
