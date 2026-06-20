import React from 'react'
import type { JSX, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface Props {
  title: string
  value: string | number
  icon: LucideIcon
  badge?: ReactNode
}

const MetricCard = React.memo(function MetricCard({ title, value, icon: Icon, badge }: Props): JSX.Element {
  return (
    <Card>
      <div className="flex items-center gap-2 text-text-secondary">
        <Icon size={18} />
        <span className="text-ui-default">{title}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-display-md text-text-primary">{value}</p>
        {badge}
      </div>
    </Card>
  )
})

export { MetricCard }
