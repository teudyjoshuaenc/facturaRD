import React from 'react'
import type { JSX, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Tone = 'brand' | 'success' | 'danger' | 'neutral'

interface Props {
  title: string
  value: string | number
  icon: LucideIcon
  badge?: ReactNode
  subtitle?: string
  tone?: Tone
}

const TONE_STYLES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-600',
  danger: 'bg-danger-50 text-danger-600',
  neutral: 'bg-neutral-100 text-text-secondary',
}

const MetricCard = React.memo(function MetricCard({ title, value, icon: Icon, badge, subtitle, tone = 'neutral' }: Props): JSX.Element {
  const valStr = String(value)
  return (
    <Card className="rounded-[20px] hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-1.5 p-4 sm:p-5 text-left min-w-0 overflow-hidden">
      <div className="flex items-center justify-between text-text-secondary w-full min-w-0">
        <span className="text-ui-xs sm:text-ui-sm font-semibold text-text-secondary uppercase tracking-wider truncate">{title}</span>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', TONE_STYLES[tone])}>
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 mt-1 min-w-0 w-full overflow-hidden">
        <p
          title={valStr}
          className={cn(
            "font-bold text-text-primary tracking-tight truncate min-w-0 max-w-full",
            valStr.length > 14
              ? "text-[16px] sm:text-[18px]"
              : valStr.length > 10
              ? "text-[18px] sm:text-[22px]"
              : "text-[22px] sm:text-[26px]"
          )}
        >
          {value}
        </p>
        {badge}
      </div>
      {subtitle && (
        <span className="text-ui-xs text-text-secondary font-medium mt-0.5 truncate">{subtitle}</span>
      )}
    </Card>
  )
})

export { MetricCard }
