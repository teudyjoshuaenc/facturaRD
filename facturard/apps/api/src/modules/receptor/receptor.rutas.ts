import { RequestMethod } from '@nestjs/common'

/**
 * Rutas del receptor DGII que viven FUERA del prefijo global `api/v1`
 * (estándar técnico de la DGII). Compartido por `main.ts` y el harness e2e para
 * que las pruebas vean exactamente las mismas URLs que producción.
 */
export const RUTAS_RECEPTOR_SIN_PREFIJO = [
  { path: 'fe/autenticacion/api/semilla', method: RequestMethod.GET },
  { path: 'fe/autenticacion/api/validacioncertificado', method: RequestMethod.POST },
  { path: 'fe/recepcion/api/ecf', method: RequestMethod.GET },
  { path: 'fe/recepcion/api/ecf', method: RequestMethod.POST },
  { path: 'fe/aprobacioncomercial/api/ecf', method: RequestMethod.GET },
  { path: 'fe/aprobacioncomercial/api/ecf', method: RequestMethod.POST },
]
