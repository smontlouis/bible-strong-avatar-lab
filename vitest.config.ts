import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      '@bible-strong/avatar-core': path.join(root, 'packages/avatar-core/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/__tests__/**/*-test.{ts,tsx}', 'packages/**/__tests__/**/*-test.{ts,tsx}'],
  },
})
