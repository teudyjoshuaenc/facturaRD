import { Injectable } from '@nestjs/common'
import { autenticar, consultarTrackIds, type DgiiEnv } from '@facturard/ecf-engine'

/**
 * Frontera de red con la DGII para la detección de secuencias. Vive en su propio
 * provider para que los e2e lo reemplacen (igual que la cola de emisión): los
 * tests nunca contactan a la DGII.
 */
@Injectable()
export class DgiiTrackIdsClient {
  /** Abre sesión con el P12 del tenant y devuelve el token bearer. */
  autenticar(p12Buffer: Buffer, passphrase: string, env: DgiiEnv): Promise<string> {
    return autenticar({ p12Buffer, passphrase, env })
  }

  /** ¿La DGII ya recibió este e-NCF? Lanza ante cualquier respuesta no válida. */
  async recibido(rncEmisor: string, eNCF: string, token: string, env: DgiiEnv): Promise<boolean> {
    const r = await consultarTrackIds(rncEmisor, eNCF, token, { env })
    return r.recibido
  }
}
