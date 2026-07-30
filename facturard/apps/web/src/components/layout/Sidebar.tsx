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
  // "Emitir" se retiró del sidebar: la creación se inicia desde el botón
  // "Crear factura" dentro de /facturas (Fase 2).
  { href: '/facturas', label: 'Facturas', iconPath: '/assets/61733f93d0c8001a74ba5b649600aae8be315442.svg' },
  { href: '/cotizaciones', label: 'Cotizaciones', iconPath: '/assets/7f182d3f3a402971ce7e1081a600cec0405d8cd5.svg' },
  { href: '/finanzas', label: 'Finanzas', iconPath: '/assets/finanzas.svg' },
  { href: '/compras', label: 'Recepción y Compras', iconPath: '/assets/f6b535ce78a3cdad16b049e4047ce1d92cd8b6d1.svg', wip: true },
  { href: '/contacto', label: 'Contactos', iconPath: '/assets/0e61680031b0c0958286e2e9ae9f0bc98aed933d.svg' },
  { href: '/producto', label: 'Productos', iconPath: '/assets/0b59873e2e7ffc5e3ea365aa91ffdcad2beda49d.svg' },
] as const

const SISTEMA_ITEMS = [
  { href: '/reportes', label: 'Reportes', iconPath: '/assets/6f267c4ae6c73dc4966f99316120ffac8a1a08f4.svg', wip: true },
  { href: '/empresa', label: 'Empresa', iconPath: '/assets/aea6417e5c12c502b8498862cacbc1c5f8370dc0.svg' },
  { href: '/certificado-digital', label: 'Certificado Digital', iconPath: '/assets/13241a49cce1e26dd59c84c1a822c865bb4b5d48.svg', wip: true },
  { href: '/cumplimiento', label: 'Cumplimiento', iconPath: '/assets/b5e2b788c5b6fba6b49f4fe30c0ba26277cad92e.svg', wip: true },
  { href: '/configuracion', label: 'Configuración', iconPath: '/assets/8e23a0d26d3f1ac328a53f7e8d576582527ebaae.svg' },
] as const

interface Props {
  tenant: TenantInfo | null
  activeRoute: string
}

function isRouteActive(activeRoute: string, itemHref: string): boolean {
  if (itemHref === '/') {
    return activeRoute === '/'
  }
  if (itemHref === '/facturas' && activeRoute === '/nueva-factura') {
    return true
  }
  return activeRoute === itemHref || activeRoute.startsWith(itemHref + '/')
}

export function Sidebar({ tenant, activeRoute }: Props): JSX.Element {
  const { sidebarOpen, setSidebarOpen } = useUI()
  
  // Collapse preference state persisted in localStorage
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Initialize collapse preference and handle window resizing dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (window.innerWidth < 1201) {
        setCollapsed(true)
      } else {
        const saved = localStorage.getItem('sidebar_collapsed')
        setCollapsed(saved === 'true')
      }
    }

    // Run initially
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  const isEffectiveCollapsed = isMobile ? false : collapsed

  const showWip = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_WIP_TABS === 'true'
  // Finanzas siempre visible aunque no esté activado — al entrar sin activar,
  // /finanzas abre directo el wizard de configuración (capital + presupuesto).
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
          'flex flex-shrink-0 flex-col justify-between border-r border-white/10 bg-[linear-gradient(180deg,#0161BE_0%,#014F9B_55%,#013D7C_100%)] transition-all duration-300 ease-in-out',
          // Mobile: fixed drawer
          'fixed inset-y-0 left-0 z-50 w-64 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Tablet/Desktop width based on collapse state
          collapsed ? 'md:w-[76px]' : 'md:w-[250px]'
        )}
      >
        {/* Top Header Section (Logo + Chevron Toggle) */}
        <div className={cn(
          "w-full h-[68px] border-b border-white/10 flex items-center shrink-0 select-none transition-all duration-300",
          isEffectiveCollapsed ? "justify-center px-0" : "justify-between pl-[28px] pr-[12px]"
        )}>
          {/* Show Figma Logo when expanded */}
          {!isEffectiveCollapsed && (
            <div className="flex-1 truncate pr-2">
              <img
                src="/icons/logo_dmaia.png"
                alt="Logo"
                className="h-[26px] w-auto max-w-full shrink-0 object-contain"
              />
            </div>
          )}
          
          {/* Expand / Collapse Button (Visible on desktop) */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden md:flex items-center justify-center w-[25px] h-[25px] rounded-[4px] text-white hover:bg-white/10 transition-colors shrink-0"
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
            className="ml-auto rounded-lg p-1 text-white hover:bg-white/10 md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className={cn(
          "flex flex-col gap-4 flex-1 select-none px-[16px] py-[16px]",
          isEffectiveCollapsed ? "overflow-visible" : "overflow-y-auto"
        )}>
          {/* Navigation group: OPERACION */}
          <div className="flex flex-col gap-2 w-full">
            {!isEffectiveCollapsed && (
              <span className="px-3 text-[10px] font-bold text-white/70 tracking-[0.8px] uppercase font-sans">
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
                  active={isRouteActive(activeRoute, item.href)}
                  collapsed={isEffectiveCollapsed}
                  onClick={() => setSidebarOpen(false)}
                />
              ))}
            </nav>
          </div>

          {/* Divider line using original SVG image (Only in collapsed mode) */}
          {isEffectiveCollapsed && (
            <div
              className="h-[1px] relative shrink-0 w-[29px] mx-auto my-1"
              style={{
                backgroundImage: `url(/assets/5c3514977249558745a380e88c122e2edd077b0b.svg)`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                filter: 'invert(1)',
              }}
            />
          )}

          {/* Navigation group: SISTEMA */}
          <div className="flex flex-col gap-2 w-full">
            {!isEffectiveCollapsed && (
              <span className="px-3 text-[10px] font-bold text-white/70 tracking-[0.8px] uppercase font-sans">
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
                  active={isRouteActive(activeRoute, item.href)}
                  collapsed={isEffectiveCollapsed}
                  onClick={() => setSidebarOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      </aside>
    </>
  )
}
