import { IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PagoTipo } from '@facturard/database'

export class ListPagosDto {
  @ApiPropertyOptional({ enum: PagoTipo })
  @IsEnum(PagoTipo)
  @IsOptional()
  tipo?: PagoTipo

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  comprobanteId?: string

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  compraId?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  desde?: string

  @ApiPropertyOptional({ description: 'ISO date — inclusivo' })
  @IsDateString()
  @IsOptional()
  hasta?: string
}
