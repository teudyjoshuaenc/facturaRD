-- CreateTable
CREATE TABLE "contactos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "rnc" TEXT,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "identificadorExtranjero" TEXT,
    "paisExtranjero" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "ghlContactId" TEXT,
    "rncValidado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contactos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactos_tenantId_tipo_activo_idx" ON "contactos"("tenantId", "tipo", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "contactos_tenantId_rnc_key" ON "contactos"("tenantId", "rnc");

-- CreateIndex
CREATE UNIQUE INDEX "contactos_tenantId_ghlContactId_key" ON "contactos"("tenantId", "ghlContactId");

-- AddForeignKey
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
