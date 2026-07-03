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
  // Line width calculation based on step: 1 -> 53px, 2 -> 210px, 3 -> 366px
  const activeLineWidth = currentStep === 1 ? '53px' : currentStep === 2 ? '210px' : '366px'

  return (
    <div className="relative flex items-center justify-between w-[450px] h-[68px] mx-auto select-none">
      {/* Step Line Container */}
      <div className="absolute w-[366px] h-4 left-[calc(50%-366px/2)] top-3 flex items-center z-0">
        {/* Base Line */}
        <div className="w-full h-0 border-[3px] border-[#F5F5F5]" />
        {/* Progress Line */}
        <div 
          className="absolute h-0 border-[3px] border-[#0379D5] transition-all duration-300 left-0" 
          style={{ width: activeLineWidth }}
        />
      </div>

      {steps.map((step) => {
        const isActive = step.number === currentStep
        const isCompleted = step.number < currentStep
        const isHighlighted = isActive || isCompleted
        const canClick = isCompleted && onStepClick

        return (
          <div key={step.number} className="relative flex flex-col items-center gap-2 z-10 w-[70px] h-[68px]">
            {/* Step Circle */}
            <button
              type="button"
              onClick={canClick ? () => onStepClick(step.number) : undefined}
              disabled={!canClick}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 relative",
                isHighlighted ? "bg-[#0379D5]" : "bg-[#F5F5F5]",
                canClick ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span className={cn(
                "text-[16px] leading-[24px] font-sans absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                isHighlighted ? "text-white font-semibold" : "text-[#A3A3A3] font-normal"
              )}>
                {step.number}
              </span>
            </button>

            {/* Step Label Text */}
            <span className={cn(
              "text-[13px] leading-[20px] font-sans font-semibold text-center whitespace-nowrap transition-colors mt-0.5",
              isActive ? "text-[#0379D5] font-semibold" : "text-[#94A3B8] font-normal"
            )}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
