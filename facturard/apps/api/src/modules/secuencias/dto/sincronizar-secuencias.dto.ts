import { IsEnum, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
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
}
