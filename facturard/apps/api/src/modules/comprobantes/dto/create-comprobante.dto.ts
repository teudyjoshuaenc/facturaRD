import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsIn,
  Matches,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { TipoECF } from '@facturard/database'

export class CreateItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  numeroLinea!: number

  @ApiProperty({ enum: ['I1', 'I2', 'I3', 'I4', 'E'], example: 'I1' })
  @IsIn(['I1', 'I2', 'I3', 'I4', 'E'])
  indicadorFacturacion!: string

  @ApiProperty({ example: 'Servicio de facturación electrónica' })
  @IsString()
  nombreItem!: string

  @ApiProperty({ enum: [1, 2], description: '1=Bien, 2=Servicio' })
  @IsIn([1, 2])
  indicadorBienoServicio!: 1 | 2

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  cantidad!: number

  @ApiPropertyOptional({ description: 'Código de unidad DGII (1-58)' })
  @IsNumber()
  @IsOptional()
  unidadMedida?: number

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitarioItem!: number

  @ApiPropertyOptional({ example: 10, description: 'Porcentaje de descuento 0-100' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  descuentoPorcentaje?: number
}

export class CreateComprobanteDto {
  @ApiProperty({ enum: TipoECF, example: 'E31' })
  @IsEnum(TipoECF)
  tipoECF!: TipoECF

  @ApiProperty({ enum: [1, 2, 3], description: '1=Contado, 2=Crédito, 3=Gratuito' })
  @IsIn([1, 2, 3])
  tipoPago!: 1 | 2 | 3

  @ApiProperty({ enum: ['01', '02', '03', '04', '05', '06'], example: '01' })
  @IsIn(['01', '02', '03', '04', '05', '06'])
  tipoIngresos!: string

  @ApiProperty({ example: '14-05-2026', description: 'DD-MM-YYYY' })
  @IsString()
  @Matches(/^\d{2}-\d{2}-\d{4}$/, { message: 'fechaEmision debe tener formato DD-MM-YYYY' })
  fechaEmision!: string

  @ApiPropertyOptional({ example: '31-12-2028', description: 'DD-MM-YYYY — requerido para E31 a crédito' })
  @IsString()
  @Matches(/^\d{2}-\d{2}-\d{4}$/, { message: 'fechaVencimiento debe tener formato DD-MM-YYYY' })
  @IsOptional()
  fechaVencimiento?: string

  @ApiPropertyOptional({ example: '131880681' })
  @IsString()
  @IsOptional()
  rncComprador?: string

  @ApiProperty({ example: 'EMPRESA TEST SRL' })
  @IsString()
  razonSocialComprador!: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  direccionComprador?: string

  @ApiProperty({ type: [CreateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  items!: CreateItemDto[]

  // E33 / E34
  @ApiPropertyOptional({ example: 'E310000000001', description: 'e-NCF que se modifica (E33/E34)' })
  @IsString()
  @IsOptional()
  eNCFModificado?: string

  @ApiPropertyOptional({ description: 'Código de modificación para E33/E34' })
  @IsNumber()
  @IsOptional()
  codigoModificacion?: number
}
