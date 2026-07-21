import type { PrismaClient } from '@prisma/client'

// Tablas que se vacían entre archivos de test e2e. El orden no importa (CASCADE),
// pero listamos las hijas de finanzas primero por claridad. Mantener sincronizada
// con el schema al agregar tablas nuevas.
export const E2E_TABLES = [
  'pagos',
  'movimientos_financieros',
  'capital_inicial',
  'audit_logs',
  'comprobantes',
  'comprobantes_recibidos',
  'certificados',
  'secuencias',
  'api_keys',
  'webhooks',
  'ghl_locations',
  'users',
  'tenants',
] as const

/**
 * Deja la base en estado limpio. Se llama una vez en globalSetup y de nuevo al
 * inicio de cada archivo (dentro de createTestApp), para que los specs no se
 * contaminen entre sí en la corrida in-band con base compartida.
 */
export async function resetDatabase(db: Pick<PrismaClient, '$executeRawUnsafe'>): Promise<void> {
  const list = E2E_TABLES.map((t) => `"${t}"`).join(',')
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
}
