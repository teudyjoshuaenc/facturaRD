import type { Metadata } from 'next'
import type { JSX } from 'react'
import { Open_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans' })

export const metadata: Metadata = {
  title: 'Factura Dmaia',
  description: 'Facturación electrónica para PYMEs dominicanas',
}

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="es" className={openSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

