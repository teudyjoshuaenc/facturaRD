'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  RefreshCw,
  FolderOpen,
  Calendar,
  Clock,
  Send,
  Eye,
  Download,
  AlertCircle,
  ChevronRight
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function CumplimientoPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Header row */}
      <div className="flex flex-col gap-1 border-b border-neutral-100 pb-5">
        <h2 className="text-h4 font-bold text-text-primary">Cumplimiento fiscal</h2>
        <p className="text-body-sm text-text-secondary">
          Monitoreá y gestioná tus obligaciones con DGII en tiempo real.
        </p>
      </div>

      {/* Acción Requerida Red Banner */}
      <div className="rounded-xl border border-red-200 bg-red-600 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-white">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white flex-shrink-0 mt-0.5">
            <AlertCircle size={22} />
          </div>
          <div className="flex flex-col gap-1 text-left">
            <span className="text-ui-xs font-bold text-white/80 uppercase tracking-wider">Acción Requerida</span>
            <h3 className="text-body-base font-bold">Reporte 607 vence en 5 días · riesgo de multa DGII</h3>
            <span className="text-ui-xs text-white/90">
              No cumplir con los plazos puede generar sanciones del <span className="font-bold">0.25%</span> de los ingresos brutos del período.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button className="h-9 px-4 rounded-lg bg-white text-red-600 font-bold hover:bg-white/95 transition-all text-ui-sm">
            Resolver ahora
          </button>
          <button className="h-9 px-4 rounded-lg border border-white text-white font-bold hover:bg-white/10 transition-all text-ui-sm">
            Ver detalles
          </button>
        </div>
      </div>

      {/* Row 2: Diagnostic & Mini boxes grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start">
        {/* Circular Progress score */}
        <Card className="lg:col-span-3 p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col sm:flex-row items-center gap-6">
          <div className="relative flex items-center justify-center h-28 w-28 flex-shrink-0">
            {/* SVG circular progress indicator */}
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="48" stroke="#f5f5f5" strokeWidth="10" fill="transparent" />
              <circle cx="56" cy="56" r="48" stroke="#3b82f6" strokeWidth="10" fill="transparent"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * (1 - 23 / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-h3 font-bold text-text-primary">23</span>
              <span className="text-[10px] font-bold text-text-secondary uppercase">/ 100</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Riesgo de incumplimiento</span>
              <span className="text-[10px] text-text-secondary font-medium">Actualizado hace 2 min</span>
            </div>
            <h3 className="text-h4 font-bold text-text-primary mt-0.5">Puntaje de cumplimiento DGII</h3>
            <p className="text-ui-xs text-text-secondary mt-1.5 leading-normal">
              Hay obligaciones vencidas o bloqueantes críticos. Calculado sobre 8 indicadores: reportes al día, certificados, NCF disponibles, tiempos de respuesta y validaciones.
            </p>
            {/* Little progress indicators at bottom */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-neutral-100">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold text-text-secondary">
                  <span>NCF DISPONIBLES</span>
                  <span className="text-green-600">85%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '85%' }} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold text-text-secondary">
                  <span>REPORTES</span>
                  <span className="text-red-600">3/5</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right 2x2 grid mini status boxes */}
        <div className="grid grid-cols-2 gap-3.5 w-full h-full lg:col-span-1">
          {/* Box 1 */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1.5 shadow-sm text-left">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Reportes enviados</span>
            <span className="text-h3 font-bold text-text-primary">12</span>
            <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              +2 vs mes anterior
            </span>
          </div>

          {/* Box 2 */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1.5 shadow-sm text-left">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Próximos a vencer</span>
            <span className="text-h3 font-bold text-text-primary">2</span>
            <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              +2 vs mes anterior
            </span>
          </div>

          {/* Box 3 */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1.5 shadow-sm text-left">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Tasa de aceptación</span>
            <span className="text-h3 font-bold text-text-primary">98.4%</span>
            <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Últimos 90 días
            </span>
          </div>

          {/* Box 4 */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1.5 shadow-sm text-left">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Rechazados</span>
            <span className="text-h3 font-bold text-danger-600">1</span>
            <span className="text-[10px] text-danger-600/80 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
              pendiente re-envío
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Obligaciones activas · abril 2026 */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col text-left">
          <h3 className="text-body-base font-bold text-text-primary">Obligaciones activas · abril 2026</h3>
          <p className="text-ui-xs text-text-secondary font-medium mt-0.5">
            Reportes mensuales requeridos por DGII en este período.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 606 */}
          <Card className="p-5 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col justify-between text-left h-[230px]">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                  606
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-neutral-100 text-neutral-600 border border-neutral-200/50 px-1.5 py-0.2 text-[9px] font-bold">
                  ● Archivo aceptado
                </span>
              </div>
              <h4 className="text-body-sm font-bold text-text-primary mt-1">Reporte de Compras</h4>
              <p className="text-ui-xs text-text-secondary leading-normal">
                Detalla los comprobantes recibidos de proveedores.
              </p>
              {/* Preparation bar */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-[10px] font-semibold text-text-secondary">
                  <span>PREPARACIÓN DE DATOS</span>
                  <span>284 / 310</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: '91%' }} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-2">
              <div className="flex items-center gap-3 text-[10px] text-text-secondary font-semibold">
                <span className="flex items-center gap-1"><Calendar size={12} /> 2026-05-15</span>
                <span className="flex items-center gap-1 text-brand-600"><Clock size={12} /> 21 días</span>
              </div>
              <Button variant="primary" size="sm" className="h-8 px-3 bg-brand-500 text-white font-semibold text-ui-xs">
                Enviar a DGII
              </Button>
            </div>
          </Card>

          {/* Card 607 */}
          <Card className="p-5 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col justify-between text-left h-[230px]">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                  607
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 text-[9px] font-bold">
                  ● En proceso
                </span>
              </div>
              <h4 className="text-body-sm font-bold text-text-primary mt-1">Reporte de Ventas</h4>
              <p className="text-ui-xs text-text-secondary leading-normal">
                Detalle de comprobantes fiscales emitidos en el período.
              </p>
              {/* Preparation bar */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-[10px] font-semibold text-text-secondary">
                  <span>PREPARACIÓN DE DATOS</span>
                  <span>438 / 500</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: '87%' }} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-2">
              <div className="flex items-center gap-3 text-[10px] text-text-secondary font-semibold">
                <span className="flex items-center gap-1"><Calendar size={12} /> 2026-05-15</span>
                <span className="flex items-center gap-1 text-orange-600"><Clock size={12} /> 21 días</span>
              </div>
              <Button variant="primary" size="sm" className="h-8 px-4 bg-orange-600 text-white font-semibold text-ui-xs hover:bg-orange-700">
                Revisar
              </Button>
            </div>
          </Card>

          {/* Card 608 */}
          <Card className="p-5 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col justify-between text-left h-[230px]">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                  608
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.2 text-[9px] font-bold">
                  ● Enviado
                </span>
              </div>
              <h4 className="text-body-sm font-bold text-text-primary mt-1">Anulaciones</h4>
              <p className="text-ui-xs text-text-secondary leading-normal">
                Comprobantes anulados o no utilizados en el período.
              </p>
              {/* Preparation bar */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-[10px] font-semibold text-text-secondary">
                  <span>PREPARACIÓN DE DATOS</span>
                  <span>284 / 310</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '91%' }} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-2">
              <div className="flex items-center gap-3 text-[10px] text-text-secondary font-semibold">
                <span className="flex items-center gap-1"><Calendar size={12} /> 2026-05-15</span>
                <span className="flex items-center gap-1 text-green-600"><Clock size={12} /> 21 días</span>
              </div>
              <Button variant="secondary" size="sm" disabled className="h-8 px-3 border border-neutral-200 text-neutral-400 font-semibold text-ui-xs bg-neutral-50/50">
                Enviar a DGII
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Row 4: Timeline and Presentation history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-2">
        {/* Left Card: Timeline (1/3 width) */}
        <Card className="lg:col-span-1 p-5 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-sm font-bold text-text-primary">Línea de tiempo</h3>
              <p className="text-[10px] text-text-secondary font-medium">Próximos vencimientos y eventos del sistema.</p>
            </div>
            <button className="text-[10px] font-bold border border-neutral-200 rounded px-2.5 py-1 text-text-secondary hover:bg-neutral-50 transition-colors shrink-0">
              Próximos 90 días
            </button>
          </div>

          <div className="flex flex-col gap-4 pl-3 relative border-l border-neutral-100 ml-1.5 mt-2">
            {/* Timeline item 1 */}
            <div className="flex flex-col gap-1 relative">
              <div className="absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-4 ring-white" />
              <div className="flex items-center justify-between w-full">
                <span className="text-ui-xs font-bold text-red-600 bg-red-50 border border-red-200/50 px-1.5 py-0.2 rounded">Vencimiento Reporte 607</span>
                <span className="text-[10px] font-bold text-danger-600">5d</span>
              </div>
              <p className="text-ui-xs text-text-secondary mt-0.5">Fecha límite para envío del reporte de ventas · abril 2026</p>
              <span className="text-[10px] text-text-tertiary font-medium">02/05/2026</span>
              <button className="text-[10px] font-bold text-brand-500 hover:text-brand-600 hover:underline text-left mt-1">
                Resolver &rarr;
              </button>
            </div>

            {/* Timeline item 2 */}
            <div className="flex flex-col gap-1 relative pt-2">
              <div className="absolute -left-[18px] top-3.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-4 ring-white" />
              <div className="flex items-center justify-between w-full">
                <span className="text-ui-xs font-bold text-orange-600 bg-orange-50 border border-orange-200/50 px-1.5 py-0.2 rounded">Certificado digital expira</span>
                <span className="text-[10px] font-bold text-orange-600">12d</span>
              </div>
              <p className="text-ui-xs text-text-secondary mt-0.5">Fecha límite para renovación de firma de NCF</p>
              <span className="text-[10px] text-text-tertiary font-medium">02/05/2026</span>
            </div>

            {/* Timeline item 3 */}
            <div className="flex flex-col gap-1 relative pt-2">
              <div className="absolute -left-[18px] top-3.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
              <div className="flex items-center justify-between w-full">
                <span className="text-ui-xs font-bold text-blue-600 bg-blue-50 border border-blue-200/50 px-1.5 py-0.2 rounded">Vencimiento Reporte 606</span>
                <span className="text-[10px] font-bold text-blue-600">21d</span>
              </div>
              <p className="text-ui-xs text-text-secondary mt-0.5">Fecha límite para envío de reporte de compras</p>
              <span className="text-[10px] text-text-tertiary font-medium">02/05/2026</span>
            </div>

            {/* Timeline item 4 */}
            <div className="flex flex-col gap-1 relative pt-2">
              <div className="absolute -left-[18px] top-3.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
              <div className="flex items-center justify-between w-full">
                <span className="text-ui-xs font-bold text-blue-600 bg-blue-50 border border-blue-200/50 px-1.5 py-0.2 rounded">Declaración IT-1 · mayo</span>
                <span className="text-[10px] font-bold text-blue-600">26d</span>
              </div>
              <p className="text-ui-xs text-text-secondary mt-0.5">ITBIS mensual · pago y presentación</p>
              <span className="text-[10px] text-text-tertiary font-medium">02/05/2026</span>
            </div>

            {/* Timeline item 5 */}
            <div className="flex flex-col gap-1 relative pt-2">
              <div className="absolute -left-[18px] top-3.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-4 ring-white" />
              <div className="flex items-center justify-between w-full">
                <span className="text-ui-xs font-bold text-green-600 bg-green-50 border border-green-200/50 px-1.5 py-0.2 rounded">Cierre fiscal trimestral</span>
                <span className="text-[10px] font-bold text-green-600">65d</span>
              </div>
              <p className="text-ui-xs text-text-secondary mt-0.5">Consolidación trimestre abril-junio 2026</p>
              <span className="text-[10px] text-text-tertiary font-medium">02/05/2026</span>
            </div>
          </div>
        </Card>

        {/* Right Card: Presentation history (2/3 width) */}
        <Card className="lg:col-span-2 p-5 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-sm font-bold text-text-primary">Historial de presentaciones</h3>
              <p className="text-[10px] text-text-secondary font-medium">Últimos envíos a DGII - con acuse de recibo.</p>
            </div>
            <button className="text-[10px] font-bold border border-neutral-200 rounded px-2.5 py-1 text-text-secondary hover:bg-neutral-50 transition-colors flex items-center gap-1.5 shrink-0">
              <Download size={12} /> Exportar
            </button>
          </div>

          <div className="overflow-x-auto border border-neutral-100 rounded-lg">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-[11px] font-bold text-text-secondary">
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Período</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Fecha envío</th>
                  <th className="px-4 py-2.5">Registros</th>
                  <th className="px-4 py-2.5 text-right pr-6">Acción</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { tipo: '606', periodo: 'Abril 2026', generado: '2026-04-14', registros: 4 },
                  { tipo: '607', periodo: 'Marzo 2026', generado: '2026-04-14', registros: 4 },
                  { tipo: '608', periodo: 'Marzo 2026', generado: '2026-04-14', registros: 4 },
                  { tipo: '606', periodo: 'Marzo 2026', generado: '2026-04-14', registros: 4 },
                  { tipo: '608', periodo: 'Marzo 2026', generado: '2026-04-14', registros: 4 },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                        {row.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-primary font-semibold text-body-sm">{row.periodo}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50/70 px-2 py-0.5 text-ui-xs font-semibold text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Aceptado
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-body-sm">{row.generado}</td>
                    <td className="px-4 py-3 text-text-primary font-bold text-body-sm">{row.registros}</td>
                    <td className="px-4 py-3 text-right pr-6">
                      <button className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none h-8 w-8 hover:bg-neutral-100/50 rounded-lg flex items-center justify-center ml-auto">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-[10px] text-text-tertiary font-medium">6 resultados</span>
        </Card>
      </div>
    </div>
  )
}
