'use client'

import type { JSX, ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface ToggleOption<T extends string> {
  value: T
  label: string
  icon?: ComponentType<{ size?: number; className?: string }>
  /** Opción visible pero no seleccionable (p.ej. un canal aún no disponible). */
  disabled?: boolean
  /** Tooltip nativo; útil para explicar por qué está deshabilitada. */
  title?: string
}

interface ToggleGroupProps<T extends string> {
  options: ToggleOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  variant?: 'default' | 'modal'
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  className,
  variant = 'default',
}: ToggleGroupProps<T>): JSX.Element {
  const isModal = variant === 'modal'
  return (
    <div className={cn(
      isModal 
        ? 'inline-flex rounded-[10px] bg-brand-500/[0.05] p-1 w-full h-[47.5px] items-center'
        : 'inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 w-full',
      className
    )}>
      {options.map((opt) => {
        const Icon = opt.icon
        const isSelected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            {...(opt.title ? { title: opt.title } : {})}
            onClick={() => onChange(opt.value)}
            className={cn(
              isModal
                ? 'flex-1 flex items-center justify-center gap-2 rounded-[8px] h-10 text-[13px] font-normal transition-all active:scale-[0.98] duration-150'
                : 'flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-ui-sm font-semibold transition-all active:scale-[0.98] duration-150',
              opt.disabled && 'opacity-40 cursor-not-allowed active:scale-100 pointer-events-none',
              isSelected
                ? isModal
                  ? 'bg-brand-500 text-white shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]'
                  : 'bg-white border border-neutral-200/60 text-brand-500 shadow-sm'
                : isModal
                  ? 'text-[#64748B] hover:text-brand-500'
                  : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {Icon && (
              <Icon
                size={isModal ? 20 : 16}
                className={isSelected ? 'text-white' : 'text-[#64748B]'}
              />
            )}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
