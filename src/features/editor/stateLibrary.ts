import {
  clips as catalogueClips,
  faceNames,
  spinnerOfMode,
  stateAliases,
  states as catalogueStates,
  type ClipDefinition,
  type StateDefinition,
} from '@bible-strong/avatar-core'

import { checkClip, freeClipName, type ClipProblem } from '@/features/editor/clipLibrary'

// Custom states: the states a creator makes in the Studio, beside the catalogue's, which stay
// read-only. A custom state is a state definition with a name, the shape the engine plays. Plain
// functions of plain data.

export type CustomState = StateDefinition & { name: string }

/**
 * How a state plays its clips. `shuffled`: drawn without end, each once a round (a single clip
 * loops). `sequence`: each once, in order, then the next state. `timed`: shuffled for a time,
 * then the next state.
 */
export type StateRule = 'shuffled' | 'sequence' | 'timed'

export const stateRules: readonly StateRule[] = ['shuffled', 'sequence', 'timed']

export const ruleOf = (state: Readonly<StateDefinition>): StateRule =>
  state.next === undefined ? 'shuffled' : state.holdSeconds === undefined ? 'sequence' : 'timed'

export const DEFAULT_HOLD_SECONDS = 3
const DEFAULT_NEXT = 'idle'

/** Change how a state plays its clips, keeping what the new rule can keep. */
export const setStateRule = (state: CustomState, rule: StateRule): CustomState => {
  const next: CustomState = { ...state }
  if (rule === 'shuffled') {
    delete next.next
    delete next.holdSeconds
  } else {
    next.next = state.next ?? DEFAULT_NEXT
    if (rule === 'sequence') delete next.holdSeconds
    else next.holdSeconds = state.holdSeconds ?? DEFAULT_HOLD_SECONDS
  }
  return next
}

/** The faces a state may hold. */
export const stateFaceChoices: readonly string[] = faceNames
/** What a state may turn the body into, by the names states use. */
export const stateMorphChoices: readonly string[] = Object.keys(spinnerOfMode)

// Names.

/** Whether the catalogue already uses a name, as a state or as an alias of one. */
export const isCatalogueStateName = (name: string) =>
  Object.hasOwn(catalogueStates, name) || Object.hasOwn(stateAliases, name)

export const freeStateName = (wanted: string, custom: readonly CustomState[]) => {
  const base = wanted.trim() || 'state'
  const taken = (name: string) =>
    isCatalogueStateName(name) || custom.some(state => state.name === name)
  if (!taken(base)) return base
  let number = 2
  while (taken(`${base}-${number}`)) number += 1
  return `${base}-${number}`
}

export const stateNameProblem = (
  name: string,
  custom: readonly CustomState[],
  current?: string
): 'empty' | 'catalogue' | 'taken' | null => {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'
  if (isCatalogueStateName(trimmed)) return 'catalogue'
  if (trimmed !== current && custom.some(state => state.name === trimmed)) return 'taken'
  return null
}

export const createState = (name: string, clip = 'Idle_B'): CustomState => ({
  name,
  clips: [clip],
})

/** A copy of any state under another name. A catalogue state's alias is not carried. */
export const duplicateState = (source: Readonly<StateDefinition>, name: string): CustomState => ({
  ...structuredClone(source as StateDefinition),
  name,
})

// The list of clips.

export const setStateClips = (
  state: CustomState,
  list: readonly string[],
  compact = false
): CustomState => {
  const next: CustomState = { ...state }
  if (compact) {
    if (list.length) next.compactClips = [...list]
    else delete next.compactClips
  } else next.clips = [...list]
  return next
}

/** Move an entry of a list of clips up (-1) or down (1). */
export const moveInList = (list: readonly string[], index: number, by: -1 | 1) => {
  const target = index + by
  if (target < 0 || target >= list.length) return [...list]
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export const setStateFace = (state: CustomState, face: string | null): CustomState => {
  const next: CustomState = { ...state }
  if (face) next.face = face
  else delete next.face
  return next
}

export const setStateMorph = (state: CustomState, morph: string | null): CustomState => {
  const next: CustomState = { ...state }
  if (morph) next.morph = morph
  else delete next.morph
  return next
}

export const setStateNext = (state: CustomState, next: string): CustomState => ({ ...state, next })

export const setStateHold = (state: CustomState, seconds: number): CustomState => ({
  ...state,
  holdSeconds: Math.round(Math.max(0.1, Math.min(600, seconds)) * 100) / 100,
})

// Reading states from links, files and storage.

/** A state as a link or a file carries it: the state, and clips of its own it brings along. */
export type StateDocument = { state: CustomState; newClips: ClipDefinition[] }

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * A state read from anywhere, checked field by field against the clips and states it may name:
 * the document, or the first problem found, said in the terms of the file.
 * `knownClips` and `knownStates` are the custom ones; the catalogue's are always known.
 */
export const checkStateDocument = (
  value: unknown,
  known: { clips: readonly string[]; states: readonly string[] }
):
  | { document: StateDocument; problem?: undefined }
  | { document?: undefined; problem: ClipProblem } => {
  const fail = (path: string, message: string) => ({ problem: { path, message } })
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('state', 'expected an object')
  }
  const source = value as Record<string, unknown>
  if (typeof source.name !== 'string' || !source.name.trim()) {
    return fail('name', 'expected a non-empty string')
  }
  const name = source.name.trim()

  const newClips: ClipDefinition[] = []
  if (source.newClips !== undefined) {
    if (!Array.isArray(source.newClips)) return fail('newClips', 'expected a list of clips')
    for (const [index, item] of source.newClips.entries()) {
      const checked = checkClip(item)
      if (checked.problem) {
        const inner = checked.problem.path === 'clip' ? '' : `.${checked.problem.path}`
        return fail(`newClips[${index}]${inner}`, checked.problem.message)
      }
      if (Object.hasOwn(catalogueClips, checked.clip.name)) {
        return fail(`newClips[${index}].name`, 'the name of a catalogue clip; choose another')
      }
      newClips.push(checked.clip)
    }
  }
  const clipKnown = (clip: string) =>
    Object.hasOwn(catalogueClips, clip) ||
    known.clips.includes(clip) ||
    newClips.some(item => item.name === clip)
  const readList = (field: 'clips' | 'compactClips') => {
    const list = source[field]
    if (!Array.isArray(list) || list.length === 0) {
      return fail(field, 'expected a non-empty list of clip names')
    }
    for (const [index, clip] of list.entries()) {
      if (typeof clip !== 'string') return fail(`${field}[${index}]`, 'expected a clip name')
      if (!clipKnown(clip)) {
        return fail(
          `${field}[${index}]`,
          `unknown clip "${clip}": name a catalogue clip, a saved custom clip, or one of newClips`
        )
      }
    }
    return { list: list as string[] }
  }
  const clips = readList('clips')
  if ('problem' in clips) return clips
  const state: CustomState = { name, clips: clips.list }
  if (source.compactClips !== undefined) {
    const compact = readList('compactClips')
    if ('problem' in compact) return compact
    state.compactClips = compact.list
  }
  if (source.face !== undefined) {
    // A built-in face, or a drawn one by its name: one the Studio does not have shows neutral.
    if (typeof source.face !== 'string' || !source.face.trim()) {
      return fail('face', `expected the name of a face: ${faceNames.join(', ')}, or a drawn one`)
    }
    state.face = source.face
  }
  if (source.morph !== undefined) {
    if (typeof source.morph !== 'string' || !stateMorphChoices.includes(source.morph)) {
      return fail('morph', `expected one of ${stateMorphChoices.join(', ')}`)
    }
    state.morph = source.morph
  }
  if (source.next !== undefined) {
    const next = source.next
    const stateKnown =
      typeof next === 'string' &&
      (Object.hasOwn(catalogueStates, next) ||
        Object.hasOwn(stateAliases, next) ||
        known.states.includes(next) ||
        next === name)
    if (!stateKnown) {
      return fail(
        'next',
        'expected the name of a catalogue state, a saved custom state, or this one'
      )
    }
    state.next = next as string
  }
  if (source.holdSeconds !== undefined) {
    if (!isNumber(source.holdSeconds) || source.holdSeconds <= 0) {
      return fail('holdSeconds', 'expected a number of seconds above 0')
    }
    if (state.next === undefined) return fail('holdSeconds', 'only with next')
    state.holdSeconds = source.holdSeconds
  }
  return { document: { state, newClips } }
}

const STORAGE_KEY = 'bible-strong-avatar-studio-states-v1'

/** The custom states kept from a store: those that read, each under a name of its own. */
export const parseCustomStates = (value: unknown, customClips: readonly string[]) => {
  if (!Array.isArray(value)) return []
  const result: CustomState[] = []
  for (const item of value) {
    const names = result.map(state => state.name)
    const checked = checkStateDocument(item, { clips: customClips, states: names })
    if (checked.document) {
      const state = checked.document.state
      result.push({ ...state, name: freeStateName(state.name, result) })
    }
  }
  return result
}

export const loadCustomStates = (
  customClips: readonly string[],
  storage: Pick<Storage, 'getItem'> = window.localStorage
): CustomState[] => {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as { states?: unknown } | null
    return parseCustomStates(stored?.states, customClips)
  } catch {
    return []
  }
}

export const persistCustomStates = (
  states: readonly CustomState[],
  storage: Pick<Storage, 'setItem'> = window.localStorage
) => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, states }))
    return true
  } catch {
    return false
  }
}

/**
 * Bring the clips a document brings along into the custom clips. A clip already there with the
 * same content is not doubled; one whose name is taken by another is kept under a free name,
 * and the state is told its new name.
 */
export const takeNewClips = (
  document: StateDocument,
  custom: readonly ClipDefinition[]
): { clips: ClipDefinition[]; state: CustomState } => {
  const clips = [...custom]
  const renamed = new Map<string, string>()
  for (const clip of document.newClips) {
    const same = clips.find(item => item.name === clip.name)
    if (same && JSON.stringify(same) === JSON.stringify(clip)) continue
    const name = same ? freeClipName(clip.name, clips) : clip.name
    if (name !== clip.name) renamed.set(clip.name, name)
    clips.push({ ...clip, name })
  }
  const rename = (list: string[]) => list.map(item => renamed.get(item) ?? item)
  const state: CustomState = { ...document.state, clips: rename(document.state.clips) }
  if (document.state.compactClips) state.compactClips = rename(document.state.compactClips)
  return { clips, state }
}

/** A state as a file holds it: the state, and the custom clips it plays, to travel together. */
export const stateFileText = (state: Readonly<CustomState>, custom: readonly ClipDefinition[]) => {
  const names = new Set([...state.clips, ...(state.compactClips ?? [])])
  const newClips = custom.filter(clip => names.has(clip.name))
  return JSON.stringify(newClips.length ? { ...state, newClips } : state, null, 2)
}

export const stateFileName = (state: Readonly<CustomState>) =>
  `${state.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'state'}.state.json`
