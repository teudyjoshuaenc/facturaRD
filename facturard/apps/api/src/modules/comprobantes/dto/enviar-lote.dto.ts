import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Máximo de comprobantes por correo.
 *
 * Es el único techo DOCUMENTADO en todo el camino: el endpoint de adjuntos de
 * GHL (`/conversations/messages/upload`) acepta 5 archivos por request y 5 MB
 * por archivo. El cap de `attachments[]` al enviar el mensaje NO está
 * documentado, así que no se apuesta a él: 5 es lo que se puede sostener.
 */
export const MAX_COMPROBANTES_POR_CORREO = 5

/** Máximo de destinatarios del correo (1 en `emailTo` + hasta 4 en `emailCc`). */
export const MAX_DESTINATARIOS = 5

/** 5 MB por archivo — límite documentado del upload de GHL. */
export const MAX_ADJUNTO_BYTES = 5 * 1024 * 1024

/**
 * 20 MB de adjuntos por correo — límite del composer de email de GHL (por
 * encima, GHL los convierte en links y el cliente ya no recibe el PDF).
 * Con PDFs de factura (~100-300 KB) nunca debería activarse; está para el caso
 * del logo pesado por `logoUrl`.
 */
export const MAX_ADJUNTOS_TOTAL_BYTES = 20 * 1024 * 1024

/** Normaliza un correo escrito a mano: sin espacios y en minúsculas. */
const normalizarEmail = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)) : value

/**
 * Envío EN LOTE: UN SOLO correo con los PDFs de varios comprobantes adjuntos.
 * No es un correo por comprobante.
 *
 * Es POST-EMISIÓN igual que el envío individual: no altera el estado DGII de
 * ningún comprobante ni participa de los reportes 606/607/608.
 */
export class EnviarLoteDto {
  @ApiProperty({
    enum: ['email', 'whatsapp', 'ambos'],
    description: 'Canal de entrega. Hoy sólo "email"; whatsapp/ambos responden 400.',
  })
  @IsIn(['email', 'whatsapp', 'ambos'])
  canal!: 'email' | 'whatsapp' | 'ambos'

  @ApiProperty({
    type: [String],
    description:
      `Comprobantes a adjuntar, entre 1 y ${MAX_COMPROBANTES_POR_CORREO}. Todos viajan en el MISMO correo. ` +
      'El orden se respeta en los adjuntos y en el cuerpo del mensaje.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_COMPROBANTES_POR_CORREO, {
    message: `Máximo ${MAX_COMPROBANTES_POR_CORREO} comprobantes por correo (es el límite de adjuntos de GoHighLevel).`,
  })
  @ArrayUnique({ message: 'Hay comprobantes repetidos en la selección.' })
  @IsUUID(undefined, { each: true })
  comprobanteIds!: string[]

  @ApiProperty({
    type: [String],
    description:
      `Destinatarios del correo, entre 1 y ${MAX_DESTINATARIOS}. El primero va en "Para" y el resto en copia.`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DESTINATARIOS, { message: `Máximo ${MAX_DESTINATARIOS} destinatarios por correo.` })
  @Transform(normalizarEmail)
  @ArrayUnique({ message: 'Hay destinatarios repetidos.' })
  @IsEmail({}, { each: true, message: 'Hay un correo con formato inválido.' })
  destinatarios!: string[]

  @ApiPropertyOptional({ description: 'Asunto. Si se omite, se usa uno por defecto con la cantidad de comprobantes y la razón social del emisor.' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  asunto?: string

  @ApiPropertyOptional({ description: 'Cuerpo del mensaje. Si se omite, se usa un texto por defecto que lista los comprobantes adjuntos.' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  mensaje?: string
}
