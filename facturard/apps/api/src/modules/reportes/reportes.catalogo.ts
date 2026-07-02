// Catálogos oficiales DGII para los reportes 606/607/608.
//  - 606 actualizado feb-2026
//  - 607 actualizado dic-2025
//  - 608 catálogo de anulación verificado contra la Comunidad de Ayuda DGII

/** 606 · Campo 3 — Tipo de Bienes y Servicios Comprados (2 dígitos). */
export const TIPO_BIENES_606: Record<string, string> = {
  '01': 'Gastos de personal',
  '02': 'Gastos por trabajos, suministros y servicios',
  '03': 'Arrendamientos',
  '04': 'Gastos de activos fijos',
  '05': 'Gastos de representación',
  '06': 'Otras deducciones admitidas',
  '07': 'Gastos financieros',
  '08': 'Gastos extraordinarios',
  '09': 'Compras y gastos que forman parte del costo de venta',
  '10': 'Adquisiciones de activos',
  '11': 'Gastos de seguros',
}

/** 606 · Campo 23 — Forma de Pago (1 dígito). */
export const FORMA_PAGO_606: Record<string, string> = {
  '1': 'Efectivo',
  '2': 'Cheque / Transferencia / Depósito',
  '3': 'Tarjeta de crédito / débito',
  '4': 'Compra a crédito',
  '5': 'Permuta',
  '6': 'Notas de crédito',
  '7': 'Mixto',
}

/** 607 · Campo 5 — Tipo de Ingreso (1 dígito). */
export const TIPO_INGRESO_607: Record<string, string> = {
  '1': 'Ingresos por operaciones (no financieros)',
  '2': 'Ingresos financieros',
  '3': 'Ingresos extraordinarios',
  '4': 'Ingresos por arrendamientos',
  '5': 'Ingresos por venta de activo depreciable',
  '6': 'Otros ingresos',
}

/** 608 · Campo 3 — Tipo de Anulación (1-10). */
export const TIPO_ANULACION_608: Record<string, string> = {
  '1': 'Deterioro de factura pre-impresa',
  '2': 'Errores de impresión (factura pre-impresa)',
  '3': 'Impresión defectuosa',
  '4': 'Corrección de la información',
  '5': 'Cambio de productos',
  '6': 'Devolución de productos',
  '7': 'Omisión de productos',
  '8': 'Errores en secuencia de NCF',
  '9': 'Por cese de operaciones',
  '10': 'Pérdida o hurto de talonarios',
}

// Defaults cuando el dato aún no se captura por comprobante/compra.
export const DEFAULT_TIPO_BIENES_606 = '09'
export const DEFAULT_FORMA_PAGO_606 = '1'
export const DEFAULT_TIPO_INGRESO_607 = '1'

// Anulación de un e-CF (vía nota de crédito): el motivo realista para e-CF es
// "Corrección de la información". Los motivos 4,5,6,7 aplican a e-CF.
export const CODIGO_ANULACION_ECF = '4'

// Límites de registros por formato (validación de tamaño de archivo).
export const LIMITE_REGISTROS: Record<'606' | '607' | '608', number> = {
  '606': 10_000,
  '607': 65_000,
  '608': 999,
}

// Umbral RD$ por debajo del cual las Facturas de Consumo (E32) NO van al detalle
// del 607 (se reportan como resumen agregado en la OFV).
export const UMBRAL_CONSUMO_607 = 250_000
