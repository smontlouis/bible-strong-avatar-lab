import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { clipNames, readCharacter, stateNames, states } from '@bible-strong/avatar-core'
import Ajv2020 from 'ajv/dist/2020.js'

import { agentDocs } from '@/agentDocs/agentDocs'
import { checkStateDocument } from '@/features/editor/stateLibrary'

const root = path.join(__dirname, '../../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const ORIGIN = 'https://avatars.example'

const files = agentDocs({
  origin: ORIGIN,
  index: read('src/agentDocs/llms.md'),
  readmes: Object.fromEntries(
    ['avatar-react', 'avatar-react-native', 'avatar-web', 'avatar-core'].map(name => [
      name,
      read(`packages/${name}/README.md`),
    ])
  ),
  clipGuide: read('public/clip-authoring.md'),
  clipSchema: read('public/clip.schema.json'),
  stateGuide: read('public/state-authoring.md'),
  stateSchema: read('public/state.schema.json'),
  characterGuide: read('public/character-authoring.md'),
})

describe('the documentation for agents', () => {
  it('fills the index, and every address it gives leads to a page the Studio serves', () => {
    const index = files['llms.txt']
    expect(index).not.toMatch(/\{\{/)
    const addresses = [...index.matchAll(/https:\/\/avatars\.example\/([^\s)`|]*)/g)].map(
      match => match[1]
    )
    expect(addresses.length).toBeGreaterThan(15)
    for (const address of addresses) {
      // The Studio itself, or a link that opens a clip in it.
      if (address === '' || address.startsWith('#')) continue
      const served = files[address] !== undefined || existsSync(path.join(root, 'public', address))
      expect(served, address).toBe(true)
    }
  })

  it('publishes each of the Studio’s characters as a file the packages read', () => {
    const characters = Object.keys(files).filter(file => file.startsWith('characters/'))
    expect(characters).toContain('characters/strobi.avatar.json')
    expect(characters).toHaveLength(10)
    for (const file of characters) {
      const read = readCharacter(JSON.parse(files[file]))
      expect(read.ok, file).toBe(true)
    }
  })

  it('publishes the catalogue', () => {
    expect(Object.keys(JSON.parse(files['catalogue/clips.json']))).toEqual(clipNames)
    expect(Object.keys(JSON.parse(files['catalogue/states.json']).states)).toEqual(stateNames)
  })

  it('holds every guide in one file', () => {
    const full = files['llms-full.txt']
    for (const title of [
      '# @bible-strong/avatar-react',
      '# @bible-strong/avatar-react-native',
      '# @bible-strong/avatar-web',
      '# @bible-strong/avatar-core',
      '# Writing a clip',
      '# Writing a state',
      '# Writing a character',
      '# Clip schema',
      '# State schema',
      '# Character schema',
    ]) {
      expect(full).toContain(title)
    }
  })
})

describe('the guides’ examples', () => {
  const exampleOf = (guide: string, heading: string) =>
    JSON.parse(
      read(guide)
        .split(heading)[1]
        .match(/```json\n([\s\S]*?)```/)![1]
    )

  it('gives a character the packages read', () => {
    const fox = exampleOf('public/character-authoring.md', '## A complete example')
    const read = readCharacter(fox)
    expect(read.ok).toBe(true)
  })

  it('gives a state the Studio reads, and a schema every catalogue state meets', () => {
    const cheering = exampleOf('public/state-authoring.md', '## The format')
    expect(checkStateDocument(cheering, { clips: [], states: [] }).problem).toBeUndefined()
    const validate = new Ajv2020({ allErrors: true, strict: false })
      .addSchema(JSON.parse(read('public/clip.schema.json')))
      .compile(JSON.parse(read('public/state.schema.json')))
    expect(validate(cheering)).toBe(true)
    for (const [name, state] of Object.entries(states)) {
      expect(validate({ name: `${name}-copy`, ...state }), name).toBe(true)
    }
    expect(validate({ name: 'a', clips: ['Done_A'], holdSeconds: 2 })).toBe(false)
  })
})
