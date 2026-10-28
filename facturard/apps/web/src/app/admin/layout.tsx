'use client'

import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Spinner } from '@/components/ui/spinner'
import { cerrarSesionAdmin, sesionAdmin, type AdminSesion } from '@/lib/admin'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin', label: 'Clientes' },
  { href: '/admin/usuarios', label: 'Usuarios', soloAdmin: true },
  { href: '/admin/auditoria', label: 'Auditoría' },
]

/** Panel del equipo DMAIA: sesión propia (no es la de los clientes). */
export default function AdminLayout({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname()
  const router = useRouter()
  const enLogin = pathname === '/admin/login'
  const [admin, setAdmin] = useState<AdminSesion | null | undefined>(undefined)

  useEffect(() => {
    const s = sesionAdmin()
    setAdmin(s)
    if (!s && !enLogin) router.replace('/admin/login')
  }, [enLogin, router, pathname])

  if (enLogin) return <>{children}</>
  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background-canvas">
        <Spinner size={28} />
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-background-canvas">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white px-2 py-1"><Logo /></div>
            <span className="hidden items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-ui-xs font-semibold sm:flex">
              <ShieldCheck size={13} /> Panel DMAIA
            </span>
          </div>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {NAV.filter((n) => !n.soloAdmin || admin.rol === 'ADMIN').map((n) => {
              const activo = n.href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/clientes') : pathname.startsWith(n.href)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-ui-sm font-semibold transition-colors',
                    activo ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {n.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-ui-sm text-white/70 md:inline">{admin.nombre}</span>
            <button
              type="button"
              onClick={() => {
                cerrarSesionAdmin()
                router.replace('/admin/login')
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-ui-sm text-white/80 hover:bg-white/10"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
