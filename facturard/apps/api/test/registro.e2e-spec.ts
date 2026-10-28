import { INestApplication, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp } from './helpers/test-app'
import { createTenant, generateP12, nextRnc } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'
import { codigoTotp } from '../src/common/services/totp'

// e2e — Registro directo en FacturaRD (Fase 1): correo → 2FA → contribuyente +
// representante → P12 → OFV → completar. Sin contraseñas ni correos propios: se
// entra con correo + código de Google Authenticator (la contraseña del CRM la
// configura GoHighLevel). El padrón de la DGII se mockea; P12 y códigos son reales.

const DN = { provincia: '010000', municipio: '010100' } // Distrito Nacional / Santo Domingo de Guzmán
const SANTIAGO = { provincia: '250000', municipio: '250100' }

describe('Registro directo (e2e)', () => {
  let app: INestApplication
  const buscarPorRNC = jest.fn()
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    const ctx = await createTestApp([
      { provide: DgiiContribuyentesService, useValue: { buscarPorRNC } },
    ])
    app = ctx.app
  })
  afterAll(async () => { await app.close() })
  beforeEach(() => {
    buscarPorRNC.mockReset()
    buscarPorRNC.mockImplementation(async (rnc: string) => ({
      rnc, razonSocial: `EMPRESA ${rnc} SRL`, nombreComercial: undefined, estado: 'ACTIVO', categoria: undefined,
    }))
  })

  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` })

  async function cuentaVerificada(email: string): Promise<string> {
    const res = await http().post('/api/v1/registro/iniciar').send({ email }).expect(200)
    return res.body.tokenRegistro as string
  }

  async function activarDosPasos(t: string): Promise<string> {
    const qr = await http().post('/api/v1/registro/dos-pasos/configurar').set(bearer(t)).expect(200)
    await http().post('/api/v1/registro/dos-pasos/activar').set(bearer(t)).send({ codigo: codigoTotp(qr.body.secreto) }).expect(200)
    return qr.body.secreto as string
  }

  const datos = (rnc: string, extra: Record<string, unknown> = {}) => ({
    contribuyente: {
      tiposComprobante: ['E31', 'E32', 'E34'],
      tipoIdentificacion: 'RNC',
      rnc,
      nombreComercial: 'MI NEGOCIO',
      actividadEconomica: 'Servicios de consultoría',
      telefono: '809-555-0101',
      email: 'Empresa@Correo.do',
      direccion: 'Av. Winston Churchill 100',
      sector: 'Piantini',
      ...DN,
      ...extra,
    },
    representante: {
      identificacion: '00112345678',
      nombreCompleto: 'Juana Pérez',
      telefono: '809-555-0102',
      celular: '829-555-0103',
      email: 'juana@correo.do',
      direccion: 'Calle 1 #2',
      sector: 'Los Jardines',
      ...SANTIAGO,
    },
  })

  describe('entrada con correo y código', () => {
    it('el correo abre el registro; se puede retomar hasta activar el 2FA, luego sólo con código', async () => {
      const t1 = await cuentaVerificada('Nueva@Empresa.do')
      const t2 = await cuentaVerificada('nueva@empresa.do')
      const e1 = await http().get('/api/v1/registro/estado').set(bearer(t1)).expect(200)
      const e2 = await http().get('/api/v1/registro/estado').set(bearer(t2)).expect(200)
      expect(e1.body.email).toBe('nueva@empresa.do')
      expect(e2.body).toEqual(e1.body)
      expect(await prisma.cuentaRegistro.count({ where: { email: 'nueva@empresa.do' } })).toBe(1)

      await activarDosPasos(t1)
      const otra = await http().post('/api/v1/registro/iniciar').send({ email: 'nueva@empresa.do' }).expect(409)
      expect(otra.body.message).toMatch(/Google Authenticator/)
    })

    it('login: código malo → 401; bueno → sesión de registro sin empresa todavía', async () => {
      const secreto = await activarDosPasos(await cuentaVerificada('login@x.do'))
      await http().post('/api/v1/registro/login').send({ email: 'login@x.do', codigo: '000000' }).expect(401)
      const ok = await http().post('/api/v1/registro/login').send({ email: 'LOGIN@x.do', codigo: codigoTotp(secreto) }).expect(200)
      expect(ok.body.tokenRegistro).toEqual(expect.any(String))
      expect(ok.body.sesion).toBeNull()
    })

    it('5 códigos incorrectos bloquean la cuenta 15 minutos (incluso con el código bueno)', async () => {
      const secreto = await activarDosPasos(await cuentaVerificada('fuerza@x.do'))
      for (let i = 0; i < 5; i++) {
        await http().post('/api/v1/registro/login').send({ email: 'fuerza@x.do', codigo: '111111' }).expect(401)
      }
      const res = await http().post('/api/v1/registro/login').send({ email: 'fuerza@x.do', codigo: codigoTotp(secreto) }).expect(401)
      expect(res.body.message).toMatch(/Demasiados intentos/)
    })

    it('sin 2FA activo no se puede entrar por login', async () => {
      await cuentaVerificada('sin2fa@x.do')
      await http().post('/api/v1/registro/login').send({ email: 'sin2fa@x.do', codigo: '123456' }).expect(401)
    })
  })

  describe('verificación en dos pasos', () => {
    it('sin 2FA no se aceptan datos; QR válido; código incorrecto → 400; no se reconfigura activa', async () => {
      const t = await cuentaVerificada('dospasos@x.do')
      await http().put('/api/v1/registro/datos').set(bearer(t)).send(datos(nextRnc())).expect(403)

      const qr = await http().post('/api/v1/registro/dos-pasos/configurar').set(bearer(t)).expect(200)
      expect(qr.body.qrDataUrl).toMatch(/^data:image\/png;base64,/)
      // Recargar la página (pedir el QR otra vez) no cambia el secreto ya escaneado
      const otraVez = await http().post('/api/v1/registro/dos-pasos/configurar').set(bearer(t)).expect(200)
      expect(otraVez.body.secreto).toBe(qr.body.secreto)
      expect(qr.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/FacturaRD%3Adospasos%40x\.do\?secret=/)
      await http().post('/api/v1/registro/dos-pasos/activar').set(bearer(t)).send({ codigo: '000000' }).expect(400)
      await http().post('/api/v1/registro/dos-pasos/activar').set(bearer(t)).send({ codigo: codigoTotp(qr.body.secreto) }).expect(200)
      await http().post('/api/v1/registro/dos-pasos/configurar').set(bearer(t)).expect(409)

      const cuenta = await prisma.cuentaRegistro.findUnique({ where: { email: 'dospasos@x.do' } })
      expect(cuenta?.totpSecretCifrado).not.toContain(qr.body.secreto)
    })
  })

  describe('flujo completo', () => {
    it('datos → P12 → OFV → completar crea la empresa lista para usar', async () => {
      const email = 'completo@empresa.do'
      const t = await cuentaVerificada(email)
      const secreto = await activarDosPasos(t)
      const rnc = nextRnc()

      // Provincia y municipio que no corresponden
      await http().put('/api/v1/registro/datos').set(bearer(t))
        .send(datos(rnc, { provincia: '010000', municipio: '250100' })).expect(400)

      const est = await http().put('/api/v1/registro/datos').set(bearer(t)).send(datos(rnc)).expect(200)
      expect(est.body).toMatchObject({ datosCompletos: true, certificadoCargado: false, completo: false })
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { rnc },
        include: { users: true, perfilFiscal: true, representante: true, secuencias: true },
      })
      expect(tenant.razonSocial).toBe(`EMPRESA ${rnc} SRL`)
      expect(tenant.email).toBe('empresa@correo.do')
      expect(tenant.users).toHaveLength(1)
      expect(tenant.users[0]).toMatchObject({ email, role: 'ADMIN', nombre: 'Juana Pérez' })
      expect(tenant.perfilFiscal).toMatchObject({ tipoRegistro: 'EMISOR_ELECTRONICO', tiposComprobante: ['E31', 'E32', 'E34'], provincia: '010000', municipio: '010100' })
      expect(tenant.representante).toMatchObject({ identificacion: '00112345678', provincia: '250000', municipio: '250100' })
      expect(tenant.secuencias).toHaveLength(10)

      // Guardar otra vez actualiza (no duplica); cambiar el RNC no se permite
      await http().put('/api/v1/registro/datos').set(bearer(t)).send(datos(rnc, { sector: 'Naco' })).expect(200)
      expect((await prisma.perfilFiscal.findUnique({ where: { tenantId: tenant.id } }))?.sector).toBe('Naco')
      await http().put('/api/v1/registro/datos').set(bearer(t)).send(datos(nextRnc())).expect(409)

      // Completar antes de tiempo dice qué falta
      const falta = await http().post('/api/v1/registro/completar').set(bearer(t)).expect(400)
      expect(falta.body.message).toMatch(/certificado digital.*Oficina Virtual/)

      // Certificado
      const cert = generateP12('EMPRESA COMPLETA')
      await http().post('/api/v1/registro/certificado').set(bearer(t))
        .attach('file', cert.p12Buffer, 'cert.p12').field('passphrase', 'mala-clave').expect(400)
      await http().post('/api/v1/registro/certificado').set(bearer(t))
        .attach('file', cert.p12Buffer, 'cert.p12').field('passphrase', cert.passphrase).expect(200)

      // OFV: exige código 2FA válido y se guarda cifrada
      await http().put('/api/v1/registro/ofv').set(bearer(t)).send({ usuario: 'ofv@empresa.do', clave: 'ClaveOFV#1', codigo: '000000' }).expect(403)
      await http().put('/api/v1/registro/ofv').set(bearer(t))
        .send({ usuario: 'ofv@empresa.do', clave: 'ClaveOFV#1', codigo: codigoTotp(secreto) }).expect(200)
      const ofv = await prisma.credencialOfv.findUniqueOrThrow({ where: { tenantId: tenant.id } })
      expect(ofv.claveCifrada).not.toContain('ClaveOFV#1')
      expect(ofv.usuarioCifrado).not.toContain('ofv@empresa.do')

      // Ver los datos sensibles exige código y queda auditado
      await http().post('/api/v1/registro/sensibles').set(bearer(t)).send({ codigo: '123456' }).expect(403)
      const sens = await http().post('/api/v1/registro/sensibles').set(bearer(t)).send({ codigo: codigoTotp(secreto) }).expect(200)
      expect(sens.body.ofv).toEqual({ usuario: 'ofv@empresa.do', clave: 'ClaveOFV#1' })
      expect(await prisma.auditLog.count({ where: { tenantId: tenant.id, accion: 'OFV_CONSULTADA' } })).toBe(1)

      // Completar → sesión normal de FacturaRD que funciona en la API
      const fin = await http().post('/api/v1/registro/completar').set(bearer(t)).expect(200)
      expect(fin.body.tenant).toMatchObject({ rnc, id: tenant.id })
      await http().get('/api/v1/cumplimiento').set(bearer(fin.body.accessToken)).expect(200)

      // Luego el login (correo + código) devuelve también la sesión de la empresa
      const login = await http().post('/api/v1/registro/login').send({ email, codigo: codigoTotp(secreto) }).expect(200)
      expect(login.body.sesion.tenant.rnc).toBe(rnc)

      // Los tokens no se cruzan
      await http().get('/api/v1/cumplimiento').set(bearer(t)).expect(401)
      await http().get('/api/v1/registro/estado').set(bearer(fin.body.accessToken)).expect(401)

      // Con EXIGIR_2FA=true, /ghl/init no entrega token sólo con el location_id
      await prisma.ghlLocation.create({ data: { locationId: 'loc-registrada', tenantId: tenant.id } })
      process.env['EXIGIR_2FA'] = 'true'
      try {
        const init = await http().get('/api/v1/ghl/init').query({ location_id: 'loc-registrada' }).expect(200)
        expect(init.body).toEqual({ requiereLogin: true, locationId: 'loc-registrada' })
      } finally {
        delete process.env['EXIGIR_2FA']
      }
    })

    it('empresa antigua sin cuenta sigue entrando por /ghl/init (sin romper a los clientes actuales)', async () => {
      const viejo = await createTenant()
      await prisma.ghlLocation.create({ data: { locationId: 'loc-antigua', tenantId: viejo.tenant.id } })
      const init = await http().get('/api/v1/ghl/init').query({ location_id: 'loc-antigua' }).expect(200)
      expect(init.body.token).toEqual(expect.any(String))
    })

    it('RNC que ya tiene cuenta en FacturaRD → 409', async () => {
      const existente = await createTenant()
      const t = await cuentaVerificada('repetido@x.do')
      await activarDosPasos(t)
      await http().put('/api/v1/registro/datos').set(bearer(t)).send(datos(existente.tenant.rnc)).expect(409)
    })

    it('cédula fuera del padrón: con nombre escrito continúa; sin nombre → 400', async () => {
      buscarPorRNC.mockRejectedValue(new NotFoundException('no está'))
      const t = await cuentaVerificada('cedula@x.do')
      await activarDosPasos(t)
      const cedula = '40211932609'
      await http().put('/api/v1/registro/datos').set(bearer(t))
        .send(datos(cedula, { tipoIdentificacion: 'CEDULA' })).expect(400)
      await http().put('/api/v1/registro/datos').set(bearer(t))
        .send(datos(cedula, { tipoIdentificacion: 'CEDULA', razonSocial: 'Pedro Gómez' })).expect(200)
      expect((await prisma.tenant.findUniqueOrThrow({ where: { rnc: cedula } })).razonSocial).toBe('Pedro Gómez')
    })
  })

  it('catálogo de provincias y municipios de la DGII', async () => {
    const res = await http().get('/api/v1/catalogos/provincias').expect(200)
    expect(res.body).toHaveLength(32)
    const dn = res.body.find((p: { codigo: string }) => p.codigo === '010000')
    expect(dn.municipios).toEqual([{ codigo: '010100', nombre: 'Santo Domingo de Guzmán' }])
  })
})
