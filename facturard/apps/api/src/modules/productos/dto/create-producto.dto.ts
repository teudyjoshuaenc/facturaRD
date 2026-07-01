import { IsString, IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateProductoDto {
  @ApiProperty({ enum: ['BIEN', 'SERVICIO'] })
  @IsIn(['BIEN', 'SERVICIO'])
  tipo!: string

  @ApiProperty({ example: 'Consultoría de software' })
  @IsString()
  nombre!: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descripcion?: string

  @ApiProperty({ example: 5000, description: 'Debe ser > 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioUnitario!: number

  @ApiPropertyOptional({ enum: ['I1', 'I2', 'I3', 'EXENTO'], default: 'I1' })
  @IsIn(['I1', 'I2', 'I3', 'EXENTO'])
  @IsOptional()
  tratamientoITBIS?: string

  @ApiPropertyOptional({ description: 'Código de unidad de medida DGII' })
  @IsString()
  @IsOptional()
  unidadMedida?: string

  @ApiPropertyOptional({ description: 'Código interno del producto (único por tenant)' })
  @IsString()
  @IsOptional()
  codigo?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoria?: string
}
