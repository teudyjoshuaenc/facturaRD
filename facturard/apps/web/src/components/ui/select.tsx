import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-ui-sm text-text-primary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'h-10 rounded-lg border border-neutral-300 bg-white px-4 text-body-sm text-text-primary',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            'disabled:bg-neutral-50 disabled:text-text-disabled',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-ui-xs text-danger-600">{error}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'
