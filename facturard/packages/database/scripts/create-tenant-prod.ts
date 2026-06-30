import { PrismaClient } from '../src/index'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { rnc: '132883225' },
    update: {},
    create: {
      rnc: '132883225',
      razonSocial: 'DMAIA SRL',
      nombreComercial: 'DMAIA',
      plan: 'PRO',
      estado: 'ACTIVO',
      direccion: 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
      planActivo: true,
    },
  })
  console.log('Tenant creado:', tenant.rnc, tenant.razonSocial)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
