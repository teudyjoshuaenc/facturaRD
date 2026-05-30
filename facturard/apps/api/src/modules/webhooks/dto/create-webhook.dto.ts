import { IsUrl, IsArray, IsString, ArrayNotEmpty, IsOptional, IsIn } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateWebhookDto {
  @ApiProperty({
    example: 'https://hooks.gohighlevel.com/webhook/abc123',
    description: 'URL destino del webhook (POST)',
  })
  @IsUrl()
  url!: string

  @ApiProperty({
    example: ['comprobante.aceptado', 'comprobante.rechazado'],
    description: 'Eventos que activarán este webhook',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  eventos!: string[]

  @ApiPropertyOptional({
    enum: ['SALIENTE', 'GHL_ENTRADA'],
    default: 'SALIENTE',
    description: 'SALIENTE = FacturaRD → destino | GHL_ENTRADA = GoHighLevel → FacturaRD',
  })
  @IsOptional()
  @IsIn(['SALIENTE', 'GHL_ENTRADA'])
  tipo?: string

  @ApiPropertyOptional({
    example: 'GoHighLevel Principal',
    description: 'Nombre descriptivo del webhook',
  })
  @IsOptional()
  @IsString()
  nombre?: string
}
