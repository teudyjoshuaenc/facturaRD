import { LineaDetalle, ItemCalculado, Totales, ITBIS_TASA, INDICADOR_FACTURACION } from './types';

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function itbisRate(indicador: number): number {
  if (indicador === INDICADOR_FACTURACION.GRAVADO_I1) return ITBIS_TASA.TASA1;
  if (indicador === INDICADOR_FACTURACION.GRAVADO_I2) return ITBIS_TASA.TASA2;
  return 0;
}

export function calcularItems(items: LineaDetalle[]): ItemCalculado[] {
  return items.map((item, i) => {
    const bruto = r2(item.cantidad * item.precioUnitario);
    const pct = item.descuentoPorcentaje ?? 0;
    const montoDescuento = r2(bruto * (pct / 100));
    const montoItem = r2(bruto - montoDescuento);
    const montoITBIS = r2(montoItem * itbisRate(item.indicadorFacturacion));

    return { ...item, numeroLinea: i + 1, montoDescuento, montoItem, montoITBIS };
  });
}

export function calcularTotales(items: ItemCalculado[]): Totales {
  let gI1 = 0, gI2 = 0, gI3 = 0, exento = 0;
  let itbis1 = 0, itbis2 = 0;

  for (const it of items) {
    switch (it.indicadorFacturacion) {
      case INDICADOR_FACTURACION.GRAVADO_I1: gI1 += it.montoItem; itbis1 += it.montoITBIS; break;
      case INDICADOR_FACTURACION.GRAVADO_I2: gI2 += it.montoItem; itbis2 += it.montoITBIS; break;
      case INDICADOR_FACTURACION.GRAVADO_I3: gI3 += it.montoItem; break;
      case INDICADOR_FACTURACION.EXENTO:     exento += it.montoItem; break;
    }
  }

  const totalITBIS = r2(itbis1 + itbis2);
  const montoGravadoTotal = r2(gI1 + gI2 + gI3);
  const montoTotal = r2(montoGravadoTotal + exento + totalITBIS);

  return {
    montoGravadoTotal,
    montoGravadoI1: r2(gI1),
    montoGravadoI2: r2(gI2),
    montoGravadoI3: r2(gI3),
    montoExento:    r2(exento),
    totalITBIS,
    totalITBIS1:    r2(itbis1),
    totalITBIS2:    r2(itbis2),
    totalITBIS3:    0,
    montoTotal,
  };
}
