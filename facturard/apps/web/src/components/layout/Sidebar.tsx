'use client'

import type { JSX } from 'react'
import {
  X,
  LayoutDashboard,
  FilePlus,
  FileText,
  BarChart3,
  Users,
  Package,
  ShieldCheck,
  Building,
  UserCheck,
  KeyRound,
  Settings,
  ChevronRight,
  Receipt
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { SidebarLink } from './SidebarLink'
import { useUI } from '@/lib/context/UIContext'
import { cn } from '@/lib/utils'
import type { TenantInfo } from '@/lib/session'

const OPERACION_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/nueva-factura', label: 'Emitir', icon: FilePlus },
  { href: '/facturas', label: 'Facturas', icon: FileText },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/contacto', label: 'Contacto', icon: Users },
  { href: '/producto', label: 'Producto', icon: Package },
  { href: '/cumplimiento', label: 'Cumplimiento', icon: ShieldCheck },
] as const

const SISTEMA_ITEMS = [
  { href: '/empresa', label: 'Empresa', icon: Building },
  { href: '/usuarios-y-roles', label: 'Usuarios y roles', icon: UserCheck },
  { href: '/certificado-digital', label: 'Certificado Digital', icon: KeyRound },
  { href: '/configuracion', label: 'configuración', icon: Settings },
] as const

interface Props {
  tenant: TenantInfo | null
  activeRoute: string
}

export function Sidebar({ tenant, activeRoute }: Props): JSX.Element {
  const { sidebarOpen, setSidebarOpen } = useUI()

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          // Base
          'flex flex-shrink-0 flex-col justify-between border-r border-border-subtle bg-white',
          // Mobile: fixed drawer
          'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Tablet (md): static, icon-only, 64px
          'md:static md:z-auto md:translate-x-0 md:w-16',
          // Desktop (lg): full width, labels visible
          'lg:w-60',
        )}
      >
        <div className="flex flex-col gap-5 overflow-y-auto p-4 lg:p-5 flex-1">
          {/* Logo row */}
          <div className="flex items-center justify-between">
            {/* Full logo on mobile drawer and desktop */}
            <div className="md:hidden lg:block">
              <Logo />
            </div>
            {/* Icon-only logo on tablet */}
            <div className="hidden md:flex lg:hidden items-center justify-center w-full">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
                <Receipt size={18} />
              </span>
            </div>
            {/* Close button — mobile only */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="ml-auto rounded-lg p-1 text-text-secondary hover:bg-neutral-50 md:hidden"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation group: OPERACION */}
          <div className="flex flex-col gap-1.5">
            <span className="hidden lg:block px-3 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              Operación
            </span>
            <nav className="flex flex-col gap-0.5">
              {OPERACION_ITEMS.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={activeRoute === item.href}
                />
              ))}
            </nav>
          </div>

          {/* Navigation group: SISTEMA */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-100">
            <span className="hidden lg:block px-3 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              Sistema
            </span>
            <nav className="flex flex-col gap-0.5">
              {SISTEMA_ITEMS.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={activeRoute === item.href}
                />
              ))}
            </nav>
          </div>
        </div>

        {/* User profile footer - styled matching Figma */}
        <div className="border-t border-border-subtle p-3.5 bg-neutral-50/50">
          <div className="flex items-center gap-3 w-full cursor-pointer hover:bg-neutral-50/80 p-1.5 rounded-lg transition-colors">
            {/* Avatar circular */}
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-700 text-white font-bold text-ui-sm">
              SM
            </div>
            
            {/* User details */}
            <div className="hidden lg:flex flex-col flex-1 truncate text-left">
              <span className="text-body-sm font-semibold text-text-primary truncate">
                Sarah Mitchell
              </span>
              <span className="text-ui-xs text-text-secondary truncate">
                sarah@acme.com
              </span>
            </div>
            
            {/* Chevron selector arrow */}
            <ChevronRight size={16} className="hidden lg:block text-text-secondary flex-shrink-0" />
          </div>
        </div>
      </aside>
    </>
  )
}
