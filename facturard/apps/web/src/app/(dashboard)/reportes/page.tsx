'use client'

import { useState, useMemo } from 'react'
import type { JSX } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Activity,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  Sparkles,
  FileText,
  Download,
  Send,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

const monthOptions = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
]

const yearOptions = [
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
]
import { useUI } from '@/lib/context/UIContext'

export default function ReportesPage(): JSX.Element {
  const { globalSearch } = useUI()
  const [selectedMonth, setSelectedMonth] = useState('04')
  const [selectedYear, setSelectedYear] = useState('2026')

  const historicalReports = useMemo(() => {
    const list = [
      { tipo: '606', periodo: 'Marzo 2026', generado: '05 abr 2026', estado: 'ENVIADO_DGII' },
      { tipo: '606', periodo: 'Marzo 2026', generado: '05 abr 2026', estado: 'ENVIADO_DGII' },
      { tipo: '606', periodo: 'Marzo 2026', generado: '05 abr 2026', estado: 'ENVIADO_DGII' },
      { tipo: '606', periodo: 'Marzo 2026', generado: '05 abr 2026', estado: 'ENVIADO_DGII' },
      { tipo: '607', periodo: 'Marzo 2026', generado: '05 abr 2026', estado: 'ERROR_DGII' },
    ]
    if (globalSearch.trim()) {
      const term = globalSearch.toLowerCase()
      return list.filter(
        (r) =>
          r.tipo.toLowerCase().includes(term) ||
          r.periodo.toLowerCase().includes(term) ||
          r.estado.toLowerCase().includes(term)
      )
    }
    return list
  }, [globalSearch])

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Page Header inside Content area */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Reportes fiscales</h2>
          <p className="text-body-sm text-text-secondary">
            Tu asistente de cumplimiento DGII. Detecta, corrige y envía sin sobresaltos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month selector */}
          <Select
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={monthOptions}
            className="w-32"
            triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
          />
          {/* Year selector */}
          <Select
            value={selectedYear}
            onChange={setSelectedYear}
            options={yearOptions}
            className="w-24"
            triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
          />
        </div>
      </div>

      {/* Row 1: Estado Fiscal Banner */}
      <Card className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white border border-neutral-200 shadow-sm rounded-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-50 text-danger-600 flex-shrink-0 mt-0.5">
            <AlertCircle size={22} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-ui-xs font-bold text-text-tertiary uppercase tracking-wider">Estado Fiscal</span>
            <h3 className="text-body-base font-bold text-danger-600">No conforme</h3>
            <span className="text-ui-xs text-text-secondary font-medium">Se han detectado documentos con retraso</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 text-left border-l border-neutral-100 pl-6 sm:h-12 justify-center">
          <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Próxima Fecha Límite</span>
          <span className="text-ui-sm font-bold text-text-primary">Reporte 606</span>
          <span className="text-ui-xs text-danger-600 font-semibold">vence en 5 días · 27 abr 2026</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" className="h-9 px-3.5 bg-brand-500 text-white font-semibold">
            <Sparkles size={13} className="mr-1.5" />
            Generar 606
          </Button>
          <Button variant="primary" size="sm" className="h-9 px-3.5 bg-brand-500 text-white font-semibold">
            <Sparkles size={13} className="mr-1.5" />
            Generar 607
          </Button>
        </div>
      </Card>

      {/* Row 2: Diagnóstico inteligente Banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 flex-shrink-0">
            <Activity size={18} />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-body-sm font-bold text-blue-900">Diagnóstico inteligente</span>
              <span className="text-[9px] font-bold bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded uppercase tracking-wide">Beta</span>
            </div>
            <span className="text-ui-xs text-blue-700 font-medium">
              Analizamos tus datos antes de generar para evitar rechazos de DGII.
            </span>
          </div>
        </div>
        <Button variant="primary" size="sm" className="h-9 px-4 bg-brand-500 text-white font-semibold shrink-0">
          Corregir automáticamente
        </Button>
      </div>

      {/* Row 3: Diagnostic Issues list */}
      <div className="flex flex-col gap-2.5">
        {/* Issue 1 */}
        <div className="rounded-xl border border-neutral-100 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-neutral-200 transition-colors shadow-sm">
          <div className="flex items-start gap-3">
            <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ui-sm font-bold text-text-primary">3 facturas inválidas para el 607</span>
                <span className="text-[9px] font-bold bg-red-50 text-red-600 border border-red-200/50 px-1.5 py-0.2 rounded">Crítico</span>
                <span className="text-[9px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200/40 px-1.5 py-0.2 rounded">Reporte 607</span>
              </div>
              <span className="text-ui-xs text-text-secondary">Comprobantes con monto en cero o sin ITBIS calculado.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-ui-sm font-semibold text-brand-500 hover:text-brand-600 px-3 py-1.5 transition-colors">
              Ver y corregir &rarr;
            </button>
            <button className="text-ui-sm font-semibold text-text-secondary hover:text-text-primary px-3 py-1.5 transition-colors">
              Marcar revisado
            </button>
          </div>
        </div>

        {/* Issue 2 */}
        <div className="rounded-xl border border-neutral-100 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-neutral-200 transition-colors shadow-sm">
          <div className="flex items-start gap-3">
            <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ui-sm font-bold text-text-primary">1 NCF fuera de rango autorizado</span>
                <span className="text-[9px] font-bold bg-red-50 text-red-600 border border-red-200/50 px-1.5 py-0.2 rounded">Crítico</span>
                <span className="text-[9px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200/40 px-1.5 py-0.2 rounded">Reporte 607</span>
              </div>
              <span className="text-ui-xs text-text-secondary">El NCF B0200000045 excede la secuencia vigente en DGII.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-ui-sm font-semibold text-brand-500 hover:text-brand-600 px-3 py-1.5 transition-colors">
              Ver y corregir &rarr;
            </button>
            <button className="text-ui-sm font-semibold text-text-secondary hover:text-text-primary px-3 py-1.5 transition-colors">
              Marcar revisado
            </button>
          </div>
        </div>

        {/* Issue 3 */}
        <div className="rounded-xl border border-neutral-100 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-neutral-200 transition-colors shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ui-sm font-bold text-text-primary">RNC de cliente faltante en 2 registros</span>
                <span className="text-[9px] font-bold bg-orange-50 text-orange-600 border border-orange-200/50 px-1.5 py-0.2 rounded">Advertencia</span>
                <span className="text-[9px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200/40 px-1.5 py-0.2 rounded">Reporte 607</span>
              </div>
              <span className="text-ui-xs text-text-secondary">Se requiere RNC para montos superiores a RD$ 250,000.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-ui-sm font-semibold text-brand-500 hover:text-brand-600 px-3 py-1.5 transition-colors">
              Ver y corregir &rarr;
            </button>
            <button className="text-ui-sm font-semibold text-text-secondary hover:text-text-primary px-3 py-1.5 transition-colors">
              Marcar revisado
            </button>
          </div>
        </div>

        {/* Issue 4 */}
        <div className="rounded-xl border border-neutral-100 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-neutral-200 transition-colors shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ui-sm font-bold text-text-primary">Diferencia de ITBIS detectada</span>
                <span className="text-[9px] font-bold bg-orange-50 text-orange-600 border border-orange-200/50 px-1.5 py-0.2 rounded">Advertencia</span>
                <span className="text-[9px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200/40 px-1.5 py-0.2 rounded">Reporte 606</span>
              </div>
              <span className="text-ui-xs text-text-secondary">5 comprobantes con ITBIS calculado distinto al esperado (18%).</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-ui-sm font-semibold text-brand-500 hover:text-brand-600 px-3 py-1.5 transition-colors">
              Ver y corregir &rarr;
            </button>
            <button className="text-ui-sm font-semibold text-text-secondary hover:text-text-primary px-3 py-1.5 transition-colors">
              Marcar revisado
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Generación de Reportes grid */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-body-base font-bold text-text-primary">Generación de reportes</h3>
          <span className="text-ui-xs text-text-secondary font-medium">Período: Abril 2026</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Card 1: 606 */}
          <Card className="p-5 flex flex-col justify-between bg-white border border-neutral-200 shadow-sm rounded-xl h-[230px]">
            <div className="flex flex-col gap-2 text-left">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                    606
                  </span>
                  <span className="text-body-sm font-bold text-text-primary">Compras de Bienes y Servicios</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  Generado
                </span>
              </div>
              <p className="text-ui-sm text-text-secondary leading-normal">
                Reporte mensual de compras realizadas a proveedores.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-text-secondary font-semibold">
                <span>Generado: 21 abr 2026, 10:42</span>
                <span>•</span>
                <span>Registros: 28</span>
              </div>
              {/* Alert banner inside card */}
              <div className="rounded border border-orange-200 bg-orange-50/50 p-2 text-[10px] text-orange-800 font-medium">
                Hay advertencias menores. Revísalas para evitar rechazos.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-2">
              <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs">
                <RefreshCw size={12} className="mr-1" />
                Generar
              </Button>
              <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs">
                <Send size={12} className="mr-1" />
                Enviar a DGII
              </Button>
              <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs">
                <Download size={12} className="mr-1" />
                TXT
              </Button>
            </div>
          </Card>

          {/* Card 2: 607 */}
          <Card className="p-5 flex flex-col justify-between bg-white border border-neutral-200 shadow-sm rounded-xl h-[230px]">
            <div className="flex flex-col gap-2 text-left">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                    607
                  </span>
                  <span className="text-body-sm font-bold text-text-primary">Ventas de Bienes y Servicios</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  Error DGII
                </span>
              </div>
              <p className="text-ui-sm text-text-secondary leading-normal">
                Reporte mensual de comprobantes emitidos.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-text-secondary font-semibold">
                <span>Generado: 21 abr 2026, 10:42</span>
                <span>•</span>
                <span>Registros: 28</span>
              </div>
              {/* Alert banner inside card */}
              <div className="rounded border border-red-200 bg-red-50/50 p-2 text-[10px] text-red-800 font-medium">
                Errores críticos detectados. El envío a DGII está bloqueado hasta resolverlos.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-2">
              <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs">
                <RefreshCw size={12} className="mr-1" />
                Generar
              </Button>
              <Button variant="secondary" size="sm" disabled className="h-8 border border-neutral-200 opacity-50 px-2 text-ui-xs">
                <Send size={12} className="mr-1" />
                Enviar a DGII
              </Button>
              <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs">
                <Download size={12} className="mr-1" />
                TXT
              </Button>
            </div>
          </Card>

          {/* Card 3: 608 */}
          <Card className="p-5 flex flex-col justify-between bg-white border border-neutral-200 shadow-sm rounded-xl h-[230px]">
            <div className="flex flex-col gap-2 text-left">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                    608
                  </span>
                  <span className="text-body-sm font-bold text-text-primary">Comprobantes Anulados</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">
                  Enviado a DGII
                </span>
              </div>
              <p className="text-ui-sm text-text-secondary leading-normal">
                Listado de NCF anulados durante el período.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-text-secondary font-semibold mt-1.5">
                <span>Generado: 21 abr 2026, 10:42</span>
                <span>•</span>
                <span>Registros: 28</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-2">
              <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs">
                <RefreshCw size={12} className="mr-1" />
                Generar
              </Button>
              <Button variant="secondary" size="sm" disabled className="h-8 border border-neutral-200 opacity-50 px-2 text-ui-xs">
                <Send size={12} className="mr-1" />
                Enviar a DGII
              </Button>
              <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs">
                <Download size={12} className="mr-1" />
                TXT
              </Button>
            </div>
          </Card>

          {/* Card 4: 609 */}
          <Card className="p-5 flex flex-col justify-between bg-white border border-neutral-200 shadow-sm rounded-xl h-[230px]">
            <div className="flex flex-col gap-2 text-left">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                    609
                  </span>
                  <span className="text-body-sm font-bold text-text-primary">Pagos al Exterior</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                  No generado
                </span>
              </div>
              <p className="text-ui-sm text-text-secondary leading-normal">
                Pagos realizados a proveedores no residentes (opcional).
              </p>
            </div>

            <div className="mt-auto">
              <Button variant="primary" size="sm" className="h-9 px-4 bg-brand-500 text-white font-semibold w-full">
                Generar 609
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Row 5: Historial de Reportes Table (Foto 5) */}
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex flex-col text-left">
          <h3 className="text-body-base font-bold text-text-primary">Historial de reportes</h3>
          <p className="text-ui-xs text-text-secondary font-medium">
            Reportes generados y enviados anteriormente.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Período</th>
                  <th className="px-4 py-3 font-semibold">Generado</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right pr-6">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historicalReports.map((row, idx) => {
                  const isSent = row.estado === 'ENVIADO_DGII'

                  return (
                    <tr key={idx} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-ui-sm">
                          {row.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-text-primary font-semibold">{row.periodo}</td>
                      <td className="px-4 py-3.5 text-text-secondary">{row.generado}</td>
                      <td className="px-4 py-3.5">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50/70 px-2.5 py-1 text-ui-xs font-semibold text-green-700">
                            <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" />
                            Enviado a DGII
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/70 px-2.5 py-1 text-ui-xs font-semibold text-red-700">
                            <XCircle size={12} className="text-red-600 flex-shrink-0" />
                            Error DGII
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right pr-6">
                        <div className="flex items-center justify-end gap-3.5">
                          <button
                            type="button"
                            title="Descargar TXT"
                            className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none flex items-center justify-center h-8 w-8 rounded-lg hover:bg-neutral-100/50"
                          >
                            <Download size={15} />
                          </button>
                          {!isSent && (
                            <Button variant="secondary" size="sm" className="h-8 border border-neutral-200 hover:bg-neutral-50 px-2 text-ui-xs flex items-center gap-1">
                              <RefreshCw size={12} className="text-brand-500" />
                              Reenviar
                            </Button>
                          )}
                          <ChevronRight size={16} className="text-text-secondary cursor-pointer" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Red Alert card under historical table (Foto 5 bottom) */}
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-body-sm font-bold text-red-900 leading-tight">
                Un envío fue rechazado por DGII
              </span>
              <span className="text-ui-xs text-red-700 font-medium mt-0.5">
                Revisa el detalle del error y reenvía cuando esté corregido.
              </span>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="h-9 px-4 border border-red-200 hover:bg-red-50 text-red-700 font-semibold bg-white shrink-0">
            Ver detalle &rarr;
          </Button>
        </div>
      </div>
    </div>
  )
}
