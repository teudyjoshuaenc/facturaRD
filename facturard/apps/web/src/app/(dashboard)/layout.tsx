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
  '/nueva-factura': {
    title: 'Emitir Factura',
    subtitle: 'Crea y emite comprobantes fiscales electrónicos',
  },
  '/configuracion': {
    title: 'Configuración',
    subtitle: 'Empresa, certificado digital e integraciones',
  },
}

export default function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const { token, tenant, isReady } = useAuth()
  const { setSidebarOpen } = useUI()
  const { diasParaVencer } = useCertificadoStatus()
  const automatizacionActivos = Math.floor(Math.random() * 2);

  useEffect(() => {
    if (isReady && !token) {
      router.replace('/')
    }
  }, [isReady, token, router])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname, setSidebarOpen])

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
    <div className="flex min-h-screen flex-col bg-background-canvas md:flex-row">
      <MobileHeader onMenuOpen={() => setSidebarOpen(true)} tenant={tenant} />
      <Sidebar tenant={tenant} activeRoute={pathname} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          pageTitle={meta.title}
          pageSubtitle={pageSubtitle}
          certDias={diasParaVencer}
          dgiiConectado={true}
          automatizacionActivos={automatizacionActivos > 0 ? automatizacionActivos : undefined}
          notificacionesCount={7}
          showEmitir={pathname !== '/nueva-factura'}
          onEmitir={() => router.push('/nueva-factura')}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
