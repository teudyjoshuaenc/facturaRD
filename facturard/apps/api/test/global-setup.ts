import { execSync } from 'child_process'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'

// Prepara la base facturard_test (Postgres efímero, docker-compose.test.yml,
// puerto 5433) antes de los e2e:
//   1. Aplica todas las migraciones con `migrate deploy` (no destructivo).
//   2. Vacía las tablas para partir de un estado limpio en cada corrida.
// DATABASE_URL lo fija el script test:e2e apuntando a la base de pruebas.
export default async function globalSetup(): Promise<void> {
  const schema = join(__dirname, '..', '..', '..', 'packages', 'database', 'prisma', 'schema.prisma')
  execSync(`pnpm exec prisma migrate deploy --schema="${schema}"`, {
    stdio: 'inherit',
    env: process.env,
  })

  const prisma = new PrismaClient()
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "pagos","movimientos_financieros","capital_inicial","audit_logs","comprobantes","comprobantes_recibidos","certificados","secuencias","api_keys","webhooks","ghl_locations","users","tenants" RESTART IDENTITY CASCADE;`,
  )
  await prisma.$disconnect()
}
