'use client'

import React, { useState, useEffect } from 'react'
import { X, Mail, Phone, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'

const CANAL_OPTIONS = [
  { value: 'correo' as const, label: 'Correo', icon: Mail },
  {
    value: 'whatsapp' as const,
    label: 'WhatsApp',
    icon: (props: any) => (
      <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    )
  }
]

interface ReenviarModalProps {
  isOpen: boolean
  onClose: () => void
  defaultEmail?: string
  onSend: (data: { canal: 'correo' | 'whatsapp'; para: string; mensaje: string; adjuntarPdf: boolean; adjuntarXml: boolean }) => Promise<void>
}

export function ReenviarModal({ isOpen, onClose, defaultEmail = '', onSend }: ReenviarModalProps) {
  const [canal, setCanal] = useState<'correo' | 'whatsapp'>('correo')
  const [para, setPara] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [adjuntarPdf, setAdjuntarPdf] = useState(true)
  const [adjuntarXml, setAdjuntarXml] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (canal === 'correo') {
      setPara(defaultEmail)
    } else {
      setPara('')
    }
  }, [canal, defaultEmail, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!para.trim()) return
    setSending(true)
    try {
      await onSend({ canal, para, mensaje, adjuntarPdf, adjuntarXml })
      onClose()
    } catch (err) {
      console.error(err)
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
          <h2 className="text-[18px] font-semibold text-[#333]">Reenviar comprobante</h2>
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
          
          {/* Canal Selector */}
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
          </div>

          {/* Para Input */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-semibold text-[#333] leading-[19.5px]">
              Para <span className="text-[#d92d20]">*</span>
            </label>
            <input
              type={canal === 'correo' ? 'email' : 'tel'}
              required
              placeholder={canal === 'correo' ? 'Facturacion@martinez.com' : 'Escribir número de teléfono (ej. 8295551234)'}
              value={para}
              onChange={(e) => setPara(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-[10px] px-[16px] py-[10px] text-[12px] text-[#333] placeholder-[#64748b]/50 focus:outline-none focus:border-[#0379d5] transition-colors"
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

          {/* Checkboxes */}
          <div className="flex flex-col gap-[12px]">
            {/* PDF checkbox */}
            <label className="flex items-center gap-[10px] text-[13px] text-[#333] font-normal cursor-pointer">
              <input
                type="checkbox"
                checked={adjuntarPdf}
                onChange={(e) => setAdjuntarPdf(e.target.checked)}
                className="w-[18px] h-[18px] rounded border-[#d0d5dd] text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
              />
              <span>Adjuntar PDF</span>
            </label>

            {/* XML checkbox */}
            <label className="flex items-center gap-[10px] text-[13px] text-[#333] font-normal cursor-pointer">
              <input
                type="checkbox"
                checked={adjuntarXml}
                onChange={(e) => setAdjuntarXml(e.target.checked)}
                className="w-[18px] h-[18px] rounded border-[#d0d5dd] text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
              />
              <span>Adjuntar XML firmado</span>
            </label>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-[20px] mt-[4px]">
            <span className="text-[11px] text-[#64748b] leading-[18px]">
              Los campos con <span className="text-[#d92d20]">*</span> son obligatorios
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
                disabled={sending || !para.trim()}
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
