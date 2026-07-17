'use client'

import { Suspense, type JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ComprobanteForm } from '@/components/nueva-factura/ComprobanteForm'
import { useNuevaFactura } from '@/hooks/useNuevaFactura'
import type { ComprobanteFormData } from '@/hooks/useNuevaFactura'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'

function NuevaFacturaContent(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('id')
  const { createComprobante, updateComprobante } = useNuevaFactura()

  async function handleSubmit(data: ComprobanteFormData): Promise<void> {
    const esNota = data.esFiscal === false

    if (draftId) {
      // 1. Update the draft/nota with the corrected values first
      await updateComprobante(draftId, data)

      if (esNota) {
        toast.success('Nota de venta actualizada exitosamente')
        router.push('/facturas')
      } else if (data.emitirConComprobante === false) {
        toast.success('Borrador actualizado exitosamente')
        router.push('/facturas')
      } else {
        // 2. Transition it to emission pipeline (real send)
        const emitRes = await api.post(`/comprobantes/${draftId}/emitir`)
        const emitData = emitRes.data
        toast.success('Comprobante emitido exitosamente y enviado a la DGII', {
          description: `e-NCF asignado: ${emitData.eNCF}`,
        })
        router.push(`/nueva-factura/exito?id=${emitData.id}&encf=${emitData.eNCF}&total=${emitData.montoTotal}`)
      }
    } else {
      // Create new comprobante
      const res = await createComprobante(data)
      if (esNota) {
        toast.success('Nota de venta creada exitosamente', {
          description: 'Documento interno (no fiscal).',
        })
        router.push('/facturas')
      } else if (data.emitirConComprobante === false) {
        toast.success('Factura creada exitosamente como borrador', {
          description: `Código asignado: ${res.eNCF || 'DRAFT'}`,
        })
        router.push('/facturas')
      } else {
        toast.success('Factura enviada a la DGII, verifica el estado en unos segundos', {
          description: `e-NCF asignado: ${res.eNCF}`,
        })
        router.push(`/nueva-factura/exito?id=${res.id}&encf=${res.eNCF}&total=${res.montoTotal}`)
      }
    }
  }

  return (
    <ComprobanteForm
      onSubmit={handleSubmit}
      onError={(msg) => toast.error('Error al guardar', { description: msg })}
    />
  )
}

export default function NuevaFacturaPage(): JSX.Element {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    }>
      <NuevaFacturaContent />
    </Suspense>
  )
}
