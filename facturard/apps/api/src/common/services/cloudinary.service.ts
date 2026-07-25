import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'

// Logo del emisor: se sube el original a Cloudinary bajo un public_id FIJO por
// tenant y se sirve una derivada optimizada. La derivada f_png es la que va al
// PDF (pdfkit sólo acepta PNG/JPEG y embebe los bytes ORIGINALES, así que hay
// que servirlo ya redimensionado/comprimido); la f_auto es para la UI.
const LOGO_TRANSFORM = { width: 360, height: 160, crop: 'limit', quality: 'auto' } as const

// Tipos permitidos en la subida. El SVG se acepta a propósito: Cloudinary lo
// RASTERIZA a PNG al servir con f_png, así el PDF recibe un raster válido.
export const LOGO_MIME_PERMITIDOS = ['image/png', 'image/jpeg', 'image/svg+xml'] as const
export const LOGO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB — alineado con el cap del loader del PDF

export interface LogoSubido {
  /** secure URL de la derivada f_png. Se guarda en Tenant.logoUrl y la usa el PDF. */
  secureUrl: string
  /** public_id fijo `facturard/<tenantId>/logo`. Se guarda en Tenant.logoPublicId. */
  publicId: string
}

/**
 * Fija el path del logo de un tenant. Derivado SIEMPRE del tenantId autenticado,
 * NUNCA de input del cliente: eso es lo que garantiza el aislamiento multi-tenant
 * (un tenant no puede escribir en el path de otro).
 */
function publicIdDe(tenantId: string): string {
  return `facturard/${tenantId}/logo`
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name)

  constructor(config: ConfigService) {
    // Fail-fast como ENCRYPTION_KEY: sin credenciales la app NO arranca (nada de
    // operar con un default silencioso). El api_secret es sensible y vive SÓLO
    // aquí, server-side; jamás se expone al frontend.
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    })
  }

  /** URL de la derivada f_png (la que va al PDF). Pura, sin red. */
  pdfUrl(publicId: string, version?: number): string {
    return cloudinary.url(publicId, {
      transformation: [LOGO_TRANSFORM],
      fetch_format: 'png',
      secure: true,
      ...(version !== undefined ? { version } : {}),
    })
  }

  /** URL de la derivada f_auto (la que muestra la UI). Pura, sin red. */
  previewUrl(publicId: string, version?: number): string {
    return cloudinary.url(publicId, {
      transformation: [LOGO_TRANSFORM],
      fetch_format: 'auto',
      secure: true,
      ...(version !== undefined ? { version } : {}),
    })
  }

  /**
   * Sube (o REEMPLAZA) el logo del tenant. Al ser el public_id fijo con
   * overwrite+invalidate, reemplazar pisa el anterior en el mismo path: cero
   * huérfanos por construcción y la CDN se purga. Devuelve la URL f_png ya lista
   * para guardar en logoUrl. Lanza errores accionables (nada de 500 crudos).
   */
  async subirLogo(tenantId: string, file: Buffer, mimetype: string): Promise<LogoSubido> {
    if (!(LOGO_MIME_PERMITIDOS as readonly string[]).includes(mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido (${mimetype}). Sube una imagen PNG, JPG o SVG.`,
      )
    }
    if (file.byteLength > LOGO_MAX_BYTES) {
      throw new BadRequestException('El logo supera el máximo de 2 MB. Sube una imagen más liviana.')
    }

    const publicId = publicIdDe(tenantId)
    const dataUri = `data:${mimetype};base64,${file.toString('base64')}`

    let result: UploadApiResponse
    try {
      result = await cloudinary.uploader.upload(dataUri, {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
      })
    } catch (err) {
      // 401 → credenciales inválidas; el resto → servicio caído / red.
      const httpCode = (err as { http_code?: number }).http_code
      const detalle = (err as { message?: string }).message ?? 'error desconocido'
      if (httpCode === 401 || httpCode === 403) {
        this.logger.error(`Cloudinary rechazó las credenciales (${httpCode}): ${detalle}`)
        throw new ServiceUnavailableException(
          'No se pudo subir el logo: las credenciales de Cloudinary son inválidas. Revisa CLOUDINARY_API_KEY/SECRET.',
        )
      }
      this.logger.error(`Fallo al subir el logo a Cloudinary: ${detalle}`)
      throw new ServiceUnavailableException(
        'No se pudo subir el logo ahora mismo (servicio de imágenes no disponible). Intenta de nuevo en un momento.',
      )
    }

    return { secureUrl: this.pdfUrl(result.public_id, result.version), publicId: result.public_id }
  }
}
