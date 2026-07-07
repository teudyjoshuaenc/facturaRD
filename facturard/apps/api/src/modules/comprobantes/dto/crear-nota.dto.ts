import { IsIn, IsInt, IsString, IsOptional, IsArray, IsBoolean, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CreateItemDto } from './create-comprobante.dto'

/**
 * Nota de crédito (E34) o débito (E33) sobre un comprobante ACEPTADO.
 * Hereda comprador + referencia fiscal del comprobante fuente.
 */
export class CrearNotaDto {
  @ApiProperty({ enum: ['E33', 'E34'], description: 'E33=Nota de Débito, E34=Nota de Crédito' })
  @IsIn(['E33', 'E34'])
  tipo!: 'E33' | 'E34'

  @ApiProperty({ enum: [1, 2, 3, 4, 5], description: '1=Anulación, 2=Corrección montos, 3=Corrección texto, 4=Reemplazo contingencia, 5=Ref. consumo' })
  @IsInt()
  @IsIn([1, 2, 3, 4, 5])
  codigoModificacion!: 1 | 2 | 3 | 4 | 5

  @ApiPropertyOptional({ description: 'Razón de la modificación' })
  @IsString()
  @IsOptional()
  razonModificacion?: string

  @ApiPropertyOptional({ type: [CreateItemDto], description: 'Líneas de la nota. Si se omiten, hereda las del comprobante fuente.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  @IsOptional()
  items?: CreateItemDto[]

  @ApiPropertyOptional({
    enum: [0, 1],
    description:
      'IndicadorNotaCredito (solo E34). El servidor lo calcula por la regla de 30 días (0 si el e-CF ' +
      'afectado tiene <=30 días calendario, 1 si >30). Si se envía, la fecha tiene prioridad.',
  })
  @IsIn([0, 1])
  @IsOptional()
  indicadorNotaCredito?: 0 | 1

  @ApiPropertyOptional({ default: true, description: 'true (default) emite de inmediato; false crea un borrador (DRAFT).' })
  @IsBoolean()
  @IsOptional()
  emitir?: boolean
}
