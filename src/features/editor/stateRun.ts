import {
  advanceEngine,
  createAvatarEngine,
  engineClipOf,
  engineFrame,
  engineStateOf,
  faces,
  faceSmiles,
  FACE_SECONDS,
  setEngineHandover,
  setEngineState,
  type AvatarEngine,
  type ClipDefinition,
  type EngineFrame,
  type StateDefinition,
} from '@bible-strong/avatar-core'

import { MAX_SHEET_FRAMES } from '@/features/editor/clipFrames'
import { ruleOf } from '@/features/editor/stateLibrary'

// The run of a state: what an engine does from the moment it enters the state, played by an
// engine of its own with a fixed seed. Which clip plays when, each play of a clip apart, when the
// state hands over and to what, and what the body turns into. It is what a person reads on the
// timeline of a state and what an agent reads to check one.

export type EngineLibraryInput = {
  clips: Record<string, ClipDefinition>
  states: Record<string, StateDefinition>
}

export type RunSegment = {
  from: number
  to: number
  /** The state that plays. It changes when the state hands over. */
  state: string
  clip: string
  /** What the body is turned into, by the state's name for it. */
  morph: string | null
  /** The face held by the state, if any. */
  face: string | null
  /** Whether the body is being led to the clip's rest pose, before the clip plays. */
  joining: boolean
}

// A step where a clip ends, joins back to itself and gives way to the next is not a play.
const MIN_SEGMENT_SECONDS = 0.05

// The run is read every sixtieth of a second, and its times are given to the hundredth.
const STEP = 1 / 60

/** How long to run a state to see what it does: its rounds, its time, its hand-over and after. */
export const runSeconds = (library: EngineLibraryInput, name: string) => {
  const engine = createAvatarEngine(library)
  const state = engineStateOf(engine, name)
  if (!state) return 0
  const durations = state.clips.map(clip => engineClipOf(engine, clip)?.duration ?? 0)
  const round = durations.reduce((sum, value) => sum + value, 0)
  const rule = ruleOf(state)
  const seconds =
    rule === 'timed'
      ? state.holdSeconds! + 6
      : rule === 'sequence'
        ? round + 6
        : Math.max(12, round * 2)
  return Math.min(60, Math.max(4, Math.ceil(seconds)))
}

/** The clip's face, or the state's, on from the start, as on an avatar that has been in it. */
const settleFace = (engine: AvatarEngine) => {
  const player = engine.player
  const face = player.faceOverride ?? player.heldFace ?? player.clipFace
  player.face = face
  player.faceFrom = [faces[face].eyes[0], faces[face].eyes[1]]
  player.inspectFrom = face === 'inspecting' ? 1 : 0
  player.smileFrom = faceSmiles[face]
  player.faceTime = FACE_SECONDS
}

const start = (library: EngineLibraryInput, name: string, handover: boolean) => {
  const engine = createAvatarEngine({ seed: 1, ...library })
  // As in an app that goes into the state from another: its first clip starts at its beginning.
  // Only a brand new avatar starts its very first clip partway through.
  engine.started = true
  setEngineHandover(engine, handover)
  setEngineState(engine, name)
  settleFace(engine)
  return engine
}

export const stateRun = (
  library: EngineLibraryInput,
  name: string,
  { seconds = runSeconds(library, name), handover = true } = {}
): RunSegment[] => {
  const engine = start(library, name, handover)
  const segments: RunSegment[] = []
  let loops = engine.player.loopCount
  const read = () => ({
    state: engine.state ?? '',
    clip: engine.player.clip?.name ?? '',
    morph: engine.morph,
    face: engine.player.heldFace,
    joining: engine.player.join !== null,
  })
  let current = { ...read(), from: 0 }
  for (let time = 0; time < seconds - 1e-9; time += STEP) {
    advanceEngine(engine, STEP)
    const now = read()
    const played = engine.player.loopCount !== loops
    loops = engine.player.loopCount
    if (
      played ||
      now.state !== current.state ||
      now.clip !== current.clip ||
      now.morph !== current.morph ||
      now.joining !== current.joining
    ) {
      const at = Math.round((time + STEP) * 100) / 100
      segments.push({ ...current, to: at })
      current = { ...now, from: at }
    }
  }
  segments.push({ ...current, to: seconds })
  return segments.filter(segment => segment.to - segment.from >= MIN_SEGMENT_SECONDS)
}

export type StateSheetFrame = { index: number; time: number; frame: EngineFrame; clip: string }

/** The frames of a state's run, at a rate, as the sheet of a clip draws them. */
export const stateSheet = (
  library: EngineLibraryInput,
  name: string,
  fps: number,
  { seconds = runSeconds(library, name), handover = true } = {}
): StateSheetFrame[] => {
  const engine = start(library, name, handover)
  const step = Math.max(1 / fps, seconds / (MAX_SHEET_FRAMES - 1))
  const frames: StateSheetFrame[] = []
  let now = 0
  for (let index = 0; index * step <= seconds + 1e-9; index += 1) {
    const target = index * step
    while (now < target - 1e-9) {
      const advance = Math.min(0.05, target - now)
      advanceEngine(engine, advance)
      now += advance
    }
    frames.push({
      index,
      time: Math.round(target * 1000) / 1000,
      frame: engineFrame(engine),
      clip: engine.player.clip?.name ?? '',
    })
  }
  return frames
}
