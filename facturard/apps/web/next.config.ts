import path from 'node:path'
import type { NextConfig } from 'next'

// Mismo prefijo que usa el middleware para reconocer el dominio del panel DMAIA.
const PREFIJO_HOST_ADMIN = process.env['ADMIN_HOST_PREFIX'] ?? 'adminfacturard.'
const HOST_ADMIN = `${PREFIJO_HOST_ADMIN.replace(/\./g, '\\.')}.*`

const nextConfig: NextConfig = {
  // Build autocontenido (server.js) para la imagen Docker del VPS. El tracing parte de
  // la raíz del monorepo para que entren las dependencias hoisteadas por pnpm.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [
      {
        // App de clientes: se embebe en los iframes de GoHighLevel.
        source: '/(.*)',
        missing: [{ type: 'host', value: HOST_ADMIN }],
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
      {
        // Panel DMAIA: no se embebe en ningún iframe.
        source: '/(.*)',
        has: [{ type: 'host', value: HOST_ADMIN }],
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
