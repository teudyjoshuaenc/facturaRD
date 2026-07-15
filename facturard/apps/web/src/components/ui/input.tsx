import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, id, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex justify-between items-center w-full select-none">
            <label htmlFor={id} className="text-ui-sm font-semibold text-text-secondary">
              {label}
            </label>
            {error && (
              <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">
                {error}
              </span>
            )}
          </div>
        )}
        <div className="relative w-full">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary flex items-center justify-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              'h-10 w-full rounded-lg border border-neutral-300 bg-white text-body-sm text-text-primary placeholder:text-text-tertiary',
              'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
              'disabled:bg-neutral-50 disabled:text-text-disabled',
              leftIcon ? 'pl-10' : 'px-4',
              rightIcon ? 'pr-10' : 'pr-4',
              error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20',
              className,
            )}
            aria-invalid={!!error}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {!label && error ? (
          <p className="text-ui-xs text-danger-600">{error}</p>
        ) : helperText ? (
          <p className="text-ui-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    )
  },
)
Input.displayName = 'Input'
