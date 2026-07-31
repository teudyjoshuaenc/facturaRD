'use client'

import type { JSX } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WizardStep {
  label: string
  number: number
}

interface StepWizardProps {
  steps: WizardStep[]
  currentStep: number
  onStepClick?: (step: number) => void
}

export function StepWizard({ steps, currentStep, onStepClick }: StepWizardProps): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-[450px] select-none items-center">
      {steps.map((step, i) => {
        const isCompleted = step.number < currentStep
        const isActive = step.number === currentStep
        const canClick = isCompleted && onStepClick

        return (
          <div key={step.number} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={canClick ? () => onStepClick(step.number) : undefined}
                disabled={!canClick}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full text-ui-default font-bold transition-all duration-300 motion-reduce:transition-none',
                  isCompleted
                    ? 'bg-gradient-to-br from-success-400 to-success-600 text-white shadow-md shadow-success-500/30'
                    : isActive
                      ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/35 ring-4 ring-brand-100 scale-110'
                      : 'bg-neutral-100 text-text-disabled',
                  canClick ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                {isCompleted ? <Check size={17} /> : step.number}
              </button>
              <span
                className={cn(
                  'text-ui-xs font-semibold whitespace-nowrap',
                  isCompleted || isActive ? 'text-text-primary' : 'text-text-disabled',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2.5 mb-5 h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={cn(
                    'h-full rounded-full bg-success-500 transition-all duration-500 ease-out motion-reduce:transition-none',
                    isCompleted ? 'w-full' : 'w-0',
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
