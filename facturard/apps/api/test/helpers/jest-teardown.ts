import { prisma } from '@facturard/database'

// Cierra el pool de conexiones Prisma al terminar CADA archivo de test. Jest aísla
// el registro de módulos por archivo, así que cada spec crea su propio cliente
// Prisma; sin desconectarlo, en la corrida in-band se acumulan ~1 pool por archivo
// y se agotan las conexiones de Postgres → fallos intermitentes ("404" por SELECTs
// que fallan) y handles abiertos. Corre en el scope raíz, después del app.close()
// de cada spec.
afterAll(async () => {
  await prisma.$disconnect()
})
