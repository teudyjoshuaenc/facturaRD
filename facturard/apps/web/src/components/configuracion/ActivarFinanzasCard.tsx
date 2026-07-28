'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Wallet, HelpCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PresupuestoOnboardingWizard } from '@/components/presupuesto/PresupuestoOnboardingWizard'
import { useCapital } from '@/hooks/useFinanzas'
import { usePresupuestoConfig } from '@/hooks/usePresupuesto'
import { useAuth } from '@/lib/context/AuthContext'

/**
 * Sección "Activar Finanzas" — el flujo que quedó pendiente para quien saltó
 * la configuración de Finanzas en el onboarding. Reutiliza el mismo wizard
 * (capital + presupuesto) que ya vive ahí y en /finanzas.
 */
export function ActivarFinanzasCard(): JSX.Element {
  const queryClient = useQueryClient()
  const { tenant, refreshTenant } = useAuth()
  const { data: capital } = useCapital()
  const { data: presupuestoConfig } = usePresupuestoConfig()
  const [open, setOpen] = useState(false)

  const habilitado = tenant?.finanzasHabilitado === true

  return (
    <Card id="activar-finanzas" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Finanzas</CardTitle>
        <CardDescription>
          Flujo de caja y presupuesto — capital inicial, ingresos, costos fijos y variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-background-canvas p-4">
          <div className="flex items-center gap-3">
            {habilitado ? (
              <CheckCircle2 size={22} className="shrink-0 text-success-500" />
            ) : (
              <Wallet size={22} className="shrink-0 text-text-tertiary" />
            )}
            <div className="flex flex-col">
              <span className="text-body-base font-medium text-text-primary">
                {habilitado ? 'Finanzas activo' : 'Finanzas no activado'}
              </span>
              <span className="text-ui-sm text-text-secondary">
                {habilitado
                  ? 'El panel de Finanzas está visible en tu menú.'
                  : 'Actívalo para ver tu flujo de caja y proyección en el menú.'}
              </span>
            </div>
          </div>
          <Badge variant={habilitado ? 'success' : 'neutral'}>{habilitado ? 'Activo' : 'Pendiente'}</Badge>
        </div>

        <Button variant={habilitado ? 'secondary' : 'primary'} className="self-start" onClick={() => setOpen(true)}>
          {habilitado ? 'Rehacer preguntas' : 'Activar ahora'}
        </Button>

        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-background-canvas p-4 text-body-sm text-text-secondary">
          <div className="flex items-center gap-2 text-text-primary">
            <HelpCircle size={16} />
            <span className="font-medium">¿Qué es Finanzas?</span>
          </div>
          <p>
            Un tablero de flujo de caja (ingresos/egresos) y proyección de presupuesto, separado de tu
            facturación fiscal. No afecta tus reportes ni tu emisión de e-CF.
          </p>
        </div>

        <PresupuestoOnboardingWizard
          open={open}
          config={presupuestoConfig}
          saldoActual={capital?.monto !== undefined ? Number(capital.monto) : undefined}
          onClose={() => {
            setOpen(false)
            queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
            refreshTenant()
          }}
        />
      </CardContent>
    </Card>
  )
}
