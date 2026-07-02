-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "contactoId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "fechaVigencia" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL,
    "itbis" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "comprobanteId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizacion_items" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad" DECIMAL(18,3) NOT NULL,
    "precioUnitario" DECIMAL(18,2) NOT NULL,
    "tratamientoITBIS" TEXT NOT NULL,
    "unidadMedida" TEXT,

    CONSTRAINT "cotizacion_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizacion_folios" (
    "tenantId" TEXT NOT NULL,
    "ultimoFolio" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizacion_folios_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "cotizaciones_tenantId_estado_idx" ON "cotizaciones"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_tenantId_folio_key" ON "cotizaciones"("tenantId", "folio");

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizacion_items" ADD CONSTRAINT "cotizacion_items_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
