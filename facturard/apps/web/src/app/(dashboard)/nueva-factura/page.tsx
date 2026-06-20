'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { ComprobanteForm } from '@/components/nueva-factura/ComprobanteForm'
import { Button } from '@/components/ui/button'
import { useNuevaFactura } from '@/hooks/useNuevaFactura'
import type { ComprobanteFormData } from '@/hooks/useNuevaFactura'

export default function NuevaFacturaPage(): JSX.Element {
  const router = useRouter()
  const { createComprobante } = useNuevaFactura()
  const [eNCF, setENCF] = useState<string | null>(null)

  async function handleSubmit(data: ComprobanteFormData): Promise<string> {
    const newENCF = await createComprobante(data)
    setENCF(newENCF)
    toast.success(`Factura emitida: ${newENCF}`, {
      description: 'El comprobante fue enviado a la DGII correctamente.',
    })
    return newENCF
  }

  if (eNCF) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-500/10">
          <CheckCircle2 className="text-success-500" size={40} />
        </div>
        <div>
          <h1 className="text-h4 text-text-primary">Factura emitida</h1>
          <p className="text-body-sm text-text-secondary">
            Se asignó el siguiente e-NCF y fue enviada a la DGII
          </p>
        </div>
        <p className="text-h3 text-brand-500">{eNCF}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push('/facturas')}>
            Ver facturas
          </Button>
          <Button variant="primary" onClick={() => setENCF(null)}>
            Emitir otra factura
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ComprobanteForm
      onSubmit={handleSubmit}
      onError={(msg) => toast.error('Error al emitir', { description: msg })}
    />
  )
}
