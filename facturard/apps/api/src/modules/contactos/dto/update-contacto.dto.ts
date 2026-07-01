import { PartialType, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional } from 'class-validator'
import { CreateContactoDto } from './create-contacto.dto'

export class UpdateContactoDto extends PartialType(CreateContactoDto) {
  @ApiPropertyOptional({ description: 'Reactivar (true) o desactivar (false) el contacto' })
  @IsBoolean()
  @IsOptional()
  activo?: boolean
}
