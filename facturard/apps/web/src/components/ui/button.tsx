import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const variantStyles = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-neutral-200 disabled:text-neutral-400',
  secondary:
    'border border-neutral-300 bg-white text-text-primary hover:bg-neutral-50 disabled:border-neutral-200 disabled:text-text-disabled',
  ghost: 'text-text-primary hover:bg-neutral-100 disabled:text-text-disabled',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 disabled:bg-neutral-200 disabled:text-neutral-400',
} as const

const sizeStyles = {
  sm: 'h-8 px-3 text-ui-sm',
  md: 'h-10 px-4 text-ui-default',
  lg: 'h-11 px-5 text-body-sm',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles
  size?: keyof typeof sizeStyles
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
