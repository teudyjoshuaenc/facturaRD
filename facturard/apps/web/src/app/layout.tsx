import type { Metadata } from 'next'
import type { JSX } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'FacturaRD',
  description: 'Facturación electrónica para PYMEs dominicanas',
}

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
