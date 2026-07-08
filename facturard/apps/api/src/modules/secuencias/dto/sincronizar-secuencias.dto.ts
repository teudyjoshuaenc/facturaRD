import { IsEnum, IsInt, Min, IsDateString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TipoECF } from '@facturard/database'

// Un ítem del sync de secuencias (cliente que migra desde otro emisor).
export class SincronizarSecuenciaItemDto {
  @ApiProperty({ enum: TipoECF })
  @IsEnum(TipoECF)
  tipoECF!: TipoECF

  @ApiProperty({ example: 125, description: 'Última secuencia ya emitida en el sistema anterior' })
  @IsInt()
  @Min(0)
  ultimaSecuencia!: number

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha de vencimiento del rango de e-NCF autorizado por la DGII (ISO). Va en <FechaVencimientoSecuencia>.',
  })
  @IsDateString()
  @IsOptional()
  fechaVencimiento?: string
}
