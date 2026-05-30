import { Injectable, BadRequestException, Logger } from '@nestjs/common'

export interface ContribuyenteDGII {
  rnc: string
  razonSocial: string
  nombreComercial: string | undefined
  estado: string
  categoria: string | undefined
}

// Estructura real de respuesta de api.dgii.gov.do
interface DgiiApiResponse {
  rnc?: string
  name?: string
  comercialName?: string
  nombreComercial?: string   // alternate casing
  status?: string
  categoria?: string
  razonSocial?: string
  nombre?: string
}

@Injectable()
export class DgiiContribuyentesService {
  private readonly logger = new Logger(DgiiContribuyentesService.name)
  private readonly baseUrl = 'https://api.dgii.gov.do/api/contribuyentes'
  private readonly timeoutMs = 8000

  async buscarPorRNC(rnc: string): Promise<ContribuyenteDGII> {
    const url = `${this.baseUrl}/${encodeURIComponent(rnc)}`

    let data: DgiiApiResponse
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (res.status === 404) {
        throw new BadRequestException(`RNC ${rnc} no está registrado en la DGII`)
      }
      if (!res.ok) {
        throw new Error(`DGII respondió ${res.status}`)
      }

      data = (await res.json()) as DgiiApiResponse
    } catch (err) {
      if (err instanceof BadRequestException) throw err

      // Red no disponible — loguear y lanzar error descriptivo
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`DGII API no disponible (${msg}). RNC: ${rnc}`)
      throw new BadRequestException(
        'No se pudo validar el RNC con la DGII. ' +
        'La API pública no está disponible en este momento. ' +
        'Intenta nuevamente en unos minutos.',
      )
    }

    const razonSocial =
      data.razonSocial ??
      data.name ??
      data.nombre ??
      rnc // último fallback

    if (!razonSocial || razonSocial === rnc) {
      throw new BadRequestException(`RNC ${rnc} no encontrado en la DGII`)
    }

    return {
      rnc,
      razonSocial: razonSocial.trim(),
      nombreComercial: (data.comercialName ?? data.nombreComercial)?.trim(),
      estado: data.status ?? 'ACTIVO',
      categoria: data.categoria,
    }
  }
}
