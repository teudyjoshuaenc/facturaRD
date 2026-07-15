// Estado de "listo para emitir" de un tenant. Un tenant puede EMITIR a la DGII
// solo si tiene un certificado digital activo Y vigente Y secuencias configuradas.
// Se comparte entre /tenants y /cumplimiento para una única fuente de verdad.

export type MotivoNoEmite = 'sinCertificado' | 'certificadoVencido' | 'sinSecuencias' | null

export interface EmisionStatus {
  puedeEmitir: boolean
  motivoNoEmite: MotivoNoEmite
}

/**
 * @param certValidoHasta  fecha de vencimiento del certificado ACTIVO, o null si no hay.
 * @param tieneSecuencias  true si el tenant tiene al menos una secuencia configurada.
 */
export function computeEmisionStatus(
  certValidoHasta: Date | null,
  tieneSecuencias: boolean,
): EmisionStatus {
  if (certValidoHasta === null) return { puedeEmitir: false, motivoNoEmite: 'sinCertificado' }
  if (certValidoHasta.getTime() < Date.now()) return { puedeEmitir: false, motivoNoEmite: 'certificadoVencido' }
  if (!tieneSecuencias) return { puedeEmitir: false, motivoNoEmite: 'sinSecuencias' }
  return { puedeEmitir: true, motivoNoEmite: null }
}
