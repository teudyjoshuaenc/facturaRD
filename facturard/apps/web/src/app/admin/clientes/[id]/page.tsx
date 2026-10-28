'use client'

import { use, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Eye, KeyRound, Lock, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { cargarProvincias, type Provincia } from '@/lib/registro'
import {
  adminApi,
  confirmacionAdmin,
  esRequiere2fa,
  fecha,
  fechaHora,
  guardarConfirmacionAdmin,
  mensajeError,
} from '@/lib/admin'

interface Ubicacion {
  provincia: string
  municipio: string
  sector: string
  direccion: string
  telefono: string
  email: string
}

interface Detalle {
  id: string
  rnc: string
  razonSocial: string
  nombreComercial: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO'
  plan: string
  ambienteDgii: 'TESTECF' | 'CERTECF' | 'ECF' | null
  createdAt: string
  ghlConectado: boolean
  perfilFiscal: ({ tipoRegistro: string; tiposComprobante: string[]; actividadEconomica: string } & Pick<Ubicacion, 'provincia' | 'municipio' | 'sector'>) | null
  representante: (Ubicacion & { identificacion: string; pasaporte: string | null; nombreCompleto: string; celular: string | null }) | null
  cuentaRegistro: { email: string; totpActivo: boolean; completadoEn: string | null; bloqueadoHasta: string | null; createdAt: string } | null
  credencialOfv: { updatedAt: string } | null
  certificados: { id: string; titular: string; rnc: string; emitidoPor: string; validoDesde: string; validoHasta: string; activo: boolean }[]
  secuencias: { tipoECF: string; ultimaSecuencia: number; fechaVencimiento: string | null; activo: boolean }[]
  ghlLocations: { locationId: string; createdAt: string }[]
  users: { email: string; nombre: string; role: string; activo: boolean }[]
  comprobantesPorEstado: Record<string, number>
  comprobantesConProblemas: { id: string; eNCF: string | null; tipoECF: string; estado: string; mensajeDGII: string | null; intentos: number; updatedAt: string }[]
  auditoria: { id: string; accion: string; createdAt: string; admin: { nombre: string } | null }[]
}

const AMBIENTES = [
  { value: '', label: 'El del servidor' },
  { value: 'TESTECF', label: 'Pruebas (TesteCF)' },
  { value: 'CERTECF', label: 'Certificación (CerteCF)' },
  { value: 'ECF', label: 'Producción (eCF)' },
]

const ACCIONES: Record<string, string> = {
  CLIENTE_ACTUALIZADO: 'Actualizó el cliente',
  CLIENTE_2FA_REINICIADO: 'Reinició el 2FA del cliente',
  COMPROBANTE_REINTENTADO: 'Reintentó un comprobante',
  DATOS_SENSIBLES_CONSULTADOS: 'Vio los datos sensibles',
  CERTIFICADO_DESCARGADO: 'Descargó el certificado',
}

function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }): JSX.Element {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-body-lg font-semibold text-text-primary">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-ui-xs font-semibold uppercase tracking-wide text-text-secondary">{etiqueta}</dt>
      <dd className="break-words text-ui-default text-text-primary">{valor || <span className="text-text-disabled">—</span>}</dd>
    </div>
  )
}

/** Acceso OFV, clave del certificado y descarga del .p12: siempre con código reciente. */
function DatosSensibles({ id, rnc, hayCertificado, hayOfv }: { id: string; rnc: string; hayCertificado: boolean; hayOfv: boolean }): JSX.Element {
  const [codigo, setCodigo] = useState('')
  const [pidiendo, setPidiendo] = useState<null | 'ver' | 'descargar'>(null)
  const [datos, setDatos] = useState<{ ofv: { usuario: string; clave: string } | null; claveCertificado: string | null } | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function ejecutar(accion: 'ver' | 'descargar'): Promise<void> {
    if (accion === 'ver') {
      setDatos((await adminApi.post(`/clientes/${id}/sensibles`)).data)
      return
    }
    const r = await adminApi.get<Blob>(`/clientes/${id}/certificado`, { responseType: 'blob' })
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${rnc}.p12`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Certificado descargado (quedó registrado en la auditoría)')
  }

  async function pedir(accion: 'ver' | 'descargar'): Promise<void> {
    setError('')
    if (confirmacionAdmin()) {
      try {
        await ejecutar(accion)
        return
      } catch (err) {
        if (!esRequiere2fa(err)) {
          setError(mensajeError(err))
          return
        }
      }
    }
    setPidiendo(accion)
  }

  async function confirmar(): Promise<void> {
    if (!pidiendo) return
    setEnviando(true)
    setError('')
    try {
      const r = await adminApi.post<{ token: string; minutos: number }>('/confirmar', { codigo })
      guardarConfirmacionAdmin(r.data.token, r.data.minutos)
    } catch (err) {
      setError(mensajeError(err, 'No pudimos verificar el código'))
      setEnviando(false)
      return
    }
    // El código ya se aceptó: un fallo aquí no es del código.
    try {
      await ejecutar(pidiendo)
      setPidiendo(null)
      setCodigo('')
    } catch (err) {
      setError(mensajeError(err, 'Código aceptado, pero no pudimos traer los datos'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Seccion titulo="Datos sensibles" accion={<Lock size={18} className="text-text-secondary" />}>
      <p className="mb-4 text-ui-sm text-text-secondary">
        Para ver o descargar estos datos se pide tu código de Google Authenticator. Cada acceso queda en la auditoría.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!hayOfv && !hayCertificado} onClick={() => void pedir('ver')}>
          <Eye size={16} /> Ver acceso OFV y clave del certificado
        </Button>
        <Button variant="secondary" disabled={!hayCertificado} onClick={() => void pedir('descargar')}>
          <Download size={16} /> Descargar .p12
        </Button>
      </div>

      {pidiendo && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="codigo-admin"
              label="Tu código de Google Authenticator"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPidiendo(null)}>Cancelar</Button>
            <Button disabled={enviando || codigo.length !== 6} onClick={() => void confirmar()}>Confirmar</Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-ui-sm text-danger-700">{error}</p>}

      {datos && (
        <dl className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-neutral-50 p-4 sm:grid-cols-3">
          <Dato etiqueta="Usuario OFV" valor={datos.ofv?.usuario ? <code>{datos.ofv.usuario}</code> : null} />
          <Dato etiqueta="Contraseña OFV" valor={datos.ofv?.clave ? <code>{datos.ofv.clave}</code> : null} />
          <Dato etiqueta="Contraseña del .p12" valor={datos.claveCertificado ? <code>{datos.claveCertificado}</code> : null} />
        </dl>
      )}
    </Seccion>
  )
}

export default function AdminClientePage({ params }: { params: Promise<{ id: string }> }): JSX.Element {
  const { id } = use(params)
  const qc = useQueryClient()
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['admin', 'cliente', id],
    queryFn: async () => (await adminApi.get<Detalle>(`/clientes/${id}`)).data,
  })
  const { data: provincias = [] } = useQuery<Provincia[]>({ queryKey: ['catalogo', 'provincias'], queryFn: cargarProvincias, staleTime: Infinity })

  const lugar = (prov?: string, mun?: string): string => {
    const p = provincias.find((x) => x.codigo === prov)
    const m = p?.municipios.find((x) => x.codigo === mun)
    return [m?.nombre, p?.nombre].filter(Boolean).join(', ') || [mun, prov].filter(Boolean).join(' / ')
  }
  const recargar = () => qc.invalidateQueries({ queryKey: ['admin', 'cliente', id] })

  async function accion(fn: () => Promise<unknown>, ok: string): Promise<void> {
    try {
      await fn()
      toast.success(ok)
      await recargar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={26} /></div>
  if (error || !d) return <p className="text-danger-700">{mensajeError(error, 'No encontramos el cliente')}</p>

  const certActivo = d.certificados.find((c) => c.activo)
  const r = d.representante

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin" className="flex w-fit items-center gap-1.5 text-ui-sm font-semibold text-text-secondary hover:text-brand-600">
        <ArrowLeft size={16} /> Clientes
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h5 font-bold text-text-primary">{d.nombreComercial || d.razonSocial}</h1>
            <Badge variant={d.estado === 'ACTIVO' ? 'success' : 'danger'}>{d.estado === 'ACTIVO' ? 'Activo' : 'Suspendido'}</Badge>
          </div>
          <p className="text-ui-sm text-text-secondary">
            {d.razonSocial} · RNC {d.rnc} · cliente desde {fecha(d.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-56 flex-col gap-1">
            <span className="text-ui-xs font-semibold text-text-secondary">Ambiente DGII</span>
            <Select
              value={d.ambienteDgii ?? ''}
              options={AMBIENTES}
              onChange={(v) => void accion(() => adminApi.patch(`/clientes/${id}`, { ambienteDgii: v || null }), 'Ambiente actualizado')}
            />
          </div>
          <Button
            variant={d.estado === 'ACTIVO' ? 'danger' : 'primary'}
            onClick={() =>
              void accion(
                () => adminApi.patch(`/clientes/${id}`, { estado: d.estado === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO' }),
                d.estado === 'ACTIVO' ? 'Cliente suspendido' : 'Cliente reactivado',
              )
            }
          >
            {d.estado === 'ACTIVO' ? 'Suspender' : 'Reactivar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Seccion titulo="Contribuyente">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato etiqueta="Razón social" valor={d.razonSocial} />
            <Dato etiqueta="Nombre comercial" valor={d.nombreComercial} />
            <Dato etiqueta="Actividad económica" valor={d.perfilFiscal?.actividadEconomica} />
            <Dato etiqueta="Comprobantes" valor={d.perfilFiscal?.tiposComprobante.join(', ')} />
            <Dato etiqueta="Teléfono" valor={d.telefono} />
            <Dato etiqueta="Correo" valor={d.email} />
            <Dato etiqueta="Dirección" valor={d.direccion} />
            <Dato etiqueta="Ubicación" valor={d.perfilFiscal ? `${d.perfilFiscal.sector}, ${lugar(d.perfilFiscal.provincia, d.perfilFiscal.municipio)}` : null} />
          </dl>
        </Seccion>

        <Seccion titulo="Representante">
          {r ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Dato etiqueta="Nombre" valor={r.nombreCompleto} />
              <Dato etiqueta="Cédula / RNC" valor={r.identificacion} />
              <Dato etiqueta="Pasaporte" valor={r.pasaporte} />
              <Dato etiqueta="Correo" valor={r.email} />
              <Dato etiqueta="Teléfono" valor={r.telefono} />
              <Dato etiqueta="Celular" valor={r.celular} />
              <Dato etiqueta="Dirección" valor={r.direccion} />
              <Dato etiqueta="Ubicación" valor={`${r.sector}, ${lugar(r.provincia, r.municipio)}`} />
            </dl>
          ) : (
            <p className="text-ui-sm text-text-secondary">Cliente creado desde el CRM: sin datos del representante.</p>
          )}
        </Seccion>

        <Seccion
          titulo="Cuenta y seguridad"
          accion={
            d.cuentaRegistro?.totpActivo ? (
              confirmarReinicio ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setConfirmarReinicio(false)}>Cancelar</Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setConfirmarReinicio(false)
                      void accion(() => adminApi.post(`/clientes/${id}/reiniciar-2fa`), 'El cliente deberá configurar su 2FA de nuevo')
                    }}
                  >
                    Confirmar reinicio
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirmarReinicio(true)}>
                  <KeyRound size={15} /> Reiniciar 2FA
                </Button>
              )
            ) : undefined
          }
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato etiqueta="Correo de la cuenta" valor={d.cuentaRegistro?.email} />
            <Dato
              etiqueta="Registro"
              valor={!d.cuentaRegistro ? 'Vía CRM (sin cuenta)' : d.cuentaRegistro.completadoEn ? `Completo el ${fecha(d.cuentaRegistro.completadoEn)}` : 'En proceso'}
            />
            <Dato etiqueta="Verificación en dos pasos" valor={d.cuentaRegistro?.totpActivo ? 'Activa' : 'Inactiva'} />
            <Dato etiqueta="Acceso OFV" valor={d.credencialOfv ? `Guardado (${fecha(d.credencialOfv.updatedAt)})` : 'No guardado'} />
            <Dato etiqueta="Subcuenta CRM" valor={d.ghlLocations.map((l) => l.locationId).join(', ')} />
            <Dato etiqueta="Contactos GHL" valor={d.ghlConectado ? 'Conectado' : 'No conectado'} />
          </dl>
        </Seccion>

        <DatosSensibles id={id} rnc={d.rnc} hayCertificado={Boolean(certActivo)} hayOfv={Boolean(d.credencialOfv)} />

        <Seccion titulo="Certificado digital">
          {d.certificados.length === 0 ? (
            <p className="text-ui-sm text-text-secondary">Sin certificado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.certificados.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-ui-sm">
                  <span className="font-semibold text-text-primary">{c.titular}</span>
                  <span className="text-text-secondary">{c.emitidoPor} · vence {fecha(c.validoHasta)}</span>
                  <Badge variant={c.activo ? 'success' : 'neutral'}>{c.activo ? 'Activo' : 'Reemplazado'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Secuencias e-NCF">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {d.secuencias.map((s) => (
              <div key={s.tipoECF} className="rounded-xl border border-neutral-200 px-3 py-2">
                <div className="text-ui-xs font-semibold text-text-secondary">{s.tipoECF}</div>
                <div className="text-body-sm font-semibold text-text-primary">{s.ultimaSecuencia}</div>
                <div className="text-ui-xs text-text-secondary">{s.fechaVencimiento ? fecha(s.fechaVencimiento) : 'sin vencimiento'}</div>
              </div>
            ))}
          </div>
        </Seccion>
      </div>

      <Seccion titulo="Comprobantes con problemas">
        <div className="mb-3 flex flex-wrap gap-2 text-ui-xs">
          {Object.entries(d.comprobantesPorEstado).map(([estado, n]) => (
            <span key={estado} className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-text-secondary">{estado}: {n}</span>
          ))}
        </div>
        {d.comprobantesConProblemas.length === 0 ? (
          <p className="text-ui-sm text-text-secondary">Ningún comprobante en ERROR ni RECHAZADO.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-ui-sm">
              <thead className="text-ui-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="py-2 pr-3">e-NCF</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Mensaje</th>
                  <th className="py-2 pr-3">Intentos</th>
                  <th className="py-2 pr-3">Actualizado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {d.comprobantesConProblemas.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100 align-top">
                    <td className="py-2 pr-3 font-semibold text-text-primary">{c.eNCF ?? '—'}</td>
                    <td className="py-2 pr-3"><Badge variant={c.estado === 'ERROR' ? 'danger' : 'warning'}>{c.estado}</Badge></td>
                    <td className="max-w-md py-2 pr-3 text-text-secondary">{c.mensajeDGII ?? '—'}</td>
                    <td className="py-2 pr-3">{c.intentos}</td>
                    <td className="py-2 pr-3 text-text-secondary">{fechaHora(c.updatedAt)}</td>
                    <td className="py-2 text-right">
                      {c.estado === 'ERROR' && (
                        <Button size="sm" variant="secondary" onClick={() => void accion(() => adminApi.post(`/comprobantes/${c.id}/reintentar`), `${c.eNCF} enviado otra vez`)}>
                          <RotateCcw size={14} /> Reintentar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-ui-xs text-text-secondary">
              Los RECHAZADOS por la DGII no se reintentan: el cliente debe emitir un comprobante nuevo.
            </p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Historial del panel">
        {d.auditoria.length === 0 ? (
          <p className="text-ui-sm text-text-secondary">Sin acciones del equipo sobre este cliente.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-ui-sm">
            {d.auditoria.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 text-text-secondary">
                <span className="text-text-primary">{fechaHora(a.createdAt)}</span>
                <span className="font-semibold text-text-primary">{a.admin?.nombre ?? 'Sistema'}</span>
                <span>{ACCIONES[a.accion] ?? a.accion}</span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}
