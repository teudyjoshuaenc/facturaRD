import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
