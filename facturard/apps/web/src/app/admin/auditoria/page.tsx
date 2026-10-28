'use client'

import type { JSX } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/spinner'
import { adminApi, fechaHora, mensajeError } from '@/lib/admin'

interface Entrada {
  id: string
  accion: string
  tenantId: string | null
  detalle: Record<string, unknown>
  ip: string | null
  createdAt: string
  admin: { nombre: string; email: string } | null
}

const ACCIONES: Record<string, string> = {
  ADMIN_LOGIN: 'Entró al panel',
  ADMIN_LOGIN_FALLIDO: 'Intento de acceso fallido',
  ADMIN_2FA_ACTIVADO: 'Activó su 2FA',
  ADMIN_CREADO: 'Creó un usuario del panel',
  ADMIN_ACTUALIZADO: 'Cambió un usuario del panel',
  CLIENTE_ACTUALIZADO: 'Actualizó un cliente',
  CLIENTE_2FA_REINICIADO: 'Reinició el 2FA de un cliente',
  COMPROBANTE_REINTENTADO: 'Reintentó un comprobante',
  DATOS_SENSIBLES_CONSULTADOS: 'Vio datos sensibles de un cliente',
  CERTIFICADO_DESCARGADO: 'Descargó el certificado de un cliente',
}

const SENSIBLES = new Set(['DATOS_SENSIBLES_CONSULTADOS', 'CERTIFICADO_DESCARGADO', 'ADMIN_LOGIN_FALLIDO'])

export default function AdminAuditoriaPage(): JSX.Element {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'auditoria'],
    queryFn: async () => (await adminApi.get<Entrada[]>('/auditoria', { params: { limite: 200 } })).data,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 font-bold text-text-primary">Auditoría</h1>
        <p className="text-body-sm text-text-secondary">Las últimas 200 acciones del equipo en el panel. No se puede editar ni borrar.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-ui-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-ui-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3">Cuándo</th>
              <th className="px-3 py-3">Quién</th>
              <th className="px-3 py-3">Acción</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="py-10 text-center"><Spinner size={22} /></td></tr>}
            {error && <tr><td colSpan={5} className="py-8 text-center text-danger-700">{mensajeError(error)}</td></tr>}
            {data?.map((a) => (
              <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{fechaHora(a.createdAt)}</td>
                <td className="px-3 py-2.5 text-text-primary">{a.admin?.nombre ?? (typeof a.detalle['email'] === 'string' ? a.detalle['email'] : '—')}</td>
                <td className={`px-3 py-2.5 ${SENSIBLES.has(a.accion) ? 'font-semibold text-warning-700' : 'text-text-primary'}`}>{ACCIONES[a.accion] ?? a.accion}</td>
                <td className="px-3 py-2.5">
                  {a.tenantId ? <Link href={`/admin/clientes/${a.tenantId}`} className="text-brand-600 hover:underline">Ver cliente</Link> : <span className="text-text-disabled">—</span>}
                </td>
                <td className="px-3 py-2.5 text-text-secondary">{a.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
