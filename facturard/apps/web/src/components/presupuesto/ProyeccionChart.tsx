'use client'

import { useId, type JSX } from 'react'
import type { FilaProyeccion } from '@/hooks/usePresupuesto'

interface ProyeccionChartProps {
  filas: FilaProyeccion[]
  colchonMonto: number
  saldoHoy: number
}

const fmtK = (v: number): string => {
  const a = Math.abs(v)
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '') + 'M'
  if (a >= 1e3) return Math.round(v / 1e3) + 'k'
  return Math.round(v) + ''
}

const W = 720
const H = 260
const PL = 58
const PR = 12
const PT = 16
const PB = 28

export function ProyeccionChart({ filas, colchonMonto, saldoHoy }: ProyeccionChartProps): JSX.Element {
  const gradientId = useId()
  const w = W - PL - PR
  const h = H - PT - PB

  // saldoHoy entra en el rango del eje Y igual que en el prototipo — si la
  // caja arranca más alta o más baja que cualquier mes proyectado (p.ej.
  // consumo neto negativo), el gráfico no debe recortarla.
  const vals = [...filas.map((f) => f.saldo), saldoHoy, colchonMonto, 0]
  let mn = Math.min(...vals)
  let mx = Math.max(...vals)
  if (mn === mx) mx = mn + 1000
  const pad = (mx - mn) * 0.12
  mn -= pad
  mx += pad

  const x = (i: number) => PL + w * (i / 11)
  const y = (v: number) => PT + h - ((v - mn) / (mx - mn)) * h

  const linePath = filas.map((f, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(f.saldo)}`).join(' ')
  const areaPath = `${linePath} L ${x(11)} ${y(mn)} L ${x(0)} ${y(mn)} Z`

  const gridLevels = Array.from({ length: 5 }, (_, k) => mn + ((mx - mn) * k) / 4)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="min-w-[560px]">
        <defs>
          <linearGradient id={gradientId} x1="0" y1={PT} x2="0" y2={PT + h} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4835EE" stopOpacity="0.24" />
            <stop offset="1" stopColor="#4835EE" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid + etiquetas del eje Y */}
        {gridLevels.map((v, k) => (
          <g key={k}>
            <line x1={PL} y1={y(v)} x2={W - PR} y2={y(v)} stroke="#E5E5E5" strokeWidth={1} opacity={0.7} />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#A3A3A3">{fmtK(v)}</text>
          </g>
        ))}

        {/* Línea de colchón de seguridad */}
        <line x1={PL} y1={y(colchonMonto)} x2={W - PR} y2={y(colchonMonto)} stroke="#F47A3C" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.85} />

        {/* Área bajo la curva */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Línea de saldo proyectado */}
        <path d={linePath} fill="none" stroke="#4835EE" strokeWidth={2.4} strokeLinejoin="round" />

        {/* Puntos + etiquetas de mes */}
        {filas.map((f, i) => {
          const risk = f.saldo < colchonMonto
          return (
            <g key={i}>
              <circle cx={x(i)} cy={y(f.saldo)} r={risk ? 4.5 : 3} fill={risk ? '#F47A3C' : '#4835EE'} />
              {(i % 2 === 0 || i === 11) && (
                <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={10.5} fill="#A3A3A3">{f.mes.slice(0, 3)}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
