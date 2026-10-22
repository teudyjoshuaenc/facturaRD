import { IsEnum, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { AmbienteDgii } from '@facturard/database'

export class AmbienteDgiiDto {
  @ApiPropertyOptional({
    enum: AmbienteDgii,
    nullable: true,
    description: 'TESTECF (pruebas libres), CERTECF (certificación) o ECF (producción). null = DGII_ENV del servidor.',
  })
  @IsEnum(AmbienteDgii)
  @IsOptional()
  ambiente?: AmbienteDgii | null
}
