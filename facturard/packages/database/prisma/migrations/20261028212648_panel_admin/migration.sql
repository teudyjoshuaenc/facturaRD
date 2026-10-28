-- CreateEnum
CREATE TYPE "RolAdmin" AS ENUM ('ADMIN', 'SOPORTE');

-- CreateTable
CREATE TABLE "admin_usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolAdmin" NOT NULL DEFAULT 'SOPORTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "totpSecretCifrado" TEXT,
    "totpActivo" BOOLEAN NOT NULL DEFAULT false,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimoAcceso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_auditoria" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "accion" TEXT NOT NULL,
    "tenantId" TEXT,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_usuarios_email_key" ON "admin_usuarios"("email");

-- CreateIndex
CREATE INDEX "admin_auditoria_tenantId_createdAt_idx" ON "admin_auditoria"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_auditoria_adminId_createdAt_idx" ON "admin_auditoria"("adminId", "createdAt");

-- AddForeignKey
ALTER TABLE "admin_auditoria" ADD CONSTRAINT "admin_auditoria_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
