-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioUnitario" DECIMAL(18,2) NOT NULL,
    "tratamientoITBIS" TEXT NOT NULL DEFAULT 'I1',
    "unidadMedida" TEXT,
    "codigo" TEXT,
    "categoria" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "productos_tenantId_activo_idx" ON "productos"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_tenantId_codigo_key" ON "productos"("tenantId", "codigo");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
