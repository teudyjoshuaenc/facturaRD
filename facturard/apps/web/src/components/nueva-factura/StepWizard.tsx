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
  const n = steps.length
  // Fracción del track recorrida — el track en sí ya está inset a los centros
  // de los círculos extremos, así que esto es simplemente lineal 0..1.
  const progress = n > 1 ? (currentStep - 1) / (n - 1) : 0

  return (
    <div
      className="relative mx-auto grid w-[450px] select-none"
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
    >
      {/* Track — inset exactamente medio ancho de columna en cada lado, así
          arranca y termina en el centro real del primer/último círculo (no en
          un pixel fijo que se desalinea con el layout real). El círculo va
          encima (z-10) y lo tapa por completo: nada "traspasa".
          Fondo sólido/gradiente en vez de border-image: border-image IGNORA
          border-radius en la mayoría de navegadores, así que las puntas
          quedaban cuadradas y se veían asomar por fuera del círculo redondo. */}
      <div
        className="pointer-events-none absolute top-[17px] z-0 h-1.5 rounded-full bg-[#F5F5F5]"
        style={{ left: `calc(50% / ${n})`, right: `calc(50% / ${n})` }}
      />
      <div
        className="pointer-events-none absolute top-[17px] z-0 h-1.5 rounded-full bg-gradient-to-r from-[#0379D5]/45 to-[#0379D5] transition-all duration-500 ease-out"
        style={{
          left: `calc(50% / ${n})`,
          width: `calc((100% - 100% / ${n}) * ${progress})`,
        }}
      />

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
          <div key={step.number} className="relative z-10 flex flex-col items-center gap-2">
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
