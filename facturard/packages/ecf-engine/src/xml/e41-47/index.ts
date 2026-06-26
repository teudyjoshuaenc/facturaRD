import { calcularItems, calcularTotales } from '../calculator';
import {
  buildECF41Xml,
  buildECF43Xml,
  buildECF44Xml,
  buildECF45Xml,
  buildECF46Xml,
  buildECF47Xml,
} from './builder';
import type {
  ECF41Input,
  ECF43Input,
  ECF44Input,
  ECF45Input,
  ECF46Input,
  ECF47Input,
  GenerarECFResult,
} from './types';

export type {
  ECF41Input, ECF43Input, ECF44Input, ECF45Input, ECF46Input, ECF47Input,
  IdDoc41, IdDoc43, IdDoc44, IdDoc45, IdDoc46, IdDoc47,
  CompradorExportacion, BeneficiarioExterior,
  InformacionReferenciaOpcional, GenerarECFResult,
} from './types';

export function generarECF41(input: ECF41Input): GenerarECFResult {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF41Xml(input, items, totales);
  return { xml, totales, items, validation: { valid: true, errors: [] } };
}

export function generarECF43(input: ECF43Input): GenerarECFResult {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF43Xml(input, items, totales);
  return { xml, totales, items, validation: { valid: true, errors: [] } };
}

export function generarECF44(input: ECF44Input): GenerarECFResult {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF44Xml(input, items, totales);
  return { xml, totales, items, validation: { valid: true, errors: [] } };
}

export function generarECF45(input: ECF45Input): GenerarECFResult {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF45Xml(input, items, totales);
  return { xml, totales, items, validation: { valid: true, errors: [] } };
}

export function generarECF46(input: ECF46Input): GenerarECFResult {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF46Xml(input, items, totales);
  return { xml, totales, items, validation: { valid: true, errors: [] } };
}

export function generarECF47(input: ECF47Input): GenerarECFResult {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF47Xml(input, items, totales);
  return { xml, totales, items, validation: { valid: true, errors: [] } };
}
