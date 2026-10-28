import axios from 'axios'

// Cliente del panel DMAIA (/admin/*). Totalmente separado de la app de clientes:
// su propio token (en sessionStorage: se borra al cerrar la pestaña) y su propia
// confirmación 2FA (en memoria, 5 minutos) para los datos sensibles.

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '')
const TOKEN_KEY = 'frd_admin_token'
const ADMIN_KEY = 'frd_admin'

export interface AdminSesion {
  id: string
  email: string
  nombre: string
  rol: 'ADMIN' | 'SOPORTE'
}

export function guardarSesionAdmin(token: string, admin: AdminSesion): void {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
}

export function sesionAdmin(): AdminSesion | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_KEY) ?? 'null') as AdminSesion | null
  } catch {
    return null
  }
}

export function cerrarSesionAdmin(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(ADMIN_KEY)
  confirmacion = null
}

let confirmacion: { token: string; expira: number } | null = null

export function guardarConfirmacionAdmin(token: string, minutos: number): void {
  confirmacion = { token, expira: Date.now() + minutos * 60_000 }
}

export function confirmacionAdmin(): string | null {
  if (confirmacion && Date.now() < confirmacion.expira) return confirmacion.token
  confirmacion = null
  return null
}

export const adminApi = axios.create({ baseURL: `${BASE_URL}/admin` })

adminApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  const conf = confirmacionAdmin()
  if (conf) config.headers['x-2fa-admin'] = conf
  return config
})

adminApi.interceptors.response.use(
  (r) => r,
  (error: unknown) => {
    const url = axios.isAxiosError(error) ? error.config?.url ?? '' : ''
    if (axios.isAxiosError(error) && error.response?.status === 401 && !url.startsWith('/auth') && typeof window !== 'undefined') {
      cerrarSesionAdmin()
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  },
)

export function mensajeError(err: unknown, porDefecto = 'Ocurrió un error'): string {
  if (axios.isAxiosError(err)) {
    const m = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (m) return Array.isArray(m) ? m.join(', ') : m
  }
  return porDefecto
}

export function esRequiere2fa(err: unknown): boolean {
  return axios.isAxiosError(err) && (err.response?.data as { codigo?: string } | undefined)?.codigo === 'REQUIERE_2FA'
}

// ── Tipos de respuesta ──────────────────────────────────────────────────────

export interface ClienteResumen {
  id: string
  rnc: string
  razonSocial: string
  nombreComercial: string | null
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO'
  plan: string
  ambienteDgii: 'TESTECF' | 'CERTECF' | 'ECF' | null
  creado: string
  registro: { email: string; dosPasos: boolean; completo: boolean } | null
  certificadoVence: string | null
  ofv: boolean
  crm: boolean
  errores: number
  rechazados: number
}

export interface ListaClientes {
  total: number
  pagina: number
  porPagina: number
  clientes: ClienteResumen[]
}

export const fecha = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const fechaHora = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
