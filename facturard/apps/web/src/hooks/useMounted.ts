'use client'

import { useEffect, useState } from 'react'

/**
 * true solo después del commit inicial en cliente. Portales (createPortal a
 * document.body) deben esperar a esto — portalear durante el render de
 * hidratación (aunque se guarde con `typeof document === 'undefined'`) choca
 * con la reconciliación del root de Next y dispara un hydration mismatch.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
