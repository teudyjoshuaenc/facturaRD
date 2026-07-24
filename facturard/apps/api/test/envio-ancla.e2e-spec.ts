import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { ComprobantesService } from '../src/modules/comprobantes/comprobantes.service'
import { CryptoService } from '../src/common/services/crypto.service'

// e2e — CASCADA DEL CONTACTO ANCLA.
//
// La API v2 de GHL es contact-first: enviar EXIGE un contactId. Sólo el ancla
// tiene esa restricción (los demás destinatarios van en emailCc, que acepta
// direcciones cualesquiera).
//
// Este spec sostiene la regla más delicada del módulo: **crear un contacto
// ESCRIBE en el CRM del cliente**, así que sólo puede pasar cuando no hay
// ninguna alternativa, con datos mínimos y de forma auditable.
//
// Orden: contacto local → contacto en GHL → contacto de la factura → crear.
describe('Ancla del correo: cascada de contacto (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let fetchSpy: jest.SpyInstance
  let pdfSpy: jest.SpyInstance

  const UPLOAD_URL = 'conversations/messages/upload'
  const MESSAGES_URL = 'conversations/messages'
  const DUPLICADO_URL = 'contacts/search/duplicate'
  const CONTACTS_URL = 'contacts/'
  const LOTE = '/api/v1/comprobantes/enviar-lote'
  /** `GhlLocation.locationId` es único global: uno por tenant de prueba. */
  const locIdDe = (t: TestTenant) => `loc-${t.tenant.id}`

  let encfSeq = 0
  const srv = () => app.getHttpServer()
  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  const jsonRes = (body: unknown, status = 200): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

  /**
   * Mock de GHL parametrizable por el caso: qué devuelve la búsqueda de
   * duplicados y qué devuelve la creación.
   */
  const mockGhl = (opts: { duplicado?: { id: string } | null; crearStatus?: number } = {}): void => {
    const { duplicado = null, crearStatus = 201 } = opts
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      // El orden importa: la URL de duplicados también contiene "contacts/".
      if (url.includes(DUPLICADO_URL)) {
        return duplicado
          ? Promise.resolve(jsonRes({ contact: { id: duplicado.id, contactName: 'HALLADO EN GHL' } }, 200))
          : Promise.resolve(jsonRes({ message: 'not found' }, 404))
      }
      if (url.includes(CONTACTS_URL)) {
        return crearStatus === 201
          ? Promise.resolve(jsonRes({ contact: { id: 'ghl-nuevo-999' } }, 201))
          : Promise.resolve(jsonRes({ message: 'forbidden' }, crearStatus))
      }
      if (url.includes(UPLOAD_URL)) return Promise.resolve(jsonRes({ uploadedFiles: { 'f.pdf': 'https://storage.ghl/f.pdf' } }, 201))
      if (url.includes(MESSAGES_URL)) return Promise.resolve(jsonRes({ messageId: 'msg-1', conversationId: 'conv-1' }, 201))
      return Promise.resolve(jsonRes({}, 404))
    })
  }

  const llamadas = (fragmento: string) =>
    fetchSpy.mock.calls.filter((c) => String(c[0]).includes(fragmento))
  const llamadasCrear = () =>
    fetchSpy.mock.calls.filter((c) => String(c[0]).includes(CONTACTS_URL) && !String(c[0]).includes(DUPLICADO_URL))
  const payloadCrear = () => JSON.parse((llamadasCrear()[0]![1] as RequestInit).body as string)

  /** Tenant con GHL conectado y location vinculada (como sale del onboarding). */
  const tenantConGhl = async (opts: { conLocation?: boolean } = {}): Promise<TestTenant> => {
    const t = await createTenant()
    const crypto = app.get(CryptoService)
    await prisma.tenant.update({
      where: { id: t.tenant.id },
      data: { ghlAccessToken: crypto.encryptString('pit-token-de-prueba') },
    })
    if (opts.conLocation !== false) {
      await prisma.ghlLocation.create({ data: { tenantId: t.tenant.id, locationId: locIdDe(t) } })
    }
    return t
  }

  const mkComprobante = async (t: TestTenant, rnc = '131880681') =>
    prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id,
        eNCF: `E31${String(++encfSeq).padStart(10, '0')}`,
        tipoECF: 'E31', estado: 'ACEPTADO', montoTotal: 1180,
        rnc, razonSocial: 'CLIENTE SRL',
        createdAt: new Date('2026-05-15T10:00:00-04:00'),
      },
    })

  const mkContacto = async (
    t: TestTenant,
    opts: { rnc?: string; email?: string | null; ghlContactId?: string | null; razonSocial?: string } = {},
  ) =>
    prisma.contacto.create({
      data: {
        tenantId: t.tenant.id, tipo: 'CLIENTE',
        rnc: opts.rnc ?? '131880681',
        razonSocial: opts.razonSocial ?? 'CLIENTE SRL',
        email: opts.email === undefined ? 'cliente@correo.do' : opts.email,
        ghlContactId: opts.ghlContactId === undefined ? 'ghl-cliente' : opts.ghlContactId,
        origen: 'GHL',
      },
    })

  const enviarLote = (t: TestTenant, comprobanteIds: string[], destinatarios: string[]) =>
    request(srv()).post(LOTE).set(auth(t)).send({ canal: 'email', comprobanteIds, destinatarios })

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    pdfSpy = jest
      .spyOn(app.get(ComprobantesService), 'regenerarPdfBuffer')
      .mockResolvedValue({ buffer: Buffer.from('%PDF-1.4 fake'), filename: 'factura.pdf' })
  })

  afterAll(async () => {
    pdfSpy.mockRestore()
    await app.close()
  })

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch')
    mockGhl()
  })

  afterEach(() => fetchSpy.mockRestore())

  // ─── PASO 1: CONTACTO LOCAL ───────────────────────────────────────────────
  it('1) usa el contacto LOCAL del destinatario sin llamar a GHL para buscarlo', async () => {
    const t = await tenantConGhl()
    await mkContacto(t)
    await mkContacto(t, { rnc: '999888777', razonSocial: 'CONTADORES SRL', email: 'contador@firma.do', ghlContactId: 'ghl-contador' })
    const c = await mkComprobante(t)

    const res = await enviarLote(t, [c.id], ['contador@firma.do']).expect(201)

    expect((res.body.data ?? res.body).ancla).toEqual({
      ghlContactId: 'ghl-contador', razonSocial: 'CONTADORES SRL',
      origen: 'contactoLocal', email: 'contador@firma.do', creado: false,
    })
    // Ni búsqueda ni creación: la DB local ya lo sabía.
    expect(llamadas(DUPLICADO_URL)).toHaveLength(0)
    expect(llamadasCrear()).toHaveLength(0)
  })

  it('1b) basta con que UNO de los destinatarios sea contacto, no tiene que ser el primero', async () => {
    const t = await tenantConGhl()
    await mkContacto(t)
    await mkContacto(t, { rnc: '999888777', razonSocial: 'CONTADORES SRL', email: 'contador@firma.do', ghlContactId: 'ghl-contador' })
    const c = await mkComprobante(t)

    const res = await enviarLote(t, [c.id], ['nuevo@correo.do', 'contador@firma.do']).expect(201)

    expect((res.body.data ?? res.body).ancla).toMatchObject({ ghlContactId: 'ghl-contador', origen: 'contactoLocal' })
    expect(llamadasCrear()).toHaveLength(0)
  })

  // ─── PASO 2: EXISTE EN GHL AUNQUE NO LO TENGAMOS ──────────────────────────
  it('2) si no está en la DB local pero SÍ en GHL, lo usa y NO crea nada', async () => {
    const t = await tenantConGhl()
    await mkContacto(t, { ghlContactId: null }) // cliente sin sincronizar
    const c = await mkComprobante(t)
    mockGhl({ duplicado: { id: 'ghl-hallado' } })

    const res = await enviarLote(t, [c.id], ['contador@firma.do']).expect(201)

    expect((res.body.data ?? res.body).ancla).toEqual({
      ghlContactId: 'ghl-hallado', razonSocial: 'HALLADO EN GHL',
      origen: 'contactoGhl', email: 'contador@firma.do', creado: false,
    })
    expect(llamadas(DUPLICADO_URL)).toHaveLength(1)
    expect(llamadasCrear()).toHaveLength(0) // NO se escribió en el CRM
  })

  it('2b) la búsqueda va con locationId y el correo url-encoded, y es un GET', async () => {
    const t = await tenantConGhl()
    await mkContacto(t, { ghlContactId: null })
    const c = await mkComprobante(t)
    mockGhl({ duplicado: { id: 'ghl-hallado' } })

    await enviarLote(t, [c.id], ['contador+lote@firma.do']).expect(201)

    const [url, init] = llamadas(DUPLICADO_URL)[0]!
    expect(String(url)).toContain(`locationId=${locIdDe(t)}`)
    expect(String(url)).toContain('contador%2Blote%40firma.do')
    expect((init as RequestInit).method).toBe('GET')
  })

  // ─── PASO 3: HAY ALTERNATIVA → NO SE ESCRIBE ──────────────────────────────
  it('3) si el cliente de la factura está sincronizado, ancla ahí en vez de crear', async () => {
    const t = await tenantConGhl()
    await mkContacto(t, { ghlContactId: 'ghl-cliente' })
    const c = await mkComprobante(t)

    const res = await enviarLote(t, [c.id], ['desconocido@firma.do']).expect(201)

    expect((res.body.data ?? res.body).ancla).toMatchObject({
      ghlContactId: 'ghl-cliente', origen: 'primerComprobante', creado: false,
    })
    // Se buscó en GHL (no estaba) pero NO se creó: había alternativa.
    expect(llamadas(DUPLICADO_URL)).toHaveLength(1)
    expect(llamadasCrear()).toHaveLength(0)
  })

  // ─── PASO 4: ÚLTIMO RECURSO — CREAR ───────────────────────────────────────
  it('4) sin ninguna alternativa crea UN contacto mínimo: sólo email, con tag y source', async () => {
    const t = await tenantConGhl()
    await mkContacto(t, { ghlContactId: null }) // cliente sin sincronizar
    const c = await mkComprobante(t)

    const res = await enviarLote(t, [c.id], ['contador@firma.do']).expect(201)

    expect((res.body.data ?? res.body).ancla).toEqual({
      ghlContactId: 'ghl-nuevo-999', razonSocial: 'contador@firma.do',
      origen: 'creado', email: 'contador@firma.do', creado: true,
    })

    expect(llamadasCrear()).toHaveLength(1)
    const payload = payloadCrear()
    expect(payload).toEqual({
      locationId: locIdDe(t),
      email: 'contador@firma.do',
      tags: ['facturard-envio'],
      source: 'FacturaRD',
    })
    // NO se inventa ningún dato de la persona.
    expect(payload).not.toHaveProperty('firstName')
    expect(payload).not.toHaveProperty('lastName')
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('phone')
  })

  it('4b) crea con el PRIMER destinatario y el correo sale de verdad, anclado en el nuevo contacto', async () => {
    const t = await tenantConGhl()
    const c = await mkComprobante(t) // sin contacto local de ningún tipo

    await enviarLote(t, [c.id], ['contador@firma.do', 'socio@firma.do']).expect(201)

    expect(payloadCrear().email).toBe('contador@firma.do')
    const send = fetchSpy.mock.calls.find((x) => {
      const u = String(x[0])
      return u.includes(MESSAGES_URL) && !u.includes(UPLOAD_URL)
    })
    const payload = JSON.parse((send![1] as RequestInit).body as string)
    expect(payload.contactId).toBe('ghl-nuevo-999')
    expect(payload.emailTo).toBe('contador@firma.do')
    expect(payload.emailCc).toEqual(['socio@firma.do']) // el resto NO necesita ser contacto
  })

  it('4c) busca en GHL ANTES de crear, y sólo crea si la búsqueda no encontró nada', async () => {
    const t = await tenantConGhl()
    const c = await mkComprobante(t)

    await enviarLote(t, [c.id], ['contador@firma.do']).expect(201)

    // El orden real de las llamadas: primero la búsqueda, después la creación.
    const orden = fetchSpy.mock.calls.map((x) => String(x[0]))
    const iBuscar = orden.findIndex((u) => u.includes(DUPLICADO_URL))
    const iCrear = orden.findIndex((u) => u.includes(CONTACTS_URL) && !u.includes(DUPLICADO_URL))
    expect(iBuscar).toBeGreaterThanOrEqual(0)
    expect(iCrear).toBeGreaterThan(iBuscar)
  })

  // ─── NO DUPLICAR ──────────────────────────────────────────────────────────
  it('el SEGUNDO envío al mismo destinatario NO crea un segundo contacto', async () => {
    const t = await tenantConGhl()
    const c1 = await mkComprobante(t)
    const c2 = await mkComprobante(t)

    // 1º envío: no existe en ningún lado → se crea.
    await enviarLote(t, [c1.id], ['contador@firma.do']).expect(201)
    expect(llamadasCrear()).toHaveLength(1)

    // 2º envío: ahora GHL sí lo tiene (es lo que devolvería en la vida real).
    fetchSpy.mockClear()
    mockGhl({ duplicado: { id: 'ghl-nuevo-999' } })
    const res = await enviarLote(t, [c2.id], ['contador@firma.do']).expect(201)

    expect((res.body.data ?? res.body).ancla).toMatchObject({
      ghlContactId: 'ghl-nuevo-999', origen: 'contactoGhl', creado: false,
    })
    expect(llamadasCrear()).toHaveLength(0)
  })

  // ─── FALLO DE SCOPE ───────────────────────────────────────────────────────
  it('403 al crear → 400 que nombra contacts.write, SIN subir PDFs ni enviar', async () => {
    const t = await tenantConGhl()
    const c = await mkComprobante(t)
    mockGhl({ crearStatus: 403 })

    const res = await enviarLote(t, [c.id], ['contador@firma.do']).expect(400)

    const texto = JSON.stringify(res.body)
    expect(texto).toContain('contacts.write')
    expect(texto).not.toContain('conversations/message.write') // no nombra el scope equivocado
    // Sin ancla no se toca nada: ni upload, ni envío, ni filas a medias.
    expect(llamadas(UPLOAD_URL)).toHaveLength(0)
    expect(llamadas(MESSAGES_URL)).toHaveLength(0)
    expect(await prisma.envioComprobante.count({ where: { tenantId: t.tenant.id } })).toBe(0)
  })

  it('401 al buscar → 400 que nombra contacts.readonly', async () => {
    const t = await tenantConGhl()
    const c = await mkComprobante(t)
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes(DUPLICADO_URL)) return Promise.resolve(jsonRes({ message: 'Unauthorized' }, 401))
      return Promise.resolve(jsonRes({}, 201))
    })

    const res = await enviarLote(t, [c.id], ['contador@firma.do']).expect(400)
    expect(JSON.stringify(res.body)).toContain('contacts.readonly')
  })

  it('un 5xx buscando NO se traga: falla antes que crear un duplicado a ciegas', async () => {
    const t = await tenantConGhl()
    const c = await mkComprobante(t)
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes(DUPLICADO_URL)) return Promise.resolve(jsonRes({ message: 'boom' }, 500))
      return Promise.resolve(jsonRes({}, 201))
    })

    await enviarLote(t, [c.id], ['contador@firma.do']).expect(503)
    expect(llamadasCrear()).toHaveLength(0)
  })

  it('sin location vinculada y sin alternativa → 400 accionable, no un 500', async () => {
    const t = await tenantConGhl({ conLocation: false })
    const c = await mkComprobante(t)

    const res = await enviarLote(t, [c.id], ['contador@firma.do']).expect(400)
    expect(JSON.stringify(res.body)).toContain('location de GoHighLevel')
    expect(llamadasCrear()).toHaveLength(0)
  })

  // ─── EL FLUJO INDIVIDUAL USA LA MISMA CASCADA ─────────────────────────────
  it('el envío individual usa la MISMA cascada (contacto sin sincronizar → se crea)', async () => {
    const t = await tenantConGhl()
    await mkContacto(t, { ghlContactId: null, email: 'cliente@correo.do' })
    const c = await mkComprobante(t)

    const res = await request(srv())
      .post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

    expect((res.body.data ?? res.body).ancla).toMatchObject({ origen: 'creado', creado: true, email: 'cliente@correo.do' })
    expect(payloadCrear()).toEqual({
      locationId: locIdDe(t), email: 'cliente@correo.do',
      tags: ['facturard-envio'], source: 'FacturaRD',
    })
  })
})
