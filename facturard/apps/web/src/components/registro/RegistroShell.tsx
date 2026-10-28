import type { JSX, ReactNode } from 'react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

interface Props {
  titulo: string
  subtitulo?: ReactNode
  ancho?: boolean
  children: ReactNode
}

/** Marco común de las pantallas de registro e inicio de sesión. */
export function RegistroShell({ titulo, subtitulo, ancho = false, children }: Props): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background-canvas px-4 py-10 sm:py-14">
      <div
        className={cn(
          'w-full rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(3,121,213,0.25)] sm:p-8',
          ancho ? 'max-w-3xl' : 'max-w-md',
        )}
      >
        <div className="mb-7">
          <Logo />
        </div>
        <div className="mb-7 flex flex-col gap-1">
          <h1 className="text-h5 font-bold tracking-tight text-text-primary">{titulo}</h1>
          {subtitulo && <p className="text-body-sm text-text-secondary">{subtitulo}</p>}
        </div>
        {children}
      </div>
    </main>
  )
}
