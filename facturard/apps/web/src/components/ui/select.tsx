'use client'

import { useState } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  dropdownClassName?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled = false,
  className,
  triggerClassName,
  dropdownClassName,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedOption = options.find((opt) => opt.value === value)

  const hasHeight = triggerClassName?.includes('h-')
  const hasBorder = triggerClassName?.includes('border')
  const hasBg = triggerClassName?.includes('bg-')
  const hasPx = triggerClassName?.includes('px-') || triggerClassName?.includes('pl-') || triggerClassName?.includes('pr-')
  const hasText = triggerClassName?.includes('text-')
  const hasFont = triggerClassName?.includes('font-')
  const hasRounded = triggerClassName?.includes('rounded-')
  const hasFocus = triggerClassName?.includes('focus:')

  const hasDropdownWidth = dropdownClassName?.includes('w-')
  const hasOuterWidth = className?.includes('w-')

  return (
    <div className={cn("relative", !hasOuterWidth && "w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-2 transition-all select-none text-left",
          !hasRounded && "rounded-[10px]",
          !hasBorder && "border border-[#E2E8F0]",
          !hasBg && "bg-[#F8FAFC]",
          !hasPx && "px-4",
          !hasText && "text-[12px] text-[#333333]",
          !hasFont && "font-sans font-normal",
          !hasHeight && "h-11",
          !hasFocus && "focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && !hasBg && "bg-white",
          isOpen && !hasBorder && "border-brand-500",
          triggerClassName
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronRight size={16} className={cn("text-[#64748B] flex-shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className={cn(
            "absolute left-0 mt-1.5 max-h-[220px] overflow-y-auto rounded-[14px] border border-[#F3F4F6] bg-white shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] z-40 py-0 animate-in fade-in-50 duration-150",
            !hasDropdownWidth && "min-w-full w-max max-w-[320px]",
            dropdownClassName
          )}>
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors focus:bg-[#F0F5FF] focus:outline-none h-[44px] text-[12px] font-semibold text-[#333333] hover:bg-[#F0F5FF]/50 cursor-pointer",
                    isSelected && "bg-[#F0F5FF]"
                  )}
                >
                  <span className="truncate leading-6">{opt.label}</span>
                  {isSelected && (
                    <Check size={16} className="text-[#0379D5] flex-shrink-0 stroke-[2.5]" />
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
