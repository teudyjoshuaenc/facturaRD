'use client'

import type { JSX } from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface ActionButtonProps {
  onClick?: () => void
  disabled?: boolean
  className?: string
  title?: string
}

export function EditActionButton({ onClick, disabled, className, title = 'Editar' }: ActionButtonProps): JSX.Element {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-[44px] w-[44px] p-0 flex items-center justify-center border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] transition-colors',
        className
      )}
      title={title}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0">
        <path
          d="M14.116 4.54133C14.4685 4.18895 14.6665 3.71098 14.6666 3.21257C14.6667 2.71416 14.4687 2.23614 14.1163 1.88367C13.7639 1.53119 13.286 1.33314 12.7876 1.33308C12.2892 1.33302 11.8111 1.53095 11.4587 1.88333L2.56133 10.7827C2.40655 10.937 2.29208 11.127 2.228 11.336L1.34733 14.2373C1.3301 14.295 1.3288 14.3562 1.34357 14.4146C1.35833 14.4729 1.38861 14.5262 1.4312 14.5687C1.47378 14.6112 1.52708 14.6414 1.58544 14.6561C1.6438 14.6707 1.70504 14.6693 1.76267 14.652L4.66467 13.772C4.87345 13.7085 5.06345 13.5947 5.218 13.4407L14.116 4.54133Z"
          stroke="#64748B"
          strokeWidth="1.33"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  )
}

interface RefreshActionButtonProps extends ActionButtonProps {
  isLoading?: boolean
}

export function RefreshActionButton({ onClick, disabled, className, title = 'Refrescar', isLoading }: RefreshActionButtonProps): JSX.Element {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'h-[44px] w-[44px] p-0 flex items-center justify-center border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] transition-colors',
        className
      )}
      title={title}
    >
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
        className={cn('w-4 h-4 shrink-0', isLoading && 'animate-spin')}
      >
        <path d="M2 8C2 6.4087 2.63214 4.88258 3.75736 3.75736C4.88258 2.63214 6.4087 2 8 2C9.67737 2.00631 11.2874 2.66082 12.4933 3.82667L14 5.33333" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2V5.33333H10.6667" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 8C14 9.5913 13.3679 11.1174 12.2426 12.2426C11.1174 13.3679 9.5913 14 8 14C6.32263 13.9937 4.71265 13.3392 3.50667 12.1733L2 10.6667" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.33333 10.6667H2V14" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Button>
  )
}

interface ExportActionButtonProps extends ActionButtonProps {
  label?: string
}

export function ExportActionButton({ onClick, disabled, className, title = 'Exportar', label = 'Exportar' }: ExportActionButtonProps): JSX.Element {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-[44px] w-auto px-[17px] flex items-center justify-start gap-[9px] border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] transition-colors font-sans font-normal text-[14px] leading-[21px]',
        className
      )}
      title={title}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0">
        <path d="M10 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V4.66667L10 1.33333Z" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.33333 1.33333V4C9.33333 4.35362 9.47381 4.69276 9.72386 4.94281C9.97391 5.19286 10.313 5.33333 10.6667 5.33333H13.3333" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 8V12" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10L8 8L10 10" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && <span className="font-normal text-[#64748b] text-[14px] leading-[21px]">{label}</span>}
    </Button>
  )
}

import { RefreshCw, Plus } from 'lucide-react'
import { Spinner } from './spinner'

interface ImportActionButtonProps extends ActionButtonProps {
  isLoading?: boolean
  label?: string
}

export function ImportActionButton({ onClick, disabled, className, title = 'Importar', label = 'Importar', isLoading }: ImportActionButtonProps): JSX.Element {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'h-10 px-4 flex items-center justify-center gap-1.5 border border-neutral-200 hover:bg-neutral-50 text-text-primary transition-colors font-semibold text-[14px]',
        className
      )}
      title={title}
    >
      {isLoading ? (
        <Spinner size={16} className="mr-0.5 text-text-secondary" />
      ) : (
        <RefreshCw size={16} className="text-[#64748b] shrink-0" />
      )}
      <span>{label}</span>
    </Button>
  )
}

interface NewActionButtonProps extends ActionButtonProps {
  label?: string
}

export function NewActionButton({ onClick, disabled, className, title = 'Nuevo', label = 'Nuevo' }: NewActionButtonProps): JSX.Element {
  return (
    <Button
      variant="primary"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-10 px-4 font-semibold text-[14px]',
        className
      )}
      title={title}
    >
      <Plus size={16} className="mr-1.5" />
      <span>{label}</span>
    </Button>
  )
}

