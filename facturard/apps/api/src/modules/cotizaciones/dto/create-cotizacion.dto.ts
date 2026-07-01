import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsIn,
  IsDateString,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CotizacionItemDto {
  @ApiPropertyOptional({ description: 'Si se envía, se copian nombre/precio/ITBIS/unidad del producto (snapshot).' })
  @IsString()
  @IsOptional()
  productoId?: string

  @ApiPropertyOptional()
  @ValidateIf((o: CotizacionItemDto) => o.productoId === undefined)
  @IsString()
  nombre?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descripcion?: string

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  cantidad!: number

  @ApiPropertyOptional({ example: 5000 })
  @ValidateIf((o: CotizacionItemDto) => o.productoId === undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number

  @ApiPropertyOptional({ enum: ['I1', 'I2', 'I3', 'EXENTO'] })
  @ValidateIf((o: CotizacionItemDto) => o.productoId === undefined)
  @IsIn(['I1', 'I2', 'I3', 'EXENTO'])
  tratamientoITBIS?: string

  @ApiPropertyOptional({ description: 'Código de unidad de medida DGII' })
  @IsString()
  @IsOptional()
  unidadMedida?: string
}

export class CreateCotizacionDto {
  @ApiPropertyOptional({ description: 'Contacto (cliente). Determina el tipo por defecto al convertir.' })
  @IsString()
  @IsOptional()
  contactoId?: string

  @ApiPropertyOptional({ description: 'Fecha de vigencia (ISO). Vencida si ya pasó.' })
  @IsDateString()
  @IsOptional()
  fechaVigencia?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notas?: string

  @ApiProperty({ type: [CotizacionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CotizacionItemDto)
  items!: CotizacionItemDto[]
}
