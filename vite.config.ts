import path from 'node:path'
import { fileURLToPath } from 'node:url'

import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(() => {
  return {
    root,
    base: './',
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
    resolve: {
      alias: {
        '@': path.join(root, 'src'),
        '@bible-strong/avatar-core': path.join(root, 'packages/avatar-core/src/index.ts'),
        '@bible-strong/avatar-react': path.join(root, 'packages/avatar-react/src/index.ts'),
      },
    },
    build: {
      outDir: path.join(root, 'dist'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 1_100,
      rolldownOptions: {
        checks: { pluginTimings: false },
      },
    },
  }
})
