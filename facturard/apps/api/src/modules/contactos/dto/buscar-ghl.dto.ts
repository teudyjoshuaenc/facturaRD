import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Búsqueda en vivo sobre GHL (no en nuestra DB) para el modal de importación
// selectiva. GHL solo indexa nombre/email/teléfono en `query` — el RNC vive en
// un custom field y no es buscable server-side.
export class BuscarGhlDto {
  @ApiPropertyOptional({ description: 'Busca por nombre, email o teléfono (limitación de la API de GHL: no busca RNC)' })
  @IsString()
  @IsOptional()
  query?: string

  @ApiPropertyOptional({ description: 'Cursor de paginación de GHL (startAfterId), devuelto en la página anterior' })
  @IsString()
  @IsOptional()
  cursorId?: string

  @ApiPropertyOptional({ description: 'Cursor de paginación de GHL (startAfter), devuelto en la página anterior' })
  @IsString()
  @IsOptional()
  cursorDate?: string

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20
}
