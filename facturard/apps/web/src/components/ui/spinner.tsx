import type { JSX } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, size = 20 }: { className?: string; size?: number }): JSX.Element {
  return <Loader2 size={size} className={cn('animate-spin text-brand-500', className)} />
}
