'use client'

import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ComprobanteForm } from '@/components/nueva-factura/ComprobanteForm'
import { useNuevaFactura } from '@/hooks/useNuevaFactura'
import type { ComprobanteFormData } from '@/hooks/useNuevaFactura'

export default function NuevaFacturaPage(): JSX.Element {
  const router = useRouter()
  const { createComprobante } = useNuevaFactura()

  async function handleSubmit(data: ComprobanteFormData): Promise<void> {
    const res = await createComprobante(data)
    if (data.emitirConComprobante === false) {
      toast.success('Factura creada exitosamente como borrador/factura interna', {
        description: `Código asignado: ${res.eNCF}`,
      })
      router.push('/facturas')
    } else {
      toast.success('Factura enviada a la DGII, verifica el estado en unos segundos', {
        description: `e-NCF asignado: ${res.eNCF}`,
      })
      router.push(`/nueva-factura/exito?id=${res.id}&encf=${res.eNCF}&total=${res.montoTotal}`)
    }
  }

  return (
    <ComprobanteForm
      onSubmit={handleSubmit}
      onError={(msg) => toast.error('Error al emitir', { description: msg })}
    />
  )
}
