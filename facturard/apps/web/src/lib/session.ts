export interface TenantInfo {
  id?: string
  rnc: string
  razonSocial: string
  plan: string
}

const TOKEN_KEY = 'frd_token'
const TENANT_KEY = 'frd_tenant'
const LOCATION_KEY = 'frd_location_id'

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
}
