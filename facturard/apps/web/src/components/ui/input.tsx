import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-ui-sm text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'h-10 rounded-lg border border-neutral-300 bg-white px-4 text-body-sm text-text-primary placeholder:text-text-tertiary',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            'disabled:bg-neutral-50 disabled:text-text-disabled',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error ? (
          <p className="text-ui-xs text-danger-600">{error}</p>
        ) : helperText ? (
          <p className="text-ui-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    )
  },
)
Input.displayName = 'Input'
