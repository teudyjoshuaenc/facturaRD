import type { JSX } from 'react'
import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
        <Receipt size={18} />
      </span>
      <span className="text-h6 font-semibold text-text-primary">
        Factura<span className="text-brand-500">RD</span>
      </span>
    </div>
  )
}
