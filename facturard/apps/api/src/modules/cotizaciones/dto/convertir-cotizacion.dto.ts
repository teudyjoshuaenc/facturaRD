import { IsEnum, IsBoolean, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { TipoECF } from '@facturard/database'

export class ConvertirCotizacionDto {
  @ApiPropertyOptional({
    enum: TipoECF,
    description: 'Override del tipo. Por defecto E31 si el contacto tiene RNC validado, si no E32.',
  })
  @IsEnum(TipoECF)
  @IsOptional()
  tipoECF?: TipoECF

  @ApiPropertyOptional({ default: false, description: 'false → produce un comprobante DRAFT; true → emite de inmediato.' })
  @IsBoolean()
  @IsOptional()
  emitir?: boolean
}
