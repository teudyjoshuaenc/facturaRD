import type { JSX } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Provincia } from '@/lib/registro'

export interface UbicacionValor {
  provincia: string
  municipio: string
  sector: string
  direccion: string
  telefono: string
  email: string
}

interface Props {
  prefijo: string
  valor: UbicacionValor
  onChange: (v: UbicacionValor) => void
  provincias: Provincia[]
}

/** Provincia y municipio de la Tabla III de la DGII + sector, dirección y contacto. */
export function UbicacionCampos({ prefijo, valor, onChange, provincias }: Props): JSX.Element {
  const set = (campo: keyof UbicacionValor) => (v: string) => onChange({ ...valor, [campo]: v })
  const municipios = provincias.find((p) => p.codigo === valor.provincia)?.municipios ?? []

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-ui-sm font-semibold text-text-secondary">Provincia</span>
        <Select
          value={valor.provincia}
          onChange={(v) => onChange({ ...valor, provincia: v, municipio: '' })}
          options={provincias.map((p) => ({ value: p.codigo, label: p.nombre }))}
          placeholder="Selecciona la provincia"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-ui-sm font-semibold text-text-secondary">Municipio</span>
        <Select
          value={valor.municipio}
          onChange={set('municipio')}
          options={municipios.map((m) => ({ value: m.codigo, label: m.nombre }))}
          placeholder={valor.provincia ? 'Selecciona el municipio' : 'Primero la provincia'}
          disabled={!valor.provincia}
        />
      </div>
      <Input id={`${prefijo}-sector`} label="Sector" value={valor.sector} onChange={(e) => set('sector')(e.target.value)} />
      <Input
        id={`${prefijo}-telefono`}
        label="Teléfono"
        type="tel"
        placeholder="809-555-0101"
        value={valor.telefono}
        onChange={(e) => set('telefono')(e.target.value)}
      />
      <div className="sm:col-span-2">
        <Input
          id={`${prefijo}-direccion`}
          label="Dirección"
          placeholder="Calle, número, edificio"
          value={valor.direccion}
          onChange={(e) => set('direccion')(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Input
          id={`${prefijo}-email`}
          label="Correo electrónico"
          type="email"
          value={valor.email}
          onChange={(e) => set('email')(e.target.value)}
        />
      </div>
    </div>
  )
}

export function ubicacionCompleta(u: UbicacionValor): boolean {
  return Boolean(u.provincia && u.municipio && u.sector.trim().length >= 2 && u.direccion.trim().length >= 5 && u.telefono.trim() && u.email.includes('@'))
}
