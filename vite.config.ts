import path from 'node:path'
import { fileURLToPath } from 'node:url'

import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import { directDialogueWithJev, jsonError } from './server/jevDirector.ts'

const root = path.dirname(fileURLToPath(import.meta.url))

const readRequestBody = async (request: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

const jevDirectorApi = (): Plugin => ({
  name: 'jev-director-api',
  configureServer(server) {
    server.middlewares.use('/api/direct-dialogue', async (request, response) => {
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (request.method !== 'POST') {
        response.statusCode = 405
        response.end(JSON.stringify({ error: 'Method not allowed.' }))
        return
      }
      try {
        response.end(JSON.stringify(await directDialogueWithJev(await readRequestBody(request))))
      } catch (error) {
        response.statusCode = 400
        response.end(JSON.stringify(jsonError(error)))
      }
    })
  },
})

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, root, '')
  if (!process.env.AI_GATEWAY_API_KEY && environment.AI_GATEWAY_API_KEY) {
    process.env.AI_GATEWAY_API_KEY = environment.AI_GATEWAY_API_KEY
  }
  return {
    root,
    base: './',
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      jevDirectorApi(),
    ],
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
