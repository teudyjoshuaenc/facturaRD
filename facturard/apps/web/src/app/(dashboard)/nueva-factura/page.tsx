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

  async function handleSubmit(data: ComprobanteFormData): Promise<string> {
    const newENCF = await createComprobante(data)
    toast.success('Factura enviada a la DGII, verifica el estado en unos segundos', {
      description: `e-NCF asignado: ${newENCF}`,
    })
    router.push('/facturas')
    return newENCF
  }

  return (
    <ComprobanteForm
      onSubmit={handleSubmit}
      onError={(msg) => toast.error('Error al emitir', { description: msg })}
    />
  )
}
