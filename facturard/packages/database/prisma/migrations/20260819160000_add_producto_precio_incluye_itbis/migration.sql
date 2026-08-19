-- Modo de captura del precio (aditivo). NO cambia ningún monto guardado:
-- precioUnitario sigue siendo la base sin ITBIS.
ALTER TABLE "productos" ADD COLUMN "precioIncluyeItbis" BOOLEAN NOT NULL DEFAULT false;
