import type { JSX } from 'react'
import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  /** Logo de Dmaia arriba del nombre — solo donde hay espacio vertical de sobra. */
  stacked?: boolean
}

export function Logo({ className, stacked = false }: LogoProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-2', !stacked && 'flex-row items-center', className)}>
      {stacked && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/icons/logo_dmaia_color.png" alt="Dmaia" className="h-7 w-auto object-contain" />
      )}
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Receipt size={18} />
        </span>
        <span className="text-h6 font-semibold text-text-primary">
          Factura <span className="text-brand-500">Dmaia</span>
        </span>
      </div>
    </div>
  )
}
