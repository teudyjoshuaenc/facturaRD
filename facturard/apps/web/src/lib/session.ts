export interface TenantInfo {
  id?: string
  rnc: string
  razonSocial: string
  plan: string
  finanzasHabilitado?: boolean
}

const TOKEN_KEY = 'frd_token'
const TENANT_KEY = 'frd_tenant'
const LOCATION_KEY = 'frd_location_id'
const REFRESH_KEY = 'frd_refresh'
const REGISTRO_KEY = 'frd_registro'

export function saveSession(token: string, tenant: TenantInfo): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant))
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getTenant(): TenantInfo | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(TENANT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TenantInfo
  } catch {
    return null
  }
}

export function saveLocationId(locationId: string): void {
  localStorage.setItem(LOCATION_KEY, locationId)
}

export function getLocationId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LOCATION_KEY)
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TENANT_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Sesiones con correo y contraseña (registro directo): además del access token
// se guarda el refresh para rotarlo en /auth/refresh en vez de /ghl/init.
export function saveRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

/** Token de la sesión de registro (permisos básicos: sólo completar el registro). */
export function saveRegistroToken(token: string): void {
  localStorage.setItem(REGISTRO_KEY, token)
}

export function getRegistroToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REGISTRO_KEY)
}

export function clearRegistroToken(): void {
  localStorage.removeItem(REGISTRO_KEY)
}
