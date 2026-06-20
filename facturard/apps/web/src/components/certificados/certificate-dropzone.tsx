'use client'

import { useRef, useState } from 'react'
import type { JSX } from 'react'
import { UploadCloud, FileCheck2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CertificateDropzoneProps {
  file: File | null
  onFileChange: (file: File) => void
}

export function CertificateDropzone({ file, onFileChange }: CertificateDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null): void {
    const selected = files?.[0]
    if (selected) onFileChange(selected)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-8 py-10 text-center transition-colors',
        dragging && 'border-brand-500 bg-brand-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".p12,.pfx"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {file ? (
        <>
          <FileCheck2 className="text-success-500" size={40} />
          <p className="text-body-sm text-text-primary">{file.name}</p>
          <p className="text-ui-sm text-text-secondary">Click para cambiar el archivo</p>
        </>
      ) : (
        <>
          <UploadCloud className="text-text-tertiary" size={40} />
          <p className="text-body-sm text-text-primary">Arrastra tu certificado aquí o haz click para buscar</p>
          <p className="text-ui-sm text-text-secondary">Formatos aceptados: .p12, .pfx</p>
        </>
      )}
    </div>
  )
}
