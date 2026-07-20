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
    <div className="relative group w-full">
      <Link
        href={href}
        className={cn(
          'flex items-center rounded-[10px] py-[10px] transition-all duration-200 gap-[10px] h-[44px]',
          collapsed ? 'justify-center px-[12px] w-full group-hover:rounded-r-none' : 'px-[12px] w-full justify-start',
          active
            ? 'bg-[#e6f3fc] text-[#0379D5] font-semibold font-sans'
            : 'text-[#64748B] hover:bg-neutral-100 hover:text-[#333333] font-sans',
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

      {/* Sliding text panel on hover for collapsed mode */}
      {collapsed && (
        <div
          className={cn(
            "absolute left-[44px] top-0 h-[44px] flex items-center pr-4 pl-2 z-50 pointer-events-none select-none",
            "rounded-r-[10px] whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
            "opacity-0 max-w-0 -translate-x-3 group-hover:opacity-100 group-hover:max-w-[200px] group-hover:translate-x-0",
            active
              ? "bg-[#e6f3fc] text-[#0379D5] font-semibold"
              : "bg-neutral-100 text-[#333333] font-normal"
          )}
        >
          <span className="font-sans text-[14px] leading-5">{label}</span>
        </div>
      )}
    </div>
  )
})

export { SidebarLink }
