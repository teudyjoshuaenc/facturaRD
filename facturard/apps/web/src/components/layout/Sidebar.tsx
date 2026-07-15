'use client'

import React, { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { X } from 'lucide-react'
import { SidebarLink } from './SidebarLink'
import { useUI } from '@/lib/context/UIContext'
import { cn } from '@/lib/utils'
import type { TenantInfo } from '@/lib/session'

const OPERACION_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', iconPath: '/assets/56c6688862abd07d5527b09c3f035232f217f5f6.svg' },
  { href: '/nueva-factura', label: 'Emitir', iconPath: '/assets/5d63790c3ee381522361e95f58f5a882667714b0.svg' },
  { href: '/facturas', label: 'Facturas', iconPath: '/assets/61733f93d0c8001a74ba5b649600aae8be315442.svg' },
  { href: '/cotizaciones', label: 'Cotizaciones', iconPath: '/assets/7f182d3f3a402971ce7e1081a600cec0405d8cd5.svg', wip: true },
  { href: '/compras', label: 'Recepción y Compras', iconPath: '/assets/f6b535ce78a3cdad16b049e4047ce1d92cd8b6d1.svg', wip: true },
  { href: '/contacto', label: 'Contactos', iconPath: '/assets/0e61680031b0c0958286e2e9ae9f0bc98aed933d.svg' },
  { href: '/producto', label: 'Productos', iconPath: '/assets/0b59873e2e7ffc5e3ea365aa91ffdcad2beda49d.svg' },
] as const

const SISTEMA_ITEMS = [
  { href: '/reportes', label: 'Reportes', iconPath: '/assets/6f267c4ae6c73dc4966f99316120ffac8a1a08f4.svg', wip: true },
  { href: '/empresa', label: 'Empresa', iconPath: '/assets/aea6417e5c12c502b8498862cacbc1c5f8370dc0.svg', wip: true },
  { href: '/usuarios-y-roles', label: 'Usuarios y roles', iconPath: '/assets/2d9e550eb3a7ec6201239db740788d0b9c47c15c.svg', wip: true },
  { href: '/certificado-digital', label: 'Certificado Digital', iconPath: '/assets/13241a49cce1e26dd59c84c1a822c865bb4b5d48.svg', wip: true },
  { href: '/cumplimiento', label: 'Cumplimiento', iconPath: '/assets/b5e2b788c5b6fba6b49f4fe30c0ba26277cad92e.svg', wip: true },
  { href: '/configuracion', label: 'Configuración', iconPath: '/assets/8e23a0d26d3f1ac328a53f7e8d576582527ebaae.svg' },
] as const

interface Props {
  tenant: TenantInfo | null
  activeRoute: string
}

export function Sidebar({ tenant, activeRoute }: Props): JSX.Element {
  const { sidebarOpen, setSidebarOpen } = useUI()
  
  // Collapse preference state persisted in localStorage
  const [collapsed, setCollapsed] = useState(false)

  // Initialize collapse preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed')
      if (saved !== null) {
        setCollapsed(saved === 'true')
      }
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  const showWip = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_WIP_TABS === 'true'
  const visibleOperacionItems = OPERACION_ITEMS.filter((item) => !('wip' in item && item.wip) || showWip)
  const visibleSistemaItems = SISTEMA_ITEMS.filter((item) => !('wip' in item && item.wip) || showWip)

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
          // Base & Styles matching Figma
          'flex flex-shrink-0 flex-col justify-between border-r border-[rgba(10,10,10,0.08)] bg-[#FAFAFA] transition-all duration-300 ease-in-out',
          // Mobile: fixed drawer
          'fixed inset-y-0 left-0 z-50 w-64 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Tablet/Desktop width based on collapse state
          collapsed ? 'md:w-[76px]' : 'md:w-[280px]'
        )}
      >
        {/* Top Header Section (Logo + Chevron Toggle) */}
        <div className={cn(
          "w-full h-[68px] border-b border-[rgba(10,10,10,0.08)] flex items-center shrink-0 select-none transition-all duration-300",
          collapsed ? "justify-center px-0" : "justify-between px-[24px]"
        )}>
          {/* Show Figma Logo when expanded */}
          {!collapsed && (
            <div className="flex-1 truncate pr-2">
              <img
                src="/assets/22b4dc8b6ae6de4c06772d04d2c2aa7596c38f4a.svg"
                alt="Logo"
                className="h-[20px] w-[90px] shrink-0"
              />
            </div>
          )}
          
          {/* Expand / Collapse Button (Visible on desktop) */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden md:flex items-center justify-center w-[25px] h-[25px] rounded-[4px] text-[#0379D5] hover:bg-neutral-100/50 transition-colors shrink-0"
            title={collapsed ? "Expandir" : "Contraer"}
          >
            <div
              className={cn("w-[13.314px] h-[7.669px] transition-transform duration-300", collapsed ? "-rotate-90" : "rotate-90")}
              style={{
                maskImage: `url(/assets/6babd1235a287a264d9763e03f8c474cf33b2d9e.svg)`,
                WebkitMaskImage: `url(/assets/6babd1235a287a264d9763e03f8c474cf33b2d9e.svg)`,
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                backgroundColor: 'currentColor',
              }}
            />
          </button>

          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1 text-[#64748B] hover:bg-neutral-50 md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex flex-col gap-4 overflow-y-auto flex-1 select-none px-[16px] py-[16px]">
          {/* Navigation group: OPERACION */}
          <div className="flex flex-col gap-2 w-full">
            {!collapsed && (
              <span className="px-3 text-[10px] font-bold text-[#667085] tracking-[0.8px] uppercase font-sans">
                Operación
              </span>
            )}
            <nav className="flex flex-col gap-1 w-full">
              {visibleOperacionItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  iconPath={item.iconPath}
                  label={item.label}
                  active={activeRoute === item.href}
                  collapsed={collapsed}
                />
              ))}
            </nav>
          </div>

          {/* Divider line using original SVG image (Only in collapsed mode) */}
          {collapsed && (
            <div
              className="h-[1px] relative shrink-0 w-[29px] mx-auto my-1"
              style={{
                backgroundImage: `url(/assets/5c3514977249558745a380e88c122e2edd077b0b.svg)`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
            />
          )}

          {/* Navigation group: SISTEMA */}
          <div className="flex flex-col gap-2 w-full">
            {!collapsed && (
              <span className="px-3 text-[10px] font-bold text-[#667085] tracking-[0.8px] uppercase font-sans">
                Sistema
              </span>
            )}
            <nav className="flex flex-col gap-1 w-full">
              {visibleSistemaItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  iconPath={item.iconPath}
                  label={item.label}
                  active={activeRoute === item.href}
                  collapsed={collapsed}
                />
              ))}
            </nav>
          </div>
        </div>

        {/* User profile footer */}
        <div className="border-t border-[rgba(10,10,10,0.05)] p-4 flex flex-col items-center justify-center w-full bg-neutral-50/20 shrink-0">
          <div className={cn(
            "flex items-center gap-[12px] rounded-[10px] w-full",
            collapsed ? "justify-center h-[36px]" : "justify-start px-2 py-1 hover:bg-neutral-100/30 transition-colors"
          )}>
            {/* Avatar circular */}
            <div className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full bg-[#B45309] text-white font-medium text-[13px] font-sans">
              SM
            </div>
            
            {/* User details & Chevron dropdown */}
            {!collapsed && (
              <>
                <div className="flex flex-col flex-1 truncate text-left font-sans">
                  <span className="text-[14px] font-semibold text-[#0a0a0a] leading-[21px] truncate">
                    Sarah Mitchell
                  </span>
                  <span className="text-[12px] text-[#737373] leading-[18px] truncate">
                    sarah@acme.com
                  </span>
                </div>
                <div
                  className="w-[16px] h-[16px] shrink-0 text-[#737373]"
                  style={{
                    maskImage: `url(/assets/c5161a09e6e09d4471b7c1397b1d7a5443877463.svg)`,
                    WebkitMaskImage: `url(/assets/c5161a09e6e09d4471b7c1397b1d7a5443877463.svg)`,
                    maskRepeat: 'no-repeat',
                    WebkitMaskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskPosition: 'center',
                    maskSize: 'contain',
                    WebkitMaskSize: 'contain',
                    backgroundColor: 'currentColor',
                  }}
                />
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
