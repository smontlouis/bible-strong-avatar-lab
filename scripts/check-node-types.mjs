// Type the built packages the way a Node project does: an ESM package compiled with
// `moduleResolution: nodenext`. There, a relative import without its extension in a published
// declaration resolves to nothing, and every export behind it is lost or becomes `any` (#20).
// Each probe below is a typed export assigned to a number: `@ts-expect-error` fails the check
// when the export is missing or `any`. Errors in the probes or in `packages/*/dist` fail it;
// errors inside other packages' own declarations (React Native's) are theirs.
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const consumer = await mkdtemp(path.join(tmpdir(), 'avatar-node-types-'))
const modules = path.join(consumer, 'node_modules')
await mkdir(path.join(modules, '@bible-strong'), { recursive: true })
await mkdir(path.join(modules, '@types'), { recursive: true })
for (const name of ['avatar-core', 'avatar-react', 'avatar-web', 'avatar-react-native']) {
  await symlink(path.join(root, 'packages', name), path.join(modules, '@bible-strong', name))
}
await symlink(path.join(root, 'node_modules/react'), path.join(modules, 'react'))
await symlink(path.join(root, 'node_modules/@types/react'), path.join(modules, '@types/react'))
await writeFile(
  path.join(consumer, 'package.json'),
  JSON.stringify({ name: 'node-types', type: 'module', private: true })
)

const probe = name => `// @ts-expect-error ${name} is typed
export const ${name}Probe: number = ${name}
`
await writeFile(
  path.join(consumer, 'web.ts'),
  `import { characterOf, readCharacter, morphEyeShapes, createAvatarPlayer, compileFace, readAvatarLibrary, faceEyesFromSvg } from '@bible-strong/avatar-core'
import { normalizeQuaternion } from '@bible-strong/avatar-core/geometry'
import { Avatar, createAvatar } from '@bible-strong/avatar-react'
import { createAvatar as createWebAvatar } from '@bible-strong/avatar-web'
${[
  'characterOf',
  'readCharacter',
  'morphEyeShapes',
  'createAvatarPlayer',
  'compileFace',
  'readAvatarLibrary',
  'faceEyesFromSvg',
  'normalizeQuaternion',
  'Avatar',
  'createAvatar',
  'createWebAvatar',
]
  .map(name => probe(name))
  .join('')}`
)
await writeFile(
  path.join(consumer, 'native.ts'),
  `import { Avatar, createAvatar } from '@bible-strong/avatar-react-native'
${['Avatar', 'createAvatar'].map(name => probe(name)).join('')}`
)

const tsc = path.join(root, 'node_modules/typescript/bin/tsc')
const ours = /^(web|native)\.ts\(|[/\\]packages[/\\]avatar-[a-z-]+[/\\]dist[/\\]/
let failed = false
for (const [file, lib] of [
  ['web.ts', 'es2022,dom'],
  ['native.ts', 'es2022'],
]) {
  const result = spawnSync(
    process.execPath,
    [
      tsc,
      file,
      '--module',
      'nodenext',
      '--moduleResolution',
      'nodenext',
      '--strict',
      '--noEmit',
      '--jsx',
      'react-jsx',
      '--lib',
      lib,
    ],
    { cwd: consumer, encoding: 'utf8' }
  )
  const errors = `${result.stdout}${result.stderr}`
    .split('\n')
    .filter(line => line.includes('error TS') && ours.test(line))
  if (errors.length > 0) {
    failed = true
    process.stderr.write(`${file} under nodenext:\n${errors.join('\n')}\n`)
  }
}
await rm(consumer, { recursive: true, force: true })
if (failed) process.exit(1)
process.stdout.write('The packages type under moduleResolution nodenext.\n')
