'use client'

import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Check, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { adminApi, fecha, mensajeError, type ListaClientes } from '@/lib/admin'
import { cn } from '@/lib/utils'

const FILTROS = [
  { id: '', label: 'Todos' },
  { id: 'conErrores', label: 'Con errores' },
  { id: 'sinCertificado', label: 'Sin certificado' },
  { id: 'registroIncompleto', label: 'Registro incompleto' },
] as const

const AMBIENTE: Record<string, string> = { TESTECF: 'Pruebas', CERTECF: 'Certificación', ECF: 'Producción' }

function Si({ ok }: { ok: boolean }): JSX.Element {
  return ok ? <Check size={16} className="text-success-600" aria-label="Sí" /> : <X size={16} className="text-neutral-300" aria-label="No" />
}

export default function AdminClientesPage(): JSX.Element {
  const [buscar, setBuscar] = useState('')
  const [consulta, setConsulta] = useState('')
  const [filtro, setFiltro] = useState<string>('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setConsulta(buscar.trim())
      setPagina(1)
    }, 300)
    return () => clearTimeout(t)
  }, [buscar])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'clientes', consulta, filtro, pagina],
    queryFn: async () =>
      (await adminApi.get<ListaClientes>('/clientes', { params: { ...(consulta ? { buscar: consulta } : {}), ...(filtro ? { filtro } : {}), pagina } })).data,
  })

  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 font-bold text-text-primary">Clientes</h1>
        <p className="text-body-sm text-text-secondary">Todas las empresas en FacturaRD, su registro, certificado y comprobantes con problemas.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-96">
          <Input
            id="buscar-cliente"
            placeholder="RNC, razón social o correo"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFiltro(f.id); setPagina(1) }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-ui-sm font-semibold transition-colors',
                filtro === f.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 bg-white text-text-secondary hover:border-neutral-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[920px] text-left text-ui-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-ui-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-3 py-3 font-semibold">Registro</th>
              <th className="px-3 py-3 font-semibold">Certificado</th>
              <th className="px-3 py-3 text-center font-semibold">OFV</th>
              <th className="px-3 py-3 text-center font-semibold">2FA</th>
              <th className="px-3 py-3 text-center font-semibold">CRM</th>
              <th className="px-3 py-3 font-semibold">Problemas</th>
              <th className="px-3 py-3 font-semibold">Estado</th>
              <th className="px-3 py-3 font-semibold">Alta</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="py-14 text-center"><Spinner size={22} /></td></tr>
            )}
            {error && (
              <tr><td colSpan={9} className="py-10 text-center text-danger-700">{mensajeError(error, 'No pudimos cargar los clientes')}</td></tr>
            )}
            {data?.clientes.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-text-secondary">No hay clientes con ese criterio.</td></tr>
            )}
            {data?.clientes.map((c) => {
              const vencido = c.certificadoVence && new Date(c.certificadoVence) < new Date()
              return (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clientes/${c.id}`} className="font-semibold text-text-primary hover:text-brand-600 hover:underline">
                      {c.nombreComercial || c.razonSocial}
                    </Link>
                    <div className="text-ui-xs text-text-secondary">{c.rnc}{c.nombreComercial ? ` · ${c.razonSocial}` : ''}</div>
                  </td>
                  <td className="px-3 py-3">
                    {!c.registro ? (
                      <Badge variant="neutral">Vía CRM</Badge>
                    ) : c.registro.completo ? (
                      <Badge variant="success">Completo</Badge>
                    ) : (
                      <Badge variant="warning">En proceso</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {c.certificadoVence ? (
                      <span className={vencido ? 'font-semibold text-danger-700' : 'text-text-primary'}>
                        {vencido ? 'Venció ' : 'Vence '}{fecha(c.certificadoVence)}
                      </span>
                    ) : (
                      <span className="text-text-disabled">Sin certificado</span>
                    )}
                  </td>
                  <td className="px-3 py-3"><div className="flex justify-center"><Si ok={c.ofv} /></div></td>
                  <td className="px-3 py-3"><div className="flex justify-center"><Si ok={Boolean(c.registro?.dosPasos)} /></div></td>
                  <td className="px-3 py-3"><div className="flex justify-center"><Si ok={c.crm} /></div></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.errores > 0 && <Badge variant="danger">{c.errores} con error</Badge>}
                      {c.rechazados > 0 && <Badge variant="warning">{c.rechazados} rechazados</Badge>}
                      {!c.errores && !c.rechazados && <span className="text-text-disabled">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge variant={c.estado === 'ACTIVO' ? 'success' : 'danger'}>{c.estado === 'ACTIVO' ? 'Activo' : 'Suspendido'}</Badge>
                      {c.ambienteDgii && <span className="text-ui-xs text-text-secondary">{AMBIENTE[c.ambienteDgii]}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{fecha(c.creado)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data && data.total > data.porPagina && (
        <div className="flex items-center justify-between text-ui-sm text-text-secondary">
          <span>{data.total} clientes · página {pagina} de {paginas}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  )
}
