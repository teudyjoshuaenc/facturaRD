import type { JSX, ReactNode } from 'react'

interface Props {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: Props): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 p-12 text-center">
      <p className="text-body-base text-text-secondary">{description}</p>
      {title && <p className="text-ui-default text-text-tertiary">{title}</p>}
      {action}
    </div>
  )
}
