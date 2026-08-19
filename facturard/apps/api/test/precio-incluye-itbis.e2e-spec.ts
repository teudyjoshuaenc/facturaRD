import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// e2e — "El precio incluye ITBIS" es MODO DE CAPTURA, no un monto.
// Bug de producción: el flag no se persistía, el formulario reabría en "sin
// ITBIS" y volver a marcarlo dividía un precio YA dividido → el precio bajaba
// en cada edición (15,000 → 12,711.86 → 10,772.76 → …).
describe('Producto — precioIncluyeItbis (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenant = await createTenant()
  })

  afterAll(async () => { await app.close() })

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })
  const srv = () => app.getHttpServer()

  // Lo que hace el formulario al capturar: 15,000 con ITBIS incluido → base.
  const BASE_15K = Math.round((15000 / 1.18) * 100) / 100 // 12711.86

  it('persiste el modo de captura junto al precio base', async () => {
    const res = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'SERVICIO', nombre: 'Con ITBIS', precioUnitario: BASE_15K, precioIncluyeItbis: true, precioCaptura: 15000 })
      .expect(201)
    expect(res.body.precioIncluyeItbis).toBe(true)
    expect(Number(res.body.precioUnitario)).toBe(BASE_15K)
  })

  it('el precio guardado SIGUE siendo la base sin ITBIS (invariante del XML/PDF)', async () => {
    const res = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'BIEN', nombre: 'Base intacta', precioUnitario: BASE_15K, precioIncluyeItbis: true, precioCaptura: 15000 })
      .expect(201)
    // El backend NO recalcula nada: guarda exactamente la base que recibió.
    expect(Number(res.body.precioUnitario)).toBe(BASE_15K)
  })

  it('reabrir y reconstruir devuelve los 15,000 tecleados (ida y vuelta estable)', async () => {
    const created = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'SERVICIO', nombre: 'Ida y vuelta', precioUnitario: BASE_15K, precioIncluyeItbis: true, precioCaptura: 15000 })
      .expect(201)

    const leido = await request(srv()).get(`/api/v1/productos/${created.body.id}`).set(auth()).expect(200)
    // Lo que hace el formulario al abrir: manda el monto tecleado, EXACTO.
    // Recalcular desde la base daría 14,999.99 — por eso se guarda precioCaptura.
    expect(Number(leido.body.precioCaptura)).toBe(15000)
    expect(Math.round(Number(leido.body.precioUnitario) * 1.18 * 100) / 100).toBe(14999.99)
  })

  it('guardar N veces sin tocar el precio NO lo hunde (idempotencia)', async () => {
    const created = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'SERVICIO', nombre: 'Idempotente', precioUnitario: BASE_15K, precioIncluyeItbis: true, precioCaptura: 15000 })
      .expect(201)
    const id = created.body.id

    // 3 ciclos abrir → guardar, tal como los hace la UI.
    for (let i = 0; i < 3; i++) {
      const actual = await request(srv()).get(`/api/v1/productos/${id}`).set(auth()).expect(200)
      const incluye = actual.body.precioIncluyeItbis === true
      const mostrado = incluye
        ? Number(actual.body.precioCaptura ?? Math.round(Number(actual.body.precioUnitario) * 1.18 * 100) / 100)
        : Number(actual.body.precioUnitario)
      expect(mostrado).toBe(15000) // el usuario siempre ve sus 15,000
      const base = incluye ? Math.round((mostrado / 1.18) * 100) / 100 : mostrado
      await request(srv()).patch(`/api/v1/productos/${id}`).set(auth())
        .send({
          precioUnitario: base,
          precioIncluyeItbis: incluye,
          precioCaptura: incluye ? mostrado : null,
        }).expect(200)
    }

    const final = await request(srv()).get(`/api/v1/productos/${id}`).set(auth()).expect(200)
    expect(Number(final.body.precioUnitario)).toBe(BASE_15K)
    expect(Number(final.body.precioCaptura)).toBe(15000)
    expect(final.body.precioIncluyeItbis).toBe(true)
  })

  it('sin el flag el producto queda en captura "sin ITBIS" (default false)', async () => {
    const res = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'BIEN', nombre: 'Sin flag', precioUnitario: 15000 }).expect(201)
    expect(res.body.precioIncluyeItbis).toBe(false)
    expect(Number(res.body.precioUnitario)).toBe(15000)
  })

  it('desmarcar el check BORRA el monto de captura (no queda un monto viejo mintiendo)', async () => {
    const res = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'BIEN', nombre: 'Desmarcar', precioUnitario: BASE_15K, precioIncluyeItbis: true, precioCaptura: 15000 })
      .expect(201)
    const upd = await request(srv()).patch(`/api/v1/productos/${res.body.id}`).set(auth())
      .send({ precioUnitario: 20000, precioIncluyeItbis: false }).expect(200)
    expect(upd.body.precioIncluyeItbis).toBe(false)
    expect(upd.body.precioCaptura).toBeNull()
    expect(Number(upd.body.precioUnitario)).toBe(20000)
  })

  it('el modo de captura se puede cambiar por PATCH', async () => {
    const res = await request(srv()).post('/api/v1/productos').set(auth())
      .send({ tipo: 'BIEN', nombre: 'Cambia modo', precioUnitario: 1000 }).expect(201)
    const upd = await request(srv()).patch(`/api/v1/productos/${res.body.id}`).set(auth())
      .send({ precioIncluyeItbis: true }).expect(200)
    expect(upd.body.precioIncluyeItbis).toBe(true)
    expect(Number(upd.body.precioUnitario)).toBe(1000) // el monto no se toca
  })
})
