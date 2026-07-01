import { PartialType } from '@nestjs/swagger'
import { IsBoolean, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { CreateProductoDto } from './create-producto.dto'

export class UpdateProductoDto extends PartialType(CreateProductoDto) {
  @ApiPropertyOptional({ description: 'Reactivar (true) o desactivar (false) el producto' })
  @IsBoolean()
  @IsOptional()
  activo?: boolean
}
