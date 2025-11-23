import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/lib/db/queries/**', // Exclude direct Prisma queries
        '**/lib/db.ts',
        '**/prisma/**',
        '**/__tests__/**',
        '**/types/**',
        '**/*.d.ts',
        '**/coverage/**',
        '**/.github/**',
        '**/scripts/**',
        '**/vitest.config.ts',
        '**/vitest.setup.ts',
      ],
      include: [
        'lib/services/**/*.ts',
        'app/**/_actions/*.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
