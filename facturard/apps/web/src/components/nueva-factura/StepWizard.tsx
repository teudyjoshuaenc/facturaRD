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
        <div className="w-full h-0 border-[3px] border-[#F5F5F5] rounded-full" />
        {/* Progress Line — gradient light-to-full matching the circles */}
        <div
          className="absolute h-0 border-[3px] transition-all duration-500 ease-out left-0 rounded-full"
          style={{
            width: activeLineWidth,
            borderColor: 'transparent',
            borderImage: 'linear-gradient(90deg, rgba(3,121,213,0.45), #0379D5) 1',
          }}
        />
      </div>

      {steps.map((step) => {
        const isActive = step.number === currentStep
        const isCompleted = step.number < currentStep
        const isHighlighted = isActive || isCompleted
        const canClick = isCompleted && onStepClick

        // Gradient by step: earlier steps get a lighter tint of the brand
        // blue, step 3 (last) always gets the full/solid color.
        const totalSteps = steps.length
        const intensity = totalSteps > 1 ? 0.45 + 0.55 * ((step.number - 1) / (totalSteps - 1)) : 1
        const circleGradient = isHighlighted
          ? `linear-gradient(135deg, rgba(3, 121, 213, ${Math.min(intensity + 0.15, 1)}), rgba(3, 121, 213, ${intensity}))`
          : undefined

        return (
          <div key={step.number} className="relative flex flex-col items-center gap-2 z-10 w-[70px] h-[68px]">
            {/* Step Circle */}
            <button
              type="button"
              onClick={canClick ? () => onStepClick(step.number) : undefined}
              disabled={!canClick}
              style={circleGradient ? { backgroundImage: circleGradient } : undefined}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full relative",
                "transition-[transform,box-shadow] duration-200 ease-out",
                !isHighlighted && "bg-[#F5F5F5]",
                isActive && "ring-4 ring-[#0379D5]/20 shadow-[0_4px_14px_rgba(3,121,213,0.35)]",
                canClick
                  ? "cursor-pointer hover:scale-[1.15] hover:shadow-[0_6px_16px_rgba(3,121,213,0.4)] active:scale-100"
                  : "cursor-default"
              )}
            >
              {isCompleted ? (
                <Check
                  size={18}
                  strokeWidth={3}
                  className="text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                />
              ) : (
                <span className={cn(
                  "text-[16px] leading-[24px] font-sans absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                  isHighlighted ? "text-white font-semibold" : "text-[#A3A3A3] font-normal"
                )}>
                  {step.number}
                </span>
              )}
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
