import { IsEnum, IsInt, IsOptional, Min, IsDateString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TipoECF } from '@facturard/database'

export class InicializarSecuenciaItemDto {
  @ApiProperty({ enum: TipoECF })
  @IsEnum(TipoECF)
  tipoECF!: TipoECF

  @ApiPropertyOptional({ example: 0, description: 'Última secuencia ya usada (exclusive — siguiente será +1)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  ultimaSecuencia?: number

  @ApiPropertyOptional({ example: '2027-12-31', description: 'Fecha de vencimiento ISO 8601' })
  @IsDateString()
  @IsOptional()
  fechaVencimiento?: string
}

export class InicializarSecuenciasDto {
  @ApiProperty({ type: [InicializarSecuenciaItemDto] })
  secuencias!: InicializarSecuenciaItemDto[]
}
