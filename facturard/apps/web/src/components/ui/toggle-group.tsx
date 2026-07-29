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
  variant?: 'default' | 'modal' | 'solid'
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  className,
  variant = 'default',
}: ToggleGroupProps<T>): JSX.Element {
  const isModal = variant === 'modal'
  const isSolid = variant === 'solid'
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))

  return (
    <div
      className={cn(
        isModal
          ? 'inline-flex rounded-[10px] bg-[#0379D5]/[0.05] p-1 w-full h-[47.5px] items-center'
          : isSolid
            ? 'relative inline-flex rounded-[10px] bg-neutral-100 p-1 w-full h-[47.5px] items-center'
            : 'inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 w-full',
        className,
      )}
    >
      {/* Píldora deslizante — un solo elemento animado en vez de recolorear cada botón */}
      {isSolid && (
        <div
          className="pointer-events-none absolute inset-y-1 left-1 rounded-[8px] bg-brand-500 shadow-md shadow-brand-500/25 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `calc((100% - 8px) / ${options.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
          aria-hidden
        />
      )}

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
                : isSolid
                  ? 'relative z-10 flex-1 flex items-center justify-center gap-2 rounded-[8px] h-10 text-[13px] font-semibold transition-colors duration-200 active:scale-[0.98]'
                  : 'flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-ui-sm font-semibold transition-all active:scale-[0.98] duration-150',
              opt.disabled && 'opacity-40 cursor-not-allowed active:scale-100 pointer-events-none',
              isSelected
                ? isModal
                  ? 'bg-white text-[#0379D5] shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]'
                  : isSolid
                    ? 'text-white'
                    : 'bg-white border border-neutral-200/60 text-brand-500 shadow-sm'
                : isModal
                  ? 'text-[#64748B] hover:text-[#0379D5]'
                  : isSolid
                    ? 'text-[#64748B] hover:text-brand-600'
                    : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {Icon && (
              <Icon
                size={isModal || isSolid ? 20 : 16}
                className={cn(
                  'transition-colors duration-200',
                  isSelected ? 'text-white' : isSolid ? 'text-[#64748B]' : 'text-[#64748B]',
                )}
              />
            )}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
