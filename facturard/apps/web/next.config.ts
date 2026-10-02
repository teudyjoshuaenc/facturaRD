import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Build autocontenido (server.js) para la imagen Docker del VPS. El tracing parte de
  // la raíz del monorepo para que entren las dependencias hoisteadas por pnpm.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Allow embedding in GoHighLevel iframes
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ]
  },
}

export default nextConfig
