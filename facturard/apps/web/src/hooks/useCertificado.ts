'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'

export interface CertificadoActivo {
  id: string
  titular: string
  rnc: string
  validoDesde: string
  validoHasta: string
  activo: boolean
}

function calcDias(cert: CertificadoActivo | null): number | null {
  if (!cert) return null
  return Math.ceil(
    (new Date(cert.validoHasta).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  )
}

export function useCertificadoStatus() {
  const { data: certificado } = useQuery({
    queryKey: ['certificado-activo'],
    queryFn: () =>
      api
        .get<CertificadoActivo>('/certificados/active')
        .then((res) => res.data)
        .catch(() => null),
    staleTime: 5 * 60 * 1000,
  })

  return { certificado: certificado ?? null, diasParaVencer: calcDias(certificado ?? null) }
}

export function useCertificado() {
  const queryClient = useQueryClient()

  const { data: certificado, isLoading } = useQuery({
    queryKey: ['certificado-activo'],
    queryFn: () =>
      api
        .get<CertificadoActivo>('/certificados/active')
        .then((res) => res.data)
        .catch(() => null),
  })

  const diasParaVencer = calcDias(certificado ?? null)
  const porVencer = diasParaVencer !== null && diasParaVencer <= 30

  const [showForm, setShowForm] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  /** Devuelve true si el certificado quedó guardado. */
  async function handleUpload(): Promise<boolean> {
    if (!file || !passphrase) return false
    setSubmitting(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('passphrase', passphrase)
      await api.post('/certificados/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await queryClient.invalidateQueries({ queryKey: ['certificado-activo'] })
      setShowForm(false)
      setFile(null)
      setPassphrase('')
      toast.success('Certificado cargado correctamente')
      return true
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast.error('Error al subir el certificado', { description: msg })
      return false
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel(): void {
    setShowForm(false)
    setFile(null)
    setPassphrase('')
    setError('')
  }

  return {
    certificado: certificado ?? null,
    isLoading,
    diasParaVencer,
    porVencer,
    showForm,
    setShowForm,
    file,
    setFile,
    passphrase,
    setPassphrase,
    submitting,
    error,
    handleUpload,
    handleCancel,
  }
}
