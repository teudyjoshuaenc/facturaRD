import { PrismaClient, UserRole, TipoECF } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const TIPO_PREFIJO: Record<TipoECF, string> = {
  E31: '31', E32: '32', E33: '33', E34: '34',
  E41: '41', E43: '43', E44: '44',
  E45: '45', E46: '46', E47: '47',
}

async function main(): Promise<void> {
  console.log('Seeding database...')

  const tenant = await prisma.tenant.upsert({
    where: { rnc: '000000001' },
    update: { planActivo: true },
    create: {
      rnc: '000000001',
      razonSocial: 'DMAIA AI Solutions',
      nombreComercial: 'DMAIA',
      plan: 'PRO',
      planActivo: true,
      trialEndsAt: null,
    },
  })
  console.log(`✓ Tenant ${tenant.razonSocial} (${tenant.id})`)

  const existing = await prisma.user.findFirst({
    where: { email: 'admin@dmaia.do', tenantId: tenant.id },
  })

  if (!existing) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'admin@dmaia.do',
        passwordHash: await bcrypt.hash('Admin1234!', 12),
        nombre: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
      },
    })
    console.log('✓ SUPER_ADMIN admin@dmaia.do creado')
  } else {
    console.log('✓ SUPER_ADMIN ya existe — omitido')
  }

  // Initialize sequences for all e-CF types
  const tipos = Object.keys(TIPO_PREFIJO) as TipoECF[]
  for (const tipoECF of tipos) {
    await prisma.secuencia.upsert({
      where: { tenantId_tipoECF: { tenantId: tenant.id, tipoECF } },
      update: {},
      create: {
        tenantId: tenant.id,
        tipoECF,
        prefijo: `E${TIPO_PREFIJO[tipoECF]}`,
        ultimaSecuencia: 0,
        activo: true,
      },
    })
  }
  console.log(`✓ Secuencias inicializadas para ${tipos.length} tipos de e-CF`)

  console.log('Seed completado.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
