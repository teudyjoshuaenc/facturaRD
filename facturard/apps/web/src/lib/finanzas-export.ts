import { formatDate } from '@/lib/comprobantes'
import { ORIGEN_LABELS, CATEGORIA_LABELS, type Transaccion } from '@/hooks/useFinanzas'

const BOM = String.fromCharCode(0xfeff) // Excel lee acentos con BOM UTF-8

// Escapa un campo CSV (comillas, comas, saltos, punto y coma).
function esc(v: string): string {
  const s = v ?? ''
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Descarga las transacciones como CSV (se abre directo en Excel). */
export function descargarTransaccionesCsv(rows: Transaccion[], filename: string): void {
  const headers = ['Fecha', 'Tipo', 'Origen', 'Referencia', 'Descripción', 'Categoría', 'Monto (RD$)']
  const lines = rows.map((t) =>
    [
      formatDate(t.fecha),
      t.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso',
      ORIGEN_LABELS[t.origen],
      t.referencia ?? '',
      t.descripcion ?? '',
      t.categoria ? CATEGORIA_LABELS[t.categoria] : '',
      t.monto.toFixed(2),
    ]
      .map((c) => esc(String(c)))
      .join(','),
  )
  const csv = BOM + [headers.map(esc).join(','), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
