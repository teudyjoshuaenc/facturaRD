import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  ValidateIf,
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

  @ApiPropertyOptional({ description: 'Si se envía, el servidor copia nombre/precio/ITBIS/unidad del producto (snapshot).' })
  @IsString()
  @IsOptional()
  productoId?: string

  // Los campos crudos son obligatorios SÓLO en líneas ad-hoc (sin productoId);
  // con productoId se toman del catálogo salvo override explícito.
  @ApiPropertyOptional({ enum: ['I1', 'I2', 'I3', 'I4', 'E'], example: 'I1' })
  @ValidateIf((o: CreateItemDto) => o.productoId === undefined)
  @IsIn(['I1', 'I2', 'I3', 'I4', 'E'])
  indicadorFacturacion?: string

  @ApiPropertyOptional({ example: 'Servicio de facturación electrónica' })
  @ValidateIf((o: CreateItemDto) => o.productoId === undefined)
  @IsString()
  nombreItem?: string

  @ApiPropertyOptional({ enum: [1, 2], description: '1=Bien, 2=Servicio' })
  @ValidateIf((o: CreateItemDto) => o.productoId === undefined)
  @IsIn([1, 2])
  indicadorBienoServicio?: 1 | 2

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  cantidad!: number

  @ApiPropertyOptional({ description: 'Código de unidad DGII (1-58)' })
  @IsNumber()
  @IsOptional()
  unidadMedida?: number

  @ApiPropertyOptional({ example: 5000 })
  @ValidateIf((o: CreateItemDto) => o.productoId === undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitarioItem?: number

  @ApiPropertyOptional({ example: 10, description: 'Porcentaje de descuento 0-100' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  descuentoPorcentaje?: number

  @ApiPropertyOptional({ example: 100, description: 'Descuento en monto absoluto (RD$) de la línea' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  descuento?: number

  @ApiPropertyOptional({ example: 27, description: 'ITBIS retenido de la línea (RD$) — típicamente E41' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  itbisRetenido?: number

  @ApiPropertyOptional({ example: 100, description: 'ISR retenido de la línea (RD$) — típicamente E47' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  isrRetenido?: number
}

export class CreateComprobanteDto {
  @ApiProperty({ enum: TipoECF, example: 'E31' })
  @IsEnum(TipoECF)
  tipoECF!: TipoECF

  @ApiPropertyOptional({
    default: true,
    description:
      'true (default) emite de inmediato (asigna e-NCF, encola y firma). false crea un borrador (DRAFT) sin consumir secuencia ni contactar la DGII.',
  })
  @IsBoolean()
  @IsOptional()
  emitir?: boolean

  @ApiPropertyOptional({ enum: [1, 2, 3], description: '1=Contado, 2=Crédito, 3=Gratuito. Requerido para E31/E32/E33/E34/E41/E44/E45/E46' })
  @IsIn([1, 2, 3])
  @IsOptional()
  tipoPago?: 1 | 2 | 3

  @ApiPropertyOptional({ enum: ['01', '02', '03', '04', '05', '06'], example: '01', description: 'Requerido para E31/E32/E33/E34/E44/E45/E46' })
  @IsIn(['01', '02', '03', '04', '05', '06'])
  @IsOptional()
  tipoIngresos?: string

  @ApiProperty({ example: '14-05-2026', description: 'DD-MM-YYYY' })
  @IsString()
  @Matches(/^\d{2}-\d{2}-\d{4}$/, { message: 'fechaEmision debe tener formato DD-MM-YYYY' })
  fechaEmision!: string

  @ApiPropertyOptional({ example: '31-12-2028', description: 'DD-MM-YYYY — requerido para E31/E33/E41/E43/E44/E45/E46/E47' })
  @IsString()
  @Matches(/^\d{2}-\d{2}-\d{4}$/, { message: 'fechaVencimiento debe tener formato DD-MM-YYYY' })
  @IsOptional()
  fechaVencimiento?: string

  @ApiPropertyOptional({ example: '131880681', description: 'RNC del comprador — requerido para E31/E41/E45' })
  @IsString()
  @IsOptional()
  rncComprador?: string

  @ApiPropertyOptional({ example: 'ABC123456', description: 'Identificador extranjero — para E46/E47' })
  @IsString()
  @IsOptional()
  identificadorExtranjero?: string

  @ApiPropertyOptional({ example: 'EMPRESA TEST SRL', description: 'Razón social del comprador — obligatorio para la mayoría de tipos' })
  @IsString()
  @IsOptional()
  razonSocialComprador?: string

  @ApiPropertyOptional({ description: 'Código ISO del país comprador — condicional para E46, obligatorio para E47' })
  @IsString()
  @IsOptional()
  paisComprador?: string

  @ApiPropertyOptional({ description: 'Término/condición de pago libre (ej. "Neto 30 días"). Informativo, se guarda en el documento.' })
  @IsString()
  @IsOptional()
  terminoPago?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  direccionComprador?: string

  @ApiProperty({ type: [CreateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  items!: CreateItemDto[]

  @ApiPropertyOptional({ description: 'Contacto comprador. El servidor copia RNC/razón social/dirección al comprobante (snapshot).' })
  @IsString()
  @IsOptional()
  contactoId?: string

  // Información de Referencia (E33/E34 obligatorio, resto condicional)
  @ApiPropertyOptional({ example: 'E310000000001', description: 'e-NCF que se modifica (obligatorio E33/E34, condicional en otros)' })
  @IsString()
  @IsOptional()
  ncfModificado?: string

  @ApiPropertyOptional({ example: '01-01-2026', description: 'DD-MM-YYYY — fecha del NCF modificado' })
  @IsString()
  @Matches(/^\d{2}-\d{2}-\d{4}$/, { message: 'fechaNCFModificado debe tener formato DD-MM-YYYY' })
  @IsOptional()
  fechaNCFModificado?: string

  @ApiPropertyOptional({ description: 'Código de modificación: 1=Anulación, 2=Corrección montos, 3=Corrección texto, 4=Reemplazo contingencia, 5=Ref. consumo' })
  @IsNumber()
  @IsIn([1, 2, 3, 4, 5])
  @IsOptional()
  codigoModificacion?: 1 | 2 | 3 | 4 | 5

  @ApiPropertyOptional({ description: 'Razón de la modificación (opcional para E33/E34)' })
  @IsString()
  @IsOptional()
  razonModificacion?: string

  @ApiPropertyOptional({ description: 'IndicadorNotaCredito (solo E34): 0 si el e-CF afectado tiene <=30 días calendario, 1 si >30. Lo calcula el servidor por fecha.' })
  @IsIn([0, 1])
  @IsOptional()
  indicadorNotaCredito?: 0 | 1
}
