import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as bcrypt from 'bcrypt'
import { prisma, RolAdmin } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, generateP12, uploadCert, TestTenant } from './helpers/factory'
import { codigoTotp } from '../src/common/services/totp'
import { CryptoService } from '../src/common/services/crypto.service'

// e2e — Panel de administración DMAIA (Fase 2). Usuarios propios (sin tenant ni GHL),
// contraseña + 2FA obligatorio, datos sensibles con código reciente y todo auditado.

const CLAVE = 'Clave-Admin-2026!'

describe('Panel de administración (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  const http = () => request(app.getHttpServer())
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` })

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
  })
  afterAll(async () => { await app.close() })

  async function crearAdmin(email: string, rol: RolAdmin = RolAdmin.ADMIN): Promise<void> {
    await prisma.adminUsuario.create({ data: { email, nombre: email, rol, passwordHash: await bcrypt.hash(CLAVE, 4) } })
  }

  /** Primer acceso completo: contraseña → configurar 2FA → sesión. */
  async function entrar(email: string): Promise<{ token: string; secreto: string }> {
    const paso = await http().post('/api/v1/admin/auth/login').send({ email, password: CLAVE }).expect(200)
    expect(paso.body.siguiente).toBe('configurar')
    const qr = await http().post('/api/v1/admin/auth/2fa/configurar').set(bearer(paso.body.tokenPaso)).expect(200)
    const ses = await http().post('/api/v1/admin/auth/2fa/activar').set(bearer(paso.body.tokenPaso))
      .send({ codigo: codigoTotp(qr.body.secreto) }).expect(200)
    return { token: ses.body.token as string, secreto: qr.body.secreto as string }
  }

  async function confirmar(token: string, secreto: string): Promise<string> {
    const r = await http().post('/api/v1/admin/confirmar').set(bearer(token)).send({ codigo: codigoTotp(secreto) }).expect(200)
    return r.body.token as string
  }

  describe('acceso', () => {
    it('contraseña → 2FA obligatorio; luego entra con contraseña + código', async () => {
      await crearAdmin('ana@dmaia.io')
      await http().post('/api/v1/admin/auth/login').send({ email: 'ana@dmaia.io', password: 'mala' }).expect(401)
      const { token, secreto } = await entrar('ana@dmaia.io')
      await http().get('/api/v1/admin/yo').set(bearer(token)).expect(200)

      const paso = await http().post('/api/v1/admin/auth/login').send({ email: 'ANA@dmaia.io', password: CLAVE }).expect(200)
      expect(paso.body.siguiente).toBe('codigo')
      // El token del paso intermedio no abre el panel
      await http().get('/api/v1/admin/clientes').set(bearer(paso.body.tokenPaso)).expect(401)
      await http().post('/api/v1/admin/auth/2fa').set(bearer(paso.body.tokenPaso)).send({ codigo: '000000' }).expect(401)
      await http().post('/api/v1/admin/auth/2fa').set(bearer(paso.body.tokenPaso)).send({ codigo: codigoTotp(secreto) }).expect(200)
    })

    it('los tokens del panel y de los clientes no se cruzan', async () => {
      await crearAdmin('beto@dmaia.io')
      const { token } = await entrar('beto@dmaia.io')
      const cliente = await createTenant()
      await http().get('/api/v1/admin/clientes').set(bearer(cliente.token)).expect(401)
      await http().get('/api/v1/cumplimiento').set(bearer(token)).expect(401)
    })

    it('5 contraseñas incorrectas bloquean 15 minutos', async () => {
      await crearAdmin('carla@dmaia.io')
      for (let i = 0; i < 5; i++) {
        await http().post('/api/v1/admin/auth/login').send({ email: 'carla@dmaia.io', password: 'mala' }).expect(401)
      }
      const r = await http().post('/api/v1/admin/auth/login').send({ email: 'carla@dmaia.io', password: CLAVE }).expect(401)
      expect(r.body.message).toMatch(/Demasiados intentos/)
    })
  })

  describe('clientes', () => {
    let admin: { token: string; secreto: string }
    let cliente: TestTenant
    let p12: Buffer

    beforeAll(async () => {
      await crearAdmin('dana@dmaia.io')
      admin = await entrar('dana@dmaia.io')
      cliente = await createTenant({ razonSocial: 'FERRETERIA EL MARTILLO SRL' })
      const cert = generateP12('FERRETERIA EL MARTILLO')
      p12 = cert.p12Buffer
      await uploadCert(app, cliente.tenant.id, cert)
      const crypto = app.get(CryptoService)
      await prisma.credencialOfv.create({
        data: { tenantId: cliente.tenant.id, usuarioCifrado: crypto.encryptString('ofv.martillo'), claveCifrada: crypto.encryptString('Clave-OFV-9') },
      })
      const base = { tenantId: cliente.tenant.id, tipoECF: 'E31' as const, montoTotal: 1180, rnc: '131880681', razonSocial: 'CLIENTE' }
      await prisma.comprobante.createMany({
        data: [
          { ...base, eNCF: 'E310000000001', estado: 'ERROR', mensajeDGII: 'timeout' },
          { ...base, eNCF: 'E310000000002', estado: 'RECHAZADO', mensajeDGII: 'rechazado' },
          { ...base, eNCF: 'E310000000003', estado: 'ACEPTADO' },
        ],
      })
    })

    it('lista con búsqueda, indicadores y conteo de errores', async () => {
      const r = await http().get('/api/v1/admin/clientes').query({ buscar: 'martillo' }).set(bearer(admin.token)).expect(200)
      expect(r.body.total).toBe(1)
      expect(r.body.clientes[0]).toMatchObject({
        id: cliente.tenant.id, ofv: true, errores: 1, rechazados: 1, certificadoVence: expect.any(String),
      })
      const conErrores = await http().get('/api/v1/admin/clientes').query({ filtro: 'conErrores' }).set(bearer(admin.token)).expect(200)
      expect(conErrores.body.clientes.map((c: { id: string }) => c.id)).toContain(cliente.tenant.id)
    })

    it('detalle sin datos secretos (sin token de GHL ni P12)', async () => {
      const r = await http().get(`/api/v1/admin/clientes/${cliente.tenant.id}`).set(bearer(admin.token)).expect(200)
      expect(r.body.ghlAccessToken).toBeUndefined()
      expect(JSON.stringify(r.body)).not.toMatch(/p12Encrypted|passphraseCifrada|Clave-OFV-9/)
      expect(r.body.comprobantesConProblemas).toHaveLength(2)
      expect(r.body.comprobantesPorEstado).toMatchObject({ ERROR: 1, RECHAZADO: 1, ACEPTADO: 1 })
    })

    it('datos sensibles y descarga del P12 exigen código reciente y quedan auditados', async () => {
      const ruta = `/api/v1/admin/clientes/${cliente.tenant.id}`
      await http().post(`${ruta}/sensibles`).set(bearer(admin.token)).expect(403)
      await http().get(`${ruta}/certificado`).set(bearer(admin.token)).expect(403)
      await http().post('/api/v1/admin/confirmar').set(bearer(admin.token)).send({ codigo: '000000' }).expect(403)

      const conf = await confirmar(admin.token, admin.secreto)
      const s = await http().post(`${ruta}/sensibles`).set(bearer(admin.token)).set('x-2fa-admin', conf).expect(200)
      expect(s.body).toEqual({ ofv: { usuario: 'ofv.martillo', clave: 'Clave-OFV-9' }, claveCertificado: 'test-pass-1234' })

      const d = await http().get(`${ruta}/certificado`).set(bearer(admin.token)).set('x-2fa-admin', conf)
        .buffer(true).parse((res, cb) => {
          const partes: Buffer[] = []
          res.on('data', (c: Buffer) => partes.push(c))
          res.on('end', () => cb(null, Buffer.concat(partes)))
        }).expect(200)
      expect(d.headers['content-disposition']).toBe(`attachment; filename="${cliente.tenant.rnc}.p12"`)
      expect(Buffer.compare(d.body as Buffer, p12)).toBe(0)

      const acciones = (await prisma.adminAuditoria.findMany({ where: { tenantId: cliente.tenant.id } })).map((a) => a.accion)
      expect(acciones).toEqual(expect.arrayContaining(['DATOS_SENSIBLES_CONSULTADOS', 'CERTIFICADO_DESCARGADO']))
    })

    it('reintentar: sólo ERROR (se encola con el mismo e-NCF); RECHAZADO no', async () => {
      const [error, rechazado] = await Promise.all([
        prisma.comprobante.findFirstOrThrow({ where: { tenantId: cliente.tenant.id, estado: 'ERROR' } }),
        prisma.comprobante.findFirstOrThrow({ where: { tenantId: cliente.tenant.id, estado: 'RECHAZADO' } }),
      ])
      ctx.queueAdd.mockClear()
      await http().post(`/api/v1/admin/comprobantes/${rechazado.id}/reintentar`).set(bearer(admin.token)).expect(400)
      const r = await http().post(`/api/v1/admin/comprobantes/${error.id}/reintentar`).set(bearer(admin.token)).expect(200)
      expect(r.body).toEqual({ encolado: true, eNCF: 'E310000000001' })
      expect(ctx.queueAdd).toHaveBeenCalledWith('emit', { comprobanteId: error.id, tenantId: cliente.tenant.id })
      expect((await prisma.comprobante.findUniqueOrThrow({ where: { id: error.id } })).estado).toBe('PENDIENTE')
    })

    it('suspender, cambiar ambiente y reiniciar el 2FA del cliente (auditado)', async () => {
      const ruta = `/api/v1/admin/clientes/${cliente.tenant.id}`
      const r = await http().patch(ruta).set(bearer(admin.token)).send({ estado: 'SUSPENDIDO', ambienteDgii: 'CERTECF' }).expect(200)
      expect(r.body).toMatchObject({ estado: 'SUSPENDIDO', ambienteDgii: 'CERTECF' })

      await http().post(`${ruta}/reiniciar-2fa`).set(bearer(admin.token)).expect(404)
      await prisma.cuentaRegistro.create({ data: { email: 'martillo@x.do', tenantId: cliente.tenant.id, totpActivo: true, totpSecretCifrado: 'x' } })
      await http().post(`${ruta}/reiniciar-2fa`).set(bearer(admin.token)).expect(200)
      expect(await prisma.cuentaRegistro.findUnique({ where: { tenantId: cliente.tenant.id } })).toMatchObject({ totpActivo: false, totpSecretCifrado: null })

      const auditoria = await http().get('/api/v1/admin/auditoria').query({ tenantId: cliente.tenant.id }).set(bearer(admin.token)).expect(200)
      expect(auditoria.body.map((a: { accion: string }) => a.accion)).toEqual(
        expect.arrayContaining(['CLIENTE_ACTUALIZADO', 'CLIENTE_2FA_REINICIADO', 'COMPROBANTE_REINTENTADO']),
      )
    })
  })

  describe('usuarios del panel', () => {
    it('sólo ADMIN gestiona usuarios; SOPORTE no; nadie se desactiva a sí mismo', async () => {
      await crearAdmin('eva@dmaia.io')
      const eva = await entrar('eva@dmaia.io')
      await http().post('/api/v1/admin/usuarios').set(bearer(eva.token))
        .send({ email: 'soporte@dmaia.io', nombre: 'Soporte', rol: 'SOPORTE', password: 'debil' }).expect(400)
      await http().post('/api/v1/admin/usuarios').set(bearer(eva.token))
        .send({ email: 'soporte@dmaia.io', nombre: 'Soporte', rol: 'SOPORTE', password: 'Clave-Soporte-1!' }).expect(201)

      await prisma.adminUsuario.update({ where: { email: 'soporte@dmaia.io' }, data: { passwordHash: await bcrypt.hash(CLAVE, 4) } })
      const soporte = await entrar('soporte@dmaia.io')
      await http().get('/api/v1/admin/usuarios').set(bearer(soporte.token)).expect(403)
      await http().get('/api/v1/admin/clientes').set(bearer(soporte.token)).expect(200)

      const yo = await http().get('/api/v1/admin/yo').set(bearer(eva.token)).expect(200)
      await http().patch(`/api/v1/admin/usuarios/${yo.body.id}`).set(bearer(eva.token)).send({ activo: false }).expect(400)

      const s = await prisma.adminUsuario.findUniqueOrThrow({ where: { email: 'soporte@dmaia.io' } })
      await http().patch(`/api/v1/admin/usuarios/${s.id}`).set(bearer(eva.token)).send({ activo: false }).expect(200)
      await http().get('/api/v1/admin/clientes').set(bearer(soporte.token)).expect(401)
    })
  })
})
