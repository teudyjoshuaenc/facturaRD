'use client'

import { Suspense, useState } from 'react'
import type { JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, FilePlus, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { downloadComprobantePdf, formatCurrency } from '@/lib/comprobantes'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function SuccessPanelContent(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const encf = searchParams.get('encf') ?? ''
  const total = Number(searchParams.get('total') ?? '0')
  const cliente = searchParams.get('cliente') ?? ''
  const fecha = searchParams.get('fecha') ?? ''

  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!id || !encf) {
      toast.error('Datos incompletos para descargar el PDF')
      return
    }
    setDownloading(true)
    try {
      await downloadComprobantePdf(api, id, encf, cliente, fecha)
      toast.success('PDF descargado correctamente')
    } catch (err) {
      console.error(err)
      toast.error('No se pudo descargar el PDF. El documento podría estar procesándose en la DGII.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-white border border-[#e2e8f0] border-solid content-stretch flex flex-col gap-[16px] items-center justify-center p-[61px] relative rounded-[14px] w-full max-w-[500px] mx-auto my-10 shadow-sm font-sans select-none animate-in fade-in slide-in-from-bottom-4 duration-350" data-node-id="759:16925" data-name="SummaryPanel">
      {/* Green Checkmark Circle Container */}
      <div className="bg-[#f0fdf4] relative rounded-[33554400px] shrink-0 size-[64px]" data-node-id="759:17333" data-name="Container">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center relative size-full">
          <div className="relative shrink-0 size-[36px] flex items-center justify-center text-emerald-600" data-node-id="759:17334" data-name="Icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="relative shrink-0 w-full" data-node-id="759:17337" data-name="Container">
        <div className="[word-break:break-word] bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center relative size-full text-center">
          <p className="font-semibold leading-[33px] relative shrink-0 text-[#101828] text-[22px] whitespace-nowrap" data-node-id="759:17339">
            Factura emitida
          </p>
          <p className="font-normal leading-[21px] relative shrink-0 text-[#6a7282] text-[14px] w-full max-w-[356px]" data-node-id="759:17341">
            El comprobante fiscal electrónico se generó correctamente.
          </p>
        </div>
      </div>

      {/* Invoice Data Box */}
      <div className="bg-[#f9fafb] border border-neutral-100 max-w-[384px] relative rounded-[14px] shrink-0 w-full" data-node-id="759:17342" data-name="Container">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center max-w-[inherit] p-[20px] relative size-full gap-3">
          <div className="relative shrink-0 w-full" data-node-id="759:17343" data-name="Container">
            <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start justify-between relative size-full">
              <div className="relative shrink-0" data-node-id="759:17344" data-name="Text">
                <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
                  <p className="[word-break:break-word] font-normal leading-[21px] relative shrink-0 text-[#6a7282] text-[14px] text-center whitespace-nowrap" data-node-id="759:17345">
                    e-NCF
                  </p>
                </div>
              </div>
              <div className="relative shrink-0" data-node-id="759:17346" data-name="Text">
                <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
                  <p className="[word-break:break-word] font-normal leading-[21px] relative shrink-0 text-[#101828] text-[14px] text-center whitespace-nowrap font-semibold" data-node-id="759:17347">
                    {encf || '---'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative shrink-0 w-full border-t border-neutral-200/50 pt-3" data-node-id="759:17348" data-name="Container">
            <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start justify-between relative size-full">
              <div className="relative shrink-0" data-node-id="759:17349" data-name="Text">
                <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
                  <p className="[word-break:break-word] font-normal leading-[21px] relative shrink-0 text-[#6a7282] text-[14px] text-center whitespace-nowrap" data-node-id="759:17350">
                    Total
                  </p>
                </div>
              </div>
              <div className="relative shrink-0" data-node-id="759:17351" data-name="Text">
                <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
                  <p className="[word-break:break-word] font-semibold leading-[21px] relative shrink-0 text-[#101828] text-[14px] text-center whitespace-nowrap" data-node-id="759:17352">
                    {formatCurrency(total)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Button Row */}
      <div className="relative shrink-0 w-full max-w-[384px] mt-2" data-node-id="759:17353" data-name="Container">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center justify-center relative size-full">
          <Button
            variant="secondary"
            disabled={downloading}
            onClick={handleDownload}
            className="h-[54px] relative rounded-[14px] shrink-0 w-[162px] gap-2 font-semibold font-sans text-[16px] text-[#364153]"
            data-node-id="759:17354"
            data-name="SecondaryButton"
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#364153]" />
            ) : (
              <Download className="w-5 h-5 text-[#364153]" />
            )}
            Descargar PDF
          </Button>

          <Button
            variant="primary"
            onClick={() => router.push('/nueva-factura')}
            className="bg-[#0379d5] hover:bg-[#0379d5]/90 flex-[1_0_0] h-[54px] min-w-px relative rounded-[14px] text-white font-semibold font-sans text-[16px]"
            data-node-id="759:17356"
            data-name="PrimaryButton"
          >
            <FilePlus className="w-5 h-5 text-white" />
            Crear nueva factura
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ExitoFacturaPage(): JSX.Element {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[500px] w-full max-w-[500px] mx-auto p-6 md:p-10 bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <SuccessPanelContent />
    </Suspense>
  )
}
