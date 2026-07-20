import { execSync } from 'child_process'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { resetDatabase } from './helpers/reset-db'

// Prepara la base facturard_test (Postgres efímero, docker-compose.test.yml,
// puerto 5433) antes de los e2e:
//   1. Aplica todas las migraciones con `migrate deploy` (no destructivo).
//   2. Vacía las tablas para partir de un estado limpio.
// Cada archivo vuelve a limpiar al arrancar (createTestApp → resetDatabase), así
// que los specs no se contaminan entre sí en la corrida in-band.
// DATABASE_URL lo fija el script test:e2e apuntando a la base de pruebas.
export default async function globalSetup(): Promise<void> {
  const schema = join(__dirname, '..', '..', '..', 'packages', 'database', 'prisma', 'schema.prisma')
  execSync(`pnpm exec prisma migrate deploy --schema="${schema}"`, {
    stdio: 'inherit',
    env: process.env,
  })

  const prisma = new PrismaClient()
  await resetDatabase(prisma)
  await prisma.$disconnect()
}
