'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'

interface TenantEmpresa {
  id: string
  rnc: string
  razonSocial: string
  nombreComercial?: string | null
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  logoUrl?: string | null
}

const isHttpUrl = (v: string): boolean => /^https?:\/\/.+/i.test(v.trim())
const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

export default function EmpresaPage(): JSX.Element {
  const queryClient = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: () => api.get<TenantEmpresa[]>('/tenants').then((res) => res.data[0]),
  })

  // Estado editable (dirección, teléfono, correo, logo). RNC/razón social NO.
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    if (!tenant) return
    setDireccion(tenant.direccion ?? '')
    setTelefono(tenant.telefono ?? '')
    setEmail(tenant.email ?? '')
    setLogoUrl(tenant.logoUrl ?? '')
  }, [tenant])

  useEffect(() => {
    setLogoError(false)
  }, [logoUrl])

  const emailInvalid = email.trim() !== '' && !isEmail(email)
  const logoInvalid = logoUrl.trim() !== '' && !isHttpUrl(logoUrl)

  const dirty = useMemo(() => {
    if (!tenant) return false
    return (
      direccion !== (tenant.direccion ?? '') ||
      telefono !== (tenant.telefono ?? '') ||
      email !== (tenant.email ?? '') ||
      logoUrl !== (tenant.logoUrl ?? '')
    )
  }, [tenant, direccion, telefono, email, logoUrl])

  const guardar = useMutation({
    mutationFn: () =>
      api
        .patch('/tenants/empresa', {
          direccion: direccion.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          logoUrl: logoUrl.trim(),
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
      toast.success('Datos de la empresa guardados')
    },
    onError: () => toast.error('No se pudieron guardar los datos. Intenta de nuevo.'),
  })

  const puedeGuardar = dirty && !emailInvalid && !logoInvalid && !guardar.isPending

  const nombreMostrar = tenant?.nombreComercial ?? tenant?.razonSocial ?? ''

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
          disabled={!puedeGuardar}
          onClick={() => guardar.mutate()}
          className="h-10 px-4 font-semibold"
        >
          {guardar.isPending ? <Spinner size={16} /> : null}
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
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

        {/* Logo por URL */}
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-5">
          <Input
            id="logoUrl"
            label="Logo de la empresa (por enlace)"
            leftIcon={<ImageIcon size={15} />}
            placeholder="https://tuempresa.do/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            error={logoInvalid ? 'Debe empezar con http:// o https://' : ''}
            helperText="Pega el enlace de tu logo (una imagen pública, ej. la de tu sitio web o redes). Formato .png o .jpg."
          />

          {/* Vista previa del logo */}
          {logoUrl.trim() !== '' && !logoInvalid && (
            <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              {logoError ? (
                <div className="flex items-center gap-2 text-ui-xs font-medium text-orange-700">
                  <AlertTriangle size={15} className="text-orange-500 shrink-0" />
                  No se pudo cargar la imagen. Verifica que el enlace apunte a una imagen pública
                  (.png o .jpg).
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl.trim()}
                    alt="Vista previa del logo"
                    className="h-12 w-auto max-w-[160px] object-contain"
                    onError={() => setLogoError(true)}
                    onLoad={() => setLogoError(false)}
                  />
                  <span className="text-ui-xs font-medium text-green-700">✓ Logo cargado</span>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Card 3: Vista previa de la factura con datos reales */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-text-secondary uppercase">
          Vista previa del comprobante
        </span>
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-6 flex flex-col gap-6">
          {/* Header emisor real */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 bg-neutral-100 rounded-lg flex items-center justify-center text-text-secondary overflow-hidden">
                {logoUrl.trim() !== '' && !logoInvalid && !logoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl.trim()} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Building size={18} />
                )}
              </div>
              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className="text-body-sm font-bold text-text-primary truncate">
                  {nombreMostrar}
                </span>
                <span className="text-[10px] text-text-secondary">RNC {tenant.rnc}</span>
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
