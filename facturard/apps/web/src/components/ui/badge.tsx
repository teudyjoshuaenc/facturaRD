import type { HTMLAttributes, JSX } from 'react'
import { cn } from '@/lib/utils'

const variantStyles = {
  success: 'bg-success-500/10 border-success-500/40 text-success-700',
  warning: 'bg-warning-500/10 border-warning-500/40 text-warning-700',
  danger: 'bg-danger-500/10 border-danger-500/40 text-danger-700',
  info: 'bg-brand-500/10 border-brand-500/40 text-brand-700',
  neutral: 'bg-neutral-100 border-neutral-200 text-text-secondary',
} as const

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-ui-sm font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  )
}
