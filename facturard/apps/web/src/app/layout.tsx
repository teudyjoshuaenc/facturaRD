import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FacturaRD',
  description: 'Facturación electrónica para PYMEs dominicanas',
}

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
