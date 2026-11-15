import {
  clips as catalogueClips,
  REST_ZOOM,
  sampleClipTrack,
  type ClipDefinition,
  type ClipEase,
  type ClipFaceKey,
  type ClipKey,
  type ClipTracks,
} from '@bible-strong/avatar-core'

import { boundedEase, DEFAULT_EASE } from '@/features/editor/clipEasings'

// Custom clips: the clips a creator makes in the Studio, beside the catalogue's, which stay
// read-only. A custom clip is a plain clip definition, the very shape the engine plays; only
// where it is kept differs. Everything here is a plain function of plain data.

export type TrackName = keyof ClipTracks
export type NumericTrackName = Exclude<TrackName, 'expression'>
type NumericKey = ClipKey<readonly number[]>

export const trackOrder: TrackName[] = [
  'position',
  'rotation',
  'squash',
  'scale',
  'lids',
  'expression',
]

/** What a numeric track holds when a clip does not have it: the body at rest. */
export const trackRest: Record<NumericTrackName, readonly number[]> = {
  position: [0, 0],
  rotation: [0, 0, 0],
  squash: [1, 1],
  scale: [REST_ZOOM],
  lids: [0],
}

/** The faces a key of the face track may ask for, `blink` included. */
export const clipFaceChoices = [
  'neutral',
  'happy',
  'surprised',
  'sad',
  'sleepy',
  'squinted',
  'calm',
  'inspect',
  'confused',
  'blink',
] as const

export const DEFAULT_CLIP_SECONDS = 2
export const MIN_CLIP_SECONDS = 0.1
export const MAX_CLIP_SECONDS = 60
/** Times are kept to the millisecond: a key dragged by hand lands on a clean number. */
const roundTime = (time: number) => Math.round(time * 1000) / 1000
const SAME_TIME = 1e-4

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

// The library.

export const isCatalogueName = (name: string) => Object.hasOwn(catalogueClips, name)

/** A name free among the catalogue's and the custom clips': the one asked for, else numbered. */
export const freeClipName = (wanted: string, custom: readonly ClipDefinition[]) => {
  const base = wanted.trim() || 'Clip'
  const taken = (name: string) => isCatalogueName(name) || custom.some(clip => clip.name === name)
  if (!taken(base)) return base
  let number = 2
  while (taken(`${base} ${number}`)) number += 1
  return `${base} ${number}`
}

/** Why a clip cannot take a name, or `null` when it can. */
export const clipNameProblem = (
  name: string,
  custom: readonly ClipDefinition[],
  current?: string
): 'empty' | 'catalogue' | 'taken' | null => {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'
  if (isCatalogueName(trimmed)) return 'catalogue'
  if (trimmed !== current && custom.some(clip => clip.name === trimmed)) return 'taken'
  return null
}

export const createClip = (name: string, duration = DEFAULT_CLIP_SECONDS): ClipDefinition => ({
  name,
  duration,
  squashAnchor: 0,
  workArea: { start: 0, end: duration },
  tracks: {},
})

/** A copy of a clip, the catalogue's or a custom one, under another name. */
export const duplicateClip = (source: Readonly<ClipDefinition>, name: string): ClipDefinition => ({
  ...structuredClone(source as ClipDefinition),
  name,
})

export const renameClip = (clip: ClipDefinition, name: string): ClipDefinition => ({
  ...clip,
  name: name.trim(),
})

// The clip's own settings.

/** The last time any key of the clip stands at. */
export const lastKeyTime = (clip: Readonly<ClipDefinition>) =>
  Math.max(0, ...trackOrder.flatMap(track => (clip.tracks[track] ?? []).map(key => key.t)))

/**
 * Lengthen or shorten a clip. Keys keep their times: a clip is not shortened past its last key,
 * which would be lost.
 */
export const setClipDuration = (clip: ClipDefinition, duration: number): ClipDefinition => {
  const next = roundTime(
    clamp(duration, Math.max(MIN_CLIP_SECONDS, lastKeyTime(clip)), MAX_CLIP_SECONDS)
  )
  const start = clamp(clip.workArea?.start ?? 0, 0, next)
  return { ...clip, duration: next, workArea: { start, end: next } }
}

/** The time of the clip's pose of rest, which a join to it aims at. */
export const setClipRestTime = (clip: ClipDefinition, time: number): ClipDefinition => ({
  ...clip,
  workArea: { start: roundTime(clamp(time, 0, clip.duration)), end: clip.duration },
})

export const setClipSquashAnchor = (clip: ClipDefinition, anchor: number): ClipDefinition => ({
  ...clip,
  squashAnchor: anchor,
})

// Keys.

const withTrack = (
  clip: ClipDefinition,
  track: TrackName,
  keys: (NumericKey | ClipFaceKey)[]
): ClipDefinition => {
  const tracks = { ...clip.tracks } as Record<TrackName, unknown>
  if (keys.length) tracks[track] = keys
  else delete tracks[track]
  return { ...clip, tracks: tracks as ClipTracks }
}

const keysOf = (clip: Readonly<ClipDefinition>, track: TrackName) =>
  (clip.tracks[track] ?? []) as (NumericKey | ClipFaceKey)[]

/** Keys in order of time; keys at the same time keep the order they had. */
const sorted = <Key extends { t: number }>(keys: Key[]) =>
  keys
    .map((key, index) => ({ key, index }))
    .sort((left, right) => left.key.t - right.key.t || left.index - right.index)
    .map(item => item.key)

/** The face a face track asks for at a time: the last before it, `neutral` before the first. */
const faceAt = (keys: readonly ClipFaceKey[], time: number) => {
  let face = 'neutral'
  for (const key of keys) {
    if (key.t > time) break
    if (key.v !== 'blink') face = key.v
  }
  return face
}

/**
 * Add a key to a track at a time, with the value the track has there. It takes the curve of the
 * passage it falls in. A key already at that time is the one returned.
 */
export const addClipKey = (
  clip: ClipDefinition,
  track: TrackName,
  time: number
): { clip: ClipDefinition; index: number } => {
  const at = roundTime(clamp(time, 0, clip.duration))
  const keys = keysOf(clip, track)
  const existing = keys.findIndex(key => Math.abs(key.t - at) < SAME_TIME)
  if (existing >= 0) return { clip, index: existing }
  let key: NumericKey | ClipFaceKey
  if (track === 'expression') {
    key = { t: at, v: faceAt(keys as ClipFaceKey[], at) }
  } else {
    const numeric = keys as NumericKey[]
    const before = numeric.filter(item => item.t < at).at(-1)
    key = {
      t: at,
      v: numeric.length ? sampleClipTrack(numeric, at) : [...trackRest[track]],
      ease: [...(before?.ease ?? DEFAULT_EASE)] as unknown as ClipEase,
    }
  }
  const next = sorted([...keys, key])
  return { clip: withTrack(clip, track, next), index: next.indexOf(key) }
}

/** Move a key to another time. The key keeps its value and curve; its index may change. */
export const moveClipKey = (
  clip: ClipDefinition,
  track: TrackName,
  index: number,
  time: number
): { clip: ClipDefinition; index: number } => {
  const keys = keysOf(clip, track)
  if (!keys[index]) return { clip, index }
  const moved = { ...keys[index], t: roundTime(clamp(time, 0, clip.duration)) }
  const next = sorted(keys.map((key, at) => (at === index ? moved : key)))
  return { clip: withTrack(clip, track, next), index: next.indexOf(moved) }
}

/** Remove a key. The last key of a track takes the track with it. */
export const deleteClipKey = (clip: ClipDefinition, track: TrackName, index: number) =>
  withTrack(
    clip,
    track,
    keysOf(clip, track).filter((_, at) => at !== index)
  )

const updateKey = <Key>(
  clip: ClipDefinition,
  track: TrackName,
  index: number,
  update: (key: Key) => Key
) =>
  withTrack(
    clip,
    track,
    keysOf(clip, track).map((key, at) =>
      at === index ? (update(key as Key) as NumericKey | ClipFaceKey) : key
    )
  )

/** Set one number of a numeric key: `component` 0 is x, 1 is y, 2 is z. */
export const setClipKeyValue = (
  clip: ClipDefinition,
  track: NumericTrackName,
  index: number,
  component: number,
  value: number
) =>
  updateKey<NumericKey>(clip, track, index, key => ({
    ...key,
    v: key.v.map((current, at) => (at === component ? value : current)),
  }))

/** Set the curve that leads from a key to the next. */
export const setClipKeyEase = (
  clip: ClipDefinition,
  track: NumericTrackName,
  index: number,
  ease: readonly number[]
) => updateKey<NumericKey>(clip, track, index, key => ({ ...key, ease: boundedEase(ease) }))

/** Give every key of a track the same curve. */
export const setClipTrackEase = (
  clip: ClipDefinition,
  track: NumericTrackName,
  ease: readonly number[]
) =>
  withTrack(
    clip,
    track,
    (keysOf(clip, track) as NumericKey[]).map(key => ({ ...key, ease: boundedEase(ease) }))
  )

/** Set the face a key asks for, or whether it changes at once (`cut`). */
export const setClipFaceKey = (
  clip: ClipDefinition,
  index: number,
  change: { v?: string; cut?: boolean }
) =>
  updateKey<ClipFaceKey>(clip, 'expression', index, key => {
    const next: ClipFaceKey = { ...key, ...change }
    if (!next.cut) delete next.cut
    return next
  })

// Reading clips from files and storage.

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const numericSizes: Record<NumericTrackName, number> = {
  position: 2,
  rotation: 3,
  squash: 2,
  scale: 1,
  lids: 1,
}

/** A clip read from anywhere, checked key by key, or `null` when it is not one. */
export const parseClip = (value: unknown): ClipDefinition | null => {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  if (typeof source.name !== 'string' || !source.name.trim()) return null
  if (!isNumber(source.duration) || source.duration <= 0) return null
  if (!source.tracks || typeof source.tracks !== 'object') return null
  const tracksSource = source.tracks as Record<string, unknown>
  const tracks: ClipTracks = {}
  for (const track of Object.keys(numericSizes) as NumericTrackName[]) {
    const keys = tracksSource[track]
    if (keys === undefined) continue
    if (!Array.isArray(keys)) return null
    const parsed: NumericKey[] = []
    for (const key of keys as Record<string, unknown>[]) {
      if (!key || !isNumber(key.t) || !Array.isArray(key.v)) return null
      if (key.v.length !== numericSizes[track] || !key.v.every(isNumber)) return null
      const next: NumericKey = { t: key.t, v: [...(key.v as number[])] }
      if (key.ease !== undefined) {
        if (!Array.isArray(key.ease) || key.ease.length !== 4 || !key.ease.every(isNumber)) {
          return null
        }
        next.ease = [...(key.ease as number[])] as unknown as ClipEase
      }
      parsed.push(next)
    }
    if (parsed.length) (tracks as Record<string, unknown>)[track] = sorted(parsed)
  }
  const faces = tracksSource.expression
  if (faces !== undefined) {
    if (!Array.isArray(faces)) return null
    const parsed: ClipFaceKey[] = []
    for (const key of faces as Record<string, unknown>[]) {
      if (!key || !isNumber(key.t) || typeof key.v !== 'string') return null
      parsed.push(key.cut === true ? { t: key.t, v: key.v, cut: true } : { t: key.t, v: key.v })
    }
    if (parsed.length) tracks.expression = sorted(parsed)
  }
  const clip: ClipDefinition = {
    name: source.name.trim(),
    duration: source.duration,
    tracks,
  }
  if (typeof source.body === 'string') clip.body = source.body
  if (isNumber(source.squashAnchor)) clip.squashAnchor = source.squashAnchor
  const workArea = source.workArea as Record<string, unknown> | undefined
  if (workArea && isNumber(workArea.start) && isNumber(workArea.end)) {
    clip.workArea = { start: workArea.start, end: workArea.end }
  }
  const inspect = source.inspect as Record<string, unknown> | undefined
  if (inspect && isNumber(inspect.bias) && typeof inspect.follow === 'boolean') {
    clip.inspect = { bias: inspect.bias, follow: inspect.follow }
  }
  return clip
}

/**
 * The custom clips kept from a store: those that read, each under a name of its own. A name the
 * catalogue took since is numbered.
 */
export const parseCustomClips = (value: unknown): ClipDefinition[] => {
  if (!Array.isArray(value)) return []
  const result: ClipDefinition[] = []
  for (const item of value) {
    const clip = parseClip(item)
    if (clip) result.push({ ...clip, name: freeClipName(clip.name, result) })
  }
  return result
}

const STORAGE_KEY = 'bible-strong-avatar-studio-clips-v1'

export const loadCustomClips = (
  storage: Pick<Storage, 'getItem'> = window.localStorage
): ClipDefinition[] => {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as { clips?: unknown } | null
    return parseCustomClips(stored?.clips)
  } catch {
    return []
  }
}

export const persistCustomClips = (
  clips: readonly ClipDefinition[],
  storage: Pick<Storage, 'setItem'> = window.localStorage
) => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, clips }))
    return true
  } catch {
    return false
  }
}

/** The file a clip is saved to, and read back from. */
export const clipFileName = (clip: Readonly<ClipDefinition>) =>
  `${clip.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'clip'}.clip.json`

export const clipFileText = (clip: Readonly<ClipDefinition>) => JSON.stringify(clip, null, 2)
