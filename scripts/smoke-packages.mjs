import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const workspace = await mkdtemp(path.join(tmpdir(), 'avatar-runtime-pack-smoke-'))
const consumer = path.join(workspace, 'consumer')

const run = (args, cwd = root, capture = false) => {
  const result = spawnSync('pnpm', args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result.stdout?.trim()
}

run(['packages:build'])
const pack = packageName => {
  const output = run(
    ['--dir', path.join(root, 'packages', packageName), 'pack', '--pack-destination', workspace],
    root,
    true
  )
  return output.split('\n').at(-1)
}
const coreTarball = pack('avatar-core')
const reactTarball = pack('avatar-react')
const webTarball = pack('avatar-web')
const nativeTarball = pack('avatar-react-native')
// No React Native consumer is built here: check that the tarball holds what Metro will load.
const nativeFiles = spawnSync('tar', ['-tzf', nativeTarball], { encoding: 'utf8' }).stdout
for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/engine.js', 'README.md', 'LICENSE']) {
  if (!nativeFiles.includes(`package/${file}`)) {
    process.stderr.write(`avatar-react-native tarball is missing ${file}\n`)
    process.exit(1)
  }
}

await cp(path.join(root, 'examples/react-vite-consumer'), consumer, {
  recursive: true,
  filter: source =>
    !source.includes(`${path.sep}node_modules`) && !source.includes(`${path.sep}dist`),
})
const packagePath = path.join(consumer, 'package.json')
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
packageJson.dependencies['@bible-strong/avatar-core'] = `file:${coreTarball}`
packageJson.dependencies['@bible-strong/avatar-react'] = `file:${reactTarball}`
packageJson.pnpm = { overrides: { '@bible-strong/avatar-core': `file:${coreTarball}` } }
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

run(['install', '--no-frozen-lockfile'], consumer)
run(['build'], consumer)

const webConsumer = path.join(workspace, 'web-consumer')
await cp(path.join(root, 'examples/web-vite-consumer'), webConsumer, {
  recursive: true,
  filter: source =>
    !source.includes(`${path.sep}node_modules`) && !source.includes(`${path.sep}dist`),
})
await cp(
  path.join(root, 'examples/react-vite-consumer/src/strobi.avatar.json'),
  path.join(webConsumer, 'src/strobi.avatar.json')
)
const webMainPath = path.join(webConsumer, 'src/main.ts')
const webMain = await readFile(webMainPath, 'utf8')
await writeFile(
  webMainPath,
  webMain.replace('../../react-vite-consumer/src/strobi.avatar.json', './strobi.avatar.json')
)
const webPackagePath = path.join(webConsumer, 'package.json')
const webPackageJson = JSON.parse(await readFile(webPackagePath, 'utf8'))
webPackageJson.dependencies['@bible-strong/avatar-web'] = `file:${webTarball}`
webPackageJson.pnpm = { overrides: { '@bible-strong/avatar-core': `file:${coreTarball}` } }
await writeFile(webPackagePath, `${JSON.stringify(webPackageJson, null, 2)}\n`)

run(['install', '--no-frozen-lockfile'], webConsumer)
run(['build'], webConsumer)
process.stdout.write(`Tarball consumers verified at ${consumer} and ${webConsumer}\n`)
