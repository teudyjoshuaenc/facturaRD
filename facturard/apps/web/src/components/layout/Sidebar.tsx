'use client'

import type { JSX } from 'react'
import { X, LayoutDashboard, FileText, Plus, Settings, Receipt } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { SidebarLink } from './SidebarLink'
import { useUI } from '@/lib/context/UIContext'
import { cn } from '@/lib/utils'
import type { TenantInfo } from '@/lib/session'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/facturas', label: 'Facturas', icon: FileText },
  { href: '/nueva-factura', label: 'Emitir', icon: Plus },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
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
        <div className="flex flex-col gap-6 overflow-y-auto p-4 lg:p-6">
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

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
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

        {/* Tenant info — desktop only */}
        {tenant && (
          <div className="hidden lg:block border-t border-border-subtle p-4">
            <p className="truncate text-ui-default text-text-primary">{tenant.razonSocial}</p>
            <p className="text-ui-sm text-text-secondary">RNC {tenant.rnc}</p>
          </div>
        )}
      </aside>
    </>
  )
}
