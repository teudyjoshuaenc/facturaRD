-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "nombre" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'SALIENTE';
