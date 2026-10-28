import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { codigoTotp } from '../src/common/services/totp'

// e2e — 2FA en el uso diario: el código se pide al entrar desde el CRM (sólo el
// código: la subcuenta identifica la cuenta) y otra vez para las operaciones de
// Empresa y Configuración (token x-2fa de 10 min). Las empresas anteriores al
// registro directo activan su 2FA desde la app; mientras no lo tengan, siguen
// funcionando como antes.

describe('2FA en el uso diario (e2e)', () => {
  let app: INestApplication
  const http = () => request(app.getHttpServer())
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` })

  beforeAll(async () => { app = (await createTestApp()).app })
  afterAll(async () => { await app.close() })

  async function empresaAntigua(locationId: string): Promise<TestTenant> {
    const t = await createTenant()
    await prisma.ghlLocation.create({ data: { locationId, tenantId: t.tenant.id } })
    return t
  }

  async function activar(t: TestTenant, email: string): Promise<string> {
    const qr = await http().post('/api/v1/seguridad/2fa/configurar').set(bearer(t.token)).send({ email }).expect(200)
    await http().post('/api/v1/seguridad/2fa/activar').set(bearer(t.token)).send({ codigo: codigoTotp(qr.body.secreto) }).expect(200)
    return qr.body.secreto as string
  }

  it('empresa antigua: entra por el CRM pero se le pide activar el 2FA; mientras tanto nada se rompe', async () => {
    const t = await empresaAntigua('loc-a')
    const init = await http().get('/api/v1/ghl/init').query({ location_id: 'loc-a' }).expect(200)
    expect(init.body).toMatchObject({ token: expect.any(String), configurar2fa: true })

    await http().patch('/api/v1/tenants/empresa').set(bearer(t.token)).send({ telefono: '809-555-1111' }).expect(200)
    const est = await http().get('/api/v1/seguridad/2fa').set(bearer(t.token)).expect(200)
    expect(est.body).toEqual({ activo: false, email: null })
    await http().post('/api/v1/seguridad/2fa/configurar').set(bearer(t.token)).send({}).expect(400)
  })

  it('al activarlo: el CRM pide el código cada vez y Empresa/Configuración exigen confirmación', async () => {
    const t = await empresaAntigua('loc-b')
    const secreto = await activar(t, 'dueno@empresa-b.do')

    // Entrar desde el CRM: ya no basta el location_id
    const init = await http().get('/api/v1/ghl/init').query({ location_id: 'loc-b' }).expect(200)
    expect(init.body).toEqual({ requiereLogin: true, locationId: 'loc-b' })

    // Sólo el código (la subcuenta identifica la cuenta)
    await http().post('/api/v1/registro/login').send({ locationId: 'loc-b', codigo: '000000' }).expect(401)
    const login = await http().post('/api/v1/registro/login').send({ locationId: 'loc-b', codigo: codigoTotp(secreto) }).expect(200)
    expect(login.body.sesion.tenant.id).toBe(t.tenant.id)
    const sesion = login.body.sesion.accessToken as string

    // Operaciones sensibles sin confirmar → 403 REQUIERE_2FA
    const sin = await http().patch('/api/v1/tenants/empresa').set(bearer(sesion)).send({ telefono: '809-555-2222' }).expect(403)
    expect(sin.body.codigo).toBe('REQUIERE_2FA')
    await http().patch('/api/v1/contactos/configurar-ghl').set(bearer(sesion)).send({ ghlRncFieldKey: 'rnc' }).expect(403)
    await http().post('/api/v1/webhooks/ghl/configurar').set(bearer(sesion)).send({}).expect(403)

    // Código incorrecto → 403 (no 401: la sesión sigue siendo válida)
    await http().post('/api/v1/seguridad/2fa/confirmar').set(bearer(sesion)).send({ codigo: '000000' }).expect(403)
    const conf = await http().post('/api/v1/seguridad/2fa/confirmar').set(bearer(sesion)).send({ codigo: codigoTotp(secreto) }).expect(200)
    expect(conf.body.minutos).toBe(10)

    await http().patch('/api/v1/tenants/empresa').set(bearer(sesion)).set('x-2fa', conf.body.token).send({ telefono: '809-555-2222' }).expect(200)
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: t.tenant.id } })).telefono).toBe('809-555-2222')

    // Las operaciones normales (facturar, cotizar…) no piden el código
    await http().get('/api/v1/cumplimiento').set(bearer(sesion)).expect(200)
  })

  it('la confirmación de una empresa no sirve para otra', async () => {
    const a = await empresaAntigua('loc-c1')
    const b = await empresaAntigua('loc-c2')
    const sa = await activar(a, 'a@c.do')
    await activar(b, 'b@c.do')
    const confA = await http().post('/api/v1/seguridad/2fa/confirmar').set(bearer(a.token)).send({ codigo: codigoTotp(sa) }).expect(200)
    await http().patch('/api/v1/tenants/empresa').set(bearer(b.token)).set('x-2fa', confA.body.token).send({ telefono: '809-555-3333' }).expect(403)
  })

  it('el correo de la cuenta no puede ser uno ya usado por otra', async () => {
    const a = await empresaAntigua('loc-d1')
    const b = await empresaAntigua('loc-d2')
    await activar(a, 'repetido@d.do')
    await http().post('/api/v1/seguridad/2fa/configurar').set(bearer(b.token)).send({ email: 'Repetido@d.do' }).expect(409)
  })

  it('subcuenta desconocida en el login → 401', async () => {
    await http().post('/api/v1/registro/login').send({ locationId: 'no-existe', codigo: '123456' }).expect(401)
  })
})
