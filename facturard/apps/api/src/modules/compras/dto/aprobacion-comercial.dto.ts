import { IsIn, IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AprobacionComercialDto {
  @ApiProperty({ enum: ['APROBADO', 'RECHAZADO'] })
  @IsIn(['APROBADO', 'RECHAZADO'])
  decision!: 'APROBADO' | 'RECHAZADO'

  @ApiPropertyOptional({ description: 'Motivo (requerido por la DGII cuando se rechaza)' })
  @IsString()
  @IsOptional()
  motivoRechazo?: string
}
