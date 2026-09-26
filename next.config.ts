import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Receipt photos are shrunk in the browser first, but a purchase can carry
      // several of them plus a PDF, so the 1 MB default is too tight.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
