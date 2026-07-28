-- CreateTable
CREATE TABLE "presupuesto_config" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sector" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'DOP',
    "mesFiscalInicio" INTEGER NOT NULL DEFAULT 0,
    "colchonMeses" INTEGER NOT NULL DEFAULT 3,
    "metaMargenPct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "varPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cxcInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cxpInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ingresos" JSONB NOT NULL DEFAULT '[]',
    "costosFijos" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuesto_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presupuesto_config_tenantId_key" ON "presupuesto_config"("tenantId");

-- AddForeignKey
ALTER TABLE "presupuesto_config" ADD CONSTRAINT "presupuesto_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
