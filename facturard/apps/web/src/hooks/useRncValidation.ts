'use client'

import { useEffect, useState } from 'react'
import { api, getErrorMessage } from '@/lib/api'

type RncStatus = 'idle' | 'loading' | 'valid' | 'invalid'

interface UseRncValidationResult {
  status: RncStatus
  razonSocial: string
  error: string
}

export function useRncValidation(rnc: string, retryNonce = 0): UseRncValidationResult {
  const [status, setStatus] = useState<RncStatus>('idle')
  const [razonSocial, setRazonSocial] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const trimmed = rnc.trim()
    if (trimmed.length !== 9 && trimmed.length !== 11) {
      setStatus('idle')
      setRazonSocial('')
      setError('')
      return
    }

    let cancelled = false
    setStatus('loading')
    setError('')

    api
      .get<{ razonSocial: string }>(`/tenants/validar-rnc/${trimmed}`)
      .then((res) => {
        if (cancelled) return
        setRazonSocial(res.data.razonSocial)
        setStatus('valid')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(getErrorMessage(err, 'RNC no registrado en la DGII'))
        setStatus('invalid')
      })

    return () => {
      cancelled = true
    }
  }, [rnc, retryNonce])

  return { status, razonSocial, error }
}
