import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import {
  clipNames,
  compileFace,
  readCharacter,
  stateNames,
  states,
} from '@bible-strong/avatar-core'
import Ajv2020 from 'ajv/dist/2020.js'

import { agentDocs } from '@/agentDocs/agentDocs'
import { checkFace } from '@/features/editor/faceLibrary'
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
  faceGuide: read('public/face-authoring.md'),
  faceSchema: read('public/face.schema.json'),
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

  it('publishes a catalogue every clip of which meets the clip schema', () => {
    const validate = new Ajv2020({ allErrors: true }).compile(
      JSON.parse(read('public/clip.schema.json'))
    )
    for (const clip of Object.values(JSON.parse(files['catalogue/clips.json']))) {
      expect(validate(clip), (clip as { name: string }).name).toBe(true)
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
      '# Writing a face',
      '# Face schema',
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

  it('gives faces the packages draw and the schema accepts, and clips that may name them', () => {
    const guide = read('public/face-authoring.md')
    const examples = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map(match =>
      JSON.parse(match[1])
    )
    expect(examples.length).toBeGreaterThanOrEqual(4)
    const validate = new Ajv2020({ allErrors: true }).compile(
      JSON.parse(read('public/face.schema.json'))
    )
    for (const face of examples) {
      expect(validate(face), face.name).toBe(true)
      expect(checkFace(face).problem, face.name).toBeUndefined()
      expect(compileFace(face).problems, face.name).toEqual([])
    }
    expect(validate({ name: 'x', eyes: { left: [] } })).toBe(false)
    const clip = new Ajv2020({ allErrors: true }).compile(
      JSON.parse(read('public/clip.schema.json'))
    )
    expect(
      clip({ name: 'Starry', duration: 1, tracks: { expression: [{ t: 0, v: 'star' }] } })
    ).toBe(true)
    expect(clip({ name: 'Starry', duration: 1, tracks: { expression: [{ t: 0, v: '' }] } })).toBe(
      false
    )
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
