import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        geometry: fileURLToPath(new URL('./src/geometry.ts', import.meta.url)),
        body: fileURLToPath(new URL('./src/body.ts', import.meta.url)),
        surfaces: fileURLToPath(new URL('./src/surfaces.ts', import.meta.url)),
      },
      formats: ['es'],
    },
    sourcemap: true,
    rollupOptions: {
      external: ['ajv/dist/2020.js'],
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
  plugins: [
    {
      name: 'copy-avatar-schema',
      closeBundle: async () => {
        const { copyFile } = await import('node:fs/promises')
        await copyFile(
          fileURLToPath(new URL('./src/avatarDefinition.schema.json', import.meta.url)),
          fileURLToPath(new URL('./dist/avatarDefinition.schema.json', import.meta.url))
        )
      },
    },
  ],
})
