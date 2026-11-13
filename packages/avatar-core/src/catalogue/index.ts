import type { ClipDefinition } from '../clips'
import clipsData from './clips.json'
import statesData from './states.json'

/** The clips every avatar can play, by name. */
export const clips: Readonly<Record<string, ClipDefinition>> = Object.fromEntries(
  (clipsData as unknown as ClipDefinition[]).map(clip => [clip.name, clip])
)

export const clipNames: readonly string[] = Object.keys(clips)

/**
 * What an avatar does in a state: the clips it draws from, and what holds while it lasts.
 * With `next` alone the clips play once, in order, then the next state starts. With `next` and
 * `holdSeconds` the next state starts when the time is up. Otherwise the clips are drawn
 * without end, each once per round, in a new order each round.
 */
export type StateDefinition = {
  clips: string[]
  /** The clips to draw from when the avatar is shown small. */
  compactClips?: string[]
  /** A face held for as long as the state lasts. */
  face?: string
  /** What the body turns into for as long as the state lasts. */
  morph?: string
  next?: string
  holdSeconds?: number
}

const stateCatalogue = statesData as unknown as {
  states: Record<string, StateDefinition>
  groups: { label: string; states: string[] }[]
}

export const states: Readonly<Record<string, StateDefinition>> = stateCatalogue.states
export const stateGroups: readonly { label: string; states: string[] }[] = stateCatalogue.groups
export const stateNames: readonly string[] = Object.keys(states)
