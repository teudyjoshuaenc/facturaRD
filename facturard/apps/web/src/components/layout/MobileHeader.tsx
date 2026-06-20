'use client'

import type { JSX } from 'react'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import type { TenantInfo } from '@/lib/session'

interface Props {
  onMenuOpen: () => void
  tenant: TenantInfo | null
}

export function MobileHeader({ onMenuOpen, tenant }: Props): JSX.Element {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-white px-4 md:hidden">
      <button
        type="button"
        onClick={onMenuOpen}
        className="rounded-lg p-2 text-text-secondary hover:bg-neutral-50"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>
      <Logo />
      {tenant && (
        <p className="max-w-[120px] truncate text-ui-sm text-text-secondary">
          {tenant.razonSocial}
        </p>
      )}
    </header>
  )
}
