'use client'

import type { JSX } from 'react'

interface Props {
  /** `startResize(key, e)` del hook useResizableColumns, ya ligado a la columna. */
  onStart: (e: React.PointerEvent) => void
}

/**
 * Tirador para redimensionar una columna. Se coloca dentro de un `<th>` con
 * `position: relative`; queda pegado a su borde derecho. Ancho de golpe amplio
 * (fácil de agarrar) con una guía fina visible al pasar el mouse.
 */
export function ColResizer({ onStart }: Props): JSX.Element {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Cambiar ancho de columna"
      onPointerDown={onStart}
      // Que un clic en el tirador no dispare el sort/selección de la cabecera.
      onClick={(e) => e.stopPropagation()}
      className="group absolute right-0 top-0 z-10 flex h-full w-[9px] translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center"
    >
      <span className="h-1/2 w-px bg-transparent transition-colors group-hover:bg-[#0379d5]" />
    </span>
  )
}
