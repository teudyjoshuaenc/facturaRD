import React from 'react'
import type { JSX, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface Props {
  title: string
  value: string | number
  icon: LucideIcon
  badge?: ReactNode
  subtitle?: string
}

const MetricCard = React.memo(function MetricCard({ title, value, icon: Icon, badge, subtitle }: Props): JSX.Element {
  return (
    <Card className="hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-1.5 p-5 text-left">
      <div className="flex items-center justify-between text-text-secondary w-full">
        <span className="text-ui-sm font-semibold text-text-secondary uppercase tracking-wider">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-50 text-text-secondary">
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <p className={`font-bold text-text-primary tracking-tight ${
          value.toString().length > 12
            ? 'text-h5'
            : value.toString().length > 10
            ? 'text-h4'
            : 'text-h3'
        }`}>
          {value}
        </p>
        {badge}
      </div>
      {subtitle && (
        <span className="text-ui-xs text-text-secondary font-medium mt-0.5">{subtitle}</span>
      )}
    </Card>
  )
})

export { MetricCard }
