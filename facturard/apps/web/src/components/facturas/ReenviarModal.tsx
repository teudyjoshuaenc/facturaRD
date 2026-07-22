'use client'

import React, { useState } from 'react'
import { X, Mail, Paperclip, AlertCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'

const CANAL_OPTIONS = [
  { value: 'correo' as const, label: 'Correo', icon: Mail },
  {
    value: 'whatsapp' as const,
    label: 'WhatsApp',
    disabled: true,
    title: 'Próximamente',
    icon: (props: { size?: number; className?: string }) => (
      <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-7.6-4.7C4.5 15.3 4 13.4 4 11.5c0-1.9.5-3.8 1.4-5.4L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    )
  }
]

interface ReenviarModalProps {
  isOpen: boolean
  onClose: () => void
  /** Correo del contacto que el backend usará. Sólo informativo: no se envía. */
  destinatario?: string
  title?: string
  onSend: (data: { asunto: string; mensaje: string }) => Promise<void>
}

/**
 * Envío de un comprobante al cliente por correo.
 *
 * El destinatario NO es editable a propósito: lo resuelve el backend desde el
 * contacto del comprobante. Permitir un correo arbitrario dejaría mandar la
 * factura de un cliente a cualquier dirección — un hueco de privacidad sobre
 * datos fiscales. Aquí sólo se MUESTRA a dónde va a salir.
 */
export function ReenviarModal({
  isOpen,
  onClose,
  destinatario = '',
  title = 'Enviar comprobante',
  onSend
}: ReenviarModalProps) {
  const [canal, setCanal] = useState<'correo' | 'whatsapp'>('correo')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [sending, setSending] = useState(false)

  if (!isOpen) return null

  const sinDestinatario = !destinatario.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sinDestinatario) return
    setSending(true)
    try {
      await onSend({ asunto, mensaje })
      onClose()
    } catch {
      // El error ya se le muestra al usuario como toast en el hook de envío;
      // el modal se queda abierto para que pueda reintentar o corregir.
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 select-none animate-fade-in font-sans">
      {/* Modal Container */}
      <div className="bg-white rounded-[24px] w-full max-w-[520px] shadow-xl overflow-hidden flex flex-col border border-[#e2e8f0]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-[24px] py-[20px] border-b border-[#f1f5f9]">
          <h2 className="text-[18px] font-semibold text-[#333] capitalize">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748b] hover:text-[#333] transition-colors focus:outline-none p-1 rounded-full hover:bg-neutral-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-[24px] flex flex-col gap-[20px] text-left">
          
          {/* Canal Selector — WhatsApp visible pero deshabilitado (sin backend aún) */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-semibold text-[#333] leading-[19.5px]">
              Canal <span className="text-[#d92d20]">*</span>
            </label>
            <ToggleGroup
              variant="modal"
              options={CANAL_OPTIONS}
              value={canal}
              onChange={(val) => setCanal(val)}
            />
            <span className="text-[11px] text-[#64748b] leading-[16px]">
              WhatsApp estará disponible próximamente.
            </span>
          </div>

          {/* Destinatario — SOLO LECTURA. Lo resuelve el backend desde el contacto
              del comprobante; mostrarlo evita dirigir una factura a un tercero. */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-semibold text-[#333] leading-[19.5px]">Para</label>
            {sinDestinatario ? (
              <div className="flex items-start gap-[8px] rounded-[10px] border border-[#fecdca] bg-[#fffbfa] px-[16px] py-[10px]">
                <AlertCircle size={14} className="mt-[3px] shrink-0 text-[#d92d20]" />
                <span className="text-[12px] leading-[18px] text-[#b42318]">
                  Este cliente no tiene correo registrado. Agrégalo en Contactos o sincroniza con
                  GoHighLevel para poder enviarle el comprobante.
                </span>
              </div>
            ) : (
              <div className="flex h-[40px] items-center gap-[8px] rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-[16px]">
                <Mail size={14} className="shrink-0 text-[#94a3b8]" />
                <span className="truncate text-[12px] leading-[19px] text-[#333]">{destinatario}</span>
              </div>
            )}
            <span className="text-[11px] leading-[16px] text-[#64748b]">
              Se envía al correo registrado del cliente.
            </span>
          </div>

          {/* Asunto (opcional) */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-semibold text-[#333] leading-[19.5px]">
              Asunto (Opcional)
            </label>
            <input
              type="text"
              maxLength={200}
              placeholder="Si lo dejas vacío se usa el asunto por defecto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              className="h-[40px] w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-[16px] text-[12px] font-normal leading-[19px] text-[#333333] placeholder:text-[#0A0A0A]/50 transition-colors focus:border-[#0379D5] focus:bg-white focus:outline-none focus:ring-0"
            />
          </div>

          {/* Mensaje Textarea */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-semibold text-[#333] leading-[19.5px]">
              Mensaje (Opcional)
            </label>
            <textarea
              placeholder="Escribir mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] px-[16px] py-[10px] text-[12px] text-[#333] placeholder-[#64748b]/50 focus:outline-none focus:border-[#0379d5] transition-colors h-[100px] resize-none"
            />
          </div>

          {/* El PDF va SIEMPRE adjunto: no es opcional, así que no se ofrece como
              checkbox. (Antes había uno de XML firmado que no tenía backend.) */}
          <div className="flex items-center gap-[8px] text-[12px] leading-[18px] text-[#64748b]">
            <Paperclip size={14} className="shrink-0" />
            <span>El PDF del comprobante se adjunta automáticamente.</span>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-[20px] mt-[4px]">
            <span className="text-[11px] text-[#64748b] leading-[18px]">
              El envío no modifica el estado fiscal del comprobante.
            </span>
            <div className="flex gap-[12px]">
              <button
                type="button"
                disabled={sending}
                onClick={onClose}
                className="h-[42px] px-[24px] border border-[#e2e8f0] bg-white text-[#333] hover:bg-neutral-50 rounded-[10px] text-[13px] font-semibold transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={sending || sinDestinatario}
                className="h-[42px] px-[32px] bg-[#0379d5] text-white hover:bg-[#0262ad] rounded-[10px] text-[13px] font-semibold transition-colors cursor-pointer focus:outline-none flex items-center gap-2 justify-center disabled:opacity-50 min-w-[100px]"
              >
                {sending ? <Spinner size={14} className="text-white" /> : 'Enviar'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  )
}
