import path from 'path'
import { VitestReporter } from 'tdd-guard-vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['default', new VitestReporter(path.resolve(__dirname))],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Next.js resolves 'server-only' in its compiler; it is not an installed
      // package, so Vitest needs a stub to import modules that use it.
      'server-only': path.resolve(
        __dirname,
        './lib/__tests__/stubs/server-only.ts'
      ),
    },
  },
})
