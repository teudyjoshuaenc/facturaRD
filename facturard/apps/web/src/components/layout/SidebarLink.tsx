import React from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
}

const SidebarLink = React.memo(function SidebarLink({ href, icon: Icon, label, active }: Props) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        'flex items-center rounded-lg py-2.5 text-ui-default transition-colors',
        'gap-3 px-3 md:justify-center md:px-2 md:gap-0 lg:justify-start lg:px-3 lg:gap-3',
        active ? 'bg-brand-50 text-brand-600' : 'text-neutral-500 hover:bg-neutral-50',
      )}
    >
      <Icon size={20} className="shrink-0" />
      <span className="md:hidden lg:block">{label}</span>
    </Link>
  )
})

export { SidebarLink }
