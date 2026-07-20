-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "MovimientoCategoria" AS ENUM ('NOMINA', 'ALQUILER', 'SERVICIOS', 'PRESTAMO', 'APORTE_CAPITAL', 'IMPUESTOS', 'OTROS');

-- CreateEnum
CREATE TYPE "PagoTipo" AS ENUM ('COBRO', 'PAGO');

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "categoria" "MovimientoCategoria" NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "metodoPago" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "PagoTipo" NOT NULL,
    "comprobanteId" TEXT,
    "compraId" TEXT,
    "monto" DECIMAL(18,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodoPago" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_inicial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capital_inicial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_financieros_tenantId_fecha_idx" ON "movimientos_financieros"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "pagos_tenantId_fecha_idx" ON "pagos"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "pagos_comprobanteId_idx" ON "pagos"("comprobanteId");

-- CreateIndex
CREATE INDEX "pagos_compraId_idx" ON "pagos"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "capital_inicial_tenantId_key" ON "capital_inicial"("tenantId");

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "comprobantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras_recibidas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_inicial" ADD CONSTRAINT "capital_inicial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
