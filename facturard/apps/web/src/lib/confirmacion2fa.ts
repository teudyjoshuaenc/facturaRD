// Token corto (10 min) que se obtiene al confirmar el código 2FA para entrar a
// Empresa / Configuración. Vive SÓLO en memoria: al salir de la sección o recargar,
// se vuelve a pedir el código.

let token: string | null = null
let expira = 0

export function guardarConfirmacion2fa(nuevo: string, minutos: number): void {
  token = nuevo
  expira = Date.now() + minutos * 60_000
}

export function confirmacion2fa(): string | null {
  if (token && Date.now() < expira) return token
  token = null
  return null
}

export function borrarConfirmacion2fa(): void {
  token = null
  expira = 0
}
