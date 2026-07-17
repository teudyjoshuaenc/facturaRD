'use client'

import React, { useState, useEffect } from 'react'
import { X, Mail, Phone, MessageSquare, Search, Building2, User, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useContactos, Contacto } from '@/hooks/useContactos'
import { cn } from '@/lib/utils'

const CANAL_OPTIONS = [
  { value: 'correo' as const, label: 'Correo', icon: Mail },
  {
    value: 'whatsapp' as const,
    label: 'WhatsApp',
    icon: (props: any) => (
      <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-7.6-4.7C4.5 15.3 4 13.4 4 11.5c0-1.9.5-3.8 1.4-5.4L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    )
  }
]

interface ReenviarModalProps {
  isOpen: boolean
  onClose: () => void
  defaultEmail?: string
  defaultPhone?: string
  contactoId?: string | null
  title?: string
  isBulk?: boolean
  onSend: (data: { canal: 'correo' | 'whatsapp'; para: string; mensaje: string; adjuntarPdf: boolean; adjuntarXml: boolean; enviarAContactoIndividual: boolean }) => Promise<void>
}

export function ReenviarModal({
  isOpen,
  onClose,
  defaultEmail = '',
  defaultPhone = '',
  contactoId = null,
  title = 'Reenviar comprobante',
  isBulk = false,
  onSend
}: ReenviarModalProps) {
  const [canal, setCanal] = useState<'correo' | 'whatsapp'>('correo')
  const [para, setPara] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [adjuntarPdf, setAdjuntarPdf] = useState(true)
  const [adjuntarXml, setAdjuntarXml] = useState(false)
  const [enviarAContactoIndividual, setEnviarAContactoIndividual] = useState(false)
  const [sending, setSending] = useState(false)

  const { contactos = [], searchQuery, setSearchQuery } = useContactos()
  const [selectedClient, setSelectedClient] = useState<Contacto | null>(null)
  const [clienteFocused, setClienteFocused] = useState(false)

  const handleParaChange = (val: string) => {
    setPara(val)
    setSearchQuery(val)
    if (selectedClient && (selectedClient.email !== val && selectedClient.telefono !== val)) {
      setSelectedClient(null)
    }
  }

  const handleSelectClient = (c: Contacto) => {
    setSelectedClient(c)
    const val = canal === 'correo' ? c.email : c.telefono
    setPara(val)
    setSearchQuery(val)
    setClienteFocused(false)
  }

  useEffect(() => {
    let email = defaultEmail
    let phone = defaultPhone

    if (contactoId && contactos.length > 0) {
      const found = contactos.find((c) => c.id === contactoId)
      if (found) {
        if (found.email) email = found.email
        if (found.telefono) phone = found.telefono
      }
    }

    if (canal === 'correo') {
      setPara(email)
      setSearchQuery(email)
    } else {
      setPara(phone)
      setSearchQuery(phone)
    }
    setSelectedClient(null)
  }, [canal, defaultEmail, defaultPhone, contactoId, contactos, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enviarAContactoIndividual && !para.trim()) return
    setSending(true)
    try {
      await onSend({
        canal,
        para: enviarAContactoIndividual ? '' : para,
        mensaje,
        adjuntarPdf,
        adjuntarXml,
        enviarAContactoIndividual
      })
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

          {/* Enviar cada uno a su cliente checkbox */}
          {isBulk && (
            <div className="flex items-center">
              <label className="flex items-center gap-[10px] text-[13px] text-[#333] font-normal cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarAContactoIndividual}
                  onChange={(e) => setEnviarAContactoIndividual(e.target.checked)}
                  className="w-[18px] h-[18px] rounded border-[#d0d5dd] text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                />
                <span>Enviar a cada cliente correspondiente</span>
              </label>
            </div>
          )}

          {/* Para Input with dropdown */}
          {!enviarAContactoIndividual && (
            <div className="flex flex-col gap-[8px] relative select-none">
              <label className="text-[12px] font-semibold text-[#333] leading-[19.5px]">
                Para <span className="text-[#d92d20]">*</span>
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#94A3B8] z-50" />
                <input
                  type={canal === 'correo' ? 'email' : 'tel'}
                  required={!enviarAContactoIndividual}
                  placeholder={canal === 'correo' ? 'Buscar cliente o escribir correo...' : 'Buscar cliente o escribir teléfono...'}
                  value={para}
                  onChange={(e) => handleParaChange(e.target.value)}
                  onFocus={() => setClienteFocused(true)}
                  className="relative z-50 h-[40px] w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] pl-[34px] pr-4 text-[12px] font-normal leading-[19px] text-[#333333] placeholder:text-[#0A0A0A]/50 focus:border-[#0379D5] focus:bg-white focus:outline-none focus:ring-0 transition-colors"
                />

                {/* Backdrop to close dropdown when clicking outside */}
                {clienteFocused && (
                  <div className="fixed inset-0 z-40" onClick={() => setClienteFocused(false)} />
                )}

                {/* Dropdown list */}
                {clienteFocused && (
                  <div className="absolute z-50 mt-1 max-h-[220px] w-full overflow-y-auto rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0px_10px_30px_-5px_rgba(0,0,0,0.15)] py-0 animate-in fade-in-50 duration-150">
                    {contactos.slice(0, 10).map((c: Contacto) => {
                      const isSelected = selectedClient?.id === c.id
                      const clientVal = canal === 'correo' ? c.email : c.telefono
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectClient(c)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors focus:bg-[#F0F5FF] focus:outline-none h-[50px] border-b border-[#F3F4F6] last:border-none",
                            isSelected ? "bg-[#F0F5FF]" : "bg-white hover:bg-[#F0F5FF]/50"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                              isSelected ? "bg-[#EFF4FF] text-[#0379D5]" : "bg-[#F3F4F6] text-[#6A7282]"
                            )}>
                              {c.tipo === 'EMPRESA' ? <Building2 size={12} /> : <User size={12} />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[12px] font-semibold text-[#333333] leading-4 truncate">
                                {c.nombre}
                              </span>
                              <span className="text-[10px] font-normal text-[#99A1AF] leading-[14px] truncate mt-0.5">
                                {clientVal || (canal === 'correo' ? 'Sin correo' : 'Sin teléfono')}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <Check size={14} className="text-[#0379D5] flex-shrink-0 stroke-[2.5]" />
                          )}
                        </button>
                      )
                    })}
                    {contactos.length === 0 && (
                      <div className="px-4 py-3 text-center text-[11px] text-text-secondary">
                        {para.trim().length > 0 ? 'No se encontraron clientes' : 'No tienes clientes activos'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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
                disabled={sending || (!enviarAContactoIndividual && !para.trim())}
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
