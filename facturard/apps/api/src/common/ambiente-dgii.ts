import { AmbienteDgii } from '@facturard/database'
import { resolveDgiiEnv, type DgiiEnv } from '@facturard/ecf-engine'

// Enum de la BD ↔ ambiente del ecf-engine. Un tenant con ambienteDgii null usa
// el DGII_ENV del servidor, así un cliente puede estar en producción y otro en
// pruebas en la misma instancia sin reiniciar nada.
const A_ENV: Record<AmbienteDgii, DgiiEnv> = {
  TESTECF: 'testecf',
  CERTECF: 'certecf',
  ECF: 'ecf',
}

const A_ENUM: Record<DgiiEnv, AmbienteDgii> = {
  testecf: AmbienteDgii.TESTECF,
  certecf: AmbienteDgii.CERTECF,
  ecf: AmbienteDgii.ECF,
}

export function dgiiEnvDe(ambiente: AmbienteDgii | null | undefined): DgiiEnv {
  return resolveDgiiEnv(ambiente ? A_ENV[ambiente] : null)
}

export function ambienteDgiiDe(env: DgiiEnv): AmbienteDgii {
  return A_ENUM[env]
}
