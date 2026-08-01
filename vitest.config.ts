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
    },
  },
})
