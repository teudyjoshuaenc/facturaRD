-- CreateTable
CREATE TABLE "compras_recibidas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactoId" TEXT,
    "tipo" TEXT NOT NULL,
    "ncf" TEXT,
    "rncProveedor" TEXT,
    "razonSocialProveedor" TEXT,
    "fechaComprobante" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL,
    "itbis" DECIMAL(18,2) NOT NULL,
    "itbisRetenido" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "estadoAprobacion" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_recibidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compras_recibidas_tenantId_fechaComprobante_idx" ON "compras_recibidas"("tenantId", "fechaComprobante");

-- AddForeignKey
ALTER TABLE "compras_recibidas" ADD CONSTRAINT "compras_recibidas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
