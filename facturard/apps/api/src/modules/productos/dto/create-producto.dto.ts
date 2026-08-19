import { IsString, IsIn, IsNumber, IsOptional, IsPositive, IsBoolean, ValidateIf } from 'class-validator'
import { Type, Transform } from 'class-transformer'
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

  @ApiPropertyOptional({
    example: 5000,
    description: 'Debe ser > 0. Opcional SÓLO si borrador=true (un borrador se guarda sin precio; se persiste 0).',
  })
  // En borrador el precio puede faltar: es un producto "guardado sin terminar".
  // Fuera de borrador sigue siendo obligatorio y > 0, igual que antes.
  @ValidateIf((o: CreateProductoDto) => o.borrador !== true || o.precioUnitario !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioUnitario?: number

  @ApiPropertyOptional({
    default: false,
    description: 'true → guarda el producto como BORRADOR del catálogo: no exige precio y NO se puede facturar.',
  })
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  @IsOptional()
  borrador?: boolean

  @ApiPropertyOptional({
    default: false,
    description:
        'MODO DE CAPTURA: true = el usuario cotiza con ITBIS incluido. `precioUnitario` DEBE venir ' +
        'igual como base sin ITBIS — este flag sólo sirve para reconstruir el precio en el formulario.',
  })
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  @IsOptional()
  precioIncluyeItbis?: boolean

  @ApiPropertyOptional({
    example: 15000,
    description:
        'Monto EXACTO tecleado cuando se capturó con ITBIS incluido. Sólo para re-mostrar el precio ' +
        '(reconstruirlo desde la base pierde 1 centavo por el redondeo). Nunca se usa para facturar.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  precioCaptura?: number

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
