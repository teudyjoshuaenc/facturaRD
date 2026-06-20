import { Injectable, NotFoundException, ServiceUnavailableException, Logger } from '@nestjs/common'

export interface ContribuyenteDGII {
  rnc: string
  razonSocial: string
  nombreComercial: string | undefined
  estado: string
  categoria: string | undefined
}

// La DGII no tiene API pública oficial — se usa Dominican Technology como proxy
// del padrón de contribuyentes (api-dgii.dominicantechnology.com).
interface DominicanTechnologyResponse {
  exito: boolean
  fuente?: string
  data?: {
    rnc: string
    razon_social: string
    nombre_comercial?: string
    actividad_economica?: string
    fecha_inicio?: string
    estado: string
    regimen_pago?: string
  }
}

@Injectable()
export class DgiiContribuyentesService {
  private readonly logger = new Logger(DgiiContribuyentesService.name)
  private readonly baseUrl = 'https://api-dgii.dominicantechnology.com/api/v1/rnc'
  private readonly timeoutMs = 8000

  async buscarPorRNC(rnc: string): Promise<ContribuyenteDGII> {
    const url = `${this.baseUrl}/${encodeURIComponent(rnc)}`

    let body: DominicanTechnologyResponse
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (res.status === 404) {
        throw new NotFoundException(`RNC ${rnc} no está registrado en la DGII`)
      }
      if (!res.ok) {
        throw new Error(`API de validación de RNC respondió ${res.status}`)
      }

      body = (await res.json()) as DominicanTechnologyResponse
    } catch (err) {
      if (err instanceof NotFoundException) throw err

      // Red no disponible / timeout — no debe tumbar el flujo principal con un 500
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`API de validación de RNC no disponible (${msg}). RNC: ${rnc}`)
      throw new ServiceUnavailableException(
        'No se pudo validar el RNC en este momento. Intenta nuevamente en unos minutos.',
      )
    }

    if (!body.exito || !body.data) {
      throw new NotFoundException(`RNC ${rnc} no está registrado en la DGII`)
    }

    return {
      rnc: body.data.rnc,
      razonSocial: body.data.razon_social.trim(),
      nombreComercial: body.data.nombre_comercial?.trim(),
      estado: body.data.estado,
      categoria: body.data.regimen_pago,
    }
  }
}
