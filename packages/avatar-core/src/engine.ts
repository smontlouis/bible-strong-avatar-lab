import { clips, states, type StateDefinition } from './catalogue'
import { slerpQuaternion, type Quaternion } from './geometry'
import { clipEaseAt, type ClipDefinition } from './clips'
import { frameOrientation } from './turn'
import { inspectEyeScales, inspectLeanOfTurn } from './faces'
import {
  drawSpinner,
  SPINNER_PAUSE_SECONDS,
  spinnerOfMode,
  spinnerShotSeconds,
  type SpinnerDrawing,
  type SpinnerMark,
  type SpinnerPattern,
} from './spinners'
import {
  advancePlayer,
  createAvatarPlayer,
  holdPlayerFace,
  pausePlayer,
  stopPlayer,
  seekPlayer,
  JOIN_EASE,
  JOIN_SECONDS,
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

/** A value that follows its target like a weight on a spring, without overshooting it. */
type Spring = { at: number; speed: number }

const SPRING_STEP = 1 / 120

const pull = (spring: Spring, target: number, stiffness: number, seconds: number) => {
  const steps = Math.max(1, Math.ceil(seconds / SPRING_STEP))
  const step = seconds / steps
  for (let index = 0; index < steps; index += 1) {
    spring.speed +=
      (-2 * stiffness * spring.speed - stiffness * stiffness * (spring.at - target)) * step
    spring.at += spring.speed * step
  }
}

type ShownPattern = { pattern: SpinnerPattern; time: number; shot: number }

/** The body turning into a spinner, and back. */
type Morphing = {
  /** The pattern that shows, or the last that did while the body comes back. */
  current: ShownPattern | null
  /** The pattern that the current one is taking the place of. */
  leaving: ShownPattern | null
  /** How much the body has turned into the spinner, from 0 to 1. */
  amount: Spring
  /** How far the current pattern has taken the place of the one that leaves. */
  swap: Spring
  /** A half turn of the body each time it goes into a spinner or comes back, in radians. */
  spin: Spring
  spinTarget: number
  spinWay: number
  /** Whether the spinner shows now: a pattern that comes in shots is hidden between them. */
  showing: boolean
  random: Random
  /** The turn the body is brought to while it is a spinner: each angle at its nearest turn. */
  rest: [number, number, number]
}

/**
 * A pose set by hand, to place the avatar freely: for a picture, or to look at it from a side.
 * Each field that is given takes the place of what the clip asks; the others are left to it.
 */
export type FreePose = {
  /** About x, y and z, in degrees: looking down, turning to the right of the screen, rolling. */
  rotation?: [number, number, number]
  /**
   * The turn of the head given whole, as a tool that turns the avatar freely has it. It takes
   * the place of `rotation`; gestures and the gaze still turn the avatar on top of it.
   */
  orientation?: Quaternion
  /** Across and up, in body radii. */
  position?: [number, number]
  zoom?: number
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
  morphing: Morphing
  gestures: Gesture[]
  gaze: Gaze
  /** A pose set by hand: what it gives takes the place of what the clip asks. */
  pose: FreePose | null
  /** A pose set by hand that was let go: the body goes back from it to what the clip asks. */
  release: {
    from: { orientation: Quaternion; position: [number, number]; zoom: number }
    time: number
  } | null
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
  morphing: {
    current: null,
    leaving: null,
    amount: { at: 0, speed: 0 },
    swap: { at: 1, speed: 0 },
    spin: { at: 0, speed: 0 },
    spinTarget: 0,
    spinWay: 1,
    showing: false,
    random: { seed: 2654435769 | 0 },
    rest: [0, 0, 0],
  },
  gestures: [],
  gaze: { target: null, at: [0, 0], hold: 0, always: false },
  pose: null,
  release: null,
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

/** Ask the body to turn into a spinner, by the name a state gives it, or `null` to come back. */
export const setEngineMorph = (engine: AvatarEngine, mode: string | null) => {
  engine.morph = mode
  const pattern = mode === null ? undefined : spinnerOfMode[mode]
  const morphing = engine.morphing
  if (!pattern || morphing.current?.pattern === pattern) {
    if (morphing.current) morphing.current.shot = 0
    return
  }
  // A pattern that takes the place of another while it shows lets it leave as it comes in.
  if (morphing.current && morphing.amount.at > 0.02) {
    morphing.leaving = morphing.current
    morphing.swap = { at: 0, speed: 0 }
  } else {
    morphing.leaving = null
    morphing.swap = { at: 1, speed: 0 }
  }
  morphing.current = { pattern, time: 0, shot: 0 }
}

/** Put the avatar in a state of the catalogue. An unknown name changes nothing. */
export const setEngineState = (engine: AvatarEngine, name: string) => {
  const state = states[name]
  if (!state) return
  engine.state = name
  setEngineMorph(engine, state.morph ?? null)
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
  setEngineMorph(engine, null)
  holdPlayerFace(engine.player, null)
  engine.started = true
  playClip(engine.player, clip, options)
  engine.loopsSeen = engine.player.loopCount
}

/** Place the avatar by hand, or pass `null` to give it back to the clip that plays. */
export const setEnginePose = (engine: AvatarEngine, pose: FreePose | null) => {
  engine.pose = pose
  engine.release = null
}

/**
 * Let go of a pose set by hand: the body goes back from where it is to what the clip asks, in
 * the time of a join, instead of jumping there.
 */
export const releaseEnginePose = (engine: AvatarEngine) => {
  if (!engine.pose) return
  const frame = engineFrame(engine)
  engine.release = {
    from: {
      orientation: frameOrientation(frame),
      position: [frame.position[0], frame.position[1]],
      zoom: frame.zoom,
    },
    time: 0,
  }
  engine.pose = null
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

/**
 * Stop whatever the avatar does and leave it at rest, still: no state, no clip, no gesture, and
 * nothing it has turned into. It starts again when a state or a clip is asked for.
 */
export const stopEngine = (engine: AvatarEngine) => {
  engine.state = null
  engine.morph = null
  // Whatever the body had turned into is gone at once, with its turn.
  const morphing = engine.morphing
  morphing.current = null
  morphing.leaving = null
  morphing.amount = { at: 0, speed: 0 }
  morphing.swap = { at: 1, speed: 0 }
  morphing.spin = { at: 0, speed: 0 }
  morphing.spinTarget = 0
  morphing.showing = false
  engine.gestures = []
  engine.release = null
  stopPlayer(engine.player)
}

/** Put the clip that plays at a time, in seconds. The state that plays, if any, goes on from there. */
export const seekEngine = (engine: AvatarEngine, seconds: number) =>
  seekPlayer(engine.player, seconds)

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

const morphAmount = (engine: Readonly<AvatarEngine>) =>
  Math.max(0, Math.min(1, engine.morphing.amount.at))

const advanceMorphing = (engine: AvatarEngine, seconds: number) => {
  const morphing = engine.morphing
  const current = morphing.current
  let showing = false
  if (current && engine.morph !== null && spinnerOfMode[engine.morph] === current.pattern) {
    current.shot += seconds
    const shotSeconds = spinnerShotSeconds[current.pattern]
    showing = true
    if (shotSeconds !== undefined && current.shot >= shotSeconds) {
      // Between two shots the avatar comes back for a moment.
      showing = false
      if (current.shot >= shotSeconds + SPINNER_PAUSE_SECONDS) {
        current.shot = 0
        showing = true
      }
    }
  }
  if (current) current.time += seconds
  if (morphing.leaving) morphing.leaving.time += seconds

  if (showing !== morphing.showing) {
    morphing.showing = showing
    if (showing) {
      morphing.spinWay = nextRandom(morphing.random) < 0.5 ? 1 : -1
      const turn = engine.player.pose.rotation
      morphing.rest = [
        Math.round(turn[0] / 360) * 360,
        Math.round(turn[1] / 360) * 360,
        Math.round(turn[2] / 360) * 360,
      ]
    }
    morphing.spinTarget += Math.PI * morphing.spinWay
  }
  pull(morphing.amount, showing ? 1 : 0, 14, seconds)
  pull(morphing.swap, 1, 11, seconds)
  pull(morphing.spin, morphing.spinTarget, 14, seconds)
  if (morphing.leaving && morphing.swap.at > 0.996) morphing.leaving = null
  if (!showing && engine.morph === null && morphing.amount.at < 0.001 && morphing.current) {
    morphing.current = null
    morphing.leaving = null
    morphing.amount = { at: 0, speed: 0 }
  }
}

/** Move the engine forward by a time, in seconds. */
export const advanceEngine = (engine: AvatarEngine, seconds: number) => {
  const step = Math.max(0, Math.min(MAX_STEP_SECONDS, seconds))
  advanceDirector(engine, step)
  advanceMorphing(engine, step)
  // A body that has turned into a spinner has stopped its choreography.
  advancePlayer(engine.player, step, 1 - morphAmount(engine))

  if (engine.release) {
    engine.release.time += step
    if (engine.release.time >= JOIN_SECONDS) engine.release = null
  }

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

/** The spinner a body has turned into, wholly or in part. */
export type SpinnerFrame = {
  /** How much the body has turned into the spinner, from 0 to 1. */
  amount: number
  /** How round the body has become, from 0 to 1: it is a plain disc before it is small. */
  round: number
  /** The disc the body becomes: its radius in body radii, where it is, how it is turned. */
  core: SpinnerDrawing['core']
  /** The marks around the disc, in body radii from the middle of the view. */
  marks: SpinnerMark[]
}

export type EngineFrame = PlayerFrame & {
  spinner: SpinnerFrame | null
  /**
   * The turn of the head when a pose set by hand gives it whole. `rotation` is then only what
   * gestures and the gaze add to it.
   */
  orientation?: Quaternion
}

const ROUND_BY = 0.62

const spinnerFrame = (engine: Readonly<AvatarEngine>): SpinnerFrame | null => {
  const morphing = engine.morphing
  const amount = morphAmount(engine)
  if (!morphing.current || amount <= 0.0005) return null
  const swap = Math.max(0, Math.min(1, morphing.swap.at))
  const arriving = drawSpinner(
    morphing.current.pattern,
    amount * (morphing.leaving ? swap : 1),
    morphing.current.time,
    morphing.current.shot
  )
  let core = arriving.core
  let marks = arriving.marks
  if (morphing.leaving) {
    const leaving = drawSpinner(
      morphing.leaving.pattern,
      amount * (1 - swap),
      morphing.leaving.time,
      morphing.leaving.shot
    )
    const between = (from: number, to: number) => from + (to - from) * swap
    core = {
      radius: between(leaving.core.radius, arriving.core.radius),
      x: leaving.core.x + arriving.core.x,
      y: leaving.core.y + arriving.core.y,
      turn: leaving.core.turn + arriving.core.turn,
      opacity: between(leaving.core.opacity, arriving.core.opacity),
      drop: swap > 0.5 ? arriving.core.drop : leaving.core.drop,
    }
    marks = [...leaving.marks, ...marks]
  }
  const share = Math.max(0, Math.min(1, amount / ROUND_BY))
  const round = share < 0.5 ? 4 * share ** 3 : 1 - (-2 * share + 2) ** 3 / 2
  return { amount, round, core, marks }
}

/** Everything a renderer needs to draw the avatar now: the clip, the gestures and the gaze. */
export const engineFrame = (engine: Readonly<AvatarEngine>): EngineFrame => {
  const frame: EngineFrame = { ...playerFrame(engine.player), spinner: spinnerFrame(engine) }

  // A body that turns into a spinner gives up its pose as it goes: it comes to rest, upright.
  if (frame.spinner) {
    const left = 1 - frame.spinner.amount
    const rest = engine.morphing.rest
    frame.rotation[0] = rest[0] + (frame.rotation[0] - rest[0]) * left
    frame.rotation[1] = rest[1] + (frame.rotation[1] - rest[1]) * left
    frame.rotation[2] = rest[2] + (frame.rotation[2] - rest[2]) * left
    frame.position[0] *= left
    frame.position[1] *= left
    frame.squash[0] = 1 + (frame.squash[0] - 1) * left
    frame.squash[1] = 1 + (frame.squash[1] - 1) * left
  }

  const pose = engine.pose
  if (pose) {
    if (pose.rotation) frame.rotation = [pose.rotation[0], pose.rotation[1], pose.rotation[2]]
    if (pose.position) frame.position = [pose.position[0], pose.position[1]]
    if (pose.zoom !== undefined) frame.zoom = pose.zoom
    if (pose.orientation) {
      // The turn is given whole. What gestures and the gaze add is kept apart, counted from
      // nothing, and laid over that turn when the avatar is drawn.
      frame.orientation = pose.orientation
      frame.rotation = [0, 0, 0]
    }
  }

  const release = engine.release
  if (release && !pose) {
    const progress = clipEaseAt(JOIN_EASE, Math.min(1, release.time / JOIN_SECONDS))
    const { from } = release
    frame.orientation = slerpQuaternion(from.orientation, frameOrientation(frame), progress)
    frame.rotation = [0, 0, 0]
    frame.position = [
      from.position[0] + (frame.position[0] - from.position[0]) * progress,
      from.position[1] + (frame.position[1] - from.position[1]) * progress,
    ]
    frame.zoom = from.zoom + (frame.zoom - from.zoom) * progress
  }

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
  // Going into a spinner and coming back, the body makes half a turn.
  const spin = engine.morphing.spin.at % (Math.PI * 2)
  if (Math.abs(spin) > 1e-6) frame.rotation[1] += (spin * 180) / Math.PI
  return frame
}
