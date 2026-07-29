'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building,
  Mail,
  Phone,
  MapPin,
  ImageIcon,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Upload,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { api, getErrorMessage } from '@/lib/api'
import { etiquetaIdentificacion } from '@/lib/comprobantes'

interface TenantEmpresa {
  id: string
  rnc: string
  razonSocial: string
  nombreComercial?: string | null
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  logoUrl?: string | null
  logoPublicId?: string | null
  logoPreviewUrl?: string | null
}

// Debe coincidir con el backend (CloudinaryService): PNG/JPG/SVG, máx 2 MB.
const LOGO_MIME_PERMITIDOS = ['image/png', 'image/jpeg', 'image/svg+xml']
const LOGO_MAX_BYTES = 2 * 1024 * 1024

const isHttpUrl = (v: string): boolean => /^https?:\/\/.+/i.test(v.trim())
const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

export default function EmpresaPage(): JSX.Element {
  const queryClient = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: () => api.get<TenantEmpresa[]>('/tenants').then((res) => res.data[0]),
  })

  // Estado editable de contacto (dirección, teléfono, correo). RNC/razón social NO.
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')

  // El logo se gestiona aparte del bloque de contacto (subida de archivo o enlace),
  // para que guardar la dirección no pise el logo.
  const managed = Boolean(tenant?.logoPublicId)
  const currentLogo = managed ? tenant?.logoPreviewUrl ?? tenant?.logoUrl ?? '' : tenant?.logoUrl ?? ''

  const [enlace, setEnlace] = useState('') // input de enlace externo (alternativa a subir)
  const [logoError, setLogoError] = useState(false) // la imagen actual no cargó
  const [uploadError, setUploadError] = useState('') // validación/errores de subida
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tenant) return
    setDireccion(tenant.direccion ?? '')
    setTelefono(tenant.telefono ?? '')
    setEmail(tenant.email ?? '')
    // El input de enlace muestra la URL externa actual; vacío si el logo es gestionado.
    setEnlace(tenant.logoPublicId ? '' : tenant.logoUrl ?? '')
  }, [tenant])

  useEffect(() => {
    setLogoError(false)
  }, [currentLogo])

  const emailInvalid = email.trim() !== '' && !isEmail(email)
  const enlaceInvalid = enlace.trim() !== '' && !isHttpUrl(enlace)

  const contactoDirty = useMemo(() => {
    if (!tenant) return false
    return (
      direccion !== (tenant.direccion ?? '') ||
      telefono !== (tenant.telefono ?? '') ||
      email !== (tenant.email ?? '')
    )
  }, [tenant, direccion, telefono, email])

  const guardarContacto = useMutation({
    mutationFn: () =>
      api
        .patch('/tenants/empresa', {
          direccion: direccion.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
      toast.success('Datos de la empresa guardados')
    },
    onError: (err) => toast.error(getErrorMessage(err, 'No se pudieron guardar los datos.')),
  })

  // Subida REAL del archivo (POST multipart /tenants/logo). Axios pone el
  // Content-Type con boundary solo al detectar el FormData.
  const subirLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/tenants/logo', fd).then((r) => r.data)
    },
    onSuccess: () => {
      setUploadError('')
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
      toast.success('Logo actualizado')
    },
    onError: (err) => {
      const msg = getErrorMessage(err, 'No se pudo subir el logo. Intenta de nuevo.')
      setUploadError(msg)
      toast.error(msg)
    },
  })

  const usarEnlace = useMutation({
    mutationFn: () => api.patch('/tenants/empresa', { logoUrl: enlace.trim() }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
      toast.success('Logo actualizado desde el enlace')
    },
    onError: (err) => toast.error(getErrorMessage(err, 'No se pudo guardar el enlace.')),
  })

  const quitarLogo = useMutation({
    mutationFn: () => api.patch('/tenants/empresa', { logoUrl: '' }).then((r) => r.data),
    onSuccess: () => {
      setUploadError('')
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
      toast.success('Logo eliminado')
    },
    onError: (err) => toast.error(getErrorMessage(err, 'No se pudo quitar el logo.')),
  })

  const onPickFile = (): void => fileInputRef.current?.click()

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-seleccionar el mismo archivo
    if (!file) return
    setUploadError('')
    if (!LOGO_MIME_PERMITIDOS.includes(file.type)) {
      setUploadError('Formato no permitido. Sube una imagen PNG, JPG o SVG.')
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setUploadError('El archivo supera el máximo de 2 MB. Sube una imagen más liviana.')
      return
    }
    subirLogo.mutate(file)
  }

  const puedeGuardarContacto = contactoDirty && !emailInvalid && !guardarContacto.isPending
  const nombreMostrar = tenant?.nombreComercial ?? tenant?.razonSocial ?? ''
  const tieneLogo = currentLogo.trim() !== ''
  const busyLogo = subirLogo.isPending || usarEnlace.isPending || quitarLogo.isPending

  if (isLoading || !tenant) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-6 text-left pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Empresa</h2>
          <p className="text-body-sm text-text-secondary">
            Estos datos aparecen en el bloque emisor de tus facturas y cotizaciones.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          disabled={!puedeGuardarContacto}
          onClick={() => guardarContacto.mutate()}
          className="h-10 px-4 font-semibold"
        >
          {guardarContacto.isPending ? <Spinner size={16} /> : null}
          {guardarContacto.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      {/* Card 1: Datos fiscales (DGII, solo lectura) */}
      <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-5">
        <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-body-sm font-bold text-text-primary">Datos fiscales (DGII)</h3>
            <p className="text-ui-xs text-text-secondary leading-normal">
              Vienen del padrón de la DGII y deben coincidir exacto con tu certificado. No son
              editables: cambiarlos haría que la DGII rechace tus e-CF.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadOnlyField label="RNC / Cédula" value={tenant.rnc} />
          <ReadOnlyField label="Razón social" value={tenant.razonSocial} />
          {tenant.nombreComercial ? (
            <ReadOnlyField label="Nombre comercial" value={tenant.nombreComercial} />
          ) : null}
        </div>
      </Card>

      {/* Card 2: Contacto del emisor (editable) */}
      <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-5">
        <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
            <Building size={16} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-body-sm font-bold text-text-primary">Datos de contacto</h3>
            <p className="text-ui-xs text-text-secondary leading-normal">
              Dirección, teléfono y correo del emisor. Son opcionales: puedes completarlos ahora o
              más tarde.
            </p>
          </div>
        </div>

        <Input
          id="direccion"
          label="Dirección fiscal"
          leftIcon={<MapPin size={15} />}
          placeholder="Av. Winston Churchill 123, Piantini, Santo Domingo"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="telefono"
            label="Teléfono"
            leftIcon={<Phone size={15} />}
            placeholder="809-000-0000"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
          <Input
            id="email"
            label="Correo"
            type="email"
            leftIcon={<Mail size={15} />}
            placeholder="facturacion@tuempresa.do"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailInvalid ? 'Correo no válido' : ''}
          />
        </div>
      </Card>

      {/* Card 3: Logo de la empresa (subida de archivo + enlace) */}
      <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-5">
        <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
            <ImageIcon size={16} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-body-sm font-bold text-text-primary">Logo de la empresa</h3>
            <p className="text-ui-xs text-text-secondary leading-normal">
              Aparece en tus facturas y cotizaciones. Sube el archivo (lo optimizamos automáticamente)
              o pega el enlace de una imagen pública.
            </p>
          </div>
        </div>

        {/* Preview del logo actual */}
        <div className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="h-16 w-28 shrink-0 flex items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-white">
            {tieneLogo && !logoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentLogo}
                alt="Logo actual"
                className="h-full w-full object-contain"
                onError={() => setLogoError(true)}
                onLoad={() => setLogoError(false)}
              />
            ) : (
              <ImageIcon size={22} className="text-text-tertiary" />
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            {tieneLogo && !logoError ? (
              <>
                <span className="text-ui-sm font-semibold text-text-primary">
                  {managed ? 'Logo subido' : 'Logo por enlace'}
                </span>
                <button
                  type="button"
                  onClick={() => quitarLogo.mutate()}
                  disabled={busyLogo}
                  className="flex items-center gap-1.5 text-ui-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 w-fit"
                >
                  <Trash2 size={13} /> Quitar logo
                </button>
              </>
            ) : logoError ? (
              <span className="flex items-center gap-1.5 text-ui-xs font-medium text-orange-700">
                <AlertTriangle size={14} className="text-orange-500 shrink-0" />
                No se pudo cargar la imagen del logo.
              </span>
            ) : (
              <span className="text-ui-sm text-text-tertiary italic">Aún no has agregado un logo</span>
            )}
          </div>
        </div>

        {/* Subir archivo */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
            className="hidden"
            onChange={onFileSelected}
          />
          <Button
            variant="secondary"
            size="md"
            disabled={busyLogo}
            onClick={onPickFile}
            className="h-10 w-fit px-4 font-semibold"
          >
            {subirLogo.isPending ? <Spinner size={16} /> : <Upload size={16} />}
            {subirLogo.isPending ? 'Subiendo…' : 'Subir logo'}
          </Button>
          <span className="text-ui-xs text-text-secondary">PNG, JPG o SVG · máximo 2 MB.</span>
          {uploadError ? (
            <span className="flex items-center gap-1.5 text-ui-xs font-medium text-red-600">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              {uploadError}
            </span>
          ) : null}
        </div>

        {/* Alternativa: enlace externo */}
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1">
              <Input
                id="enlace"
                label="O pega un enlace público"
                leftIcon={<LinkIcon size={15} />}
                placeholder="https://tuempresa.do/logo.png"
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
                error={enlaceInvalid ? 'Debe empezar con http:// o https://' : ''}
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              disabled={busyLogo || enlace.trim() === '' || enlaceInvalid}
              onClick={() => usarEnlace.mutate()}
              className="h-10 px-4 font-semibold shrink-0"
            >
              {usarEnlace.isPending ? <Spinner size={16} /> : null}
              Usar enlace
            </Button>
          </div>
        </div>
      </Card>

      {/* Card 4: Vista previa de la factura con datos reales */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-text-secondary uppercase">
          Vista previa del comprobante
        </span>
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-6 flex flex-col gap-6">
          {/* Header emisor real */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 bg-neutral-100 rounded-lg flex items-center justify-center text-text-secondary overflow-hidden">
                {tieneLogo && !logoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentLogo} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Building size={18} />
                )}
              </div>
              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className="text-body-sm font-bold text-text-primary truncate">
                  {nombreMostrar}
                </span>
                <span className="text-[10px] text-text-secondary">{etiquetaIdentificacion(tenant.rnc)} {tenant.rnc}</span>
              </div>
            </div>
            <div className="flex flex-col items-end text-right leading-tight shrink-0">
              <span className="text-[10px] font-bold text-text-secondary uppercase">
                Factura de Crédito Fiscal
              </span>
              <span className="text-ui-sm font-bold text-brand-600 mt-1">E31 · (ejemplo)</span>
            </div>
          </div>

          {/* Emisor / cliente */}
          <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 text-ui-xs leading-relaxed text-text-secondary">
            <div className="flex flex-col gap-0.5 text-left">
              <span className="font-bold text-text-primary uppercase">Emisor</span>
              <span>{direccion.trim() || <span className="text-text-tertiary italic">Sin dirección</span>}</span>
              <span>
                {[telefono.trim(), email.trim()].filter(Boolean).join('  ·  ') || (
                  <span className="text-text-tertiary italic">Sin teléfono/correo</span>
                )}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-left">
              <span className="font-bold text-text-primary uppercase">Cliente</span>
              <span className="text-text-tertiary italic">Ejemplo — datos del comprador</span>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-[10px] text-text-tertiary border-t border-neutral-100 pt-3">
            <Lock size={11} />
            Así se verá el bloque emisor en el PDF. Los productos y el cliente son solo un ejemplo.
          </p>
        </div>
      </div>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <div className="flex items-center gap-1.5">
        <label className="text-ui-sm font-semibold text-text-secondary">{label}</label>
        <Lock size={11} className="text-text-tertiary" />
      </div>
      <div className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 flex items-center text-body-sm text-text-secondary">
        {value}
      </div>
    </div>
  )
}
