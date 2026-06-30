'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import {
  Download,
  RotateCw,
  KeyRound,
  FileCheck2,
  Calendar,
  Eye,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Info
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function CertificadoDigitalPage(): JSX.Element {
  const [password, setPassword] = useState('password1234')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex flex-col gap-6 text-left pb-10">
      {/* Header and CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Certificado digital</h2>
          <p className="text-body-sm text-text-secondary">
            Gestioná el certificado .P12 usado para firmar comprobantes electrónicos ante DGII.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200/50 px-2.5 py-1 text-ui-xs font-bold text-orange-700">
            ● Expira en 12 días
          </span>
          <Button
            variant="secondary"
            size="md"
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4 text-ui-sm font-semibold flex items-center gap-1.5"
          >
            <Download size={15} />
            Exportar detalles
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4 text-ui-sm font-semibold flex items-center gap-1.5"
          >
            <RotateCw size={15} />
            Reemplazar
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start w-full">
        {/* Left Column (Grid span 3) */}
        <div className="lg:col-span-3 flex flex-col gap-6 w-full">
          {/* Card 1: Cargar certificado */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-5 text-left">
            <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                <span className="text-[11px] font-bold text-brand-600">1</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-body-sm font-bold text-text-primary flex items-center gap-1.5">
                  Cargar certificado
                  <span className="text-[10px] text-text-tertiary">&uarr;</span>
                </h3>
                <p className="text-ui-xs text-text-secondary leading-normal">
                  Subí un archivo .P12 emitido por la CA autorizada y su contraseña privada.
                </p>
              </div>
            </div>

            {/* Uploaded File capsule */}
            <div className="border border-green-200 rounded-xl p-4 bg-green-50/20 text-left flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-green-600" />
                  <span className="text-ui-sm font-bold text-text-primary">distribuidora_2028.p12</span>
                  <span className="text-[9px] bg-green-100 border border-green-200 text-green-700 font-bold px-1.5 py-0.2 rounded uppercase">Archivo aceptado</span>
                </div>
                <button className="text-ui-xs font-bold text-brand-500 hover:text-brand-600">Cambiar archivo</button>
              </div>

              {/* Certificate metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-ui-xs text-text-secondary border-t border-green-100/50 pt-2.5">
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary uppercase text-[9px]">Titular</span>
                  <span className="mt-0.5 font-medium">Distribuidora SRL</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary uppercase text-[9px]">RNC</span>
                  <span className="mt-0.5 font-mono font-medium">131793916</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary uppercase text-[9px]">Vigencia</span>
                  <span className="mt-0.5 font-medium">2025-05-05 &rarr; 2028-05-05</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary uppercase text-[9px]">Huella</span>
                  <span className="mt-0.5 font-mono font-medium truncate" title="a1f82c7d9b3e4f51...">a1f82c7d9b3e4f51...</span>
                </div>
              </div>
            </div>

            {/* Password input row */}
            <div className="flex flex-col gap-1.5 text-left max-w-2xl w-full">
              <label className="text-ui-xs font-bold text-text-secondary uppercase">Contraseña del certificado *</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-10 text-body-sm text-text-primary focus:outline-none"
                  />
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-brand-500"
                  >
                    <Eye size={14} />
                  </button>
                </div>
                <Button variant="primary" size="md" className="h-10 px-4 bg-brand-500 text-white font-semibold">
                  Validar y activar
                </Button>
              </div>
              <span className="text-[10px] text-text-tertiary mt-0.5">● Nunca almacenamos tu contraseña en texto plano. Se cifra con AES-256.</span>
            </div>
          </Card>

          {/* Card 2: Resultado de validación */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                <span className="text-[11px] font-bold text-brand-600">2</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-body-sm font-bold text-text-primary flex items-center gap-1.5">
                  Resultado de validación
                  <span className="text-[10px] text-text-tertiary">&uarr;</span>
                </h3>
                <p className="text-ui-xs text-text-secondary leading-normal">
                  Verificaciones automáticas realizadas sobre el certificado cargado.
                </p>
              </div>
            </div>

            {/* Validation items list */}
            <div className="flex flex-col gap-2.5">
              {[
                { label: 'Firma digital verificable', desc: 'Cadena de confianza válida hasta CA raíz DGII', status: 'OK' },
                { label: 'RNC coincide con empresa', desc: '131793916 - Distribuidora SR', status: 'OK' },
                { label: 'Algoritmo compatible DGII', desc: 'SHA-256 - RSA 2048', status: 'OK' },
                { label: 'Fecha de expiración', desc: 'Vence el 2026-05-05 · renová pronto', status: 'WARN' },
                { label: 'Compatible con DGII', desc: 'Cumple con los requisitos técnicos para firmar e-CF E31, E32, E33, E34, E41, E43, E44 y E45.', status: 'OK' },
              ].map((item, idx) => {
                const isOk = item.status === 'OK'

                return (
                  <div key={idx} className="flex justify-between items-start p-3 bg-neutral-50/50 border border-neutral-200/50 rounded-xl">
                    <div className="flex items-start gap-3">
                      {isOk ? (
                        <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex flex-col leading-tight">
                        <span className="text-ui-sm font-bold text-text-primary">{item.label}</span>
                        <span className="text-ui-xs text-text-secondary mt-0.5">{item.desc}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isOk ? 'bg-green-50 text-green-700 border border-green-200/40' : 'bg-orange-50 text-orange-700 border border-orange-200/40'}`}>
                      {isOk ? 'Aprobado' : 'Advertencia'}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Card 3: Prueba de firma digital */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                <span className="text-[11px] font-bold text-brand-600">3</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-body-sm font-bold text-text-primary flex items-center gap-1.5">
                  Prueba de firma digital
                  <span className="text-[10px] text-text-tertiary">&uarr;</span>
                </h3>
                <p className="text-ui-xs text-text-secondary leading-normal">
                  Firmá un XML de prueba para confirmar que el certificado funciona de punta a punta contra DGII.
                </p>
              </div>
            </div>

            {/* Test action block */}
            <div className="rounded-xl border border-neutral-150 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-text-secondary flex-shrink-0">
                  <FileCheck2 size={16} className="text-brand-500" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-ui-sm font-bold text-text-primary">Firma un XML de prueba</span>
                  <span className="text-ui-xs text-text-secondary mt-0.5">
                    Generamos un e-CF de prueba, lo firmamos y validamos la respuesta.
                  </span>
                </div>
              </div>
              <Button variant="primary" size="sm" className="h-9 px-4 bg-brand-500 text-white font-semibold shrink-0">
                Probar firma digital
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column (Grid span 1) */}
        <div className="flex flex-col gap-6 w-full lg:col-span-1">
          {/* Card: Estado del Certificado */}
          <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4.5 flex flex-col gap-3 text-left">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Estado del Certificado</span>
                <h4 className="text-body-base font-bold text-orange-700">Activo · vence pronto</h4>
              </div>
              <AlertTriangle size={18} className="text-orange-500" />
            </div>
            <p className="text-ui-xs text-orange-700/80 leading-normal font-semibold">
              El certificado vencerá en pocos días. Prepará el nuevo archivo para evitar la interrupción de facturas.
            </p>
          </div>

          {/* Card: Checklist de activacion */}
          <Card className="p-5 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col gap-3 text-left">
            <span className="text-[10px] font-bold text-text-secondary uppercase">Checklist de activación</span>
            <div className="flex items-baseline gap-1">
              <span className="text-h2 font-bold text-orange-600 leading-tight">12</span>
              <span className="text-ui-xs font-bold text-text-secondary">días restantes</span>
            </div>
            <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: '40%' }} />
            </div>

            <div className="flex items-center gap-1.5 text-ui-xs text-text-secondary font-semibold mt-2 pt-2 border-t border-neutral-100">
              <Calendar size={13} />
              <span>Vence el 2026-05-05</span>
            </div>
          </Card>

          {/* Card: Salud del Certificado */}
          <Card className="p-5 bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col gap-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-secondary uppercase">Salud del Certificado</span>
              <span className="text-ui-xs font-bold bg-green-50 border border-green-200 text-green-700 rounded px-1.5 py-0.5">84/100</span>
            </div>
            <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '84%' }} />
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-neutral-100 text-ui-xs font-semibold">
              <div className="flex items-center justify-between text-text-primary">
                <span>Validez y cadena de confianza</span>
                <span className="h-4.5 w-4.5 rounded-full border border-green-500 bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={10} />
                </span>
              </div>
              <div className="flex items-center justify-between text-text-primary">
                <span>Vigencia adecuada (&gt;30 días)</span>
                <span className="h-4.5 w-4.5 rounded-full border border-red-500 bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                  <XCircle size={10} />
                </span>
              </div>
              <div className="flex items-center justify-between text-text-primary">
                <span>Prueba de firma exitosa</span>
                <span className="h-4.5 w-4.5 rounded-full border border-neutral-300 bg-white flex items-center justify-center flex-shrink-0" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
