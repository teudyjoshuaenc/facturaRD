export { PrismaClient } from '@prisma/client'

// Enums exported as values (needed for class-validator @IsEnum and @ApiQuery enum)
export {
  Plan,
  TenantEstado,
  UserRole,
  TipoECF,
  ComprobanteEstado,
} from '@prisma/client'

// Model types
export type {
  Tenant,
  User,
  Certificado,
  Comprobante,
  ApiKey,
  Webhook,
  AuditLog,
  Secuencia,
} from '@prisma/client'

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}
