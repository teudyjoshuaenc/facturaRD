import axios from 'axios'
import { clearRegistroToken, getRegistroToken, saveRefreshToken, saveSession, type TenantInfo } from './session'

// Cliente del registro directo (/registro/*). Usa su propio token: la sesión de
// registro sólo sirve para completar el registro, no para operar la empresa.

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '')

export const registroApi = axios.create({ baseURL: `${BASE_URL}/registro` })

registroApi.interceptors.request.use((config) => {
  const token = getRegistroToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

registroApi.interceptors.response.use(
  (r) => r,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && typeof window !== 'undefined') {
      const esLogin = error.config?.url?.includes('/login')
      if (!esLogin) {
        clearRegistroToken()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export type TipoEcf = 'E31' | 'E32' | 'E33' | 'E34' | 'E41' | 'E43' | 'E44' | 'E45' | 'E46' | 'E47'

export const TIPOS_COMPROBANTE: { value: TipoEcf; label: string }[] = [
  { value: 'E31', label: 'Crédito Fiscal (31)' },
  { value: 'E32', label: 'Consumo (32)' },
  { value: 'E33', label: 'Nota de Débito (33)' },
  { value: 'E34', label: 'Nota de Crédito (34)' },
  { value: 'E41', label: 'Compras (41)' },
  { value: 'E43', label: 'Gastos Menores (43)' },
  { value: 'E44', label: 'Regímenes Especiales (44)' },
  { value: 'E45', label: 'Gubernamental (45)' },
  { value: 'E46', label: 'Exportaciones (46)' },
  { value: 'E47', label: 'Pagos al Exterior (47)' },
]

export const TIPOS_REGISTRO = [
  { value: 'EMISOR_ELECTRONICO', label: 'Emisor electrónico' },
  { value: 'PROVEEDOR_SERVICIOS', label: 'Proveedor de servicios de facturación' },
]

export interface EstadoRegistro {
  email: string
  emailVerificado: boolean
  dosPasosActivo: boolean
  datosCompletos: boolean
  certificadoCargado: boolean
  ofvCargada: boolean
  completo: boolean
  tenant: { id: string; rnc: string; razonSocial: string } | null
}

interface Ubicacion {
  provincia: string
  municipio: string
  sector: string
  direccion: string
  telefono: string
  email: string
}

export interface Contribuyente extends Ubicacion {
  tipoRegistro: string
  tiposComprobante: TipoEcf[]
  tipoIdentificacion: 'RNC' | 'CEDULA'
  rnc: string
  razonSocial?: string
  nombreComercial?: string
  actividadEconomica: string
}

export interface Representante extends Ubicacion {
  identificacion: string
  pasaporte?: string
  nombreCompleto: string
  celular?: string
}

export interface SesionTenant {
  accessToken: string
  refreshToken: string
  tenant: TenantInfo & { id: string }
}

export interface Provincia {
  codigo: string
  nombre: string
  municipios: { codigo: string; nombre: string }[]
}

export async function cargarProvincias(): Promise<Provincia[]> {
  const res = await axios.get<Provincia[]>(`${BASE_URL}/catalogos/provincias`)
  return res.data
}

/** Guarda la sesión de la empresa (access + refresh) para entrar al panel. */
export function guardarSesionTenant(sesion: SesionTenant): void {
  saveSession(sesion.accessToken, sesion.tenant)
  saveRefreshToken(sesion.refreshToken)
}

/** Quita valores vacíos de un formulario antes de enviarlo (el API rechaza "" en campos opcionales). */
export function sinVacios<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as T
}
