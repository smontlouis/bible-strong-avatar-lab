import { readFileSync } from 'node:fs'
import path from 'node:path'

import { runnerImport, type Plugin } from 'vite'

import type { AgentDocSources } from './agentDocs'
import { localized, PRODUCTION_ORIGIN } from './origin'

// Serves the documentation for agents in development and writes it into the build. The pages
// are made by `agentDocs.ts`, which uses the Studio's own code: it is run through Vite with the
// Studio's aliases, so that the characters are those the Studio exports.

const contentTypes: Record<string, string> = {
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

export const agentDocsPlugin = (root: string, alias: Record<string, string>): Plugin => {
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

  const build = async (origin: string) => {
    const { module } = await runnerImport<typeof import('./agentDocs')>(
      path.join(root, 'src/agentDocs/agentDocs.ts'),
      { configFile: false, root, logLevel: 'silent', resolve: { alias } }
    )
    const sources: AgentDocSources = {
      origin,
      index: read('src/agentDocs/llms.md'),
      readmes: Object.fromEntries(
        ['avatar-react', 'avatar-react-native', 'avatar-web', 'avatar-core'].map(name => [
          name,
          read(`packages/${name}/README.md`),
        ])
      ),
      clipGuide: read('public/clip-authoring.md'),
      clipSchema: read('public/clip.schema.json'),
    }
    return module.agentDocs(sources)
  }

  return {
    name: 'bible-strong-agent-docs',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const file = (request.url ?? '').split(/[?#]/)[0].replace(/^\/+/, '')
        const origin = `http://${request.headers.host ?? 'localhost'}`
        // The guide and the schema are public files; here they name the local Studio.
        if (file === 'clip-authoring.md' || file === 'clip.schema.json') {
          response.setHeader('Content-Type', contentTypes[path.extname(file)])
          response.end(localized(read(`public/${file}`), origin))
          return
        }
        if (!/^(llms(-full)?\.txt|docs\/|characters\/|catalogue\/)/.test(file)) return next()
        try {
          // Built on each request: in development the sources change under the server.
          const files = await build(origin)
          if (files[file] === undefined) return next()
          response.setHeader('Content-Type', contentTypes[path.extname(file)] ?? 'text/plain')
          response.end(files[file])
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      const files = await build(PRODUCTION_ORIGIN)
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName, source })
      }
    },
  }
}
