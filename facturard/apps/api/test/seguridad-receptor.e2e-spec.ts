import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { firmarDocumento, verificarFirmaEcf } from '@facturard/ecf-engine'
import { createTestApp } from './helpers/test-app'
import { createTenant, uploadCert, generateP12, nextRnc, TestCert, TestTenant } from './helpers/factory'
import { REDIS_CLIENT } from '../src/modules/receptor/receptor.service'

// e2e — Fase 0 de seguridad:
//  (1) POST /users sólo para ADMIN y sin poder asignar SUPER_ADMIN.
//  (2) Receptor DGII: la semilla debe venir firmada, nunca se guarda un e-CF en un
//      tenant "de respaldo", acuses No Recibido con su motivo, acuse siempre firmado,
//      documentos indentados (como los entrega la DGII) y rutas sin importar mayúsculas.
// Redis se reemplaza por un mapa en memoria; la DGII nunca es contactada.

function redisEnMemoria() {
  const m = new Map<string, string>()
  return {
    setex: async (k: string, _ttl: number, v: string) => { m.set(k, v); return 'OK' },
    get: async (k: string) => m.get(k) ?? null,
    del: async (k: string) => (m.delete(k) ? 1 : 0),
    disconnect: () => undefined,
  }
}

/** Indenta un XML compacto, como la DGII entrega los documentos ya firmados. */
function indentar(xml: string): string {
  let nivel = 0
  return xml
    .replace(/></g, '>\n<')
    .split('\n')
    .map((linea) => {
      if (/^<\//.test(linea)) nivel--
      const out = '  '.repeat(Math.max(nivel, 0)) + linea
      if (/^<[^/?!][^>]*[^/]>$/.test(linea) && !/<\/[^>]+>$/.test(linea)) nivel++
      return out
    })
    .join('\n')
}

const firmar = (cert: TestCert, xml: string, raiz: string) =>
  firmarDocumento({
    p12: cert.p12Buffer,
    passphrase: cert.passphrase,
    xml,
    signOptions: { referenceXPath: `//*[local-name(.)='${raiz}']` },
  })

function ecfXml(rncEmisor: string, rncComprador: string, eNCF: string, contacto = 'CONTACTO'): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?><ECF><Encabezado><Version>1.0</Version>' +
    `<IdDoc><TipoeCF>31</TipoeCF><eNCF>${eNCF}</eNCF></IdDoc>` +
    `<Emisor><RNCEmisor>${rncEmisor}</RNCEmisor><RazonSocialEmisor>PROVEEDOR SRL</RazonSocialEmisor><FechaEmision>01-10-2026</FechaEmision></Emisor>` +
    `<Comprador><RNCComprador>${rncComprador}</RNCComprador><ContactoComprador>${contacto}</ContactoComprador></Comprador>` +
    '<Totales><MontoTotal>1180.00</MontoTotal></Totales></Encabezado>' +
    '<FechaHoraFirma>01-10-2026 10:00:00</FechaHoraFirma></ECF>'
  )
}

describe('Seguridad: usuarios y receptor DGII (e2e)', () => {
  let app: INestApplication
  let receptor: TestTenant
  let otro: TestTenant
  let emisorCert: TestCert
  let receptorCert: TestCert
  const RNC_EMISOR = '131880681'

  beforeAll(async () => {
    const ctx = await createTestApp([{ provide: REDIS_CLIENT, useValue: redisEnMemoria() }])
    app = ctx.app
    // `otro` se crea PRIMERO: antes era el "tenant de respaldo" que recibía e-CF ajenos.
    otro = await createTenant()
    receptor = await createTenant()
    emisorCert = generateP12('PROVEEDOR EMISOR')
    receptorCert = generateP12('RECEPTOR SRL')
    await uploadCert(app, receptor.tenant.id, receptorCert)
  })
  afterAll(async () => { await app.close() })

  /** Flujo de autenticación que hace el emisor (o la DGII) antes de enviar. */
  async function token(cert = emisorCert): Promise<string> {
    const semilla = await request(app.getHttpServer()).get('/fe/autenticacion/api/semilla').expect(200)
    const res = await request(app.getHttpServer())
      .post('/fe/autenticacion/api/validacioncertificado')
      .attach('xml', Buffer.from(firmar(cert, semilla.text, 'SemillaModel')), 'semilla.xml')
      .expect(200)
    return res.body.token as string
  }

  const enviarEcf = async (xml: string, ruta = '/fe/recepcion/api/ecf') =>
    request(app.getHttpServer())
      .post(ruta)
      .set('Authorization', `Bearer ${await token()}`)
      .attach('xml', Buffer.from(xml), `${RNC_EMISOR}E31.xml`)

  const estadoAcuse = (xml: string) => ({
    estado: /<Estado>(\d)<\/Estado>/.exec(xml)?.[1],
    motivo: /<CodigoMotivoNoRecibido>(\d)<\/CodigoMotivoNoRecibido>/.exec(xml)?.[1],
  })

  // ── (1) Usuarios ──────────────────────────────────────────────────────────
  describe('POST /users', () => {
    const jwt = new JwtService({ secret: process.env['JWT_SECRET'] ?? 'change-me-in-production' })

    it('un ADMIN crea un usuario con rol permitido', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${otro.token}`)
        .send({ email: 'contador@x.do', password: 'Clave-segura-1', nombre: 'Contador', role: 'CONTADOR' })
        .expect(201)
      expect(res.body.role).toBe('CONTADOR')
      expect(res.body.passwordHash).toBeUndefined()
    })

    it('nadie puede asignar SUPER_ADMIN por la API', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${otro.token}`)
        .send({ email: 'escalar@x.do', password: 'Clave-segura-1', nombre: 'X', role: 'SUPER_ADMIN' })
        .expect(400)
      expect(await prisma.user.count({ where: { email: 'escalar@x.do' } })).toBe(0)
    })

    it('un usuario que no es ADMIN no puede crear usuarios', async () => {
      const usuario = jwt.sign({ sub: 'u1', tenantId: otro.tenant.id, role: 'USUARIO' })
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${usuario}`)
        .send({ email: 'nuevo@x.do', password: 'Clave-segura-1', nombre: 'Nuevo' })
        .expect(403)
    })

    it('no acepta campos fuera del contrato (tenantId, activo)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${otro.token}`)
        .send({ email: 'x2@x.do', password: 'Clave-segura-1', nombre: 'X', tenantId: receptor.tenant.id })
        .expect(400)
    })
  })

  // ── (2) Autenticación del receptor ────────────────────────────────────────
  describe('validacioncertificado', () => {
    it('rechaza la semilla SIN firmar (antes devolvía un token)', async () => {
      const semilla = await request(app.getHttpServer()).get('/fe/autenticacion/api/semilla').expect(200)
      const res = await request(app.getHttpServer())
        .post('/fe/autenticacion/api/validacioncertificado')
        .attach('xml', Buffer.from(semilla.text), 'semilla.xml')
        .expect(401)
      expect(res.body.token).toBeUndefined()
    })

    it('acepta la semilla firmada e indentada, y una semilla sólo sirve una vez', async () => {
      const semilla = await request(app.getHttpServer()).get('/fe/autenticacion/api/semilla').expect(200)
      const firmada = Buffer.from(indentar(firmar(emisorCert, semilla.text, 'SemillaModel')))
      const ok = await request(app.getHttpServer())
        .post('/fe/autenticacion/api/validacioncertificado')
        .attach('xml', firmada, 'semilla.xml')
        .expect(200)
      expect(ok.body.token).toEqual(expect.any(String))
      await request(app.getHttpServer())
        .post('/fe/autenticacion/api/validacioncertificado')
        .attach('xml', firmada, 'semilla.xml')
        .expect(401)
    })

    it('recepción sin token → 401', async () => {
      await request(app.getHttpServer())
        .post('/fe/recepcion/api/ecf')
        .attach('xml', Buffer.from(ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000001')), 'x.xml')
        .expect(401)
    })
  })

  // ── (2) Recepción de e-CF ─────────────────────────────────────────────────
  describe('recepción de e-CF', () => {
    it('e-CF válido → acuse Recibido (0), firmado con el certificado del receptor, y se guarda', async () => {
      const res = await enviarEcf(firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000101'), 'ECF'))
      expect(res.status).toBe(200)
      expect(estadoAcuse(res.text)).toEqual({ estado: '0', motivo: undefined })
      const firma = verificarFirmaEcf(res.text)
      expect(firma.valida).toBe(true)
      expect(firma.infoCert?.nombreEmisor).toBe('RECEPTOR SRL')
      expect(
        await prisma.comprobanteRecibido.count({ where: { tenantId: receptor.tenant.id, eNCF: 'E310000000101' } }),
      ).toBe(1)
    })

    it('e-CF indentado después de firmado (como lo envía la DGII) → Recibido', async () => {
      const xml = indentar(firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000102'), 'ECF'))
      const res = await enviarEcf(xml)
      expect(estadoAcuse(res.text)).toEqual({ estado: '0', motivo: undefined })
    })

    it('rutas sin distinguir mayúsculas (/FE/Recepcion/Api/Ecf)', async () => {
      const res = await enviarEcf(
        firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000103'), 'ECF'),
        '/FE/Recepcion/Api/Ecf',
      )
      expect(res.status).toBe(200)
      expect(estadoAcuse(res.text).estado).toBe('0')
    })

    it('reintento del MISMO documento → mismo acuse, sin duplicar', async () => {
      const xml = firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000104'), 'ECF')
      await enviarEcf(xml)
      const res = await enviarEcf(xml)
      expect(estadoAcuse(res.text)).toEqual({ estado: '0', motivo: undefined })
      expect(await prisma.comprobanteRecibido.count({ where: { eNCF: 'E310000000104' } })).toBe(1)
    })

    it('OTRO documento con el mismo e-NCF → No Recibido motivo 3 y se conserva el original', async () => {
      const original = firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000105', 'ORIGINAL'), 'ECF')
      await enviarEcf(original)
      const res = await enviarEcf(firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000105', 'OTRO'), 'ECF'))
      expect(estadoAcuse(res.text)).toEqual({ estado: '1', motivo: '3' })
      expect(verificarFirmaEcf(res.text).valida).toBe(true)
      const guardado = await prisma.comprobanteRecibido.findFirst({ where: { eNCF: 'E310000000105' } })
      expect(guardado?.xmlFirmado).toBe(original)
    })

    it('firma alterada → No Recibido motivo 2 (acuse firmado) y no se guarda', async () => {
      const alterado = firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000106'), 'ECF')
        .replace('1180.00', '9999.00')
      const res = await enviarEcf(alterado)
      expect(res.status).toBe(200)
      expect(estadoAcuse(res.text)).toEqual({ estado: '1', motivo: '2' })
      expect(verificarFirmaEcf(res.text).valida).toBe(true)
      expect(await prisma.comprobanteRecibido.count({ where: { eNCF: 'E310000000106' } })).toBe(0)
    })

    it('RNC comprador que no es cliente → 404 y NO se guarda en ningún otro tenant', async () => {
      const ajeno = nextRnc()
      const res = await enviarEcf(firmar(emisorCert, ecfXml(RNC_EMISOR, ajeno, 'E310000000107'), 'ECF'))
      expect(res.status).toBe(404)
      expect(await prisma.comprobanteRecibido.count({ where: { eNCF: 'E310000000107' } })).toBe(0)
      expect(await prisma.comprobanteRecibido.count({ where: { tenantId: otro.tenant.id } })).toBe(0)
    })

    it('receptor sin certificado → 503 (nunca un acuse sin firmar) y no se guarda', async () => {
      const res = await enviarEcf(firmar(emisorCert, ecfXml(RNC_EMISOR, otro.tenant.rnc, 'E310000000108'), 'ECF'))
      expect(res.status).toBe(503)
      expect(res.text).not.toContain('<ARECF')
      expect(await prisma.comprobanteRecibido.count({ where: { eNCF: 'E310000000108' } })).toBe(0)
    })
  })

  // ── (2) Aprobación comercial ──────────────────────────────────────────────
  describe('aprobación comercial', () => {
    const acecf = (rncComprador: string, eNCF: string) =>
      '<?xml version="1.0" encoding="utf-8"?><ACECF><DetalleAprobacionComercial><Version>1.0</Version>' +
      `<RNCEmisor>${RNC_EMISOR}</RNCEmisor><eNCF>${eNCF}</eNCF><FechaEmision>01-10-2026</FechaEmision>` +
      `<MontoTotal>1180.00</MontoTotal><RNCComprador>${rncComprador}</RNCComprador><Estado>1</Estado>` +
      '<FechaHoraAprobacionComercial>01-10-2026 11:00:00</FechaHoraAprobacionComercial>' +
      '</DetalleAprobacionComercial></ACECF>'

    const enviarAprobacion = async (xml: string) =>
      request(app.getHttpServer())
        .post('/fe/aprobacioncomercial/api/ecf')
        .set('Authorization', `Bearer ${await token()}`)
        .attach('xml', Buffer.from(xml), 'acecf.xml')

    it('aprobación firmada de un e-CF recibido → 200 y queda ACEPTADO', async () => {
      await enviarEcf(firmar(emisorCert, ecfXml(RNC_EMISOR, receptor.tenant.rnc, 'E310000000201'), 'ECF'))
      const res = await enviarAprobacion(indentar(firmar(emisorCert, acecf(receptor.tenant.rnc, 'E310000000201'), 'ACECF')))
      expect(res.status).toBe(200)
      const c = await prisma.comprobanteRecibido.findFirst({ where: { eNCF: 'E310000000201' } })
      expect(c?.estado).toBe('ACEPTADO')
    })

    it('aprobación sin firma → 400', async () => {
      const res = await enviarAprobacion(acecf(receptor.tenant.rnc, 'E310000000201'))
      expect(res.status).toBe(400)
    })

    it('aprobación para RNCs que no son clientes → 400 (sin tenant de respaldo)', async () => {
      const res = await enviarAprobacion(firmar(emisorCert, acecf(nextRnc(), 'E310000000202'), 'ACECF'))
      expect(res.status).toBe(400)
      expect(await prisma.auditLog.count({ where: { tenantId: otro.tenant.id } })).toBe(0)
    })
  })
})
