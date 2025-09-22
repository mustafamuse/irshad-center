import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/components/ui/**',
      ],
    },
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'coverage'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
