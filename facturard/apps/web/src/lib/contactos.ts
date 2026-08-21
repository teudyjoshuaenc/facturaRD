/**
 * Tipos de contacto — una sola fuente para la etiqueta y para la regla del RNC.
 *
 * Un "cliente ocasional" es, fiscalmente, un CONSUMIDOR FINAL: se le factura sin
 * RNC (E32 por debajo de RD$250,000). Es EXACTAMENTE el mismo valor de `tipo`
 * que el backend ya guarda — aquí sólo cambia cómo se llama en pantalla, así que
 * no hay migración, no cambia el XML ni los reportes, y los contactos que ya
 * existen se re-etiquetan solos.
 */

export const TIPO_OCASIONAL = 'CONSUMIDOR_FINAL' as const

export type TipoContacto = 'CLIENTE' | 'PROVEEDOR' | typeof TIPO_OCASIONAL

export const TIPO_CONTACTO_LABELS: Record<TipoContacto, string> = {
  CLIENTE: 'Cliente',
  PROVEEDOR: 'Proveedor',
  CONSUMIDOR_FINAL: 'Cliente ocasional',
}

export const TIPO_CONTACTO_OPTIONS: { value: TipoContacto; label: string }[] = [
  { value: 'CLIENTE', label: TIPO_CONTACTO_LABELS.CLIENTE },
  { value: 'PROVEEDOR', label: TIPO_CONTACTO_LABELS.PROVEEDOR },
  { value: TIPO_OCASIONAL, label: `${TIPO_CONTACTO_LABELS.CONSUMIDOR_FINAL} (sin RNC)` },
]

export function esOcasional(tipo: string): boolean {
  return tipo === TIPO_OCASIONAL
}

/**
 * El RNC (o el identificador extranjero) es obligatorio para todos MENOS el
 * ocasional. No es una preferencia de UI: un cliente fijo termina en E31/E41/E45,
 * que exigen RNC del comprador ante la DGII; el ocasional sólo se factura por
 * E32, donde la identificación no se exige por debajo de RD$250,000.
 */
export function rncEsRequerido(tipo: string): boolean {
  return !esOcasional(tipo)
}

export const AYUDA_RNC_OCASIONAL =
  'Opcional para un cliente ocasional: se factura sin RNC por Factura de Consumo (E32) hasta RD$250,000.'
