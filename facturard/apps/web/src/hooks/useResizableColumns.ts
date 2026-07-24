'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ResizableColumn {
  /** Identificador estable de la columna (se usa para persistir su ancho). */
  key: string
  /** Ancho inicial en px. */
  width: number
  /** Ancho mínimo en px (default 60). */
  min?: number
}

const DEFAULT_MIN = 60
const PREFIX = 'colw:'

/**
 * Anchos de columna redimensionables por el usuario, persistidos por tabla.
 *
 * Liviano y sin dependencias: arrastrar un tirador en el borde del `<th>` ajusta
 * el ancho; se guarda en localStorage por `storageKey`. Pensado para usarse con
 * `table-fixed` + un `<colgroup>` de `<col style={{ width }}>` (ver `colWidths`).
 *
 * `columns` debe ser estable entre renders (constante de módulo o useMemo); su
 * identidad se usa para recalcular defaults y detectar cambios de esquema.
 */
export function useResizableColumns(storageKey: string, columns: ResizableColumn[]) {
  const defaults = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c.width])) as Record<string, number>,
    [columns],
  )
  const minOf = useCallback(
    (key: string) => columns.find((c) => c.key === key)?.min ?? DEFAULT_MIN,
    [columns],
  )

  // Se arranca SIEMPRE con los defaults (para que el HTML del server y el primer
  // render del cliente coincidan); lo guardado se aplica en un effect.
  const [widths, setWidths] = useState<Record<string, number>>(defaults)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFIX + storageKey)
      if (!raw) return
      const saved = JSON.parse(raw) as Record<string, number>
      setWidths((prev) => {
        const next = { ...prev }
        // Solo claves conocidas: si cambió el esquema de columnas, lo viejo se ignora.
        for (const c of columns) {
          const v = saved[c.key]
          if (typeof v === 'number' && Number.isFinite(v)) next[c.key] = Math.max(minOf(c.key), v)
        }
        return next
      })
    } catch {
      /* localStorage no disponible o JSON corrupto: se usan los defaults */
    }
  }, [storageKey, columns, minOf])

  const persist = useCallback(
    (w: Record<string, number>) => {
      try {
        localStorage.setItem(PREFIX + storageKey, JSON.stringify(w))
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  )

  const startResize = useCallback(
    (key: string, e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = widths[key] ?? defaults[key] ?? 120
      const min = minOf(key)

      const onMove = (ev: PointerEvent) => {
        const w = Math.max(min, Math.round(startW + (ev.clientX - startX)))
        setWidths((prev) => (prev[key] === w ? prev : { ...prev, [key]: w }))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setWidths((prev) => {
          persist(prev)
          return prev
        })
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [widths, defaults, minOf, persist],
  )

  const reset = useCallback(() => {
    setWidths(defaults)
    persist(defaults)
  }, [defaults, persist])

  return { widths, startResize, reset }
}
