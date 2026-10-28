import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

// TOTP (RFC 6238) compatible con Google Authenticator: HMAC-SHA1, 6 dígitos,
// pasos de 30 s. Implementado con `crypto` de Node para no sumar dependencias.

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PASO_SEGUNDOS = 30
const DIGITOS = 6

function base32Encode(buf: Buffer): string {
  let bits = 0
  let valor = 0
  let out = ''
  for (const byte of buf) {
    valor = (valor << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALFABETO_BASE32[(valor << (5 - bits)) & 31]
  return out
}

function base32Decode(texto: string): Buffer {
  const limpio = texto.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase()
  let bits = 0
  let valor = 0
  const out: number[] = []
  for (const c of limpio) {
    const i = ALFABETO_BASE32.indexOf(c)
    if (i < 0) throw new Error('Secreto TOTP inválido')
    valor = (valor << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** Secreto nuevo de 160 bits en base32 (lo que se guarda cifrado y va en el QR). */
export function generarSecretoTotp(): string {
  return base32Encode(randomBytes(20))
}

/** Código de 6 dígitos para un instante dado. */
export function codigoTotp(secreto: string, instanteMs = Date.now()): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(instanteMs / 1000 / PASO_SEGUNDOS)))
  const hmac = createHmac('sha1', base32Decode(secreto)).update(contador).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binario = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITOS
  return String(binario).padStart(DIGITOS, '0')
}

/** Verifica un código aceptando ±1 paso (30 s) de desfase de reloj. */
export function verificarTotp(secreto: string, codigo: string, instanteMs = Date.now()): boolean {
  const limpio = String(codigo ?? '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(limpio)) return false
  for (const desfase of [-1, 0, 1]) {
    const esperado = codigoTotp(secreto, instanteMs + desfase * PASO_SEGUNDOS * 1000)
    if (timingSafeEqual(Buffer.from(esperado), Buffer.from(limpio))) return true
  }
  return false
}

/** URL `otpauth://` que se convierte en el QR para Google Authenticator. */
export function urlOtpauth(secreto: string, cuenta: string, emisor = 'FacturaRD'): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`)
  return `otpauth://totp/${etiqueta}?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASO_SEGUNDOS}`
}
