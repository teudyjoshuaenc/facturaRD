'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { Check, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RegistroShell } from '@/components/registro/RegistroShell'
import { DosPasosStep } from '@/components/registro/DosPasosStep'
import { OfvStep } from '@/components/registro/OfvStep'
import {
  CONTRIBUYENTE_VACIO,
  REPRESENTANTE_VACIO,
  ContribuyenteForm,
  RepresentanteForm,
  contribuyenteCompleto,
  representanteCompleto,
} from '@/components/registro/DatosForms'
import { CertificadoStep } from '@/components/onboarding/CertificadoStep'
import {
  cargarProvincias,
  guardarSesionTenant,
  registroApi,
  sinVacios,
  type Contribuyente,
  type EstadoRegistro,
  type Provincia,
  type Representante,
  type SesionTenant,
} from '@/lib/registro'
import { clearRegistroToken, getRegistroToken } from '@/lib/session'
import { useAuth } from '@/lib/context/AuthContext'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

type Paso = 'dosPasos' | 'contribuyente' | 'representante' | 'certificado' | 'ofv' | 'resumen'

const PASOS: { id: Paso; label: string }[] = [
  { id: 'dosPasos', label: 'Seguridad' },
  { id: 'contribuyente', label: 'Contribuyente' },
  { id: 'representante', label: 'Representante' },
  { id: 'certificado', label: 'Certificado' },
  { id: 'ofv', label: 'Oficina Virtual' },
  { id: 'resumen', label: 'Confirmar' },
]

function pasoListo(p: Paso, e: EstadoRegistro): boolean {
  switch (p) {
    case 'dosPasos': return e.dosPasosActivo
    case 'contribuyente':
    case 'representante': return e.datosCompletos
    case 'certificado': return e.certificadoCargado
    case 'ofv': return e.ofvCargada
    case 'resumen': return e.completo
  }
}

function primerPendiente(e: EstadoRegistro): Paso {
  return PASOS.find((p) => !pasoListo(p.id, e))?.id ?? 'resumen'
}

export default function ConfigurarRegistroPage(): JSX.Element {
  const router = useRouter()
  const { setAuth } = useAuth()
  const [estado, setEstado] = useState<EstadoRegistro | null>(null)
  const [paso, setPaso] = useState<Paso>('dosPasos')
  const [provincias, setProvincias] = useState<Provincia[]>([])
  const [contribuyente, setContribuyente] = useState<Contribuyente>(CONTRIBUYENTE_VACIO)
  const [representante, setRepresentante] = useState<Representante>(REPRESENTANTE_VACIO)
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [terminado, setTerminado] = useState<SesionTenant | null>(null)

  const refrescar = useCallback(async (moverAlPendiente: boolean) => {
    const r = await registroApi.get<EstadoRegistro>('/estado')
    setEstado(r.data)
    if (moverAlPendiente) setPaso(primerPendiente(r.data))
    return r.data
  }, [])

  useEffect(() => {
    if (!getRegistroToken()) {
      router.replace('/login')
      return
    }
    void refrescar(true)
    cargarProvincias().then(setProvincias).catch(() => setError('No pudimos cargar las provincias.'))
    registroApi
      .get<{ contribuyente: Partial<Contribuyente> | null; representante: Partial<Representante> | null }>('/datos')
      .then((r) => {
        if (r.data.contribuyente) setContribuyente((c) => ({ ...c, ...limpiarNulos(r.data.contribuyente!) }))
        if (r.data.representante) setRepresentante((x) => ({ ...x, ...limpiarNulos(r.data.representante!) }))
      })
      .catch(() => undefined)
  }, [router, refrescar])

  async function guardarDatos(): Promise<void> {
    setError('')
    setGuardando(true)
    try {
      await registroApi.put('/datos', {
        contribuyente: sinVacios(contribuyente),
        representante: sinVacios(representante),
      })
      await refrescar(false)
      setPaso('certificado')
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos guardar los datos.'))
    } finally {
      setGuardando(false)
    }
  }

  async function subirCertificado(): Promise<void> {
    if (!file) return
    setError('')
    setGuardando(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('passphrase', passphrase)
      await registroApi.post('/certificado', fd)
      await refrescar(false)
      setPaso('ofv')
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos validar el certificado.'))
    } finally {
      setGuardando(false)
    }
  }

  async function completar(): Promise<void> {
    setError('')
    setGuardando(true)
    try {
      const r = await registroApi.post<SesionTenant>('/completar')
      guardarSesionTenant(r.data)
      setAuth(r.data.accessToken, r.data.tenant)
      clearRegistroToken()
      setTerminado(r.data)
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos completar el registro.'))
    } finally {
      setGuardando(false)
    }
  }

  if (terminado) {
    return (
      <RegistroShell titulo="¡Tu cuenta está lista!">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-600">
            <PartyPopper size={30} />
          </div>
          <p className="text-body-sm text-text-secondary">
            <strong className="text-text-primary">{terminado.tenant.razonSocial}</strong> quedó registrada en FacturaRD.
            El equipo de DMAIA continúa con la certificación ante la DGII.
          </p>
          <Button className="w-full" onClick={() => router.replace('/dashboard')}>Entrar a FacturaRD</Button>
        </div>
      </RegistroShell>
    )
  }

  if (!estado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background-canvas">
        <Spinner size={28} />
      </main>
    )
  }

  const indice = PASOS.findIndex((p) => p.id === paso)
  const puedeIr = (p: Paso): boolean => {
    if (p === 'dosPasos') return !estado.dosPasosActivo
    if (!estado.dosPasosActivo) return false
    if (p === 'contribuyente' || p === 'representante') return true
    return estado.datosCompletos
  }

  return (
    <RegistroShell
      ancho
      titulo="Registra tu empresa"
      subtitulo={<>Cuenta: <strong className="text-text-primary">{estado.email}</strong></>}
    >
      <ol className="mb-8 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PASOS.map((p, i) => {
          const listo = pasoListo(p.id, estado)
          const actual = p.id === paso
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!puedeIr(p.id) || actual}
                onClick={() => setPaso(p.id)}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-ui-xs font-semibold transition-colors',
                  actual ? 'bg-brand-50 text-brand-700' : listo ? 'text-success-700' : 'text-text-disabled',
                  puedeIr(p.id) && !actual && 'hover:bg-neutral-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-ui-sm',
                    actual ? 'bg-brand-500 text-white' : listo ? 'bg-success-500 text-white' : 'bg-neutral-100',
                  )}
                >
                  {listo && !actual ? <Check size={15} /> : i + 1}
                </span>
                {p.label}
              </button>
            </li>
          )
        })}
      </ol>

      {error && <p className="mb-5 rounded-lg bg-danger-50 px-3 py-2 text-ui-sm text-danger-700">{error}</p>}

      <div key={paso} className="animate-fade-in-up">
        {paso === 'dosPasos' && (
          <DosPasosStep onActivado={() => void refrescar(true)} />
        )}

        {paso === 'contribuyente' && (
          <div className="flex flex-col gap-6">
            <Encabezado titulo="Datos del contribuyente" texto="Como aparecen en la DGII. La razón social se completa sola con tu RNC." />
            <ContribuyenteForm
              valor={contribuyente}
              onChange={setContribuyente}
              provincias={provincias}
              rncBloqueado={Boolean(estado.tenant)}
            />
            <Navegacion
              siguiente="Siguiente"
              onSiguiente={() => setPaso('representante')}
              deshabilitado={!contribuyenteCompleto(contribuyente)}
            />
          </div>
        )}

        {paso === 'representante' && (
          <div className="flex flex-col gap-6">
            <Encabezado titulo="Datos del representante" texto="La persona que actúa ante la DGII como usuario administrador de e-CF." />
            <RepresentanteForm valor={representante} onChange={setRepresentante} provincias={provincias} />
            <Navegacion
              onAtras={() => setPaso('contribuyente')}
              siguiente={guardando ? 'Guardando…' : 'Guardar datos'}
              onSiguiente={guardarDatos}
              deshabilitado={guardando || !representanteCompleto(representante) || !contribuyenteCompleto(contribuyente)}
            />
          </div>
        )}

        {paso === 'certificado' && (
          <div className="flex flex-col gap-4">
            {estado.certificadoCargado && (
              <p className="text-ui-sm text-success-700">
                Ya subiste un certificado.{' '}
                <button type="button" className="font-semibold underline" onClick={() => setPaso('ofv')}>Mantenerlo y seguir</button>
              </p>
            )}
            <CertificadoStep
              file={file}
              passphrase={passphrase}
              onFileChange={setFile}
              onPassphraseChange={setPassphrase}
              onNext={() => void subirCertificado()}
              onBack={() => setPaso('representante')}
            />
            {guardando && <Spinner size={20} />}
          </div>
        )}

        {paso === 'ofv' && (
          <OfvStep
            yaGuardada={estado.ofvCargada}
            onBack={() => setPaso('certificado')}
            onGuardado={() => void refrescar(false).then(() => setPaso('resumen'))}
          />
        )}

        {paso === 'resumen' && (
          <div className="flex flex-col gap-6">
            <Encabezado titulo="Confirma tu registro" texto="Revisa que todo esté listo antes de finalizar." />
            <ul className="flex flex-col gap-2">
              {[
                ['Verificación en dos pasos', estado.dosPasosActivo],
                [`Contribuyente y representante${estado.tenant ? ` · ${estado.tenant.razonSocial} (${estado.tenant.rnc})` : ''}`, estado.datosCompletos],
                ['Certificado digital (.p12)', estado.certificadoCargado],
                ['Acceso a la Oficina Virtual', estado.ofvCargada],
              ].map(([texto, ok]) => (
                <li key={String(texto)} className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-body-sm">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', ok ? 'bg-success-500 text-white' : 'bg-neutral-100 text-text-disabled')}>
                    <Check size={14} />
                  </span>
                  <span className={ok ? 'text-text-primary' : 'text-text-disabled'}>{texto}</span>
                </li>
              ))}
            </ul>
            <Navegacion
              onAtras={() => setPaso('ofv')}
              siguiente={guardando ? 'Finalizando…' : 'Finalizar registro'}
              onSiguiente={completar}
              deshabilitado={guardando || !(estado.dosPasosActivo && estado.datosCompletos && estado.certificadoCargado && estado.ofvCargada)}
            />
          </div>
        )}
      </div>
    </RegistroShell>
  )
}

function Encabezado({ titulo, texto }: { titulo: string; texto: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-h6 text-text-primary">{titulo}</h2>
      <p className="text-body-sm text-text-secondary">{texto}</p>
    </div>
  )
}

function Navegacion({
  onAtras,
  siguiente,
  onSiguiente,
  deshabilitado,
}: {
  onAtras?: () => void
  siguiente: string
  onSiguiente: () => void
  deshabilitado: boolean
}): JSX.Element {
  return (
    <div className={cn('flex gap-3', onAtras ? 'justify-between' : 'justify-end')}>
      {onAtras && <Button variant="secondary" onClick={onAtras}>Atrás</Button>}
      <Button onClick={onSiguiente} disabled={deshabilitado}>{siguiente}</Button>
    </div>
  )
}

function limpiarNulos<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as Partial<T>
}
