const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Pino from being bundled (required for Next.js 15)
  serverExternalPackages: ['pino', 'pino-pretty'],

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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com https://*.js.stripe.com https://maps.googleapis.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              process.env.NODE_ENV === 'development'
                ? "connect-src 'self' ws: wss: blob: data: https://api.stripe.com https://checkout.stripe.com https://merchant-ui-api.stripe.com https://sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://va.vercel-scripts.com"
                : "connect-src 'self' blob: data: https://api.stripe.com https://checkout.stripe.com https://merchant-ui-api.stripe.com https://sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://va.vercel-scripts.com",
              "worker-src 'self' blob:",
              "child-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
              "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://merchant-ui-api.stripe.com",
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

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "irshad-35",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the Sentry DSN is publicly accessible before enabling this option.
  tunnelRoute: '/monitoring',

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
}

// Make sure adding Sentry options is the last code to run before exporting
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)
