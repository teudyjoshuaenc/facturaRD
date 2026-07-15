import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'

// e2e Sprint 2 — catálogo de productos + snapshot en emisión.
describe('Productos (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
    await initSequences(tenantA.tenant.id)
    await uploadCert(app, tenantA.tenant.id, generateP12('PROD-TENANT-A'))
  })

  afterAll(async () => { await app.close() })

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const nuevo = (over: Record<string, unknown> = {}) => ({
    tipo: 'SERVICIO', nombre: 'Consultoría', precioUnitario: 1000, tratamientoITBIS: 'I1', ...over,
  })

  it('CRUD: crea, obtiene, lista, actualiza', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ codigo: 'SVC-1' })).expect(201)
    expect(created.body.activo).toBe(true)
    const id = created.body.id

    await request(app.getHttpServer()).get(`/api/v1/productos/${id}`).set(auth(tenantA)).expect(200)

    const list = await request(app.getHttpServer()).get('/api/v1/productos').set(auth(tenantA)).expect(200)
    expect(list.body.data.some((p: { id: string }) => p.id === id)).toBe(true)

    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/productos/${id}`).set(auth(tenantA)).send({ precioUnitario: 1500 }).expect(200)
    expect(Number(upd.body.precioUnitario)).toBe(1500)
  })

  it('código duplicado → 409', async () => {
    await request(app.getHttpServer()).post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ codigo: 'DUP' })).expect(201)
    await request(app.getHttpServer()).post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ codigo: 'DUP' })).expect(409)
  })

  it('precioUnitario <= 0 → 400', async () => {
    await request(app.getHttpServer()).post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ precioUnitario: 0 })).expect(400)
  })

  it('soft delete + filtro 3 estados: default=todos, activo=true excluye, activo=false incluye', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ codigo: 'SOFT' })).expect(201)
    const id = created.body.id

    await request(app.getHttpServer()).delete(`/api/v1/productos/${id}`).set(auth(tenantA)).expect(200)

    // soft delete: sigue accesible por id con activo=false
    const byId = await request(app.getHttpServer()).get(`/api/v1/productos/${id}`).set(auth(tenantA)).expect(200)
    expect(byId.body.activo).toBe(false)

    // default (sin parámetro) → trae activos E inactivos
    const listTodos = await request(app.getHttpServer()).get('/api/v1/productos').set(auth(tenantA)).expect(200)
    expect(listTodos.body.data.some((p: { id: string }) => p.id === id)).toBe(true)

    // activo=true → sólo activos (no aparece el soft-deleted)
    const listActivos = await request(app.getHttpServer()).get('/api/v1/productos?activo=true').set(auth(tenantA)).expect(200)
    expect(listActivos.body.data.some((p: { id: string }) => p.id === id)).toBe(false)
    expect(listActivos.body.data.every((p: { activo: boolean }) => p.activo === true)).toBe(true)

    // activo=false → sólo inactivos (aparece el soft-deleted)
    const listInactivos = await request(app.getHttpServer()).get('/api/v1/productos?activo=false').set(auth(tenantA)).expect(200)
    expect(listInactivos.body.data.some((p: { id: string }) => p.id === id)).toBe(true)
    expect(listInactivos.body.data.every((p: { activo: boolean }) => p.activo === false)).toBe(true)
  })

  it('reactivar: PATCH activo=true devuelve el producto a la lista de activos', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ codigo: 'REACT' })).expect(201)
    const id = created.body.id

    await request(app.getHttpServer()).delete(`/api/v1/productos/${id}`).set(auth(tenantA)).expect(200)
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/productos/${id}`).set(auth(tenantA)).send({ activo: true }).expect(200)
    expect(upd.body.activo).toBe(true)

    const listActivos = await request(app.getHttpServer()).get('/api/v1/productos?activo=true').set(auth(tenantA)).expect(200)
    expect(listActivos.body.data.some((p: { id: string }) => p.id === id)).toBe(true)
  })

  it('aislamiento multi-tenant: B no lee ni actualiza el producto de A (404)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ codigo: 'ISO' })).expect(201)
    const id = created.body.id
    await request(app.getHttpServer()).get(`/api/v1/productos/${id}`).set(auth(tenantB)).expect(404)
    await request(app.getHttpServer()).patch(`/api/v1/productos/${id}`).set(auth(tenantB)).send({ precioUnitario: 5 }).expect(404)
  })

  it('snapshot: emitir con productoId copia los campos; editar el producto después NO cambia el comprobante', async () => {
    const prod = await request(app.getHttpServer())
      .post('/api/v1/productos').set(auth(tenantA)).send(nuevo({ nombre: 'Servicio X', precioUnitario: 2000, tratamientoITBIS: 'I1', codigo: 'SNAP' })).expect(201)

    const comp = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send({
        tipoECF: 'E31', emitir: false, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
        rncComprador: '131880681', razonSocialComprador: 'CLIENTE SRL',
        items: [{ numeroLinea: 1, productoId: prod.body.id, cantidad: 2 }],
      }).expect(201)

    // snapshot: 2 x 2000 = 4000 gravado + 18% = 4720
    expect(Number(comp.body.montoTotal)).toBe(4720)
    const item0 = comp.body.datos.items[0]
    expect(item0.nombreItem).toBe('Servicio X')
    expect(item0.precioUnitarioItem).toBe(2000)
    expect(item0.indicadorFacturacion).toBe('I1')

    // Mutar el producto no debe afectar el comprobante ya creado.
    await request(app.getHttpServer())
      .patch(`/api/v1/productos/${prod.body.id}`).set(auth(tenantA)).send({ nombre: 'CAMBIADO', precioUnitario: 9999 }).expect(200)

    const refetch = await prisma.comprobante.findUniqueOrThrow({ where: { id: comp.body.id } })
    const datos = refetch.datos as { items: Array<{ nombreItem: string; precioUnitarioItem: number }> }
    expect(datos.items[0]?.nombreItem).toBe('Servicio X')
    expect(datos.items[0]?.precioUnitarioItem).toBe(2000)
    expect(Number(refetch.montoTotal)).toBe(4720)
  })
})
