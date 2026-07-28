import { IsArray, IsOptional, IsString, ArrayMaxSize } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Sin body (u omitiendo ghlContactIds) → sincronización completa (comportamiento
// histórico). Con ghlContactIds → solo esos contactos (modal de importación
// selectiva). El tope evita una ráfaga de N fetches individuales a GHL.
export class SincronizarGhlDto {
  @ApiPropertyOptional({ type: [String], description: 'IDs de contacto de GHL a importar/actualizar. Omitir para sincronizar todo el location.' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ghlContactIds?: string[]
}
