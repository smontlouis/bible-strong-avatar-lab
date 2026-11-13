import { clips, states, type StateDefinition } from './catalogue'
import type { ClipDefinition } from './clips'
import { inspectEyeScales, inspectLeanOfTurn } from './faces'
import {
  advancePlayer,
  createAvatarPlayer,
  holdPlayerFace,
  pausePlayer,
  playClip,
  playerFrame,
  resumePlayer,
  setPlayerFace,
  type AvatarPlayer,
  type PlayerFrame,
} from './player'

// The engine. Around the player, which plays one clip, it keeps what makes an avatar alive: a
// state that draws clips without repeating itself, gestures laid over the clip that plays, and
// a gaze that follows a point. It is plain data moved forward by plain functions.

/** A generator of numbers from 0 to 1 that gives the same run for the same seed. */
type Random = { seed: number }

const nextRandom = (random: Random) => {
  random.seed = (random.seed + 1831565813) | 0
  let value = Math.imul(random.seed ^ (random.seed >>> 15), random.seed | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

/** A seed for a name, so that two avatars with two names do not move as one. */
export const seedOfName = (name: string) => {
  let hash = 2166136261
  for (let index = 0; index < name.length; index += 1) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

export const gestureNames = ['nod', 'bounce', 'spin'] as const
export type GestureName = (typeof gestureNames)[number]

type Gesture = { name: GestureName; time: number; turns: number }

type Gaze = {
  /** Where the avatar is asked to look, each from -1 to 1: to the right, and up. */
  target: [number, number] | null
  /** Where it looks now: the target, reached smoothly. */
  at: [number, number]
  /** How much the gaze weighs, from 0 to 1: it comes and goes smoothly. */
  hold: number
  /** Whether the gaze is laid over a clip that plays. If not, it only acts on a still body. */
  always: boolean
}

export type AvatarEngine = {
  player: AvatarPlayer
  random: Random
  /** The state that draws the clips, or `null` when a clip was asked for by name. */
  state: string | null
  /** The clips left to draw in each list of clips, by the list's own content. */
  bags: Record<string, string[]>
  lastClip: string | null
  /** In a state that plays its clips in order: which one plays. */
  index: number
  /** Seconds spent in the state. */
  stateTime: number
  loopsSeen: number
  /** Whether a first clip has been drawn: only the very first starts partway through. */
  started: boolean
  /** Shown small: a state that has a shorter list of clips uses it. */
  compact: boolean
  /** A state without a face of its own holds `surprised`. */
  emphasis: boolean
  /** What the body is asked to turn into, by the state. */
  morph: string | null
  gestures: Gesture[]
  gaze: Gaze
}

export const createAvatarEngine = (
  options: { seed?: number; compact?: boolean } = {}
): AvatarEngine => ({
  player: createAvatarPlayer(),
  random: { seed: options.seed ?? 1 },
  state: null,
  bags: {},
  lastClip: null,
  index: 0,
  stateTime: 0,
  loopsSeen: 0,
  started: false,
  compact: options.compact ?? false,
  emphasis: false,
  morph: null,
  gestures: [],
  gaze: { target: null, at: [0, 0], hold: 0, always: false },
})

const listOf = (engine: Readonly<AvatarEngine>, state: Readonly<StateDefinition>) =>
  engine.compact && state.compactClips ? state.compactClips : state.clips

/** Whether a state plays its clips once, in order, before it gives way to the next state. */
const inOrder = (state: Readonly<StateDefinition>) =>
  state.next !== undefined && state.holdSeconds === undefined

/**
 * Draw the next clip of a list. Each clip of the list comes once per round, in an order drawn
 * anew each round; a clip listed three times comes three times. A round does not start on the
 * clip the last one ended on, when the list has another to offer.
 */
const draw = (engine: AvatarEngine, list: readonly string[]) => {
  // States that share a list share its rounds: going from one to the other does not start over.
  const key = list.join('|')
  let bag = engine.bags[key]
  if (!bag || bag.length === 0) {
    bag = [...list]
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const other = Math.floor(nextRandom(engine.random) * (index + 1))
      const moved = bag[index]
      bag[index] = bag[other]
      bag[other] = moved
    }
    const fresh = bag.findIndex(name => name !== engine.lastClip)
    if (fresh > 0) {
      const moved = bag[0]
      bag[0] = bag[fresh]
      bag[fresh] = moved
    }
    engine.bags[key] = bag
  }
  return bag.shift()!
}

const pick = (engine: AvatarEngine) => {
  const state = engine.state === null ? undefined : states[engine.state]
  if (!state) return
  const list = listOf(engine, state)
  const ordered = inOrder(state)
  const name = ordered ? list[Math.min(engine.index, list.length - 1)] : draw(engine, list)
  engine.lastClip = name
  // Only the very first clip starts partway through, so that two avatars started together do
  // not move together.
  const phase = engine.started || ordered ? 0 : nextRandom(engine.random)
  engine.started = true
  engine.loopsSeen = engine.player.loopCount
  // The clip that already plays goes on: it is not started again.
  if (engine.player.clip?.name === name && engine.player.playing) return
  const clip = clips[name]
  if (clip) playClip(engine.player, clip, { phase })
  engine.loopsSeen = engine.player.loopCount
}

/** Put the avatar in a state of the catalogue. An unknown name changes nothing. */
export const setEngineState = (engine: AvatarEngine, name: string) => {
  const state = states[name]
  if (!state) return
  engine.state = name
  engine.morph = state.morph ?? null
  holdPlayerFace(engine.player, state.face ?? (engine.emphasis ? 'surprised' : null))
  engine.index = 0
  engine.stateTime = 0
  pick(engine)
}

/** Play one clip, outside any state. */
export const playEngineClip = (
  engine: AvatarEngine,
  clip: ClipDefinition,
  options: { phase?: number; transition?: 'join' | 'cut' } = {}
) => {
  engine.state = null
  engine.morph = null
  holdPlayerFace(engine.player, null)
  engine.started = true
  playClip(engine.player, clip, options)
  engine.loopsSeen = engine.player.loopCount
}

export const setEngineFace = (engine: AvatarEngine, face: string | null) =>
  setPlayerFace(engine.player, face)

export const setEngineCompact = (engine: AvatarEngine, compact: boolean) => {
  engine.compact = compact
}

export const setEngineEmphasis = (engine: AvatarEngine, emphasis: boolean) => {
  engine.emphasis = emphasis
  const state = engine.state === null ? undefined : states[engine.state]
  if (state && !state.face) holdPlayerFace(engine.player, emphasis ? 'surprised' : null)
}

export const pauseEngine = (engine: AvatarEngine) => pausePlayer(engine.player)
export const resumeEngine = (engine: AvatarEngine) => resumePlayer(engine.player)

/** Lay a gesture over what plays. Gestures add up: a second one does not wait for the first. */
export const pokeEngine = (engine: AvatarEngine, name: GestureName, turns = 1) => {
  engine.gestures.push({ name, time: 0, turns: Math.max(1, Math.round(turns)) })
}

/**
 * Ask the avatar to look at a point: `x` to the right and `y` up, each from -1 to 1, or `null`
 * to look nowhere in particular.
 */
export const setEngineGaze = (engine: AvatarEngine, target: [number, number] | null) => {
  const gaze = engine.gaze
  if (target === null) {
    gaze.target = null
    return
  }
  const clamped: [number, number] = [
    Math.max(-1, Math.min(1, target[0])),
    Math.max(-1, Math.min(1, target[1])),
  ]
  // A gaze that starts from nothing starts on its target: it does not sweep in from the middle.
  if (gaze.hold === 0) gaze.at = [clamped[0], clamped[1]]
  gaze.target = clamped
}

export const setEngineGazeAlways = (engine: AvatarEngine, always: boolean) => {
  engine.gaze.always = always
}

const gestureSeconds = (gesture: Readonly<Gesture>) =>
  gesture.name === 'spin' ? 0.9 + 0.4 * (gesture.turns - 1) : gesture.name === 'nod' ? 0.5 : 0.62

const MAX_STEP_SECONDS = 0.1
// How much of the way to its target the gaze covers in a sixtieth of a second.
const GAZE_CATCH_UP = 0.14
// The gaze weighs this much over a clip that plays: the clip keeps the lead.
const GAZE_OVER_CLIP = 0.55

const advanceDirector = (engine: AvatarEngine, seconds: number) => {
  const state = engine.state === null ? undefined : states[engine.state]
  if (!state) return
  engine.stateTime += seconds
  if (state.next !== undefined && state.holdSeconds !== undefined) {
    if (engine.stateTime >= state.holdSeconds) {
      setEngineState(engine, state.next)
      return
    }
  }
  if (engine.player.loopCount === engine.loopsSeen) return
  // The clip has reached its end.
  engine.loopsSeen = engine.player.loopCount
  if (inOrder(state)) {
    engine.index += 1
    if (engine.index >= listOf(engine, state).length) {
      setEngineState(engine, state.next!)
      return
    }
  }
  pick(engine)
}

/** Move the engine forward by a time, in seconds. */
export const advanceEngine = (engine: AvatarEngine, seconds: number) => {
  const step = Math.max(0, Math.min(MAX_STEP_SECONDS, seconds))
  advanceDirector(engine, step)
  advancePlayer(engine.player, step)

  for (const gesture of engine.gestures) gesture.time += step
  if (engine.gestures.some(gesture => gesture.time >= gestureSeconds(gesture))) {
    engine.gestures = engine.gestures.filter(gesture => gesture.time < gestureSeconds(gesture))
  }

  const gaze = engine.gaze
  const share = 1 - (1 - GAZE_CATCH_UP) ** (step * 60)
  const wanted = gaze.target ? 1 : 0
  gaze.hold += (wanted - gaze.hold) * share
  if (Math.abs(wanted - gaze.hold) < 0.001) gaze.hold = wanted
  if (gaze.target) {
    gaze.at[0] += (gaze.target[0] - gaze.at[0]) * share
    gaze.at[1] += (gaze.target[1] - gaze.at[1]) * share
  }
}

/** The swell of a gesture between two shares of its time: up from nothing and back. */
const swell = (progress: number, from: number, to: number) =>
  progress > from && progress < to ? Math.sin((Math.PI * (progress - from)) / (to - from)) ** 2 : 0

/** Everything a renderer needs to draw the avatar now: the clip, the gestures and the gaze. */
export const engineFrame = (engine: Readonly<AvatarEngine>): PlayerFrame => {
  const frame = playerFrame(engine.player)

  const gaze = engine.gaze
  if (gaze.hold > 0) {
    const turnX = -14 * gaze.at[1]
    const turnY = 18 * gaze.at[0]
    const moveX = 0.03 * gaze.at[0]
    const moveY = 0.024 * gaze.at[1]
    if (engine.player.playing) {
      if (gaze.always) {
        const weight = GAZE_OVER_CLIP * gaze.hold
        frame.rotation[0] += turnX * weight
        frame.rotation[1] += turnY * weight
        frame.position[0] += moveX * weight
        frame.position[1] += moveY * weight
      }
    } else {
      // A still body turns to what it looks at.
      frame.rotation[0] += (turnX - frame.rotation[0]) * gaze.hold
      frame.rotation[1] += (turnY - frame.rotation[1]) * gaze.hold
      frame.rotation[2] *= 1 - gaze.hold
      frame.position[0] += (moveX - frame.position[0]) * gaze.hold
      frame.position[1] += (moveY - frame.position[1]) * gaze.hold
    }
  }

  // Gestures are laid over the clip: turns and moves add up, stretches multiply.
  for (const gesture of engine.gestures) {
    const progress = Math.min(1, gesture.time / gestureSeconds(gesture))
    if (gesture.name === 'spin') {
      frame.rotation[1] += 180 * gesture.turns * (1 - Math.cos(Math.PI * progress))
    } else if (gesture.name === 'nod') {
      frame.rotation[0] += 16 * Math.sin(Math.PI * progress) ** 2
    } else {
      const crouch = swell(progress, 0, 0.18) + swell(progress, 0.82, 1)
      const flight = swell(progress, 0.18, 0.82)
      const airborne = Math.max(0, Math.min(1, (progress - 0.14) / 0.72))
      frame.position[1] += 0.3 * Math.sin(Math.PI * airborne)
      frame.squash[0] *= 1 + 0.08 * crouch - 0.04 * flight
      frame.squash[1] *= 1 - 0.1 * crouch + 0.06 * flight
    }
  }

  // Which eye of `inspecting` is the large one follows the turn of the head as it is drawn,
  // gaze and gestures included.
  const inspect = engine.player.clip?.inspect
  if (frame.inspectWeight > 0 && (!inspect || inspect.follow)) {
    frame.eyeScales = inspectEyeScales(frame.inspectWeight, inspectLeanOfTurn(frame.rotation[1]))
  }
  return frame
}
