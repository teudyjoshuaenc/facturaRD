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
  | 'INTERNO'

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
  // Fase 2: discriminador y folio interno de Nota de venta.
  esFiscal?: boolean
  folioInterno?: string | null
  /**
   * Correo del comprador, resuelto por el backend desde el Contacto local. NO
   * es una columna del comprobante: el snapshot fiscal no guarda correo.
   * Es la ÚNICA fuente válida para mostrar a dónde sale el envío.
   */
  contactoEmail?: string | null
}

// Clase de documento derivada (para badge/filtro en la lista).
export type ClaseDocumento = 'fiscal' | 'borrador' | 'nota'

/**
 * Clase de un documento. El ORDEN importa: `DRAFT` manda sobre todo lo demás.
 *
 * Una nota de venta TAMBIÉN puede estar en borrador: el backend guarda
 * `estado='DRAFT', esFiscal=false` y sólo le asigna el folio `NV-` cuando se
 * finaliza (pasa a `INTERNO`). Si se mirara `esFiscal` primero, ese documento
 * se mostraría como "Nota de venta" ya creada cuando en realidad es un borrador
 * sin folio. Un borrador es un borrador sea fiscal (E31/E34/…) o no.
 */
export function claseDocumento(c: Pick<Comprobante, 'esFiscal' | 'estado'>): ClaseDocumento {
  if (c.estado === 'DRAFT') return 'borrador'
  if (c.esFiscal === false) return 'nota'
  return 'fiscal'
}

export const CLASE_LABELS: Record<ClaseDocumento, string> = {
  fiscal: 'Fiscal',
  borrador: 'Borrador',
  nota: 'Nota de venta',
}

// ─────────────────────────────────────────────────────────────────────────────
// FUENTE ÚNICA de presentación de un comprobante en listas.
//
// Tres dimensiones ORTOGONALES, cada una en su propia columna/filtro:
//   1. ESTADO DGII  → qué dijo la DGII. Sólo aplica a lo que viaja a la DGII.
//   2. TIPO/CLASE   → qué ES el documento (e-CF E31/E32/…, borrador, nota).
//   3. ORIGEN       → de dónde viene (cotización convertida). Nunca sustituye
//                     al estado: una factura rechazada que vino de cotización
//                     se muestra RECHAZADA.
//
// Ningún componente debe declarar labels propios: todo sale de aquí.
// ─────────────────────────────────────────────────────────────────────────────

/** Estados transitorios del ciclo DGII: el comprobante sigue viajando. */
export const ESTADOS_EN_PROCESO: readonly ComprobanteEstado[] = ['PENDIENTE', 'EN_COLA', 'ENVIANDO']

/**
 * Mientras un comprobante está en proceso, el worker lo envía a la DGII y lo
 * cambia a ACEPTADO/RECHAZADO en segundos; las vistas re-consultan cada tanto
 * para que el estado se actualice sin recargar la página.
 */
export const POLL_EN_PROCESO_MS = 3000

export function enProceso(c: Pick<Comprobante, 'estado'> | null | undefined): boolean {
  return !!c && ESTADOS_EN_PROCESO.includes(c.estado)
}

/**
 * Máximo de caracteres del nombre de un artículo. La DGII lo limita a 80
 * (`NombreItem` es `AlfNum80Type` en los XSD e-CF 31/32/33/34). El backend lo
 * rechaza con 400; el front lo tope-a aquí para no dejar teclear de más y evitar
 * el viaje ida y vuelta. El nombre del producto es la fuente del snapshot, así
 * que el tope va sobre el nombre del producto.
 */
export const MAX_NOMBRE_ITEM = 80

/**
 * Tope de `DescripcionItem` en los XSD de la DGII (AlfNum1000Type).
 */
export const MAX_DESCRIPCION_ITEM = 1000

/**
 * Desagrega el ITBIS de un precio "con impuesto incluido".
 *
 * Todo el sistema (DTO, XML, PDF, totales) trabaja con el precio BASE sin ITBIS:
 * "el precio incluye ITBIS" es sólo una comodidad de captura, y la conversión
 * ocurre una sola vez, al guardar en el formulario. Redondea a 2 decimales
 * porque el backend rechaza precios con más (`maxDecimalPlaces: 2`).
 */
export function precioBaseSinItbis(precio: number, rate: number, incluye = true): number {
  if (!incluye || !rate || !Number.isFinite(precio)) return precio
  return Math.round((precio / (1 + rate)) * 100) / 100
}

/**
 * Inversa de `precioBaseSinItbis`: reconstruye el precio TAL COMO LO ESCRIBIÓ el
 * usuario a partir de la base guardada. Necesaria al reabrir un formulario: si
 * el producto se capturó "con ITBIS incluido" hay que mostrar el total, no la
 * base. Sin esto el input mostraba la base con el check apagado y volver a
 * marcarlo dividía un precio YA dividido — el monto bajaba en cada edición.
 */
export function precioSegunCaptura(
  base: number,
  rate: number,
  incluye = false,
  precioCaptura?: number | null,
): number {
  if (!incluye || !rate || !Number.isFinite(base)) return base
  // El monto tecleado manda: reconstruirlo desde la base pierde un centavo
  // (15,000 → 12,711.86 → 14,999.99). Sólo se recalcula si no lo tenemos
  // (productos capturados antes de que se guardara).
  if (precioCaptura != null && Number.isFinite(precioCaptura) && precioCaptura > 0) return precioCaptura
  return Math.round(base * (1 + rate) * 100) / 100
}

/**
 * Identificador visible del documento: e-NCF si es fiscal, folio NV- si es nota
 * de venta. Espejo de `EnvioComprobanteService.referencia()` en el backend.
 */
export function referenciaComprobante(c: Pick<Comprobante, 'eNCF' | 'folioInterno'>): string {
  return c.eNCF || c.folioInterno || '—'
}

/**
 * Si el comprobante tiene un PDF que se pueda adjuntar a un correo. Rechazado y
 * error NO llegaron a representar nada válido: el backend responde 404 al pedir
 * su PDF y aborta el lote completo. Se comprueba en el front sólo para no
 * ofrecer un envío que ya sabemos que va a fallar — la regla la sostiene el backend.
 */
export function tienePdfEnviable(c: Pick<Comprobante, 'estado'>): boolean {
  return c.estado !== 'RECHAZADO' && c.estado !== 'ERROR'
}

/** Estados que NO pertenecen al ciclo DGII (el documento nunca se envía). */
export const ESTADOS_SIN_DGII: readonly ComprobanteEstado[] = ['DRAFT', 'INTERNO']

export type EstadoDgiiTono = 'success' | 'warning' | 'danger' | 'proceso' | 'noAplica'

export interface EstadoDgiiBadge {
  /** Texto a mostrar en la columna "Estado DGII" ('—' si no aplica). */
  label: string
  tono: EstadoDgiiTono
  /** false → borrador o nota de venta: no tiene estado fiscal que mostrar. */
  aplicaDgii: boolean
  /** Tooltip explicativo (por qué ese estado / por qué no aplica). */
  titulo: string
}

/**
 * Estado del ciclo DGII de un comprobante. Es la ÚNICA función que decide qué
 * se pinta en la columna "Estado DGII".
 *
 * ERROR es TERMINAL (se agotaron los reintentos de BullMQ): se muestra como
 * fallo que requiere atención, nunca con el spinner de "en proceso".
 */
export function estadoDgiiBadge(estado: ComprobanteEstado): EstadoDgiiBadge {
  switch (estado) {
    case 'ACEPTADO':
      return { label: 'Aceptado', tono: 'success', aplicaDgii: true, titulo: 'Aceptado por la DGII' }
    case 'ACEPTADO_CONDICIONAL':
      return {
        label: 'Aceptado c/obs.',
        tono: 'warning',
        aplicaDgii: true,
        titulo: 'Aceptado por la DGII con observaciones',
      }
    case 'RECHAZADO':
      return { label: 'Rechazado', tono: 'danger', aplicaDgii: true, titulo: 'Rechazado por la DGII' }
    case 'ERROR':
      return {
        label: 'Error',
        tono: 'danger',
        aplicaDgii: true,
        titulo: 'Error de envío: no se pudo entregar a la DGII tras los reintentos. Requiere atención.',
      }
    case 'PENDIENTE':
    case 'EN_COLA':
    case 'ENVIANDO':
      return { label: 'En proceso', tono: 'proceso', aplicaDgii: true, titulo: 'En proceso ante la DGII' }
    case 'DRAFT':
      return {
        label: '—',
        tono: 'noAplica',
        aplicaDgii: false,
        titulo: 'Borrador: todavía no se ha enviado a la DGII',
      }
    case 'INTERNO':
      return {
        label: '—',
        tono: 'noAplica',
        aplicaDgii: false,
        titulo: 'Nota de venta interna: no es un e-CF, no se envía a la DGII',
      }
  }
}

export interface TipoClaseBadge {
  /** El TIPO del documento: tipo de e-CF legible o "Nota de venta". Nunca "Borrador". */
  label: string
  clase: ClaseDocumento
  /** Tooltip: en borradores conserva el tipo e-CF que se emitiría. */
  titulo: string
}

/** Qué ES el documento. Única fuente de la columna "Tipo / Clase". */
export function tipoClaseBadge(
  c: Pick<Comprobante, 'esFiscal' | 'estado' | 'tipoECF'>,
): TipoClaseBadge {
  const clase = claseDocumento(c)
  const tipoLabel = TIPO_ECF_LABELS[c.tipoECF] ?? c.tipoECF
  // La columna SIEMPRE muestra el TIPO del documento: "Nota de venta" para lo no
  // fiscal, o el tipo de e-CF para lo fiscal. Que sea un borrador ya lo dice la
  // columna del e-NCF, así que aquí NO se rotula "Borrador".
  if (c.esFiscal === false) {
    return { label: 'Nota de venta', clase, titulo: 'Documento interno sin valor fiscal (no es un e-CF)' }
  }
  // Fiscal (emitido o borrador): su tipo de e-CF.
  const titulo = clase === 'borrador' ? `Borrador de ${tipoLabel} — aún no emitido` : tipoLabel
  return { label: tipoLabel, clase, titulo }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Label granular de cada estado — para vistas de DETALLE (historial, tarjeta de
 * estado), donde distinguir "En cola" de "Enviando" sí aporta. En las LISTAS se
 * usa `estadoDgiiBadge()`, que agrupa los transitorios en "En proceso".
 */
export const ESTADO_LABELS: Record<ComprobanteEstado, string> = {
  PENDIENTE: 'Pendiente',
  EN_COLA: 'En cola',
  ENVIANDO: 'Enviando',
  ACEPTADO: 'Aceptado',
  ACEPTADO_CONDICIONAL: 'Aceptado c/obs.',
  RECHAZADO: 'Rechazado',
  ERROR: 'Error',
  DRAFT: 'Borrador',
  INTERNO: 'Nota de venta',
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
  INTERNO: 'neutral',
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

/**
 * Tipos que el sistema emite hoy en la práctica (los que ofrece el formulario y
 * para los que hay secuencias configuradas). El filtro de Tipo se limita a
 * éstos: ofrecer E41/E43/E44/E45/E46/E47 daba filtros que nunca devuelven nada.
 * Los demás siguen mostrándose en la columna Tipo si existiera alguno.
 */
export const TIPOS_ECF_EMITIDOS: readonly TipoECF[] = ['E31', 'E32', 'E33', 'E34']

// ─── Opciones de filtro (compartidas por la barra de filtros y el hook) ──────

/** Filtro de Estado DGII. 'EN_PROCESO' agrupa PENDIENTE|EN_COLA|ENVIANDO. */
export type EstadoFiltro =
  | 'todos'
  | 'ACEPTADO'
  | 'ACEPTADO_CONDICIONAL'
  | 'RECHAZADO'
  | 'EN_PROCESO'
  | 'ERROR'

export type ClaseFiltro = 'todos' | ClaseDocumento
export type OrigenFiltro = 'todos' | 'cotizacion'

/** Estados reales que el backend debe filtrar para cada opción del selector. */
export function estadosDeFiltro(filtro: EstadoFiltro): ComprobanteEstado[] {
  if (filtro === 'todos') return []
  if (filtro === 'EN_PROCESO') return [...ESTADOS_EN_PROCESO]
  return [filtro]
}

export const ESTADO_FILTER_OPTIONS: { value: EstadoFiltro; label: string }[] = [
  { value: 'todos', label: 'Estado DGII' },
  { value: 'ACEPTADO', label: 'Aceptado' },
  { value: 'ACEPTADO_CONDICIONAL', label: 'Aceptado c/obs.' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'ERROR', label: 'Error' },
]

export const CLASE_FILTER_OPTIONS: { value: ClaseFiltro; label: string }[] = [
  { value: 'todos', label: 'Clase' },
  { value: 'fiscal', label: 'Fiscal (e-CF)' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'nota', label: 'Nota de venta' },
]

export const TIPO_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Tipo' },
  ...TIPOS_ECF_EMITIDOS.map((t) => ({ value: t, label: TIPO_ECF_LABELS[t] })),
]

export const ORIGEN_FILTER_OPTIONS: { value: OrigenFiltro; label: string }[] = [
  { value: 'todos', label: 'Origen' },
  { value: 'cotizacion', label: 'Desde cotización' },
]

/**
 * RNC (empresas/negocios) = 9 dígitos. Cédula (persona física) = 11 dígitos.
 * Mismo criterio de largo que ya usan los modales de contacto (formatRncInput).
 */
export function etiquetaIdentificacion(valor: string | null | undefined): 'RNC' | 'Cédula' {
  const limpio = (valor ?? '').replace(/\D/g, '')
  return limpio.length === 11 ? 'Cédula' : 'RNC'
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

const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** "Mes DD, AAAA" — misma lógica UTC-vs-local que formatDate() para evitar
 * que una fecha sin hora (YYYY-MM-DD) se corra un día por timezone. */
function formatFechaLarga(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  const hasTime = value.includes('T') || value.includes(' ')
  const day = hasTime ? date.getDate() : date.getUTCDate()
  const month = hasTime ? date.getMonth() : date.getUTCMonth()
  const year = hasTime ? date.getFullYear() : date.getUTCFullYear()
  return `${MESES_LARGO[month]} ${day}, ${year}`
}

/** Quita caracteres inválidos en nombres de archivo (Windows/macOS/Linux). */
function sanitizeNombreArchivo(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

function nombreArchivoDocumento(prefijo: string, numero: string, cliente: string, fecha: string): string {
  const partes = [`${prefijo} #${numero || 'S-N'}`, `- ${cliente || 'Consumidor Final'}`, formatFechaLarga(fecha)]
    .filter(Boolean)
  return `${sanitizeNombreArchivo(partes.join(' '))}.pdf`
}

export async function downloadComprobantePdf(
  api: { get: (url: string, config: object) => Promise<{ data: Blob }> },
  id: string,
  eNCF: string,
  cliente: string,
  fecha: string,
): Promise<void> {
  const filename = nombreArchivoDocumento('Factura', eNCF, cliente, fecha)
  await downloadPdfBlob(api, `/comprobantes/${id}/pdf`, filename)
}

export async function downloadCotizacionPdf(
  api: { get: (url: string, config: object) => Promise<{ data: Blob }> },
  id: string,
  folio: string,
  cliente: string,
  fecha: string,
): Promise<void> {
  const filename = nombreArchivoDocumento('Cotización', folio, cliente, fecha)
  await downloadPdfBlob(api, `/cotizaciones/${id}/pdf`, filename)
}
