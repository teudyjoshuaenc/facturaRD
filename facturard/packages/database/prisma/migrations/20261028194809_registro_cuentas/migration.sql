-- CreateTable
CREATE TABLE "cuentas_registro" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "tokenVerificacionHash" TEXT,
    "tokenVerificacionExpira" TIMESTAMP(3),
    "totpSecretCifrado" TEXT,
    "totpActivo" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "completadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_registro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfiles_fiscales" (
    "tenantId" TEXT NOT NULL,
    "tipoRegistro" TEXT NOT NULL,
    "tiposComprobante" "TipoECF"[],
    "actividadEconomica" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfiles_fiscales_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "representantes" (
    "tenantId" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "pasaporte" TEXT,
    "nombreCompleto" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "celular" TEXT,
    "email" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "representantes_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "credenciales_ofv" (
    "tenantId" TEXT NOT NULL,
    "usuarioCifrado" TEXT NOT NULL,
    "claveCifrada" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credenciales_ofv_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_registro_email_key" ON "cuentas_registro"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_registro_tokenVerificacionHash_key" ON "cuentas_registro"("tokenVerificacionHash");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_registro_tenantId_key" ON "cuentas_registro"("tenantId");

-- AddForeignKey
ALTER TABLE "cuentas_registro" ADD CONSTRAINT "cuentas_registro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfiles_fiscales" ADD CONSTRAINT "perfiles_fiscales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representantes" ADD CONSTRAINT "representantes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credenciales_ofv" ADD CONSTRAINT "credenciales_ofv_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
