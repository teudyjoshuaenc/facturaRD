'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CertificateDropzone } from '@/components/certificados/certificate-dropzone'

interface Props {
  file: File | null
  passphrase: string
  onFileChange: (file: File) => void
  onPassphraseChange: (passphrase: string) => void
  onNext: () => void
  onBack: () => void
}

function esP12(name: string): boolean {
  return /\.(p12|pfx)$/i.test(name)
}

export function CertificadoStep({ file, passphrase, onFileChange, onPassphraseChange, onNext, onBack }: Props): JSX.Element {
  const [fileError, setFileError] = useState('')

  function handleFile(f: File): void {
    if (!esP12(f.name)) {
      setFileError('El archivo debe ser un certificado .p12 o .pfx.')
      return
    }
    setFileError('')
    onFileChange(f)
  }

  const puedeContinuar = !!file && passphrase.length >= 4

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Sube tu certificado</h2>
        <p className="text-body-sm text-text-secondary">
          Es el certificado digital que firma tus facturas ante la DGII. Debe estar a nombre del
          representante legal de la empresa.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <CertificateDropzone file={file} onFileChange={handleFile} />
        {fileError && <p className="text-ui-xs text-danger-600">{fileError}</p>}
      </div>

      <Input
        label="Contraseña del certificado"
        type="password"
        placeholder="La contraseña de tu archivo .p12"
        value={passphrase}
        onChange={(e) => onPassphraseChange(e.target.value)}
        helperText="Te la entregó tu proveedor de firma digital al emitir el certificado."
      />

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>
          Atrás
        </Button>
        <Button variant="primary" size="lg" className="flex-1" disabled={!puedeContinuar} onClick={onNext}>
          Continuar
        </Button>
      </div>
    </div>
  )
}
