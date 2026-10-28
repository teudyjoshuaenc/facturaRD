import axios, { type InternalAxiosRequestConfig } from 'axios'
import { getToken, saveSession, clearSession, getLocationId, getRefreshToken, saveRefreshToken, getTenant } from './session'
import type { TenantInfo } from './session'
import { confirmacion2fa } from './confirmacion2fa'

// Sin slash final: la llamada de reautenticación más abajo concatena
// `${BASE_URL}/ghl/init` a mano (no usa el join de axios, que sí tolera
// slashes duplicados) — con un env var que termine en "/" eso arma
// ".../api/v1//ghl/init", la API responde 404 y el refresh queda roto.
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '')

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Confirmación 2FA vigente (secciones Empresa / Configuración)
  const confirmado = confirmacion2fa()
  if (confirmado) config.headers['x-2fa'] = confirmado
  return config
})

// --- 401 → re-auth via GHL init (token rotation) ---

type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void }
let refreshing = false
const queue: QueueItem[] = []

function flushQueue(err: unknown, token: string | null): void {
  queue.forEach((item) => (err ? item.reject(err) : item.resolve(token!)))
  queue.length = 0
}

interface GhlInitResponse {
  token?: string
  tenant?: TenantInfo
  onboarding?: boolean
  requiereLogin?: boolean
}

/** Renueva la sesión: con refresh token (login con correo) o, si no hay, vía GHL init. */
async function renovarSesion(): Promise<string> {
  const refreshToken = getRefreshToken()
  const tenantActual = getTenant()
  if (refreshToken && tenantActual) {
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(`${BASE_URL}/auth/refresh`, {
      refreshToken,
    })
    saveSession(res.data.accessToken, tenantActual)
    saveRefreshToken(res.data.refreshToken)
    return res.data.accessToken
  }

  const locationId = getLocationId()
  if (!locationId) throw new Error('No location_id stored — cannot re-authenticate')
  // Re-authenticate via GHL init (bypasses api interceptors to avoid loop)
  const res = await axios.get<GhlInitResponse>(`${BASE_URL}/ghl/init`, {
    params: { location_id: locationId },
  })
  const { token, tenant } = res.data
  if (!token || !tenant) throw new Error('GHL init did not return a token')
  saveSession(token, tenant)
  return token
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    const is401 = error.response?.status === 401
    const alreadyRetried = original._retry === true
    const isInitCall = (original.url?.includes('/ghl/init') || original.url?.includes('/auth/refresh')) ?? false

    if (!is401 || alreadyRetried || isInitCall) {
      return Promise.reject(error)
    }

    original._retry = true

    if (refreshing) {
      return new Promise<string>((resolve, reject) => {
        queue.push({ resolve, reject })
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      })
    }

    refreshing = true

    try {
      const token = await renovarSesion()
      flushQueue(null, token)

      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch (refreshError) {
      flushQueue(refreshError, null)
      const conCorreo = getRefreshToken() !== null
      clearSession()
      if (typeof window !== 'undefined') window.location.href = conCorreo ? '/login' : '/'
      return Promise.reject(refreshError)
    } finally {
      refreshing = false
    }
  },
)

export interface ApiErrorResponse {
  statusCode: number
  message: string | string[]
  error?: string
}

export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorResponse | undefined
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message
    }
  }
  return fallback
}
