import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Props {
  href: string
  iconPath: string
  label: string
  active: boolean
  collapsed: boolean
  onClick?: () => void
}

const SidebarLink = React.memo(function SidebarLink({ href, iconPath, label, active, collapsed, onClick }: Props) {
  return (
    <div className="relative group w-full" onClick={onClick}>
      <Link
        href={href}
        className={cn(
          'flex items-center rounded-[10px] py-[10px] transition-all duration-200 gap-[10px] h-[44px]',
          collapsed ? 'justify-center px-[12px] w-full group-hover:rounded-r-none' : 'px-[12px] w-full justify-start',
          active
            ? 'bg-white text-brand-500 font-semibold font-sans shadow-[0px_1px_3px_rgba(0,0,0,0.15)]'
            : 'text-white hover:bg-white/10 hover:text-white font-sans',
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
          <span className="font-sans text-[14px] leading-5 truncate min-w-0 flex-1">{label}</span>
        )}
      </Link>

      {/* Sliding text panel on hover for collapsed mode */}
      {collapsed && (
        <div
          className={cn(
            "absolute left-[44px] top-0 h-[44px] flex items-center pr-4 pl-2 z-50 pointer-events-none select-none",
            "rounded-r-[10px] whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
            "opacity-0 max-w-0 -translate-x-3 group-hover:opacity-100 group-hover:max-w-[240px] group-hover:translate-x-0",
            active
              ? "bg-white text-brand-500 font-semibold"
              : "bg-brand-600 text-white font-normal"
          )}
        >
          <span className="font-sans text-[14px] leading-5">{label}</span>
        </div>
      )}
    </div>
  )
})

export { SidebarLink }
