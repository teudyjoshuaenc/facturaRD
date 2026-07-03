'use client'

import { useEffect, useCallback, type JSX, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, subtitle, icon, children, footer, className }: ModalProps): JSX.Element | null {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-[520px] animate-in rounded-[16px] border border-neutral-100 bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]',
          className,
        )}
        role="dialog"
        aria-modal
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] p-[20px_24px] h-[84.5px] select-none">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-[43.5px] w-[43.5px] items-center justify-center rounded-[14px] bg-[#0379D5]/10 text-[#0379D5] flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="flex flex-col gap-0.5 text-left">
              <h2 className="text-[16px] font-semibold text-[#333333] leading-[26px] font-sans">{title}</h2>
              {subtitle && <p className="text-[12px] font-normal text-[#64748B] leading-[18px] font-sans">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] text-[#64748B] transition-colors hover:bg-neutral-100 hover:text-text-primary flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-[20px_24px] flex flex-col gap-[20px]">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] p-[16px_24px] rounded-b-[16px] h-[95px]">
            {footer}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes animate-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-in {
          animation: animate-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
