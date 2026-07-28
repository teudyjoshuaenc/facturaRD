'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { MapPin, TrendingUp, Receipt, Trophy } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { formatCurrency, formatCurrencyCompact } from '@/lib/comprobantes'
import { PROVINCIA_CENTROIDE } from '@/lib/provincias-rd'
import { useVentasPorProvincia, type ClaseVentasProvincia, type VentaPorProvincia } from '@/hooks/useComprobantes'

interface Props {
  fechaDesde: string
  fechaHasta: string
}

// Escala de radio: área ~ proporcional al monto (no el radio directo — si no,
// la provincia top se come el mapa). Color: interpolación continua clara→oscura
// del mismo azul de marca — magnitud reforzada en 2 canales (tamaño + color),
// nunca solo color (accesibilidad).
const RADIO_MIN = 9
const RADIO_MAX = 36
const COLOR_CLARO: [number, number, number] = [204, 229, 247] // brand-100
const COLOR_OSCURO: [number, number, number] = [1, 78, 147] // brand-800

function lerp(a: number, b: number, ratio: number): number {
  return Math.round(a + (b - a) * ratio)
}

function colorPara(ratio: number): string {
  const r = lerp(COLOR_CLARO[0], COLOR_OSCURO[0], ratio)
  const g = lerp(COLOR_CLARO[1], COLOR_OSCURO[1], ratio)
  const b = lerp(COLOR_CLARO[2], COLOR_OSCURO[2], ratio)
  return `rgb(${r}, ${g}, ${b})`
}

function KpiTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: JSX.Element
  label: string
  value: string
  sub?: string | undefined
}): JSX.Element {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-border-subtle bg-background-canvas px-4 py-3 min-w-[160px]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div className="flex flex-col overflow-hidden">
        <span className="truncate text-ui-xs font-semibold uppercase tracking-wide text-text-secondary">
          {label}
        </span>
        <span className="truncate text-body-base font-bold text-text-primary">{value}</span>
        {sub && <span className="truncate text-ui-xs text-text-tertiary">{sub}</span>}
      </div>
    </div>
  )
}

export function VentasPorProvinciaMap({ fechaDesde, fechaHasta }: Props): JSX.Element {
  const [clase, setClase] = useState<ClaseVentasProvincia>('fiscal')
  const { provincias, sinAsignar, isLoading } = useVentasPorProvincia({ fechaDesde, fechaHasta, clase })

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<Map<string, import('leaflet').CircleMarker>>(new Map())

  const ranking = useMemo(
    () => [...provincias].sort((a, b) => b.monto - a.monto),
    [provincias],
  )
  const totalMonto = useMemo(() => provincias.reduce((s, p) => s + p.monto, 0), [provincias])
  const totalFacturas = useMemo(() => provincias.reduce((s, p) => s + p.facturas, 0), [provincias])
  const top = ranking[0] as VentaPorProvincia | undefined
  const montoMax = Math.max(1, ...provincias.map((p) => p.monto))

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [18.85, -70.4],
          zoom: 8,
          scrollWheelZoom: false,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 12,
        }).addTo(mapRef.current)
      }

      const map = mapRef.current
      // Limpia los marcadores de la carga anterior antes de redibujar.
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker) map.removeLayer(layer)
      })
      markersRef.current.clear()

      for (const p of provincias) {
        const centro = PROVINCIA_CENTROIDE[p.provincia]
        if (!centro) continue
        const ratio = p.monto / montoMax
        const radio = RADIO_MIN + ratio * (RADIO_MAX - RADIO_MIN)

        const marker = L.circleMarker(centro, {
          radius: radio,
          fillColor: colorPara(ratio),
          fillOpacity: 0.8,
          color: '#014E93',
          weight: 1.5,
        })
          .bindTooltip(
            `<strong>${p.provincia}</strong><br/>${formatCurrencyCompact(p.monto)} · ${p.facturas} factura${p.facturas === 1 ? '' : 's'}`,
          )
          .addTo(map)

        markersRef.current.set(p.provincia, marker)
      }
    })

    return () => {
      cancelled = true
    }
  }, [provincias, montoMax])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  function irAProvincia(provincia: string): void {
    const marker = markersRef.current.get(provincia)
    const centro = PROVINCIA_CENTROIDE[provincia]
    if (!marker || !centro || !mapRef.current) return
    mapRef.current.flyTo(centro, 10, { duration: 0.6 })
    marker.openTooltip()
  }

  const sinDatos = !isLoading && provincias.length === 0
  const etiquetaClase =
    clase === 'nota'
      ? 'notas de venta'
      : clase === 'todas'
        ? 'facturas y notas de venta (incluye borradores de nota)'
        : 'facturación aceptada'

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Ventas por provincia</CardTitle>
          <CardDescription>
            Dónde están tus clientes con más {etiquetaClase} este período
            {sinAsignar.facturas > 0 && ` · ${sinAsignar.facturas} sin provincia asignada`}
          </CardDescription>
        </div>
        <ToggleGroup
          value={clase}
          onChange={setClase}
          options={[
            { value: 'fiscal', label: 'Fiscales' },
            { value: 'nota', label: 'Notas de venta' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* KPIs — el total que se pedía ver de un vistazo, sin pasar el mouse */}
        <div className="flex flex-wrap gap-3">
          <KpiTile
            icon={<TrendingUp size={18} />}
            label="Total vendido"
            value={formatCurrencyCompact(totalMonto)}
          />
          <KpiTile
            icon={<Receipt size={18} />}
            label="Documentos"
            value={String(totalFacturas)}
            sub={sinAsignar.facturas > 0 ? `+${sinAsignar.facturas} sin provincia` : undefined}
          />
          <KpiTile
            icon={<Trophy size={18} />}
            label="Provincia líder"
            value={top?.provincia ?? '—'}
            sub={top ? formatCurrencyCompact(top.monto) : undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Mapa */}
          <div className="flex flex-col gap-2">
            <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-border-subtle">
              <div ref={containerRef} className="h-full w-full" />
              {(isLoading || sinDatos) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  {isLoading ? (
                    <Spinner size={24} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-6 text-center text-body-sm text-text-secondary">
                      <MapPin size={20} className="text-text-tertiary" />
                      <span>Asigna provincia a tus contactos en el Directorio para ver el mapa de ventas.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Leyenda de la escala */}
            {!sinDatos && (
              <div className="flex items-center gap-2 px-1 text-ui-xs text-text-tertiary">
                <span>Menos</span>
                <div
                  className="h-2 flex-1 rounded-full"
                  style={{ background: `linear-gradient(to right, ${colorPara(0)}, ${colorPara(1)})` }}
                />
                <span>Más ventas</span>
              </div>
            )}
          </div>

          {/* Ranking — la lista escaneable que el mapa solo no da */}
          <div className="flex flex-col gap-1.5 overflow-y-auto lg:max-h-[360px]">
            {ranking.length === 0 && !isLoading ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border-subtle p-6 text-center text-ui-sm text-text-tertiary">
                Sin ventas con provincia asignada este período
              </div>
            ) : (
              ranking.map((p, i) => {
                const pct = Math.max(4, (p.monto / montoMax) * 100)
                return (
                  <button
                    key={p.provincia}
                    type="button"
                    onClick={() => irAProvincia(p.provincia)}
                    className="flex flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand-50/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-ui-sm font-semibold text-text-primary">
                        <span className="text-text-tertiary">{i + 1}.</span> {p.provincia}
                      </span>
                      <span className="shrink-0 text-ui-sm font-bold text-text-primary">
                        {formatCurrency(p.monto)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: colorPara(p.monto / montoMax) }}
                      />
                    </div>
                    <span className="text-ui-xs text-text-tertiary">
                      {p.facturas} documento{p.facturas === 1 ? '' : 's'}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
