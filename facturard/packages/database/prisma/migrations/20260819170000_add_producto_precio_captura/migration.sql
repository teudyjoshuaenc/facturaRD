-- Monto tecleado por el usuario al capturar con ITBIS incluido (aditivo).
-- Sólo para re-mostrar el precio; precioUnitario sigue siendo la base fiscal.
ALTER TABLE "productos" ADD COLUMN "precioCaptura" DECIMAL(18,2);
