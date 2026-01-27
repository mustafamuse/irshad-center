const { withSentryConfig } = require('@sentry/nextjs')
const { withAxiom } = require('next-axiom')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/clockin',
        destination: '/teacher/checkin',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "img-src 'self' blob: data: https://*.stripe.com",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com https://*.js.stripe.com https://maps.googleapis.com https://va.vercel-scripts.com https://*.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              process.env.NODE_ENV === 'development'
                ? "connect-src 'self' ws: wss: blob: data: https://api.stripe.com https://checkout.stripe.com https://merchant-ui-api.stripe.com https://*.axiom.co"
                : "connect-src 'self' blob: data: https://api.stripe.com https://checkout.stripe.com https://merchant-ui-api.stripe.com https://*.axiom.co",
              "worker-src 'self' blob:",
              "child-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
              "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://merchant-ui-api.stripe.com https://www.google.com https://maps.google.com",
              "media-src 'self' blob: data:",
            ].join('; '),
          },
          {
            key: 'Permissions-Policy',
            value:
              'payment=(self "https://js.stripe.com" "https://checkout.stripe.com" "https://merchant-ui-api.stripe.com"), camera=(), microphone=()',
          },
        ],
      },
    ]
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  env: {
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN,
    KV_URL: process.env.KV_URL,
  },
  transpilePackages: ['@react-pdf/renderer'],
  webpack: (config) => {
    config.externals = config.externals || []
    config.externals.push({
      canvas: 'canvas',
    })
    return config
  },
}

const sentryConfig = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
})

module.exports = withAxiom(sentryConfig)
