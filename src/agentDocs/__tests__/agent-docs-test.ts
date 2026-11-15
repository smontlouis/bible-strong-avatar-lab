import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { clipNames, readCharacter, stateNames } from '@bible-strong/avatar-core'

import { agentDocs } from '@/agentDocs/agentDocs'

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
      if (address === '') continue
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
      '# Clip schema',
    ]) {
      expect(full).toContain(title)
    }
  })
})
