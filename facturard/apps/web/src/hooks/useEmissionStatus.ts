'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface CertificadoActivo {
  id: string
  titular: string
  rnc: string
  validoDesde: string
  validoHasta: string
  activo: boolean
}

export interface TenantInfo {
  id: string
  rnc: string
  razonSocial: string
  plan: 'BASICO' | 'PYME' | 'PRO'
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO'
  planActivo: boolean
  trialEndsAt: string | null
}

export function useEmissionStatus() {
  const { data: certificado, isLoading: certLoading } = useQuery({
    queryKey: ['certificado-activo'],
    queryFn: () =>
      api
        .get<CertificadoActivo>('/certificados/active')
        .then((res) => res.data)
        .catch((err) => {
          if (err.response?.status === 404) return null
          throw err
        }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: () =>
      api
        .get<TenantInfo[]>('/tenants')
        .then((res) => res.data[0])
        .catch(() => null),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const isLoading = certLoading || tenantLoading

  let blockingReason: string | null = null
  let isPlanExpired = false
  let hasCertIssue = false

  if (!isLoading) {
    // 1. Check plan status
    if (tenant) {
      if (tenant.estado !== 'ACTIVO') {
        isPlanExpired = true
        blockingReason = 'Su cuenta está suspendida o cancelada.'
      } else if (tenant.trialEndsAt && new Date(tenant.trialEndsAt) < new Date()) {
        isPlanExpired = true
        blockingReason = 'El período de prueba ha terminado. Actualice su plan para continuar emitiendo comprobantes.'
      } else if (!tenant.planActivo) {
        isPlanExpired = true
        blockingReason = 'Plan inactivo. Contacte soporte o actualice su suscripción.'
      }
    }

    // 2. Check certificate status
    if (!blockingReason) {
      if (!certificado) {
        hasCertIssue = true
        blockingReason = 'No hay un certificado digital activo configurado para la empresa.'
      } else {
        const expired = new Date(certificado.validoHasta) < new Date()
        if (expired) {
          hasCertIssue = true
          blockingReason = 'El certificado digital configurado ha expirado.'
        }
      }
    }
  }

  return {
    certificado: certificado ?? null,
    tenant: tenant ?? null,
    isLoading,
    isPlanExpired,
    hasCertIssue,
    blockingReason,
    isEmitEnabled: !blockingReason,
  }
}
