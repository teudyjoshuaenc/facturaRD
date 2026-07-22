import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma, TipoECF } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { ComprobantesService } from '../src/modules/comprobantes/comprobantes.service'
import { CryptoService } from '../src/common/services/crypto.service'

// e2e — envío de comprobantes al cliente vía GoHighLevel (email).
//
// Es POST-EMISIÓN: el objetivo central de este spec es demostrar que enviar un
// comprobante NO altera nada fiscal (estado DGII, e-NCF, reportes 606/607).
// `fetch` está mockeado: la API de GHL nunca se contacta de verdad.
describe('Envío de comprobantes por GHL (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let fetchSpy: jest.SpyInstance
  let pdfSpy: jest.SpyInstance

  const UPLOAD_URL = 'conversations/messages/upload'
  const MESSAGES_URL = 'conversations/messages'
  const GHL_CONTACT_ID = 'ghl-contact-123'
  const PDF_URL = 'https://storage.ghl/attachments/factura.pdf'

  let encfSeq = 0

  const srv = () => app.getHttpServer()
  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  const jsonRes = (body: unknown, status = 200): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

  /** Mock por defecto: upload OK → URL; send OK → messageId. */
  const mockGhlOk = (): void => {
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes(UPLOAD_URL)) {
        return Promise.resolve(jsonRes({ uploadedFiles: { 'factura.pdf': PDF_URL }, traceId: 't1' }, 201))
      }
      if (url.includes(MESSAGES_URL)) {
        return Promise.resolve(jsonRes({ messageId: 'msg-abc', conversationId: 'conv-xyz' }, 201))
      }
      return Promise.resolve(jsonRes({}, 404))
    })
  }

  /** Tenant con GHL conectado (token cifrado, como en producción). */
  const tenantConGhl = async (): Promise<TestTenant> => {
    const t = await createTenant()
    const crypto = app.get(CryptoService)
    await prisma.tenant.update({
      where: { id: t.tenant.id },
      data: { ghlAccessToken: crypto.encryptString('pit-token-de-prueba') },
    })
    return t
  }

  const mkComprobante = async (
    t: TestTenant,
    opts: { contactoId?: string; rnc?: string; estado?: 'ACEPTADO' | 'DRAFT'; tipoECF?: TipoECF } = {},
  ) =>
    prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id,
        eNCF: `E31${String(++encfSeq).padStart(10, '0')}`,
        tipoECF: opts.tipoECF ?? 'E31',
        estado: opts.estado ?? 'ACEPTADO',
        montoTotal: 1180,
        rnc: opts.rnc ?? '131880681',
        razonSocial: 'CLIENTE SRL',
        contactoId: opts.contactoId ?? null,
        createdAt: new Date('2026-05-15T10:00:00-04:00'),
      },
    })

  const mkContacto = async (t: TestTenant, opts: { rnc?: string; email?: string | null; ghlContactId?: string | null } = {}) =>
    prisma.contacto.create({
      data: {
        tenantId: t.tenant.id,
        tipo: 'CLIENTE',
        rnc: opts.rnc ?? '131880681',
        razonSocial: 'CLIENTE SRL',
        email: opts.email === undefined ? 'cliente@correo.do' : opts.email,
        ghlContactId: opts.ghlContactId === undefined ? GHL_CONTACT_ID : opts.ghlContactId,
        origen: 'GHL',
      },
    })

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    // El PDF real se genera con el motor de representación impresa (lento y ya
    // cubierto por sus propios tests). Aquí sólo importa que el buffer llegue
    // al upload, así que se sustituye por uno mínimo.
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
    mockGhlOk()
  })

  afterEach(() => fetchSpy.mockRestore())

  // ─── AISLAMIENTO FISCAL (la regla que no se negocia) ──────────────────────
  describe('Aislamiento fiscal', () => {
    it('enviar NO altera el estado DGII del comprobante ni los reportes 606/607', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)
      const RANGO = 'desde=2026-05-01&hasta=2026-05-31'

      const base607 = (await request(srv()).get(`/api/v1/reportes/607?${RANGO}`).set(auth(t)).expect(200)).body
      const base606 = (await request(srv()).get(`/api/v1/reportes/606?${RANGO}`).set(auth(t)).expect(200)).body
      const antes = await prisma.comprobante.findUniqueOrThrow({ where: { id: c.id } })

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

      // Reportes byte a byte idénticos.
      expect((await request(srv()).get(`/api/v1/reportes/607?${RANGO}`).set(auth(t)).expect(200)).body).toEqual(base607)
      expect((await request(srv()).get(`/api/v1/reportes/606?${RANGO}`).set(auth(t)).expect(200)).body).toEqual(base606)

      // La fila fiscal intacta: mismo estado, e-NCF, trackId, xmlFirmado, updatedAt.
      const despues = await prisma.comprobante.findUniqueOrThrow({ where: { id: c.id } })
      expect(despues).toEqual(antes)
    })

    it('enviar NO encola nada en BullMQ (no re-emite a la DGII)', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)
      ctx.queueAdd.mockClear()

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

      expect(ctx.queueAdd).not.toHaveBeenCalled()
    })
  })

  // ─── CAMINO FELIZ ─────────────────────────────────────────────────────────
  describe('Envío por email', () => {
    it('sube el PDF como multipart y envía el mensaje con la URL adjunta', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)

      const res = await request(srv())
        .post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

      expect(res.body.data ?? res.body).toMatchObject({
        canal: 'EMAIL', estado: 'ENVIADO', destino: 'cliente@correo.do', ghlMessageId: 'msg-abc',
      })

      // 1) El upload va como multipart con la key fileAttachment y el contactId.
      const upload = fetchSpy.mock.calls.find((c2) => String(c2[0]).includes(UPLOAD_URL))
      expect(upload).toBeDefined()
      const uploadInit = upload![1] as RequestInit
      expect(uploadInit.method).toBe('POST')
      expect(uploadInit.body).toBeInstanceOf(FormData)
      const form = uploadInit.body as FormData
      expect(form.get('contactId')).toBe(GHL_CONTACT_ID)
      expect(form.get('fileAttachment')).toBeInstanceOf(Blob)
      // Content-Type NO se fija a mano: lo pone fetch con su boundary.
      expect(Object.keys(uploadInit.headers as Record<string, string>)).not.toContain('Content-Type')
      expect((uploadInit.headers as Record<string, string>)['Version']).toBe('2021-07-28')

      // 2) El mensaje lleva type Email, el adjunto y el asunto por defecto.
      const send = fetchSpy.mock.calls.find((c2) => {
        const u = String(c2[0])
        return u.includes(MESSAGES_URL) && !u.includes(UPLOAD_URL)
      })
      expect(send).toBeDefined()
      const payload = JSON.parse((send![1] as RequestInit).body as string)
      expect(payload).toMatchObject({
        type: 'Email',
        contactId: GHL_CONTACT_ID,
        emailTo: 'cliente@correo.do',
        attachments: [PDF_URL],
      })
      expect(payload.subject).toContain(c.eNCF)
      expect(payload.subject).toContain(t.tenant.razonSocial)
    })

    it('respeta el asunto y el mensaje override', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t))
        .send({ canal: 'email', asunto: 'Tu factura de mayo', mensaje: 'Saludos cordiales' }).expect(201)

      const send = fetchSpy.mock.calls.find((c2) => {
        const u = String(c2[0])
        return u.includes(MESSAGES_URL) && !u.includes(UPLOAD_URL)
      })
      const payload = JSON.parse((send![1] as RequestInit).body as string)
      expect(payload.subject).toBe('Tu factura de mayo')
      expect(payload.html).toContain('Saludos cordiales')
    })

    // Forma REAL verificada contra GHL en producción (HTTP 201). `msg` es un
    // texto humano, no un id: si se usara como fallback, guardaríamos
    // "Email queued successfully." dentro de ghlMessageId.
    it('parsea la respuesta real de GHL y NUNCA guarda `msg` como messageId', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)
      fetchSpy.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes(UPLOAD_URL)) return Promise.resolve(jsonRes({ uploadedFiles: { 'f.pdf': PDF_URL } }, 201))
        return Promise.resolve(
          jsonRes(
            {
              threadId: 'GKYsET44tBsKh7EawkTg',
              emailMessageId: 'fuBv2ztY2JMO6307ep8C',
              msg: 'Email queued successfully.',
              conversationId: 'R5Js0HjnmrgEfRrPcECw',
              traceId: '4228a68c',
            },
            201,
          ),
        )
      })

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

      const fila = (await prisma.envioComprobante.findMany({ where: { comprobanteId: c.id } }))[0]!
      // Sin `messageId` en la raíz, cae a emailMessageId — jamás a `msg`.
      expect(fila.ghlMessageId).toBe('fuBv2ztY2JMO6307ep8C')
      expect(fila.ghlMessageId).not.toContain('queued')
      expect(fila.ghlConversationId).toBe('R5Js0HjnmrgEfRrPcECw')
    })

    it('persiste el envío y lo expone en GET :id/envios', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

      const hist = await request(srv()).get(`/api/v1/comprobantes/${c.id}/envios`).set(auth(t)).expect(200)
      const filas = hist.body.data ?? hist.body
      expect(filas).toHaveLength(1)
      expect(filas[0]).toMatchObject({
        canal: 'EMAIL', estado: 'ENVIADO', destino: 'cliente@correo.do',
        ghlMessageId: 'msg-abc', ghlConversationId: 'conv-xyz',
      })
    })
  })

  // ─── RESOLUCIÓN DE CONTACTO ───────────────────────────────────────────────
  describe('Resolución del contacto', () => {
    it('resuelve por comprobante.contactoId cuando existe', async () => {
      const t = await tenantConGhl()
      // Dos contactos con el MISMO rnc-fallback no serían distinguibles: se usa
      // un ghlContactId propio para probar que ganó el resuelto por id.
      const elegido = await prisma.contacto.create({
        data: {
          tenantId: t.tenant.id, tipo: 'CLIENTE', rnc: '999888777', razonSocial: 'POR ID SRL',
          email: 'porid@correo.do', ghlContactId: 'ghl-por-id', origen: 'GHL',
        },
      })
      await mkContacto(t) // el que encontraría el fallback por RNC
      const c = await mkComprobante(t, { contactoId: elegido.id })

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

      const upload = fetchSpy.mock.calls.find((c2) => String(c2[0]).includes(UPLOAD_URL))
      expect((upload![1] as RequestInit & { body: FormData }).body.get('contactId')).toBe('ghl-por-id')
    })

    it('cae al Contacto por tenantId+rnc cuando contactoId es null', async () => {
      const t = await tenantConGhl()
      await mkContacto(t, { rnc: '131880681' })
      const c = await mkComprobante(t, { rnc: '131880681' }) // contactoId null

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(201)

      const upload = fetchSpy.mock.calls.find((c2) => String(c2[0]).includes(UPLOAD_URL))
      expect((upload![1] as RequestInit & { body: FormData }).body.get('contactId')).toBe(GHL_CONTACT_ID)
    })

    it('400 accionable si el contacto no tiene ghlContactId (no sincronizado)', async () => {
      const t = await tenantConGhl()
      await mkContacto(t, { ghlContactId: null })
      const c = await mkComprobante(t)

      const res = await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(400)
      expect(JSON.stringify(res.body)).toContain('no está sincronizado con GoHighLevel')
      expect(fetchSpy).not.toHaveBeenCalled() // ni siquiera se intentó llamar a GHL
    })

    it('400 accionable si no existe el contacto', async () => {
      const t = await tenantConGhl()
      const c = await mkComprobante(t, { rnc: '000000000' })

      const res = await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(400)
      expect(JSON.stringify(res.body)).toContain('No encontramos al cliente')
    })

    it('400 accionable si el contacto no tiene correo', async () => {
      const t = await tenantConGhl()
      await mkContacto(t, { email: null })
      const c = await mkComprobante(t)

      const res = await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(400)
      expect(JSON.stringify(res.body)).toContain('no tiene correo registrado')
    })

    it('400 accionable si el tenant no conectó GoHighLevel', async () => {
      const t = await createTenant() // sin ghlAccessToken
      await mkContacto(t)
      const c = await mkComprobante(t)

      const res = await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(400)
      expect(JSON.stringify(res.body)).toContain('GoHighLevel no está conectado')
    })
  })

  // ─── WHATSAPP: NO DISPONIBLE AÚN ──────────────────────────────────────────
  describe('WhatsApp (aún no implementado)', () => {
    it.each(['whatsapp', 'ambos'])('canal=%s responde 400 claro, sin tocar GHL', async (canal) => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)

      const res = await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal }).expect(400)
      expect(JSON.stringify(res.body)).toContain('WhatsApp aún no está disponible')
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(await prisma.envioComprobante.count({ where: { comprobanteId: c.id } })).toBe(0)
    })

    it('rechaza un canal inexistente por validación', async () => {
      const t = await tenantConGhl()
      const c = await mkComprobante(t)
      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'paloma' }).expect(400)
    })
  })

  // ─── ERRORES DE GHL ───────────────────────────────────────────────────────
  describe('Fallos de GoHighLevel', () => {
    it('5xx de GHL → 503 transitorio y el fallo queda registrado como FALLIDO', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)
      fetchSpy.mockResolvedValue(jsonRes({ error: 'boom' }, 500))

      const res = await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(503)
      expect(JSON.stringify(res.body)).toContain('problema temporal')

      const filas = await prisma.envioComprobante.findMany({ where: { comprobanteId: c.id } })
      expect(filas).toHaveLength(1)
      expect(filas[0]!.estado).toBe('FALLIDO')
      expect(filas[0]!.error).toBeTruthy()
      expect(filas[0]!.ghlMessageId).toBeNull()
    })

    it('401 de GHL → 400 que nombra el scope que falta', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)
      fetchSpy.mockResolvedValue(jsonRes({ message: 'Unauthorized' }, 401))

      const res = await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(400)
      expect(JSON.stringify(res.body)).toContain('conversations/message.write')
    })

    it('error de red → 503, no 500', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)
      fetchSpy.mockRejectedValue(new Error('ECONNRESET'))

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(503)
    })

    it('upload sin URL en la respuesta → NO se envía el correo ni se inventa éxito', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const c = await mkComprobante(t)
      fetchSpy.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes(UPLOAD_URL)) return Promise.resolve(jsonRes({ uploadedFiles: {} }, 201))
        return Promise.resolve(jsonRes({ messageId: 'no-deberia-pasar' }, 201))
      })

      await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(t)).send({ canal: 'email' }).expect(503)

      const enviados = fetchSpy.mock.calls.filter((c2) => {
        const u = String(c2[0])
        return u.includes(MESSAGES_URL) && !u.includes(UPLOAD_URL)
      })
      expect(enviados).toHaveLength(0)
      const filas = await prisma.envioComprobante.findMany({ where: { comprobanteId: c.id } })
      expect(filas[0]!.estado).toBe('FALLIDO')
    })
  })

  // ─── SCOPING ──────────────────────────────────────────────────────────────
  it('404 si el comprobante es de otro tenant', async () => {
    const dueno = await tenantConGhl()
    const otro = await tenantConGhl()
    await mkContacto(dueno)
    const c = await mkComprobante(dueno)

    await request(srv()).post(`/api/v1/comprobantes/${c.id}/enviar`).set(auth(otro)).send({ canal: 'email' }).expect(404)
  })
})
