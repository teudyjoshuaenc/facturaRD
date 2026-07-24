import { INestApplication, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { ComprobantesService } from '../src/modules/comprobantes/comprobantes.service'
import { CryptoService } from '../src/common/services/crypto.service'

// e2e — envío EN LOTE: UN SOLO correo con los PDFs de varios comprobantes.
//
// Lo que este spec sostiene:
//  1. es UN correo, no N (una sola llamada a /conversations/messages),
//  2. deja UNA FILA POR COMPROBANTE unidas por loteId,
//  3. es todo-o-nada: si un PDF no se genera, no sale nada,
//  4. no toca NADA fiscal.
// `fetch` está mockeado: la API de GHL nunca se contacta de verdad.
describe('Envío en lote por GHL (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let fetchSpy: jest.SpyInstance
  let pdfSpy: jest.SpyInstance

  const UPLOAD_URL = 'conversations/messages/upload'
  const MESSAGES_URL = 'conversations/messages'
  const DUPLICADO_URL = 'contacts/search/duplicate'
  const CONTACTS_URL = 'contacts/'
  const GHL_CONTACT_ID = 'ghl-contact-123'

  /** Comprobantes cuyo PDF debe fallar al generarse (por id). */
  let pdfRoto: Set<string>
  let encfSeq = 0

  const srv = () => app.getHttpServer()
  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const LOTE = '/api/v1/comprobantes/enviar-lote'

  const jsonRes = (body: unknown, status = 200): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

  /** Cada upload devuelve una URL distinta para poder verificar que se adjuntan TODAS. */
  let uploadSeq = 0
  const mockGhlOk = (): void => {
    uploadSeq = 0
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      // OJO con el orden: la URL de duplicados contiene "contacts/".
      if (url.includes(DUPLICADO_URL)) {
        return Promise.resolve(jsonRes({ message: 'not found' }, 404)) // no existe en GHL
      }
      if (url.includes(CONTACTS_URL)) {
        return Promise.resolve(jsonRes({ contact: { id: 'ghl-creado-1' } }, 201))
      }
      if (url.includes(UPLOAD_URL)) {
        const nombre = `pdf-${++uploadSeq}`
        return Promise.resolve(jsonRes({ uploadedFiles: { [`${nombre}.pdf`]: `https://storage.ghl/${nombre}.pdf` } }, 201))
      }
      if (url.includes(MESSAGES_URL)) {
        return Promise.resolve(jsonRes({ messageId: 'msg-lote', conversationId: 'conv-lote' }, 201))
      }
      return Promise.resolve(jsonRes({}, 404))
    })
  }

  const llamadasUpload = () => fetchSpy.mock.calls.filter((c) => String(c[0]).includes(UPLOAD_URL))
  const llamadasSend = () =>
    fetchSpy.mock.calls.filter((c) => {
      const u = String(c[0])
      return u.includes(MESSAGES_URL) && !u.includes(UPLOAD_URL)
    })
  const payloadSend = () => JSON.parse((llamadasSend()[0]![1] as RequestInit).body as string)

  const tenantConGhl = async (): Promise<TestTenant> => {
    const t = await createTenant()
    const crypto = app.get(CryptoService)
    await prisma.tenant.update({
      where: { id: t.tenant.id },
      data: { ghlAccessToken: crypto.encryptString('pit-token-de-prueba') },
    })
    return t
  }

  const mkComprobante = async (t: TestTenant, opts: { rnc?: string; estado?: 'ACEPTADO' | 'RECHAZADO' } = {}) =>
    prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id,
        eNCF: `E31${String(++encfSeq).padStart(10, '0')}`,
        tipoECF: 'E31',
        estado: opts.estado ?? 'ACEPTADO',
        montoTotal: 1180,
        rnc: opts.rnc ?? '131880681',
        razonSocial: 'CLIENTE SRL',
        createdAt: new Date('2026-05-15T10:00:00-04:00'),
      },
    })

  const mkContacto = async (
    t: TestTenant,
    opts: { rnc?: string; email?: string | null; ghlContactId?: string | null; razonSocial?: string } = {},
  ) =>
    prisma.contacto.create({
      data: {
        tenantId: t.tenant.id,
        tipo: 'CLIENTE',
        rnc: opts.rnc ?? '131880681',
        razonSocial: opts.razonSocial ?? 'CLIENTE SRL',
        email: opts.email === undefined ? 'cliente@correo.do' : opts.email,
        ghlContactId: opts.ghlContactId === undefined ? GHL_CONTACT_ID : opts.ghlContactId,
        origen: 'GHL',
      },
    })

  /** Escenario base: tenant con GHL, contacto sincronizado y N comprobantes enviables. */
  const escenario = async (n: number) => {
    const t = await tenantConGhl()
    await mkContacto(t)
    const comprobantes = []
    for (let i = 0; i < n; i++) comprobantes.push(await mkComprobante(t))
    return { t, comprobantes, ids: comprobantes.map((c) => c.id) }
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    // El PDF real ya está cubierto por los tests del motor. Aquí sólo importa
    // que el buffer llegue al upload — salvo los ids marcados en `pdfRoto`, que
    // simulan un comprobante sin PDF posible (rechazado/sin datos).
    pdfSpy = jest
      .spyOn(app.get(ComprobantesService), 'regenerarPdfBuffer')
      .mockImplementation(async (_tenantId: string, id: string) => {
        if (pdfRoto.has(id)) {
          throw new NotFoundException('No hay PDF disponible: el comprobante fue rechazado o falló su envío')
        }
        return { buffer: Buffer.from('%PDF-1.4 fake'), filename: `factura-${id.slice(0, 6)}.pdf` }
      })
  })

  afterAll(async () => {
    pdfSpy.mockRestore()
    await app.close()
  })

  beforeEach(() => {
    pdfRoto = new Set()
    fetchSpy = jest.spyOn(global, 'fetch')
    mockGhlOk()
  })

  afterEach(() => fetchSpy.mockRestore())

  // ─── AISLAMIENTO FISCAL (la regla que no se negocia) ──────────────────────
  describe('Aislamiento fiscal', () => {
    it('el envío en lote NO altera el estado DGII de ningún comprobante ni el 606/607', async () => {
      const { t, ids } = await escenario(3)
      const RANGO = 'desde=2026-05-01&hasta=2026-05-31'

      const base607 = (await request(srv()).get(`/api/v1/reportes/607?${RANGO}`).set(auth(t)).expect(200)).body
      const base606 = (await request(srv()).get(`/api/v1/reportes/606?${RANGO}`).set(auth(t)).expect(200)).body
      const antes = await prisma.comprobante.findMany({ where: { tenantId: t.tenant.id }, orderBy: { id: 'asc' } })

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      expect((await request(srv()).get(`/api/v1/reportes/607?${RANGO}`).set(auth(t)).expect(200)).body).toEqual(base607)
      expect((await request(srv()).get(`/api/v1/reportes/606?${RANGO}`).set(auth(t)).expect(200)).body).toEqual(base606)
      expect(await prisma.comprobante.findMany({ where: { tenantId: t.tenant.id }, orderBy: { id: 'asc' } })).toEqual(antes)
    })

    it('el envío en lote NO encola nada en BullMQ (no re-emite a la DGII)', async () => {
      const { t, ids } = await escenario(3)
      ctx.queueAdd.mockClear()

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      expect(ctx.queueAdd).not.toHaveBeenCalled()
    })
  })

  // ─── UN SOLO CORREO CON TODOS LOS ADJUNTOS ────────────────────────────────
  describe('Un solo correo con N adjuntos', () => {
    it('sube 3 PDFs y manda UN ÚNICO mensaje con los 3 adjuntos', async () => {
      const { t, ids } = await escenario(3)

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      // 3 uploads (uno por PDF) pero UN SOLO send: es un correo, no tres.
      expect(llamadasUpload()).toHaveLength(3)
      expect(llamadasSend()).toHaveLength(1)

      const payload = payloadSend()
      expect(payload.type).toBe('Email')
      expect(payload.emailTo).toBe('contador@firma.do')
      expect(payload.attachments).toEqual([
        'https://storage.ghl/pdf-1.pdf',
        'https://storage.ghl/pdf-2.pdf',
        'https://storage.ghl/pdf-3.pdf',
      ])

      const body = res.body.data ?? res.body
      expect(body).toMatchObject({ canal: 'EMAIL', estado: 'ENVIADO', adjuntos: 3, ghlMessageId: 'msg-lote' })
      expect(body.comprobantes).toHaveLength(3)
      expect(body.loteId).toBeTruthy()
    })

    it('el primer destinatario va en Para y el resto en copia (GHL sólo admite un emailTo)', async () => {
      const { t, ids } = await escenario(2)

      await request(srv()).post(LOTE).set(auth(t)).send({
        canal: 'email', comprobanteIds: ids,
        destinatarios: ['contador@firma.do', 'cliente@correo.do', 'socio@firma.do'],
      }).expect(201)

      const payload = payloadSend()
      expect(payload.emailTo).toBe('contador@firma.do')
      expect(payload.emailCc).toEqual(['cliente@correo.do', 'socio@firma.do'])
    })

    it('con un solo destinatario NO manda la clave emailCc', async () => {
      const { t, ids } = await escenario(1)

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      expect(payloadSend()).not.toHaveProperty('emailCc')
    })

    it('el asunto y el cuerpo por defecto nombran la cantidad y listan los comprobantes', async () => {
      const { t, ids, comprobantes } = await escenario(3)

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      const payload = payloadSend()
      expect(payload.subject).toContain('3 comprobantes')
      expect(payload.subject).toContain(t.tenant.razonSocial)
      for (const c of comprobantes) expect(payload.html).toContain(c.eNCF)
    })

    it('respeta el asunto y el mensaje override', async () => {
      const { t, ids } = await escenario(2)

      await request(srv()).post(LOTE).set(auth(t)).send({
        canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'],
        asunto: 'Facturas de mayo', mensaje: 'Aquí van las facturas del mes',
      }).expect(201)

      const payload = payloadSend()
      expect(payload.subject).toBe('Facturas de mayo')
      expect(payload.html).toContain('Aquí van las facturas del mes')
    })
  })

  // ─── REGISTRO: UNA FILA POR COMPROBANTE, UNIDAS POR loteId ────────────────
  describe('Registro del envío', () => {
    it('deja una fila por comprobante compartiendo loteId, ghlMessageId y conversationId', async () => {
      const { t, ids } = await escenario(3)

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do', 'cliente@correo.do'] }).expect(201)
      const { loteId } = res.body.data ?? res.body

      const filas = await prisma.envioComprobante.findMany({ where: { tenantId: t.tenant.id } })
      expect(filas).toHaveLength(3)
      expect(new Set(filas.map((f) => f.comprobanteId))).toEqual(new Set(ids))
      for (const fila of filas) {
        expect(fila).toMatchObject({
          canal: 'EMAIL', estado: 'ENVIADO', loteId,
          ghlMessageId: 'msg-lote', ghlConversationId: 'conv-lote',
          destino: 'contador@firma.do, cliente@correo.do',
        })
      }
    })

    it('cada comprobante ve su propio envío en GET :id/envios', async () => {
      const { t, ids } = await escenario(2)

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      for (const id of ids) {
        const hist = await request(srv()).get(`/api/v1/comprobantes/${id}/envios`).set(auth(t)).expect(200)
        const filas = hist.body.data ?? hist.body
        expect(filas).toHaveLength(1)
        expect(filas[0]).toMatchObject({ estado: 'ENVIADO', ghlMessageId: 'msg-lote' })
        expect(filas[0].loteId).toBeTruthy()
      }
    })
  })

  // ─── CONTACTO ANCLA ───────────────────────────────────────────────────────
  describe('Contacto ancla del hilo', () => {
    it('ancla en el contacto de un DESTINATARIO cuando ya existe sincronizado', async () => {
      const { t, ids } = await escenario(2)
      await mkContacto(t, {
        rnc: '999888777', razonSocial: 'CONTADORES SRL',
        email: 'contador@firma.do', ghlContactId: 'ghl-contador',
      })

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      expect((res.body.data ?? res.body).ancla).toEqual({
        ghlContactId: 'ghl-contador', razonSocial: 'CONTADORES SRL',
        origen: 'contactoLocal', email: 'contador@firma.do', creado: false,
      })
      expect(payloadSend().contactId).toBe('ghl-contador')
      expect((llamadasUpload()[0]![1] as RequestInit & { body: FormData }).body.get('contactId')).toBe('ghl-contador')
    })

    it('ancla en el contacto de la primera factura cuando el destinatario no es contacto (y NO crea nada)', async () => {
      const { t, ids } = await escenario(2)

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['desconocido@correo.do'] }).expect(201)

      expect((res.body.data ?? res.body).ancla).toMatchObject({
        ghlContactId: GHL_CONTACT_ID, razonSocial: 'CLIENTE SRL', origen: 'primerComprobante', creado: false,
      })
      expect(payloadSend().contactId).toBe(GHL_CONTACT_ID)
      // Había alternativa: no se escribió en el CRM del cliente.
      expect(fetchSpy.mock.calls.filter((c) => String(c[0]).includes(CONTACTS_URL))).toHaveLength(0)
    })

    it('el correo del destinatario se compara sin distinguir mayúsculas', async () => {
      const { t, ids } = await escenario(1)
      await mkContacto(t, { rnc: '999888777', razonSocial: 'CONTADORES SRL', email: 'Contador@Firma.do', ghlContactId: 'ghl-contador' })

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['  CONTADOR@FIRMA.DO  '] }).expect(201)

      expect((res.body.data ?? res.body).ancla.origen).toBe('contactoLocal')
    })
  })

  // ─── LÍMITES ──────────────────────────────────────────────────────────────
  describe('Límites de GoHighLevel', () => {
    it('rechaza 6 comprobantes (máximo 5 adjuntos) sin tocar GHL', async () => {
      const { t, ids } = await escenario(6)

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(400)

      expect(JSON.stringify(res.body)).toContain('5')
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(await prisma.envioComprobante.count({ where: { tenantId: t.tenant.id } })).toBe(0)
    })

    it('acepta exactamente 5', async () => {
      const { t, ids } = await escenario(5)

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(201)

      expect((res.body.data ?? res.body).adjuntos).toBe(5)
      expect(llamadasSend()).toHaveLength(1)
    })

    it('rechaza más de 5 destinatarios', async () => {
      const { t, ids } = await escenario(1)

      await request(srv()).post(LOTE).set(auth(t)).send({
        canal: 'email', comprobanteIds: ids,
        destinatarios: ['a@x.do', 'b@x.do', 'c@x.do', 'd@x.do', 'e@x.do', 'f@x.do'],
      }).expect(400)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it.each(['no-es-un-correo', 'sin@dominio', ''])('rechaza el destinatario inválido %p', async (malo) => {
      const { t, ids } = await escenario(1)

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['ok@correo.do', malo] }).expect(400)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('rechaza la lista vacía y los comprobantes repetidos', async () => {
      const { t, ids } = await escenario(1)

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: [], destinatarios: ['ok@correo.do'] }).expect(400)
      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: [ids[0], ids[0]], destinatarios: ['ok@correo.do'] }).expect(400)
      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: [] }).expect(400)
    })

    it('canal whatsapp responde 400 claro sin tocar GHL', async () => {
      const { t, ids } = await escenario(2)

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'whatsapp', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(400)

      expect(JSON.stringify(res.body)).toContain('WhatsApp aún no está disponible')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  // ─── TODO-O-NADA ──────────────────────────────────────────────────────────
  describe('Fallo parcial: todo-o-nada', () => {
    it('si UN PDF no se puede generar, NO se envía nada y el error nombra cuál', async () => {
      const { t, ids, comprobantes } = await escenario(3)
      pdfRoto.add(ids[1]!) // el del medio

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(400)

      const texto = JSON.stringify(res.body)
      expect(texto).toContain(comprobantes[1]!.eNCF!) // dice CUÁL falló
      expect(texto).toContain('No se envió nada')
      // Ni un solo byte a GHL, ni una sola fila: la validación corre ANTES del
      // punto de no retorno.
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(await prisma.envioComprobante.count({ where: { tenantId: t.tenant.id } })).toBe(0)
    })

    it('un comprobante RECHAZADO en la selección aborta el lote completo', async () => {
      const t = await tenantConGhl()
      await mkContacto(t)
      const bueno = await mkComprobante(t)
      const malo = await mkComprobante(t, { estado: 'RECHAZADO' })
      pdfRoto.add(malo.id)

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: [bueno.id, malo.id], destinatarios: ['contador@firma.do'] }).expect(400)

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('404 si un comprobante es de otro tenant (no se filtra nada de otro)', async () => {
      const { t, ids } = await escenario(1)
      const otro = await tenantConGhl()
      const ajeno = await mkComprobante(otro)

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: [ids[0], ajeno.id], destinatarios: ['contador@firma.do'] }).expect(404)

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('si falla el 2º upload, NO se manda el correo y quedan N filas FALLIDO con el mismo loteId', async () => {
      const { t, ids } = await escenario(3)
      let subidas = 0
      fetchSpy.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes(UPLOAD_URL)) {
          subidas++
          if (subidas === 2) return Promise.resolve(jsonRes({ error: 'boom' }, 500))
          return Promise.resolve(jsonRes({ uploadedFiles: { 'a.pdf': 'https://storage.ghl/a.pdf' } }, 201))
        }
        return Promise.resolve(jsonRes({ messageId: 'no-deberia-pasar' }, 201))
      })

      await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(503)

      expect(llamadasSend()).toHaveLength(0) // el correo NUNCA salió
      const filas = await prisma.envioComprobante.findMany({ where: { tenantId: t.tenant.id } })
      expect(filas).toHaveLength(3)
      expect(filas.every((f) => f.estado === 'FALLIDO')).toBe(true)
      expect(filas.every((f) => f.ghlMessageId === null)).toBe(true)
      expect(new Set(filas.map((f) => f.loteId)).size).toBe(1) // un solo lote
    })

    it('5xx al enviar el correo → 503 y las N filas quedan FALLIDO (nunca ENVIADO sin 2xx)', async () => {
      const { t, ids } = await escenario(2)
      fetchSpy.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes(UPLOAD_URL)) return Promise.resolve(jsonRes({ uploadedFiles: { 'a.pdf': 'https://storage.ghl/a.pdf' } }, 201))
        return Promise.resolve(jsonRes({ error: 'boom' }, 500))
      })

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(503)
      expect(JSON.stringify(res.body)).toContain('problema temporal')

      const filas = await prisma.envioComprobante.findMany({ where: { tenantId: t.tenant.id } })
      expect(filas).toHaveLength(2)
      expect(filas.every((f) => f.estado === 'FALLIDO' && f.error)).toBe(true)
    })

    it('401 de GHL → 400 que nombra el scope que falta', async () => {
      const { t, ids } = await escenario(2)
      fetchSpy.mockResolvedValue(jsonRes({ message: 'Unauthorized' }, 401))

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: ids, destinatarios: ['contador@firma.do'] }).expect(400)
      expect(JSON.stringify(res.body)).toContain('conversations/message.write')
    })

    it('400 accionable si el tenant no conectó GoHighLevel', async () => {
      const t = await createTenant() // sin ghlAccessToken
      await mkContacto(t)
      const c = await mkComprobante(t)

      const res = await request(srv()).post(LOTE).set(auth(t))
        .send({ canal: 'email', comprobanteIds: [c.id], destinatarios: ['contador@firma.do'] }).expect(400)
      expect(JSON.stringify(res.body)).toContain('GoHighLevel no está conectado')
    })
  })
})
