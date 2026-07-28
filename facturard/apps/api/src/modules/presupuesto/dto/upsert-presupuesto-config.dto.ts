import { IsString, IsNotEmpty, IsOptional, IsNumber, IsInt, Min, Max, IsArray, ValidateNested, ArrayMaxSize } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class IngresoLineaDto {
  @ApiProperty({ example: 'Ventas de servicios' })
  @IsString()
  @IsNotEmpty()
  nombre!: string

  @ApiProperty({ example: 150000, description: 'Monto mensual estimado, >= 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoMensual!: number

  @ApiPropertyOptional({ example: 2, description: '% de crecimiento mensual compuesto. 0 = se mantiene igual.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  crecimientoPct?: number = 0
}

export class CostoFijoLineaDto {
  @ApiProperty({ example: 'Nómina' })
  @IsString()
  @IsNotEmpty()
  nombre!: string

  @ApiPropertyOptional({ example: 'Personal', description: 'Etiqueta libre para agrupar el desglose — no es el enum fiscal de movimientos.' })
  @IsString()
  @IsOptional()
  categoria?: string

  @ApiProperty({ example: 45000, description: 'Monto mensual, >= 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoMensual!: number
}

// Upsert completo — se reescribe toda la config de una vez (perfil + líneas +
// parámetros), igual que hace el wizard de onboarding en un solo submit.
export class UpsertPresupuestoConfigDto {
  @ApiPropertyOptional({ example: 'Tecnología' })
  @IsString()
  @IsOptional()
  sector?: string

  @ApiPropertyOptional({ default: 'DOP', description: 'Ámbito de este módulo únicamente — el motor fiscal siempre es DOP' })
  @IsString()
  @IsOptional()
  moneda?: string

  @ApiPropertyOptional({ default: 0, description: '0=enero … 11=diciembre' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  @IsOptional()
  mesFiscalInicio?: number

  @ApiPropertyOptional({ default: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  @IsOptional()
  colchonMeses?: number

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  metaMargenPct?: number

  @ApiPropertyOptional({ default: 0, description: 'Costo variable como % de ingresos' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  varPct?: number

  @ApiPropertyOptional({ default: 0, description: 'Por cobrar hoy — informativo' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  cxcInicial?: number

  @ApiPropertyOptional({ default: 0, description: 'Por pagar hoy — informativo' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  cxpInicial?: number

  @ApiProperty({ type: [IngresoLineaDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => IngresoLineaDto)
  ingresos!: IngresoLineaDto[]

  @ApiProperty({ type: [CostoFijoLineaDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CostoFijoLineaDto)
  costosFijos!: CostoFijoLineaDto[]
}
