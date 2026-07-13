import type { JSX } from 'react'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TenantInfo } from '@/lib/session'

interface Props {
  tenant: TenantInfo
  onContinue: () => void
  /** false → tenant sin certificado: podrá cotizar/borradores, no emitir aún. */
  puedeEmitir?: boolean
}

export function SuccessStep({ tenant, onContinue, puedeEmitir = true }: Props): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-500/10">
        <CheckCircle2 className="text-success-500" size={40} />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-h4 text-text-primary">Cuenta creada</h2>
        <p className="text-body-sm text-text-secondary">
          {puedeEmitir
            ? 'Ya puedes emitir tu primera factura.'
            : 'Empieza a cotizar y preparar tus facturas. Cuando quieras enviarlas a la DGII, actívalo en Configuración → Certificación fiscal.'}
        </p>
      </div>

      <div className="w-full rounded-lg border border-border bg-background-canvas p-4 text-left">
        <dl className="flex flex-col gap-2 text-body-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Empresa</dt>
            <dd className="truncate text-text-primary" title={tenant.razonSocial}>{tenant.razonSocial}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">RNC</dt>
            <dd className="text-text-primary">{tenant.rnc}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Plan</dt>
            <dd className="text-text-primary">{tenant.plan}</dd>
          </div>
        </dl>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={onContinue}>
        {puedeEmitir ? 'Emitir mi primera factura' : 'Empezar a facturar'}
        <ArrowRight size={18} />
      </Button>
    </div>
  )
}
