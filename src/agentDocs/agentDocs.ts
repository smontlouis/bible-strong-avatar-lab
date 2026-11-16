import {
  avatarCharacterSchema,
  clips,
  stateAliases,
  stateGroups,
  states,
} from '@bible-strong/avatar-core'

import { characterOfAvatar, parseAvatarLibrary, type AvatarLibrary } from '@/features/editor/avatar'
import defaultLibrary from '@/features/editor/defaultLibrary.json'

import { localized } from './origin'

// The documentation the Studio serves to agents, made from the sources it describes: the package
// READMEs, the clip guide and schema, the catalogue and the Studio's own characters. Nothing is
// copied by hand, so nothing drifts. The Vite plugin reads the files and serves or writes what
// this returns, path by path.

export type AgentDocSources = {
  /** Where the Studio is served, without a trailing slash. */
  origin: string
  /** The index, with `{{origin}}` and `{{characters}}` to fill. */
  index: string
  /** The README of each package, by its short name (`avatar-react`…). */
  readmes: Record<string, string>
  clipGuide: string
  clipSchema: string
  stateGuide: string
  stateSchema: string
  faceGuide: string
  faceSchema: string
  characterGuide: string
}

const PACKAGE_ORDER = ['avatar-react', 'avatar-react-native', 'avatar-web', 'avatar-core']

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'avatar'

/** The characters the Studio comes with, each as the file its Export tab downloads. */
export const bundledCharacters = () => {
  const library = structuredClone(defaultLibrary) as unknown as AvatarLibrary
  return parseAvatarLibrary(library, library).avatars.map(avatar => ({
    name: avatar.name,
    file: `${slugOf(avatar.name)}.avatar.json`,
    character: characterOfAvatar(avatar),
  }))
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export const agentDocs = (sources: AgentDocSources): Record<string, string> => {
  const { origin } = sources
  const characters = bundledCharacters()
  const characterList = characters
    .map(item => `- [${item.name}](${origin}/characters/${item.file})`)
    .join('\n')
  const index = sources.index
    .replaceAll('{{origin}}', origin)
    .replace('{{characters}}', characterList)
    .trimEnd()

  const files: Record<string, string> = { 'llms.txt': `${index}\n` }
  for (const name of PACKAGE_ORDER) {
    if (sources.readmes[name]) files[`docs/${name}.md`] = sources.readmes[name]
  }
  for (const item of characters) files[`characters/${item.file}`] = json(item.character)
  // The catalogue as an agent reads it to learn from: a field it leaves empty (`null`) is left
  // out, as the clip schema has it.
  files['catalogue/clips.json'] = json(
    JSON.parse(JSON.stringify(clips, (_, value) => (value === null ? undefined : value)))
  )
  files['catalogue/states.json'] = json({ states, groups: stateGroups, aliases: stateAliases })
  // The schema of a character, at the address its `$id` gives.
  files['schema/avatar-character.json'] = json(avatarCharacterSchema)

  // Everything an agent reads, in one file: the index, then each guide in full.
  const section = (path: string, body: string) =>
    `\n\n---\n\n<!-- ${origin}/${path} -->\n\n${body.trim()}\n`
  files['llms-full.txt'] = [
    `${index}\n`,
    ...PACKAGE_ORDER.filter(name => sources.readmes[name]).map(name =>
      section(`docs/${name}.md`, sources.readmes[name])
    ),
    section('clip-authoring.md', localized(sources.clipGuide, origin)),
    section('state-authoring.md', localized(sources.stateGuide, origin)),
    section('face-authoring.md', localized(sources.faceGuide, origin)),
    section('character-authoring.md', localized(sources.characterGuide, origin)),
    section(
      'clip.schema.json',
      `# Clip schema\n\n\`\`\`json\n${localized(sources.clipSchema, origin).trim()}\n\`\`\``
    ),
    section(
      'state.schema.json',
      `# State schema\n\n\`\`\`json\n${localized(sources.stateSchema, origin).trim()}\n\`\`\``
    ),
    section(
      'face.schema.json',
      `# Face schema\n\n\`\`\`json\n${localized(sources.faceSchema, origin).trim()}\n\`\`\``
    ),
    section(
      'schema/avatar-character.json',
      `# Character schema\n\n\`\`\`json\n${localized(JSON.stringify(avatarCharacterSchema, null, 2), origin)}\n\`\`\``
    ),
  ].join('')
  return files
}
