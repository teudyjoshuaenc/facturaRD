'use client'

import type { JSX } from 'react'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { TIPOS_COMPROBANTE, TIPOS_REGISTRO, type Contribuyente, type Provincia, type Representante, type TipoEcf } from '@/lib/registro'
import { UbicacionCampos, ubicacionCompleta } from './UbicacionCampos'

export const CONTRIBUYENTE_VACIO: Contribuyente = {
  tipoRegistro: 'EMISOR_ELECTRONICO',
  tiposComprobante: ['E31', 'E32', 'E33', 'E34'],
  tipoIdentificacion: 'RNC',
  rnc: '',
  razonSocial: '',
  nombreComercial: '',
  actividadEconomica: '',
  provincia: '',
  municipio: '',
  sector: '',
  direccion: '',
  telefono: '',
  email: '',
}

export const REPRESENTANTE_VACIO: Representante = {
  identificacion: '',
  pasaporte: '',
  nombreCompleto: '',
  celular: '',
  provincia: '',
  municipio: '',
  sector: '',
  direccion: '',
  telefono: '',
  email: '',
}

export function contribuyenteCompleto(c: Contribuyente): boolean {
  const largo = c.tipoIdentificacion === 'RNC' ? 9 : 11
  return (
    c.rnc.length === largo &&
    c.tiposComprobante.length > 0 &&
    c.actividadEconomica.trim().length >= 3 &&
    ubicacionCompleta(c)
  )
}

export function representanteCompleto(r: Representante): boolean {
  return /^(\d{9}|\d{11})$/.test(r.identificacion) && r.nombreCompleto.trim().length >= 3 && ubicacionCompleta(r)
}

interface ContribuyenteProps {
  valor: Contribuyente
  onChange: (v: Contribuyente) => void
  provincias: Provincia[]
  rncBloqueado: boolean
}

export function ContribuyenteForm({ valor, onChange, provincias, rncBloqueado }: ContribuyenteProps): JSX.Element {
  const set = <K extends keyof Contribuyente>(k: K, v: Contribuyente[K]) => onChange({ ...valor, [k]: v })
  const alternarTipo = (t: TipoEcf) =>
    set('tiposComprobante', valor.tiposComprobante.includes(t) ? valor.tiposComprobante.filter((x) => x !== t) : [...valor.tiposComprobante, t])

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-semibold text-text-secondary">Tipo de registro</span>
          <Select value={valor.tipoRegistro} onChange={(v) => set('tipoRegistro', v)} options={TIPOS_REGISTRO} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-semibold text-text-secondary">Identificación</span>
          <ToggleGroup
            options={[
              { value: 'RNC', label: 'RNC' },
              { value: 'CEDULA', label: 'Cédula' },
            ]}
            value={valor.tipoIdentificacion}
            onChange={(v) => !rncBloqueado && set('tipoIdentificacion', v)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="rnc"
          label={valor.tipoIdentificacion === 'RNC' ? 'RNC (9 dígitos)' : 'Cédula (11 dígitos)'}
          inputMode="numeric"
          value={valor.rnc}
          disabled={rncBloqueado}
          maxLength={valor.tipoIdentificacion === 'RNC' ? 9 : 11}
          onChange={(e) => set('rnc', e.target.value.replace(/\D/g, ''))}
          helperText={rncBloqueado ? 'El RNC no se puede cambiar después de creada la empresa.' : 'La razón social se toma de la DGII.'}
        />
        <Input
          id="nombre-comercial"
          label="Nombre comercial (opcional)"
          value={valor.nombreComercial ?? ''}
          onChange={(e) => set('nombreComercial', e.target.value)}
        />
        {valor.tipoIdentificacion === 'CEDULA' && (
          <div className="sm:col-span-2">
            <Input
              id="razon-social"
              label="Nombre completo (sólo si tu cédula no aparece en la DGII)"
              value={valor.razonSocial ?? ''}
              onChange={(e) => set('razonSocial', e.target.value)}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Input
            id="actividad"
            label="Actividad económica"
            placeholder="Ej.: Servicios de consultoría"
            value={valor.actividadEconomica}
            onChange={(e) => set('actividadEconomica', e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-ui-sm font-semibold text-text-secondary">Tipos de comprobante que vas a emitir</span>
        <div className="flex flex-wrap gap-2">
          {TIPOS_COMPROBANTE.map((t) => {
            const activo = valor.tiposComprobante.includes(t.value)
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => alternarTipo(t.value)}
                aria-pressed={activo}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-ui-sm transition-colors',
                  activo ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-text-secondary hover:border-neutral-300',
                )}
              >
                {activo && <Check size={14} />}
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <UbicacionCampos prefijo="contribuyente" valor={valor} onChange={(u) => onChange({ ...valor, ...u })} provincias={provincias} />
    </div>
  )
}

interface RepresentanteProps {
  valor: Representante
  onChange: (v: Representante) => void
  provincias: Provincia[]
}

export function RepresentanteForm({ valor, onChange, provincias }: RepresentanteProps): JSX.Element {
  const set = <K extends keyof Representante>(k: K, v: Representante[K]) => onChange({ ...valor, [k]: v })
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input id="rep-nombre" label="Nombre completo" value={valor.nombreCompleto} onChange={(e) => set('nombreCompleto', e.target.value)} />
        </div>
        <Input
          id="rep-identificacion"
          label="Cédula o RNC"
          inputMode="numeric"
          maxLength={11}
          value={valor.identificacion}
          onChange={(e) => set('identificacion', e.target.value.replace(/\D/g, ''))}
          helperText="Cédula si es dominicano; RNC asignado si es extranjero."
        />
        <Input
          id="rep-pasaporte"
          label="Pasaporte (sólo extranjeros)"
          value={valor.pasaporte ?? ''}
          onChange={(e) => set('pasaporte', e.target.value)}
        />
        <Input id="rep-celular" label="Celular (opcional)" type="tel" value={valor.celular ?? ''} onChange={(e) => set('celular', e.target.value)} />
      </div>
      <UbicacionCampos prefijo="representante" valor={valor} onChange={(u) => onChange({ ...valor, ...u })} provincias={provincias} />
    </div>
  )
}
