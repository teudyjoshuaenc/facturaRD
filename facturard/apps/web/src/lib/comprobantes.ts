export type TipoECF = 'E31' | 'E32' | 'E33' | 'E34' | 'E41' | 'E43' | 'E44' | 'E45' | 'E46' | 'E47'

export type ComprobanteEstado =
  | 'PENDIENTE'
  | 'EN_COLA'
  | 'ENVIANDO'
  | 'ACEPTADO'
  | 'ACEPTADO_CONDICIONAL'
  | 'RECHAZADO'
  | 'ERROR'
  | 'DRAFT'

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
  datos?: any
  cotizacionId?: string | null
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
  DRAFT: 'Borrador',
}

export const ESTADO_BADGE_VARIANT: Record<ComprobanteEstado, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PENDIENTE: 'neutral',
  EN_COLA: 'neutral',
  ENVIANDO: 'info',
  ACEPTADO: 'success',
  ACEPTADO_CONDICIONAL: 'warning',
  RECHAZADO: 'danger',
  ERROR: 'danger',
  DRAFT: 'neutral',
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
  if (!value) return ''
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match && match[1] && match[2] && match[3]) {
    return `${match[3]}-${match[2]}-${match[1]}`
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  const hasTime = value.includes('T') || value.includes(' ')
  const day = String(hasTime ? date.getDate() : date.getUTCDate()).padStart(2, '0')
  const month = String((hasTime ? date.getMonth() : date.getUTCMonth()) + 1).padStart(2, '0')
  const year = hasTime ? date.getFullYear() : date.getUTCFullYear()
  return `${day}-${month}-${year}`
}

async function downloadPdfBlob(
  api: { get: (url: string, config: object) => Promise<{ data: Blob }> },
  url: string,
  filename: string,
): Promise<void> {
  const res = await api.get(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadComprobantePdf(
  api: { get: (url: string, config: object) => Promise<{ data: Blob }> },
  id: string,
  eNCF: string,
): Promise<void> {
  // eNCF puede venir vacío en borradores; el backend nombra el archivo, aquí sólo
  // damos un nombre de descarga razonable.
  await downloadPdfBlob(api, `/comprobantes/${id}/pdf`, `${eNCF || 'borrador'}.pdf`)
}

export async function downloadCotizacionPdf(
  api: { get: (url: string, config: object) => Promise<{ data: Blob }> },
  id: string,
  folio: string,
): Promise<void> {
  await downloadPdfBlob(api, `/cotizaciones/${id}/pdf`, `${folio || 'cotizacion'}.pdf`)
}
