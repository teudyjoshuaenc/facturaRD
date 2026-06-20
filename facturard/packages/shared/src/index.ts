// Shared domain types used across apps and packages

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  statusCode: number
  message: string
  error?: string
  timestamp: string
  path: string
}

export type TipoECF =
  | 'E31'
  | 'E32'
  | 'E33'
  | 'E34'
  | 'E41'
  | 'E43'
  | 'E44'
  | 'E45'
  | 'E46'
  | 'E47'

export type ComprobanteEstado =
  | 'PENDIENTE'
  | 'EN_COLA'
  | 'ENVIANDO'
  | 'ACEPTADO'
  | 'ACEPTADO_CONDICIONAL'
  | 'RECHAZADO'
  | 'ERROR'

export interface ResumenComprobantes {
  totalFacturas: number
  montoTotal: number
  itbisTotal: number
  pendientes: number
  rechazadas: number
  aceptadas: number
}

export type Plan = 'BASICO' | 'PYME' | 'PRO'

export type UserRole = 'ADMIN' | 'USUARIO' | 'CONTADOR'
