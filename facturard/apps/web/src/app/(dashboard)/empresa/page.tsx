'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import {
  Building,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
  Phone,
  FileText,
  HelpCircle
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/AuthContext'
import { Select } from '@/components/ui/select'

const monedaOptions = [
  { value: 'DOP', label: 'DOP - Peso Dominicano' },
  { value: 'USD', label: 'USD - Dólar Estadounidense' },
]

const tasaOptions = [
  { value: '18', label: '18% Tasa General' },
  { value: '16', label: '16% Tasa Reducida' },
  { value: '0', label: '0% Tasa Cero' },
]

export default function EmpresaPage(): JSX.Element {
  const { tenant } = useAuth()

  // Form states
  const [rnc, setRnc] = useState('131793916')
  const [razonSocial, setRazonSocial] = useState('DMAIA Distribuidora SRL')
  const [moneda, setMoneda] = useState('DOP')
  const [tasaItbis, setTasaItbis] = useState('18')
  const [nombreComercial, setNombreComercial] = useState('DMAIA.SRL')
  const [actividadEcon, setActividadEcon] = useState('Venta al por mayor de alimentos y bebidas')
  const [direccion, setDireccion] = useState('Av. Winston Churchill 123, Piantini, Santo Domingo')
  const [telefono, setTelefono] = useState('809-567-8901')
  const [emailFact, setEmailFact] = useState('facturacion@dmaia.do')

  // Document types checkboxes states
  const [comprobantes, setComprobantes] = useState({
    E31: true,
    E32: false,
    E33: true,
    E34: true,
    E35: false,
    E36: true,
    E37: false,
    E38: true,
  })

  // Delivery options toggles
  const [autoEmail, setAutoEmail] = useState(true)
  const [manualDeliv, setManualDeliv] = useState(false)

  return (
    <div className="flex flex-col gap-6 text-left pb-10">
      {/* Header and CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Empresa</h2>
          <p className="text-body-sm text-text-secondary">
            Configurá los datos fiscales para emitir comprobantes electrónicos ante DGII.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200/50 px-2.5 py-1 text-ui-xs font-bold text-orange-700">
            ● Configuración incompleta
          </span>
          <Button
            variant="secondary"
            size="md"
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4 text-ui-sm font-semibold"
          >
            Descartar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => alert('Cambios guardados exitosamente.')}
            className="h-10 px-4 bg-brand-500 text-white font-semibold"
          >
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start w-full">
        {/* Left Column (Grid span 3) */}
        <div className="lg:col-span-3 flex flex-col gap-6 w-full">
          {/* Card 1: Datos fiscales */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-5 text-left">
            <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                <Building size={16} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="text-body-sm font-bold text-text-primary">Datos fiscales</h3>
                  <span className="text-[8px] bg-red-100 border border-red-200 text-red-700 font-bold px-1.5 py-0.2 rounded uppercase">Crítico</span>
                </div>
                <p className="text-ui-xs text-text-secondary leading-normal">
                  Información obligatoria registrada ante DGII. No podés emitir comprobantes sin estos datos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* RNC */}
              <div className="flex flex-col gap-1.5 relative text-left">
                <label className="text-ui-xs font-bold text-text-secondary uppercase">RNC *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={rnc}
                    onChange={(e) => setRnc(e.target.value)}
                    className="h-10 w-full rounded-lg border border-green-300 bg-white px-3 pr-10 text-body-sm text-text-primary focus:outline-none"
                  />
                  <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                </div>
                <span className="text-[10px] text-green-600 font-semibold mt-0.5">● RNC verificado en el padrón DGII</span>
              </div>

              {/* Razon Social */}
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-ui-xs font-bold text-text-secondary uppercase">Razón social *</label>
                  <span className="text-[9px] text-text-tertiary font-bold">Auto-completado</span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={razonSocial}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-body-sm text-text-secondary cursor-not-allowed"
                />
                <span className="text-[10px] text-text-tertiary">Auto-completado desde el padrón DGII</span>
              </div>

              {/* Nombre comercial */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-ui-xs font-bold text-text-secondary uppercase">Nombre comercial</label>
                <input
                  type="text"
                  readOnly
                  value={nombreComercial}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-body-sm text-text-secondary cursor-not-allowed"
                />
                <span className="text-[10px] text-text-tertiary">Auto-completado desde el padrón DGII</span>
              </div>

              {/* Actividad economica */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-ui-xs font-bold text-text-secondary uppercase">Actividad económica *</label>
                <input
                  type="text"
                  readOnly
                  value={actividadEcon}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-body-sm text-text-secondary cursor-not-allowed"
                />
                <span className="text-[10px] text-text-tertiary">Auto-completado desde el padrón DGII</span>
              </div>
            </div>
          </Card>

          {/* Card 2: Información comercial */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-5 text-left">
            <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                <Mail size={16} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-body-sm font-bold text-text-primary">Información comercial</h3>
                <p className="text-ui-xs text-text-secondary leading-normal">
                  Estos datos aparecen en tus facturas y notificaciones al cliente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Logo dropzone */}
              <div className="md:col-span-1 flex flex-col gap-1.5 text-left">
                <span className="text-ui-xs font-bold text-text-secondary uppercase">Logo de la empresa</span>
                <div className="border border-dashed border-neutral-300 rounded-lg p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-50 hover:bg-neutral-100/50 transition-colors h-32">
                  <UploadCloud size={20} className="text-text-secondary" />
                  <span className="text-[10px] font-bold text-text-primary">Arrastrá o buscá un archivo</span>
                  <span className="text-[9px] text-text-tertiary">PNG, JPG o SVG · máx 2MB</span>
                </div>
              </div>

              {/* Form items */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {/* Direccion */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-ui-xs font-bold text-text-secondary uppercase">Dirección fiscal completa *</label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-body-sm text-text-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Telefono */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-ui-xs font-bold text-text-secondary uppercase">Teléfono *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-body-sm text-text-primary focus:outline-none"
                      />
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-ui-xs font-bold text-text-secondary uppercase">Email de facturación *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={emailFact}
                        onChange={(e) => setEmailFact(e.target.value)}
                        className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-10 text-body-sm text-text-primary focus:outline-none"
                      />
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 3: Vista Previa Factura */}
          <div className="flex flex-col gap-2.5 text-left">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Vista Previa de Factura</span>
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-6 flex flex-col gap-6">
              {/* Fake invoice header */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-neutral-100 rounded-lg flex items-center justify-center text-text-secondary">
                    <Building size={18} />
                  </div>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-body-sm font-bold text-text-primary">Distribuidora</span>
                    <span className="text-[10px] text-text-secondary">RNC 131793916</span>
                  </div>
                </div>
                <div className="flex flex-col items-end text-right leading-tight">
                  <span className="text-[10px] font-bold text-text-secondary uppercase">Factura de Crédito Fiscal</span>
                  <span className="text-ui-sm font-bold text-brand-600 mt-1">E31 · 0000004922</span>
                  <span className="text-[10px] text-text-tertiary mt-0.5">23/04/2026</span>
                </div>
              </div>

              {/* Address grid */}
              <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 text-ui-xs leading-relaxed text-text-secondary">
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="font-bold text-text-primary uppercase">Emisor</span>
                  <span>Av. Winston Churchill 123, Piantini, Santo Domingo</span>
                  <span>facturacion@acme.do</span>
                </div>
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="font-bold text-text-primary uppercase">Cliente</span>
                  <span>Cafetería Nacional SRL</span>
                  <span>RNC 101234567</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-t border-neutral-100 pt-4 overflow-x-auto">
                <table className="w-full text-left text-ui-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-[10px] font-bold text-text-secondary uppercase">
                      <th className="py-2">Descripción</th>
                      <th className="py-2 text-center">Unit.</th>
                      <th className="py-2 text-center">Cant.</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { desc: 'Caja café premium 500g', unit: '10', cant: '4,250.00', total: '425.00' },
                      { desc: 'Caja café premium 500g', unit: '10', cant: '4,250.00', total: '425.00' },
                    ].map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-100 last:border-0 font-medium">
                        <td className="py-2.5 text-text-primary">{item.desc}</td>
                        <td className="py-2.5 text-center text-text-secondary">{item.unit}</td>
                        <td className="py-2.5 text-center text-text-secondary">{item.cant}</td>
                        <td className="py-2.5 text-right text-text-primary">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary line */}
              <div className="flex justify-end border-t border-neutral-100 pt-3 text-ui-xs font-semibold text-text-secondary gap-4">
                <span>Subtotal - ITBIS 18% - Total:</span>
                <span className="text-text-primary font-bold">4,600 - 828 - <span className="text-brand-600">RD$ 5,428.00</span></span>
              </div>
            </div>
          </div>

          {/* Card 4: Configuración de comprobantes (Foto 2) */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-6 text-left">
            <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-body-sm font-bold text-text-primary">Configuración de comprobantes</h3>
                <p className="text-ui-xs text-text-secondary leading-normal">
                  Definí qué tipos de e-CF emite tu empresa y cómo se entregan al cliente.
                </p>
              </div>
            </div>

            {/* Checklist checkbox list grid */}
            <div className="flex flex-col gap-3">
              <span className="text-ui-xs font-bold text-text-secondary uppercase">Tipos de comprobante habilitados</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'E31', label: 'E31 - Crédito Fiscal' },
                  { id: 'E32', label: 'E32 - Consumo' },
                  { id: 'E33', label: 'E33 - Nota de Debito' },
                  { id: 'E34', label: 'E34 - Nota de Credito' },
                  { id: 'E35', label: 'E35 - Compras' },
                  { id: 'E36', label: 'E36 - Gastos Menores' },
                  { id: 'E37', label: 'E37 - Reg. Especiales' },
                  { id: 'E38', label: 'E38 - Gubernamental' },
                ].map((item) => {
                  const isChecked = comprobantes[item.id as keyof typeof comprobantes]

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setComprobantes({ ...comprobantes, [item.id]: !isChecked })}
                      className={`flex justify-between items-center text-left px-3.5 py-3 border rounded-xl transition-all font-semibold text-ui-sm cursor-pointer select-none ${isChecked ? 'border-brand-500 bg-brand-50/50 text-brand-600 shadow-sm shadow-brand-500/5' : 'border-neutral-200 bg-white text-text-secondary'}`}
                    >
                      <span>{item.label}</span>
                      <span className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center flex-shrink-0 ${isChecked ? 'border-brand-500 bg-brand-500 text-white' : 'border-neutral-300 bg-white'}`}>
                        {isChecked && <CheckCircle2 size={10} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Defaults selection grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Moneda */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-ui-xs font-bold text-text-secondary uppercase">Moneda por defecto</label>
                <Select
                  value={moneda}
                  onChange={setMoneda}
                  options={monedaOptions}
                  triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
                />
              </div>

              {/* Tasa ITBIS */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-ui-xs font-bold text-text-secondary uppercase">Tasa general ITBIS</label>
                <Select
                  value={tasaItbis}
                  onChange={setTasaItbis}
                  options={tasaOptions}
                  triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
                />
              </div>
            </div>

            {/* Method of delivery */}
            <div className="flex flex-col gap-4 border-t border-neutral-100 pt-5">
              <span className="text-ui-xs font-bold text-text-secondary uppercase">Método de entrega al cliente</span>
              
              <div className="flex flex-col gap-3.5">
                {/* Option 1 */}
                <div className="flex items-start justify-between w-full">
                  <div className="flex flex-col text-left">
                    <span className="text-ui-sm font-bold text-text-primary">Enviar factura por email automáticamente</span>
                    <span className="text-ui-xs text-text-secondary mt-0.5">Al emitir, el PDF y XML se envían al email del cliente.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoEmail(!autoEmail)
                      if (!autoEmail) setManualDeliv(false)
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoEmail ? 'bg-brand-500' : 'bg-neutral-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoEmail ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Option 2 */}
                <div className="flex items-start justify-between w-full pt-2.5 border-t border-neutral-100/50">
                  <div className="flex flex-col text-left">
                    <span className="text-ui-sm font-bold text-text-primary">Solo entrega Manual</span>
                    <span className="text-ui-xs text-text-secondary mt-0.5">El usuario decide cuándo y cómo enviar cada comprobante.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManualDeliv(!manualDeliv)
                      if (!manualDeliv) setAutoEmail(false)
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${manualDeliv ? 'bg-brand-500' : 'bg-neutral-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${manualDeliv ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (Grid span 1) */}
        <div className="flex flex-col gap-6 w-full lg:col-span-1">
          {/* Card: Estado de configuracion */}
          <Card className="p-5 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-body-sm font-bold text-text-primary">Estado de configuración</h3>
              <span className="text-ui-xs font-bold bg-green-50 border border-green-200 text-green-700 rounded px-1.5 py-0.5">94%</span>
            </div>
            <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '94%' }} />
            </div>
            <span className="text-ui-xs text-text-secondary font-medium">5 de 8 pasos completados para facturar.</span>

            {/* Config alert rows */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-neutral-100">
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-orange-50 border border-orange-100 text-left">
                <AlertTriangle size={15} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] font-bold text-orange-700">Estado DGII</span>
                  <span className="text-ui-xs font-semibold text-orange-700 mt-0.5">En configuración</span>
                  <span className="text-[9px] text-orange-600/70 mt-1 leading-normal">Tu empresa está registrada pero aún faltan secuencias NCF.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100 text-left">
                <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] font-bold text-red-700">Estado DGII</span>
                  <span className="text-ui-xs font-semibold text-red-700 mt-0.5">En configuración</span>
                  <span className="text-[9px] text-red-600/70 mt-1 leading-normal">Tu empresa está registrada pero aún faltan secuencias NCF.</span>
                </div>
              </div>
            </div>

            {/* Checklist activacion list */}
            <div className="flex flex-col gap-2.5 pt-3 border-t border-neutral-100 text-ui-xs">
              <span className="text-[10px] font-bold text-text-secondary uppercase">Checklist de activación</span>
              
              <div className="flex flex-col gap-2 font-medium">
                {[
                  { label: 'RNC validado', done: true },
                  { label: 'Nombre comercial definido', done: true },
                  { label: 'Logo cargado', done: false },
                  { label: 'Dirección completa', done: true },
                  { label: 'Email de contacto válido', done: true },
                  { label: 'Tipos de comprobante activos', done: true },
                  { label: 'Certificado digital', done: false },
                  { label: 'Secuencias NCF configuradas', done: false },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-text-primary">
                    <span>{item.label}</span>
                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0 ${item.done ? 'border-green-500 bg-green-500 text-white' : 'border-neutral-300 bg-white'}`}>
                      {item.done && <CheckCircle2 size={10} />}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-neutral-100">
              <Button variant="primary" size="md" className="h-9 px-4 bg-brand-500 text-white font-semibold w-full text-ui-sm">
                Continuar configuración
              </Button>
              <Button variant="secondary" size="md" className="h-9 px-4 border border-neutral-200 hover:bg-neutral-50 font-semibold w-full text-ui-sm">
                Ver guía paso a paso
              </Button>
            </div>
          </Card>

          {/* Card: ¿Sabés que...? */}
          <Card className="p-4 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col gap-2.5 text-left">
            <div className="flex items-center gap-2 text-text-primary">
              <HelpCircle size={15} className="text-brand-500" />
              <h4 className="text-ui-sm font-bold text-text-primary">¿Sabés que...?</h4>
            </div>
            <p className="text-[10px] text-text-secondary leading-normal font-semibold">
              DGII requiere que el certificado digital esté registrado con el mismo RNC que figura en los comprobantes emitidos.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
