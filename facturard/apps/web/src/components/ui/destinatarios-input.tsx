'use client'

import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Máximo de destinatarios por correo. Mismo número que valida el backend. */
export const MAX_DESTINATARIOS = 5

/**
 * Validación de formato deliberadamente simple y alineada con `@IsEmail` del
 * backend para los casos que un humano teclea mal: algo@algo.tld. No intenta
 * ser un parser de RFC 5322 — el backend es el que manda.
 */
export function esEmailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())
}

interface Props {
  value: string[]
  onChange: (destinatarios: string[]) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Entrada de destinatarios en forma de chips.
 *
 * Componente COMPARTIDO: lo usan el envío individual y el envío en lote. Si hay
 * que cambiar el máximo o la validación, se cambia acá y en el DTO del backend
 * — no en dos formularios distintos.
 */
export function DestinatariosInput({ value, onChange, disabled = false, placeholder }: Props): React.JSX.Element {
  const [borrador, setBorrador] = useState('')
  const [error, setError] = useState<string | null>(null)

  const lleno = value.length >= MAX_DESTINATARIOS

  const agregar = (crudo: string): boolean => {
    const email = crudo.trim().toLowerCase()
    if (!email) return false
    if (lleno) {
      setError(`Máximo ${MAX_DESTINATARIOS} destinatarios por correo.`)
      return false
    }
    if (!esEmailValido(email)) {
      setError(`"${email}" no parece un correo válido.`)
      return false
    }
    if (value.includes(email)) {
      setError('Ese correo ya está en la lista.')
      return false
    }
    onChange([...value, email])
    setError(null)
    return true
  }

  const quitar = (email: string) => {
    onChange(value.filter((v) => v !== email))
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter, coma y punto y coma cierran el chip: son los tres separadores que
    // la gente usa al pegar una lista de correos.
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      if (agregar(borrador)) setBorrador('')
      return
    }
    // Backspace con el input vacío borra el último chip (comportamiento estándar).
    if (e.key === 'Backspace' && borrador === '' && value.length > 0) {
      quitar(value[value.length - 1]!)
    }
  }

  // Pegar "a@x.do, b@x.do" agrega los dos de una vez.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const texto = e.clipboardData.getData('text')
    if (!/[,;\s]/.test(texto)) return
    e.preventDefault()
    const restantes = MAX_DESTINATARIOS - value.length
    const nuevos = texto
      .split(/[,;\s]+/)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v && esEmailValido(v) && !value.includes(v))
    const unicos = [...new Set(nuevos)].slice(0, restantes)
    if (unicos.length > 0) {
      onChange([...value, ...unicos])
      setError(null)
    }
    if (unicos.length < nuevos.length) setError(`Sólo caben ${MAX_DESTINATARIOS} destinatarios; el resto no se agregó.`)
  }

  return (
    <div className="flex flex-col gap-[6px]">
      <div
        className={cn(
          'flex min-h-[40px] w-full flex-wrap items-center gap-[6px] rounded-[10px] border bg-[#f8fafc] px-[10px] py-[6px] transition-colors focus-within:border-[#0379d5] focus-within:bg-white',
          error ? 'border-[#fecdca]' : 'border-[#e2e8f0]',
          disabled && 'opacity-60',
        )}
      >
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex max-w-full items-center gap-[6px] rounded-[8px] bg-[rgba(3,121,213,0.08)] px-[8px] py-[4px] text-[12px] leading-[18px] text-[#0262ad]"
          >
            <span className="truncate">{email}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => quitar(email)}
              aria-label={`Quitar ${email}`}
              className="shrink-0 rounded-full text-[#0262ad]/70 transition-colors hover:text-[#0262ad] focus:outline-none disabled:cursor-not-allowed"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={borrador}
          disabled={disabled || lleno}
          onChange={(e) => {
            setBorrador(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          // Escribir un correo y darle a Enviar sin presionar Enter es el error
          // más fácil de cometer: al perder el foco el borrador se convierte en chip.
          onBlur={() => {
            if (agregar(borrador)) setBorrador('')
          }}
          placeholder={
            lleno ? `Máximo ${MAX_DESTINATARIOS} destinatarios` : value.length === 0 ? (placeholder ?? 'correo@cliente.do') : 'Agregar otro…'
          }
          className="h-[26px] min-w-[140px] flex-1 bg-transparent text-[12px] leading-[19px] text-[#333] placeholder:text-[#0A0A0A]/40 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex items-start justify-between gap-[8px]">
        {error ? (
          <span className="flex items-start gap-[6px] text-[11px] leading-[16px] text-[#b42318]">
            <AlertCircle size={12} className="mt-[2px] shrink-0" />
            {error}
          </span>
        ) : (
          <span className="text-[11px] leading-[16px] text-[#64748b]">
            Escribe un correo y presiona Enter. El primero va en “Para”, el resto en copia.
          </span>
        )}
        <span className="shrink-0 text-[11px] leading-[16px] text-[#64748b]">
          {value.length}/{MAX_DESTINATARIOS}
        </span>
      </div>
    </div>
  )
}
