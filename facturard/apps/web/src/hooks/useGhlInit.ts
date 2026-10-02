'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { saveLocationId } from '@/lib/session'
import { reenviarGhlPrefill } from '@/lib/ghl-prefill'
import { useAuth } from '@/lib/context/AuthContext'
import type { TenantInfo } from '@/lib/session'

interface GhlInitResponse {
  token?: string
  tenant?: TenantInfo
  onboarding?: boolean
  locationId?: string
}

interface UseGhlInitResult {
  error: boolean
}

export function useGhlInit(): UseGhlInitResult {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuth()
  const [error, setError] = useState(false)

  useEffect(() => {
    const locationId = searchParams.get('location_id')

    if (!locationId) {
      setError(true)
      return
    }

    saveLocationId(locationId)

    api
      .get<GhlInitResponse>('/ghl/init', { params: { location_id: locationId } })
      .then((res) => {
        const data = res.data

        if (data.onboarding) {
          // Se reenvían los datos de contacto que GHL haya puesto en el enlace
          // (email/phone/address/city) para prellenar el alta.
          const qs = new URLSearchParams({ location_id: locationId })
          reenviarGhlPrefill(searchParams, qs)
          router.replace(`/onboarding?${qs.toString()}`)
          return
        }

        if (data.token && data.tenant) {
          setAuth(data.token, data.tenant)
          router.replace('/dashboard')
          return
        }

        setError(true)
      })
      .catch(() => setError(true))
  }, [searchParams, router, setAuth])

  return { error }
}
