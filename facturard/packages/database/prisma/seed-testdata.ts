/**
 * Datos de prueba para el tenant DMAIA SRL local (el que abre el frontend con
 * ?location_id=loc_dev_dmaia). NO fiscal, NO producción — solo para ver la UI en
 * todos los estados y flujos.
 *
 * Es REPETIBLE: borra lo que él mismo sembró (marcado con `datos.__seed`) y lo
 * vuelve a crear. No toca comprobantes reales ni el contacto de Wilmer.
 *
 *   pnpm --filter @facturard/database exec ts-node --project tsconfig.seed.json prisma/seed-testdata.ts
 */
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// Tenant DMAIA SRL con GhlLocation loc_dev_dmaia (lo resuelve el frontend).
const RNC_TENANT = '132883225'
const SEED = 'testdata-ui' // marca para poder re-sembrar sin duplicar

// e-NCF de prueba en un rango alto (E319…) para no chocar con la secuencia real.
const encf = (n: number) => `E319${String(n).padStart(9, '0')}`

const NOMBRE_LARGO = ' Dmaia 360 Instalación Incluye: 1) CRM, 2) Página Web, 3) Posicionamiento SEO, 4) Redes Sociales' // 96 chars

type ItemSeed = { nombreItem: string; cantidad: number; precioUnitarioItem: number; indicadorFacturacion?: string }

function buildDatos(opts: {
  tipoECF: string
  items: ItemSeed[]
  rncComprador?: string
  razonSocialComprador: string
  eNCF?: string
  esFiscal?: boolean
}): Prisma.InputJsonValue {
  return {
    __seed: SEED,
    emitir: opts.esFiscal !== false,
    tipoECF: opts.tipoECF,
    esFiscal: opts.esFiscal ?? true,
    tipoPago: 1,
    // Obligatorio para E31/E32/E33/E34/E44/E45/E46. Sin esto el clonado (Reintentar)
    // no tenía qué precargar en "Tipo de ingreso". '01' = Ingresos por operaciones.
    tipoIngresos: '01',
    terminoPago: 'Contado',
    fechaEmision: '22-07-2026',
    ...(opts.eNCF ? { eNCF: opts.eNCF } : {}),
    ...(opts.rncComprador ? { rncComprador: opts.rncComprador } : {}),
    razonSocialComprador: opts.razonSocialComprador,
    items: opts.items.map((it, i) => ({
      numeroLinea: i + 1,
      nombreItem: it.nombreItem,
      cantidad: it.cantidad,
      precioUnitarioItem: it.precioUnitarioItem,
      indicadorFacturacion: it.indicadorFacturacion ?? 'I1',
      indicadorBienoServicio: 2,
    })),
  }
}

const totalConItbis = (items: ItemSeed[]) =>
  items.reduce((s, it) => {
    const base = it.cantidad * it.precioUnitarioItem
    const itbis = (it.indicadorFacturacion ?? 'I1') === 'I1' ? base * 0.18 : 0
    return s + base + itbis
  }, 0)

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { rnc: RNC_TENANT } })
  const tenantId = tenant.id
  console.log(`Tenant destino: ${tenant.razonSocial} (${tenantId})`)

  // ── Limpieza de una corrida anterior (envios primero por la FK) ─────────────
  const previos = await prisma.comprobante.findMany({
    where: { tenantId, datos: { path: ['__seed'], equals: SEED } },
    select: { id: true },
  })
  if (previos.length) {
    const ids = previos.map((c) => c.id)
    await prisma.envioComprobante.deleteMany({ where: { comprobanteId: { in: ids } } })
    await prisma.comprobante.deleteMany({ where: { id: { in: ids } } })
    console.log(`Limpiados ${ids.length} comprobantes de una corrida anterior`)
  }

  // ── Contactos (upsert por RNC) ──────────────────────────────────────────────
  const cliente = await prisma.contacto.upsert({
    where: { tenantId_rnc: { tenantId, rnc: '131880681' } },
    update: { email: 'cliente@correo.do', ghlContactId: 'ghl-cliente-1', activo: true },
    create: {
      tenantId, tipo: 'CLIENTE', rnc: '131880681', razonSocial: 'Comercial El Cliente SRL',
      email: 'cliente@correo.do', ghlContactId: 'ghl-cliente-1', origen: 'GHL', rncValidado: true,
    },
  })
  const contador = await prisma.contacto.upsert({
    where: { tenantId_rnc: { tenantId, rnc: '130123456' } },
    update: { email: 'contador@firma.do', ghlContactId: 'ghl-contador-1', activo: true },
    create: {
      tenantId, tipo: 'CLIENTE', rnc: '130123456', razonSocial: 'Contadores Fiscales SRL',
      email: 'contador@firma.do', ghlContactId: 'ghl-contador-1', origen: 'GHL', rncValidado: true,
    },
  })
  // Sin sincronizar (ghlContactId null) → para probar la cascada del ancla.
  await prisma.contacto.upsert({
    where: { tenantId_rnc: { tenantId, rnc: '101234567' } },
    update: { email: 'ventas@economica.do', ghlContactId: null, activo: true },
    create: {
      tenantId, tipo: 'CLIENTE', rnc: '101234567', razonSocial: 'Ferretería La Económica',
      email: 'ventas@economica.do', origen: 'MANUAL', rncValidado: true,
    },
  })
  console.log('✓ 3 contactos (2 sincronizados con GHL, 1 sin sincronizar)')

  // ── Productos (upsert por código) ───────────────────────────────────────────
  const productos: { codigo: string; nombre: string; precio: number; itbis?: string }[] = [
    { codigo: 'SVC-MKT', nombre: 'Consultoría de Marketing Digital', precio: 15000 },
    { codigo: 'SVC-LOGO', nombre: 'Diseño de Logo', precio: 8000 },
    { codigo: 'SVC-HOST', nombre: 'Hosting Anual', precio: 5000 },
    { codigo: 'PRD-EXE', nombre: 'Libro Educativo (Exento)', precio: 2000, itbis: 'EXENTO' },
    // Nombre >80: al agregarlo a una factura el backend lo rechaza (FIX 7).
    { codigo: 'SVC-LARGO', nombre: NOMBRE_LARGO.trim(), precio: 86600 },
  ]
  for (const p of productos) {
    await prisma.producto.upsert({
      where: { tenantId_codigo: { tenantId, codigo: p.codigo } },
      update: { nombre: p.nombre, precioUnitario: p.precio, tratamientoITBIS: p.itbis ?? 'I1', activo: true },
      create: {
        tenantId, tipo: 'SERVICIO', codigo: p.codigo, nombre: p.nombre,
        precioUnitario: p.precio, tratamientoITBIS: p.itbis ?? 'I1',
      },
    })
  }
  console.log(`✓ ${productos.length} productos (incluye uno con nombre >80 para probar el FIX 7)`)

  // ── Comprobantes: uno por estado para ver todos los botones ────────────────
  const dia = (d: number) => new Date(Date.now() - d * 86_400_000)

  const filas: Prisma.ComprobanteCreateManyInput[] = [
    // ACEPTADO → botón "Reenviar" (correo al cliente)
    {
      tenantId, eNCF: encf(1), tipoECF: 'E31', estado: 'ACEPTADO', esFiscal: true,
      montoTotal: totalConItbis([{ nombreItem: 'Consultoría de Marketing Digital', cantidad: 1, precioUnitarioItem: 15000 }]),
      rnc: cliente.rnc!, razonSocial: cliente.razonSocial, contactoId: cliente.id,
      trackId: 'TRK-TEST-0001', mensajeDGII: 'Aceptado', createdAt: dia(2),
      datos: buildDatos({ tipoECF: 'E31', eNCF: encf(1), rncComprador: cliente.rnc!, razonSocialComprador: cliente.razonSocial, items: [{ nombreItem: 'Consultoría de Marketing Digital', cantidad: 1, precioUnitarioItem: 15000 }] }),
    },
    // ACEPTADO_CONDICIONAL → también "Reenviar", badge con observación
    {
      tenantId, eNCF: encf(2), tipoECF: 'E31', estado: 'ACEPTADO_CONDICIONAL', esFiscal: true,
      montoTotal: totalConItbis([{ nombreItem: 'Diseño de Logo', cantidad: 1, precioUnitarioItem: 8000 }]),
      rnc: contador.rnc!, razonSocial: contador.razonSocial, contactoId: contador.id,
      trackId: 'TRK-TEST-0002', mensajeDGII: 'Aceptado con observaciones', createdAt: dia(3),
      datos: buildDatos({ tipoECF: 'E31', eNCF: encf(2), rncComprador: contador.rnc!, razonSocialComprador: contador.razonSocial, items: [{ nombreItem: 'Diseño de Logo', cantidad: 1, precioUnitarioItem: 8000 }] }),
    },
    // PENDIENTE → en proceso (sin acción de reintento)
    {
      tenantId, eNCF: encf(3), tipoECF: 'E31', estado: 'PENDIENTE', esFiscal: true,
      montoTotal: totalConItbis([{ nombreItem: 'Hosting Anual', cantidad: 1, precioUnitarioItem: 5000 }]),
      rnc: cliente.rnc!, razonSocial: cliente.razonSocial, contactoId: cliente.id, createdAt: dia(0),
      datos: buildDatos({ tipoECF: 'E31', eNCF: encf(3), rncComprador: cliente.rnc!, razonSocialComprador: cliente.razonSocial, items: [{ nombreItem: 'Hosting Anual', cantidad: 1, precioUnitarioItem: 5000 }] }),
    },
    // RECHAZADO → botón "Reintentar" (ícono RotateCw)
    {
      tenantId, eNCF: encf(4), tipoECF: 'E31', estado: 'RECHAZADO', esFiscal: true,
      montoTotal: totalConItbis([{ nombreItem: 'Consultoría de Marketing Digital', cantidad: 2, precioUnitarioItem: 15000 }]),
      rnc: contador.rnc!, razonSocial: contador.razonSocial, contactoId: contador.id,
      mensajeDGII: 'Rechazado [131] La firma digital del documento no es válida.', createdAt: dia(1),
      datos: buildDatos({ tipoECF: 'E31', eNCF: encf(4), rncComprador: contador.rnc!, razonSocialComprador: contador.razonSocial, items: [{ nombreItem: 'Consultoría de Marketing Digital', cantidad: 2, precioUnitarioItem: 15000 }] }),
    },
    // ERROR → botón "Reintentar" — reproduce el fallo real de prod (NombreItem 96).
    // Al reintentar (clonar) el formulario trae el nombre largo para corregirlo.
    {
      tenantId, eNCF: encf(5), tipoECF: 'E31', estado: 'ERROR', esFiscal: true,
      montoTotal: totalConItbis([{ nombreItem: NOMBRE_LARGO, cantidad: 1, precioUnitarioItem: 86600 }]),
      rnc: cliente.rnc!, razonSocial: cliente.razonSocial, contactoId: cliente.id,
      mensajeDGII: "El XML generado no es válido según el XSD e-CF 31:\nElement 'NombreItem': [facet 'maxLength'] The value has a length of '96'; this exceeds the allowed maximum length of '80'.",
      createdAt: dia(1),
      datos: buildDatos({ tipoECF: 'E31', eNCF: encf(5), rncComprador: cliente.rnc!, razonSocialComprador: cliente.razonSocial, items: [{ nombreItem: NOMBRE_LARGO, cantidad: 1, precioUnitarioItem: 86600 }] }),
    },
    // DRAFT fiscal → botones "Editar" + "Emitir"
    {
      tenantId, eNCF: null, tipoECF: 'E31', estado: 'DRAFT', esFiscal: true,
      montoTotal: totalConItbis([{ nombreItem: 'Hosting Anual', cantidad: 1, precioUnitarioItem: 5000 }]),
      rnc: cliente.rnc!, razonSocial: cliente.razonSocial, contactoId: cliente.id, createdAt: dia(0),
      datos: buildDatos({ tipoECF: 'E31', rncComprador: cliente.rnc!, razonSocialComprador: cliente.razonSocial, items: [{ nombreItem: 'Hosting Anual', cantidad: 1, precioUnitarioItem: 5000 }] }),
    },
  ]

  await prisma.comprobante.createMany({ data: filas })
  console.log(`✓ ${filas.length} comprobantes: ACEPTADO, ACEPTADO_CONDICIONAL, PENDIENTE, RECHAZADO, ERROR, DRAFT`)
  console.log('   → RECHAZADO y ERROR muestran el botón "Reintentar" (RotateCw)')
  console.log('\nSeed de datos de prueba completado.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
