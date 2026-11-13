import {
  advanceEngine,
  clips,
  createAvatarEngine,
  engineFrame,
  pauseEngine,
  playEngineClip,
  pokeEngine,
  renderCharacterFrame,
  resumeEngine,
  setEngineCompact,
  setEngineEmphasis,
  setEngineFace,
  setEngineLookAt,
  setEngineState,
  engineAtRest,
  type AvatarCharacter,
  type AvatarEngine,
  type CharacterScene,
  type GestureName,
} from '@bible-strong/avatar-core'

// Every function of this file but `createAvatarRun` runs on the UI thread, inside the frame
// callback of `Avatar`. Each carries the `worklet` directive and reaches the core through
// Bundle Mode's import forwarding. None touches React or React Native, so they are tested in
// plain Node.

/** A spinner draws at most this many marks at once, two patterns crossing included. */
export const MARK_SLOTS = 12
// How long the avatar is run to find a pose to hold for someone who asked for less motion.
const SETTLE_STEPS = 60
const SETTLE_STEP_SECONDS = 0.1
// Below this the eyelids are open: a pose the avatar can hold.
const OPEN_LIDS = 0.05

/** What React asks of the avatar. `seq` grows by one with each command of a component. */
export type AvatarCommand = { seq: number } & (
  | { type: 'state'; state: string }
  | { type: 'clip'; clip: string }
  | { type: 'face'; face: string | null }
  | { type: 'emphasis'; emphasis: boolean }
  | { type: 'compact'; compact: boolean }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'poke'; gesture: GestureName; turns: number }
  | { type: 'look'; target: [number, number] | null }
  // Draw again, for a setting that changed outside the engine.
  | { type: 'wake' }
)

/** One avatar as the UI thread runs it: the engine, and when it was last drawn and asked. */
export type AvatarRun = {
  engine: AvatarEngine
  paused: boolean
  /** When the last frame was drawn, or 0 for none since the avatar last stood still. */
  renderedAt: number
  /** When the last command came, for `settleAfterMs`. */
  commandAt: number
  /** Nothing moves until the next command: the frame callback can stop. */
  idle: boolean
  /** `seq` of the last command applied. */
  processed: number
}

export type RunSettings = {
  reduceMotion: boolean
  /** Hold the pose this long after the last command, eyes open. 0 keeps the avatar moving. */
  settleAfterMs: number
}

/** One mark of a spinner. A filled mark has no stroke; a line has no fill. */
export type PaintedMark = { d: string; opacity: number; strokeWidth: number }

/** The paths, colours and placement of one frame, as the SVG elements read them. */
export type PaintedFrame = {
  head: string
  left: string
  right: string
  nose: string
  mouth: string
  back: string[]
  front: string[]
  /** One clip per front path; empty when the path is drawn whole. */
  frontClips: string[]
  backColors: string[]
  frontColors: string[]
  body: string
  eyes: string
  /** How the body is moved, as SVG writes `matrix(a b c d e f)`. */
  matrix: number[]
  bodyOpacity: number
  /** How much of the body's parts and face shows: 0 once the body is a spinner's disc. */
  fading: number
  disc: string
  discOpacity: number
  marks: PaintedMark[]
}

export type AvatarStart = {
  seed: number
  compact: boolean
  emphasis: boolean
  state?: string
  clip?: string
  face?: string
  lookAt?: [number, number] | null
  paused: boolean
}

/** Start an avatar's run: the engine in the state, or on the clip, it is first given. */
export const createAvatarRun = (start: AvatarStart): AvatarRun => {
  const engine = createAvatarEngine({ seed: start.seed, compact: start.compact })
  setEngineEmphasis(engine, start.emphasis)
  if (start.state === undefined && start.clip !== undefined && clips[start.clip]) {
    playEngineClip(engine, clips[start.clip])
  } else {
    setEngineState(engine, start.state ?? 'idle')
  }
  if (start.face !== undefined) setEngineFace(engine, start.face)
  if (start.lookAt) setEngineLookAt(engine, start.lookAt)
  if (start.paused) pauseEngine(engine)
  return { engine, paused: start.paused, renderedAt: 0, commandAt: 0, idle: false, processed: 0 }
}

export const paintCharacterScene = (scene: CharacterScene): PaintedFrame => {
  'worklet'
  const { geometry, colors, bodyColors, transform, spinner } = scene
  const round = spinner?.round ?? 0
  const marks: PaintedMark[] = []
  for (let index = 0; index < MARK_SLOTS; index += 1) {
    const mark = spinner?.marks[index]
    marks.push(
      mark
        ? { d: mark.d, opacity: mark.opacity, strokeWidth: mark.strokeWidth ?? 0 }
        : { d: '', opacity: 0, strokeWidth: 0 }
    )
  }
  return {
    head: round >= 0.999 ? '' : geometry.headPath,
    left: geometry.leftVisible ? geometry.leftPath : '',
    right: geometry.rightVisible ? geometry.rightPath : '',
    nose: geometry.nosePath,
    mouth: geometry.mouthPath,
    back: geometry.backPaths,
    front: geometry.frontPaths,
    frontClips: geometry.frontClipPaths,
    backColors: bodyColors.back,
    frontColors: bodyColors.front,
    body: colors.body,
    eyes: colors.eyes,
    matrix: [...transform],
    bodyOpacity: spinner?.opacity ?? 1,
    fading: 1 - round,
    disc: spinner && round > 0 ? spinner.disc : '',
    discOpacity: round,
    marks,
  }
}

/** The grey of a hex colour at the same lightness. Any other colour is returned unchanged. */
export const greyOf = (color: string) => {
  'worklet'
  const short = /^#[0-9a-f]{3}$/i.test(color)
  if (!short && !/^#[0-9a-f]{6}$/i.test(color)) return color
  const hex = short
    ? `${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color.slice(1)
  const value = parseInt(hex, 16)
  const level = Math.round(
    0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)
  )
  return `rgb(${level}, ${level}, ${level})`
}

/** Apply a command to the run, in place. */
export const applyAvatarCommand = (run: AvatarRun, command: AvatarCommand, now: number) => {
  'worklet'
  const engine = run.engine
  // An avatar that stood still starts again from where it was, without a jump in time.
  if (run.idle) run.renderedAt = 0
  run.idle = false
  run.commandAt = now
  run.processed = command.seq
  switch (command.type) {
    case 'state':
      setEngineState(engine, command.state)
      break
    case 'clip':
      if (clips[command.clip]) playEngineClip(engine, clips[command.clip])
      break
    case 'face':
      setEngineFace(engine, command.face)
      break
    case 'emphasis':
      setEngineEmphasis(engine, command.emphasis)
      break
    case 'compact':
      setEngineCompact(engine, command.compact)
      break
    case 'pause':
      run.paused = true
      pauseEngine(engine)
      break
    case 'resume':
      run.paused = false
      resumeEngine(engine)
      break
    case 'poke':
      pokeEngine(engine, command.gesture, command.turns)
      break
    case 'look':
      setEngineLookAt(engine, command.target)
      break
    case 'wake':
      break
  }
  // A paused avatar keeps what it is asked for until it goes on.
  if (run.paused) pauseEngine(engine)
}

/**
 * Advance the run to `now` and draw its frame, in place. It says when the avatar can stand
 * still: paused, settled for someone who asked for less motion, or held after
 * `settleAfterMs`.
 */
export const stepAvatarRun = (
  character: Readonly<AvatarCharacter>,
  run: AvatarRun,
  now: number,
  settings: RunSettings
): PaintedFrame => {
  'worklet'
  const engine = run.engine
  // The first frame is when the avatar was first asked for something.
  if (run.commandAt === 0) run.commandAt = now
  if (settings.reduceMotion && !run.paused) {
    for (let step = 0; step < SETTLE_STEPS; step += 1) advanceEngine(engine, SETTLE_STEP_SECONDS)
  } else if (!run.paused) {
    // A frame that comes late does not throw the avatar: the engine caps its own step.
    advanceEngine(engine, run.renderedAt === 0 ? 0 : (now - run.renderedAt) / 1000)
  }
  run.renderedAt = now
  const frame = engineFrame(engine)
  const held =
    settings.settleAfterMs > 0 &&
    now - run.commandAt >= settings.settleAfterMs &&
    frame.lids < OPEN_LIDS &&
    engineAtRest(engine)
  run.idle = run.paused || settings.reduceMotion || held
  return paintCharacterScene(renderCharacterFrame(character, frame))
}
