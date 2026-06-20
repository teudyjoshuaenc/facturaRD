export type TipoECF = 'E31' | 'E32' | 'E33' | 'E34' | 'E41' | 'E43' | 'E44' | 'E45' | 'E46' | 'E47'

export type ComprobanteEstado =
  | 'PENDIENTE'
  | 'EN_COLA'
  | 'ENVIANDO'
  | 'ACEPTADO'
  | 'ACEPTADO_CONDICIONAL'
  | 'RECHAZADO'
  | 'ERROR'

export interface Comprobante {
  id: string
  tenantId: string
  eNCF: string
  tipoECF: TipoECF
  estado: ComprobanteEstado
  montoTotal: string | number
  rnc: string
  razonSocial: string
  pdfUrl: string | null
  trackId: string | null
  mensajeDGII: string | null
  createdAt: string
  updatedAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const ESTADO_LABELS: Record<ComprobanteEstado, string> = {
  PENDIENTE: 'Pendiente',
  EN_COLA: 'En cola',
  ENVIANDO: 'Enviando',
  ACEPTADO: 'Aceptado',
  ACEPTADO_CONDICIONAL: 'Aceptado c/obs.',
  RECHAZADO: 'Rechazado',
  ERROR: 'Error',
}

export const ESTADO_BADGE_VARIANT: Record<ComprobanteEstado, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PENDIENTE: 'neutral',
  EN_COLA: 'neutral',
  ENVIANDO: 'info',
  ACEPTADO: 'success',
  ACEPTADO_CONDICIONAL: 'warning',
  RECHAZADO: 'danger',
  ERROR: 'danger',
}

export const TIPO_ECF_LABELS: Record<TipoECF, string> = {
  E31: 'Crédito Fiscal (E31)',
  E32: 'Consumo (E32)',
  E33: 'Nota de Débito (E33)',
  E34: 'Nota de Crédito (E34)',
  E41: 'Compras (E41)',
  E43: 'Gastos Menores (E43)',
  E44: 'Regímenes Especiales (E44)',
  E45: 'Gubernamental (E45)',
  E46: 'Exportaciones (E46)',
  E47: 'Pagos al Exterior (E47)',
}

export function formatCurrency(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatCurrencyCompact(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export async function downloadComprobantePdf(
  api: { get: (url: string, config: object) => Promise<{ data: Blob }> },
  id: string,
  eNCF: string,
): Promise<void> {
  const res = await api.get(`/comprobantes/${id}/pdf`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${eNCF}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
