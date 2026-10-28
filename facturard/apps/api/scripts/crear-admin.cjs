/**
 * Crea el PRIMER usuario del panel de administración (los demás se crean desde el panel).
 *
 *   Local:    ADMIN_EMAIL=tu@dmaia.io ADMIN_NOMBRE="Tu Nombre" pnpm --filter @facturard/api admin:crear
 *   En el VPS: docker compose -f deploy/docker-compose.prod.yml exec \
 *                -e ADMIN_EMAIL=tu@dmaia.io -e ADMIN_NOMBRE="Tu Nombre" api node scripts/crear-admin.cjs
 *
 * JavaScript plano a propósito: la imagen de producción no trae ts-node.
 * Pide la contraseña sin mostrarla (o la toma de ADMIN_PASSWORD). Al entrar al panel,
 * la persona configura su Google Authenticator (obligatorio).
 */
const bcrypt = require('bcrypt')
const { createInterface } = require('readline')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const CLAVE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/

function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl.question(texto, (v) => {
      rl.close()
      process.stdout.write('\n')
      resolve(v)
    })
    rl._writeToOutput = (s) => {
      if (s.startsWith(texto)) rl.output.write(texto)
    }
  })
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const nombre = (process.env.ADMIN_NOMBRE || '').trim()
  if (!email.includes('@') || !nombre) throw new Error('Define ADMIN_EMAIL y ADMIN_NOMBRE')
  if (await prisma.adminUsuario.findUnique({ where: { email } })) throw new Error(`Ya existe ${email}`)
  const password = process.env.ADMIN_PASSWORD || (await preguntarOculto('Contraseña (12+, mayúscula, minúscula, número y símbolo): '))
  if (!CLAVE.test(password)) throw new Error('La contraseña no cumple los requisitos')
  await prisma.adminUsuario.create({
    data: { email, nombre, rol: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) },
  })
  console.log(`✓ Administrador ${email} creado. Entra al panel y configura tu Google Authenticator.`)
}

main()
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
