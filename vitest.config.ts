import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/api/**/*.{test,spec}.ts', 'db/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@obc/db/testing': new URL('./db/testing.ts', import.meta.url).pathname,
      '@obc/db': new URL('./db/index.ts', import.meta.url).pathname,
    },
  },
})
