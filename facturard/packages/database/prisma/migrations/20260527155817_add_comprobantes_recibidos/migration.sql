-- CreateTable
CREATE TABLE "comprobantes_recibidos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rncEmisor" TEXT NOT NULL,
    "eNCF" TEXT NOT NULL,
    "tipoECF" TEXT NOT NULL,
    "xmlFirmado" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'RECIBIDO',
    "aprobacion" TEXT,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_recibidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comprobantes_recibidos_tenantId_rncEmisor_idx" ON "comprobantes_recibidos"("tenantId", "rncEmisor");

-- CreateIndex
CREATE INDEX "comprobantes_recibidos_tenantId_fechaRecepcion_idx" ON "comprobantes_recibidos"("tenantId", "fechaRecepcion");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_recibidos_tenantId_eNCF_rncEmisor_key" ON "comprobantes_recibidos"("tenantId", "eNCF", "rncEmisor");

-- AddForeignKey
ALTER TABLE "comprobantes_recibidos" ADD CONSTRAINT "comprobantes_recibidos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
