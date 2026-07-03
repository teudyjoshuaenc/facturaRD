import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Props {
  href: string
  iconPath: string
  label: string
  active: boolean
  collapsed: boolean
}

const SidebarLink = React.memo(function SidebarLink({ href, iconPath, label, active, collapsed }: Props) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        'flex items-center rounded-[10px] py-[10px] transition-all duration-200 gap-[10px] h-[44px]',
        collapsed ? 'justify-center px-[12px] w-full' : 'px-[12px] w-full justify-start',
        active
          ? 'bg-[#e6f3fc] text-[#0379D5] font-semibold font-sans'
          : 'text-[#64748B] hover:bg-neutral-100/50 hover:text-[#333333] font-sans',
      )}
    >
      <div
        className="w-[20px] h-[20px] shrink-0"
        style={{
          maskImage: `url(${iconPath})`,
          WebkitMaskImage: `url(${iconPath})`,
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          backgroundColor: 'currentColor',
        }}
      />
      {!collapsed && (
        <span className="font-sans text-[14px] leading-5 truncate">{label}</span>
      )}
    </Link>
  )
})

export { SidebarLink }
