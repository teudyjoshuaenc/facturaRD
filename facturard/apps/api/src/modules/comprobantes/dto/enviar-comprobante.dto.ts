import { IsIn, IsString, IsOptional, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Envío de un comprobante ya generado al cliente, a través de GoHighLevel.
 * Es POST-EMISIÓN: no altera el estado DGII del comprobante ni sus reportes.
 */
export class EnviarComprobanteDto {
  @ApiProperty({
    enum: ['email', 'whatsapp', 'ambos'],
    description:
      'Canal de entrega. Hoy sólo "email" está implementado; "whatsapp" y "ambos" responden 400 ' +
      '(WhatsApp exige plantillas aprobadas por Meta — sprint aparte).',
  })
  @IsIn(['email', 'whatsapp', 'ambos'])
  canal!: 'email' | 'whatsapp' | 'ambos'

  @ApiPropertyOptional({ description: 'Asunto del correo. Si se omite, se usa uno por defecto con el e-NCF y la razón social del emisor.' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  asunto?: string

  @ApiPropertyOptional({ description: 'Cuerpo del mensaje. Si se omite, se usa un texto por defecto.' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  mensaje?: string
}
