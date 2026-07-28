'use client'
import { useState } from 'react'
import { useEffect } from 'react'
import type { JSX, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/context/AuthContext'
import { useUI } from '@/lib/context/UIContext'
import { useCertificadoStatus } from '@/hooks/useCertificado'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Resumen de tu operación del mes' },
  '/facturas': { title: 'Facturas', subtitle: 'Historial de comprobantes fiscales electrónicos' },
  '/cotizaciones': { title: 'Cotizaciones', subtitle: 'Presupuestos y cotizaciones de clientes' },
  '/finanzas': { title: 'Finanzas', subtitle: 'Flujo de caja: ingresos, egresos y capital' },
  '/compras': { title: 'Recepción y Compras', subtitle: 'Gastos y comprobantes recibidos de proveedores' },
  '/nueva-factura': {
    title: 'Crear factura',
    subtitle: 'Crea y emite comprobantes fiscales electrónicos',
  },
  '/nueva-factura/exito': {
    title: 'Factura Emitida',
    subtitle: 'El comprobante fiscal electrónico se generó correctamente',
  },
  '/configuracion': {
    title: 'Configuración',
    subtitle: 'Ajustes globales del sistema',
  },
  '/reportes': {
    title: 'Reportes y Métricas',
    subtitle: 'Estadísticas e informes de facturación electrónica',
  },
  '/contacto': {
    title: 'Directorio de Clientes',
    subtitle: 'Gestión de contactos y clientes frecuentes',
  },
  '/producto': {
    title: 'Catálogo de Productos',
    subtitle: 'Gestión de bienes y servicios registrados',
  },
  '/cumplimiento': {
    title: 'Cumplimiento Tributario',
    subtitle: 'Estado de validaciones con la DGII y reportes fiscales',
  },
  '/empresa': {
    title: 'Datos de la Empresa',
    subtitle: 'Información comercial y datos del emisor de facturas',
  },
  '/usuarios-y-roles': {
    title: 'Usuarios y Permisos',
    subtitle: 'Control de accesos y configuración de roles',
  },
  '/certificado-digital': {
    title: 'Certificado Digital',
    subtitle: 'Estado y configuración de tu firma digital para e-NCF',
  },
}

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const { token, tenant, isReady, refreshTenant } = useAuth()
  const { setSidebarOpen } = useUI()
  const { diasParaVencer } = useCertificadoStatus()

  const isProd = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SHOW_WIP_TABS !== 'true'
  const wipRoutes = [
    '/compras',
    '/reportes',
    '/usuarios-y-roles',
    '/certificado-digital',
    '/cumplimiento',
  ]
  const isWipRoute = wipRoutes.includes(pathname)

  useEffect(() => {
    if (isProd && isWipRoute) {
      router.replace('/dashboard')
    }
  }, [isProd, isWipRoute, pathname, router])

  useEffect(() => {
    if (isReady && !token) {
      router.replace('/')
    }
  }, [isReady, token, router])

  useEffect(() => {
    if (isReady && token) {
      refreshTenant()
    }
  }, [isReady, token, refreshTenant])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname, setSidebarOpen])

  if (isProd && isWipRoute) {
    return <></>
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-canvas">
        <Spinner size={32} />
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-canvas">
        <Spinner size={32} />
      </div>
    )
  }

  const meta = PAGE_META[pathname] ?? { title: 'FacturaRD', subtitle: '' }
  let pageSubtitle = meta.subtitle
  if (pathname === '/dashboard' && tenant) {
    pageSubtitle = `${tenant.razonSocial} · RNC ${tenant.rnc}`
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden flex-col bg-background-canvas md:flex-row">
      <MobileHeader onMenuOpen={() => setSidebarOpen(true)} tenant={tenant} />
      <Sidebar tenant={tenant} activeRoute={pathname} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          pageTitle={meta.title}
          pageSubtitle={pageSubtitle}
          certDias={diasParaVencer}
          dgiiConectado={diasParaVencer !== null}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 flex justify-center items-start">
          <div className="w-full max-w-[1400px] lg:min-h-[1012px] lg:h-auto flex flex-col text-left mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
