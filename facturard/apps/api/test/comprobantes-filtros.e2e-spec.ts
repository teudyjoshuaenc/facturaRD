import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'

// e2e — Filtros de GET /comprobantes tras separar las 3 dimensiones de la lista
// (estado DGII / clase de documento / origen). Lo que se protege aquí:
//
//  1. `estado` acepta VARIOS valores separados por coma → el agrupado
//     "En proceso" (PENDIENTE|EN_COLA|ENVIANDO) se resuelve EN EL SERVIDOR con
//     paginación correcta. Antes se filtraba en cliente sobre un limit:100 y
//     con más comprobantes la lista salía incompleta en silencio.
//  2. `origen=cotizacion` filtra por procedencia — es un eje aparte: una
//     factura rechazada que vino de cotización sigue siendo RECHAZADO.
//  3. `clase` y `estado` se combinan en AND (ninguno pisa al otro).
//
// Nada de esto toca el ciclo fiscal: sólo lectura de la lista.
describe('GET /comprobantes — filtros estado/clase/origen — e2e', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenant = await createTenant()
    await initSequences(tenant.tenant.id)
    await uploadCert(app, tenant.tenant.id, generateP12('FILTROS'))
  })

  afterAll(async () => { await app.close() })

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })

  // Se siembran los comprobantes directamente en la DB: aquí se prueba la
  // CONSULTA, no el pipeline de emisión (que ya cubren otros specs).
  const sembrar = async (
    estado: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> => {
    const c = await prisma.comprobante.create({
      data: {
        tenantId: tenant.tenant.id,
        tipoECF: 'E31',
        estado: estado as never,
        montoTotal: 1000,
        rnc: '131880681',
        razonSocial: 'CLIENTE FILTROS SRL',
        datos: {},
        ...extra,
      },
    })
    return c.id
  }

  let idAceptado: string
  let idRechazado: string
  let idError: string
  let idPendiente: string
  let idEnCola: string
  let idEnviando: string
  let idDraft: string
  let idNota: string
  let idAceptadoDeCotizacion: string
  let idRechazadoDeCotizacion: string
  let idNotaBorrador: string

  beforeAll(async () => {
    // Una cotización real para poder enlazar procedencia.
    const cot = await prisma.cotizacion.create({
      data: {
        tenantId: tenant.tenant.id,
        folio: 'COT-900001',
        estado: 'CONVERTIDA',
        subtotal: 1000,
        itbis: 180,
        total: 1180,
      },
    })

    idAceptado = await sembrar('ACEPTADO', { eNCF: 'E319000000001' })
    idRechazado = await sembrar('RECHAZADO', { eNCF: 'E319000000002' })
    idError = await sembrar('ERROR', { eNCF: 'E319000000003' })
    idPendiente = await sembrar('PENDIENTE', { eNCF: 'E319000000004' })
    idEnCola = await sembrar('EN_COLA', { eNCF: 'E319000000005' })
    idEnviando = await sembrar('ENVIANDO', { eNCF: 'E319000000006' })
    idDraft = await sembrar('DRAFT')
    idNota = await sembrar('INTERNO', { esFiscal: false, folioInterno: 'NV-900001' })
    // Nota de venta guardada como BORRADOR: esFiscal=false + DRAFT y todavía SIN
    // folio NV- (el backend lo asigna al finalizarla). Es "borrador", no "nota".
    idNotaBorrador = await sembrar('DRAFT', { esFiscal: false })
    idAceptadoDeCotizacion = await sembrar('ACEPTADO', { eNCF: 'E319000000007', cotizacionId: cot.id })
    idRechazadoDeCotizacion = await sembrar('RECHAZADO', { eNCF: 'E319000000008', cotizacionId: cot.id })
  })

  const listar = async (params: Record<string, string>) => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/comprobantes')
      .query({ limit: '100', ...params })
      .set(auth())
      .expect(200)
    return res.body as { data: { id: string; estado: string }[]; total: number }
  }

  it('estado con UN valor filtra ese estado (compatibilidad hacia atrás)', async () => {
    const { data } = await listar({ estado: 'ACEPTADO' })
    expect(data.map((c) => c.id).sort()).toEqual([idAceptado, idAceptadoDeCotizacion].sort())
    expect(data.every((c) => c.estado === 'ACEPTADO')).toBe(true)
  })

  it('estado con VARIOS valores resuelve "En proceso" en el servidor', async () => {
    const { data, total } = await listar({ estado: 'PENDIENTE,EN_COLA,ENVIANDO' })
    expect(data.map((c) => c.id).sort()).toEqual([idPendiente, idEnCola, idEnviando].sort())
    // El total viene del COUNT del servidor: la paginación es correcta.
    expect(total).toBe(3)
  })

  it('ERROR es filtrable por sí solo (antes no existía la opción)', async () => {
    const { data } = await listar({ estado: 'ERROR' })
    expect(data.map((c) => c.id)).toEqual([idError])
  })

  it('el filtro de estado devuelve el total del SERVIDOR, no el de la página', async () => {
    const { data, total } = await listar({ estado: 'PENDIENTE,EN_COLA,ENVIANDO', limit: '2' })
    expect(data).toHaveLength(2) // página recortada…
    expect(total).toBe(3) // …pero el total es el real
  })

  it('origen=cotizacion filtra por procedencia, sin mirar el estado', async () => {
    const { data } = await listar({ origen: 'cotizacion' })
    expect(data.map((c) => c.id).sort()).toEqual(
      [idAceptadoDeCotizacion, idRechazadoDeCotizacion].sort(),
    )
  })

  it('una factura de cotización RECHAZADA conserva su estado RECHAZADO', async () => {
    const { data } = await listar({ origen: 'cotizacion', estado: 'RECHAZADO' })
    expect(data.map((c) => c.id)).toEqual([idRechazadoDeCotizacion])
    expect(data[0]?.estado).toBe('RECHAZADO')
  })

  // DRAFT manda sobre esFiscal: un borrador es un borrador aunque sea de una
  // nota de venta. Con la precedencia invertida, el borrador de nota se colaba
  // en clase=nota y desaparecía de clase=borrador.
  it('clase=borrador incluye el DRAFT fiscal Y el borrador de nota de venta', async () => {
    const { data } = await listar({ clase: 'borrador' })
    expect(data.map((c) => c.id).sort()).toEqual([idDraft, idNotaBorrador].sort())
  })

  it('clase=nota trae sólo notas YA creadas, no el borrador de nota', async () => {
    const { data } = await listar({ clase: 'nota' })
    expect(data.map((c) => c.id)).toEqual([idNota])
  })

  it('las tres clases son mutuamente excluyentes y cubren todo', async () => {
    const [fiscal, borrador, nota, todos] = await Promise.all([
      listar({ clase: 'fiscal' }),
      listar({ clase: 'borrador' }),
      listar({ clase: 'nota' }),
      listar({}),
    ])
    const ids = [...fiscal.data, ...borrador.data, ...nota.data].map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length) // sin solapes
    expect(ids.sort()).toEqual(todos.data.map((c) => c.id).sort()) // sin huecos
  })

  it('clase=fiscal excluye borradores y notas de venta', async () => {
    const { data } = await listar({ clase: 'fiscal' })
    const ids = data.map((c) => c.id)
    expect(ids).not.toContain(idDraft)
    expect(ids).not.toContain(idNota)
    expect(ids).toContain(idAceptado)
  })

  it('clase y estado se combinan en AND (ninguno pisa al otro)', async () => {
    const { data } = await listar({ clase: 'fiscal', estado: 'RECHAZADO' })
    expect(data.map((c) => c.id).sort()).toEqual([idRechazado, idRechazadoDeCotizacion].sort())
    // Combinación contradictoria → conjunto vacío, no un resultado "colado".
    const contradictoria = await listar({ clase: 'borrador', estado: 'ACEPTADO' })
    expect(contradictoria.data).toHaveLength(0)
  })

  it('un estado inválido se rechaza con 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/comprobantes')
      .query({ estado: 'COTIZACION_CONVERTIDA' })
      .set(auth())
      .expect(400)
  })
})
