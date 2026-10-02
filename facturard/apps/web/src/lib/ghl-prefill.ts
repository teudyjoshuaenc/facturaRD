/**
 * Datos de contacto del emisor que GoHighLevel puede pasar en el enlace del menú
 * personalizado, para prellenar el onboarding sin que el usuario los escriba:
 *
 *   https://APP_DOMAIN/?location_id={{location.id}}&email={{location.email}}
 *     &phone={{location.phone}}&address={{location.full_address}}
 *
 * (Variables de ubicación soportadas por GHL en Custom Menu Links. Si se usa
 * `{{location.address}}` sin ciudad, se puede añadir `&city={{location.city}}`.)
 * Todos son opcionales. Si GHL no reemplaza una variable llega literal
 * ("{{location.email}}") y se descarta.
 */
export interface GhlPrefill {
  email: string
  telefono: string
  direccion: string
}

export const GHL_PREFILL_PARAMS = ['email', 'phone', 'address', 'city'] as const

function limpio(v: string | null): string {
  const t = (v ?? '').trim()
  return t === '' || t.includes('{{') ? '' : t
}

export function leerGhlPrefill(params: URLSearchParams): GhlPrefill {
  const address = limpio(params.get('address'))
  const city = limpio(params.get('city'))
  return {
    email: limpio(params.get('email')),
    telefono: limpio(params.get('phone')),
    direccion: [address, city].filter(Boolean).join(', '),
  }
}

/** Copia los params de prefill presentes de `from` a `to` (para reenviarlos de / a /onboarding). */
export function reenviarGhlPrefill(from: URLSearchParams, to: URLSearchParams): void {
  for (const k of GHL_PREFILL_PARAMS) {
    const v = limpio(from.get(k))
    if (v) to.set(k, v)
  }
}
