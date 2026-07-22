import { Injectable } from '@nestjs/common'

export const GHL_BASE_URL = 'https://services.leadconnectorhq.com'

// Versión de la API v2 de GHL. Verificada contra la doc oficial y confirmada
// empíricamente contra producción (el probe de /conversations/messages/upload
// devolvió 201 con este header). La doc rotula la página como "v3" pero el
// selector de versiones sigue ofreciendo — y el API sigue aceptando — ésta.
export const GHL_VERSION = '2021-07-28'

export interface GhlRequestInit {
  method?: string
  /** Cuerpo JSON. Fija Content-Type: application/json. */
  json?: unknown
  /**
   * Cuerpo multipart. NO se fija Content-Type a propósito: fetch debe generarlo
   * él mismo para incluir el `boundary`. Ponerlo a mano rompe el upload.
   */
  form?: FormData
}

/**
 * Cliente HTTP compartido para la API v2 de GoHighLevel.
 *
 * Centraliza las dos rarezas de autenticación que ya habíamos descubierto con
 * la sincronización de contactos, para no re-implementarlas por módulo:
 *  - Los Private Integration Token se documentan tanto como
 *    'Authorization: Bearer <token>' como 'Authorization: <token>'. Se intenta
 *    con Bearer y, ante 401/403, se reintenta sin él.
 *  - GHL exige el header `Version`.
 */
@Injectable()
export class GhlHttpService {
  async request(url: string, token: string, init: GhlRequestInit = {}): Promise<Response> {
    const { method = 'GET', json, form } = init

    // El body se construye en cada intento: un FormData es reutilizable, pero
    // mantenerlo dentro del closure evita depender de ese detalle.
    const build = (auth: string): RequestInit => {
      const headers: Record<string, string> = { Authorization: auth, Version: GHL_VERSION, Accept: 'application/json' }
      if (form !== undefined) {
        // sin Content-Type: lo pone fetch con su boundary
        return { method, headers, body: form }
      }
      if (json !== undefined) {
        headers['Content-Type'] = 'application/json'
        return { method, headers, body: JSON.stringify(json) }
      }
      return { method, headers }
    }

    let res = await fetch(url, build(`Bearer ${token}`))
    if (res.status === 401 || res.status === 403) {
      res = await fetch(url, build(token))
    }
    return res
  }
}
