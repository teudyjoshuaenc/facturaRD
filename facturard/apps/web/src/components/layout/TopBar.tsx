'use client'

import type { JSX } from 'react'
import { Shield, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  pageTitle: string
  pageSubtitle: string
  certDias: number | null
  onEmitir: () => void
  showEmitir: boolean
}

export function TopBar({
  pageTitle,
  pageSubtitle,
  certDias,
  onEmitir,
  showEmitir,
}: Props): JSX.Element {
  const certOk = certDias !== null && certDias > 30
  const certWarn = certDias !== null && certDias > 0 && certDias <= 30
  const certExp = certDias !== null && certDias <= 0

  return (
    <header className="hidden border-b border-border-subtle bg-white px-6 py-3 md:flex md:items-center md:justify-between">
      {/* Breadcrumb */}
      <div>
        <h1 className="text-h6 text-text-primary">{pageTitle}</h1>
        <p className="text-ui-sm text-text-secondary">{pageSubtitle}</p>
      </div>

      {/* Status chips + CTA */}
      <div className="flex items-center gap-3">
        {/* DGII status */}
        <div className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-background-canvas px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-success-500" />
          <span className="text-ui-sm text-text-primary">DGII</span>
          <span className="text-ui-sm text-success-600">Conectado</span>
        </div>

        {/* Certificate status */}
        {certDias !== null && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5',
              certExp
                ? 'border-danger-200 bg-danger-50'
                : certWarn
                  ? 'border-warning-200 bg-warning-50'
                  : 'border-border-subtle bg-background-canvas',
            )}
          >
            {certExp || certWarn ? (
              <ShieldAlert
                size={14}
                className={certExp ? 'text-danger-500' : 'text-warning-500'}
              />
            ) : (
              <Shield size={14} className="text-success-500" />
            )}
            <span className="text-ui-sm text-text-primary">Certificado</span>
            <span
              className={cn(
                'text-ui-sm',
                certExp
                  ? 'text-danger-600'
                  : certWarn
                    ? 'text-warning-700'
                    : 'text-success-600',
              )}
            >
              {certExp ? 'Vencido' : `${certDias} días`}
            </span>
          </div>
        )}

        {certOk === false && certDias === null && (
          <div className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-background-canvas px-3 py-1.5">
            <ShieldAlert size={14} className="text-text-secondary" />
            <span className="text-ui-sm text-text-secondary">Sin certificado</span>
          </div>
        )}

        {/* Emitir button */}
        {showEmitir && (
          <Button variant="primary" size="sm" onClick={onEmitir}>
            Emitir Factura
          </Button>
        )}
      </div>
    </header>
  )
}
