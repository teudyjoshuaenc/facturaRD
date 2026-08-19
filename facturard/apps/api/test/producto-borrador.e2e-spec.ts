import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'

// e2e — BORRADOR de catálogo: un producto "guardado sin terminar".
// Espejo del DRAFT de comprobante: se guarda incompleto, no se puede facturar
// hasta publicarlo, y nunca se cuela en el selector de emisión.
describe('Productos — borrador de catálogo (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenant = await createTenant()
    await initSequences(tenant.tenant.id)
    await uploadCert(app, tenant.tenant.id, generateP12('PROD-BORRADOR'))
  })

  afterAll(async () => { await app.close() })

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })
  const srv = () => app.getHttpServer()

  const crearBorrador = (over: Record<string, unknown> = {}) =>
    request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'SERVICIO', nombre: 'Sin terminar', borrador: true, ...over })

  it('guarda un borrador SIN precio (201) y lo marca borrador', async () => {
    const res = await crearBorrador().expect(201)
    expect(res.body.borrador).toBe(true)
    expect(Number(res.body.precioUnitario)).toBe(0)
    expect(res.body.activo).toBe(true)
  })

  it('un borrador PUEDE traer precio si el usuario ya lo escribió', async () => {
    const res = await crearBorrador({ nombre: 'Medio hecho', precioUnitario: 750 }).expect(201)
    expect(res.body.borrador).toBe(true)
    expect(Number(res.body.precioUnitario)).toBe(750)
  })

  it('SIN borrador el precio sigue siendo obligatorio (400) — no se relajó nada', async () => {
    await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'SERVICIO', nombre: 'Publicado sin precio' }).expect(400)

    await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'SERVICIO', nombre: 'Publicado precio 0', precioUnitario: 0 }).expect(400)
  })

  it('el listado por defecto NO devuelve borradores (selector de emisión limpio)', async () => {
    const b = await crearBorrador({ nombre: 'Oculto' }).expect(201)
    const pub = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'BIEN', nombre: 'Visible', precioUnitario: 100 }).expect(201)

    const list = await request(srv()).get('/api/v1/productos?limit=100').set(auth()).expect(200)
    const ids = list.body.data.map((p: { id: string }) => p.id)
    expect(ids).not.toContain(b.body.id)
    expect(ids).toContain(pub.body.id)
  })

  it('?clase=borrador devuelve SÓLO borradores; ?clase=todos devuelve ambos', async () => {
    const soloB = await request(srv()).get('/api/v1/productos?clase=borrador&limit=100').set(auth()).expect(200)
    expect(soloB.body.data.length).toBeGreaterThan(0)
    expect(soloB.body.data.every((p: { borrador: boolean }) => p.borrador === true)).toBe(true)

    const todos = await request(srv()).get('/api/v1/productos?clase=todos&limit=100').set(auth()).expect(200)
    expect(todos.body.data.some((p: { borrador: boolean }) => p.borrador === true)).toBe(true)
    expect(todos.body.data.some((p: { borrador: boolean }) => p.borrador === false)).toBe(true)
  })

  it('NO se puede facturar con un borrador → 400 y sin consumir e-NCF', async () => {
    const b = await crearBorrador({ nombre: 'No facturable' }).expect(201)

    const antes = await request(srv()).get('/api/v1/secuencias').set(auth()).expect(200)

    const res = await request(srv()).post('/api/v1/comprobantes').set(auth()).send({
      tipoECF: 'E31', emitir: false, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      rncComprador: '131880681', razonSocialComprador: 'CLIENTE SRL',
      items: [{ numeroLinea: 1, productoId: b.body.id, cantidad: 1 }],
    }).expect(400)
    expect(String(res.body.message)).toMatch(/borrador/i)

    const despues = await request(srv()).get('/api/v1/secuencias').set(auth()).expect(200)
    expect(despues.body).toEqual(antes.body)
  })

  it('publicar (PATCH borrador:false) exige precio > 0', async () => {
    const b = await crearBorrador({ nombre: 'Para publicar' }).expect(201)

    await request(srv()).patch(`/api/v1/productos/${b.body.id}`).set(auth())
      .send({ borrador: false }).expect(400)

    const ok = await request(srv()).patch(`/api/v1/productos/${b.body.id}`).set(auth())
      .send({ borrador: false, precioUnitario: 1200 }).expect(200)
    expect(ok.body.borrador).toBe(false)
    expect(Number(ok.body.precioUnitario)).toBe(1200)
  })

  it('publicado, YA se puede facturar', async () => {
    const b = await crearBorrador({ nombre: 'Publicado luego' }).expect(201)
    await request(srv()).patch(`/api/v1/productos/${b.body.id}`).set(auth())
      .send({ borrador: false, precioUnitario: 500 }).expect(200)

    const comp = await request(srv()).post('/api/v1/comprobantes').set(auth()).send({
      tipoECF: 'E31', emitir: false, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      rncComprador: '131880681', razonSocialComprador: 'CLIENTE SRL',
      items: [{ numeroLinea: 1, productoId: b.body.id, cantidad: 2 }],
    }).expect(201)
    expect(comp.body.datos.items[0].nombreItem).toBe('Publicado luego')
    expect(Number(comp.body.montoTotal)).toBe(1180) // 2×500 + 18%
  })

  it('un borrador se edita como borrador sin exigir precio', async () => {
    const b = await crearBorrador({ nombre: 'Editable' }).expect(201)
    const upd = await request(srv()).patch(`/api/v1/productos/${b.body.id}`).set(auth())
      .send({ nombre: 'Editable v2' }).expect(200)
    expect(upd.body.nombre).toBe('Editable v2')
    expect(upd.body.borrador).toBe(true)
    expect(Number(upd.body.precioUnitario)).toBe(0)
  })

  it('regresión: un producto normal sigue creándose publicado (borrador=false)', async () => {
    const res = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'BIEN', nombre: 'Normal', precioUnitario: 999 }).expect(201)
    expect(res.body.borrador).toBe(false)
  })
})
