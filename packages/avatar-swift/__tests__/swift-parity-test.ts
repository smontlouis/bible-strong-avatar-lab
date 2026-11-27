import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  advanceEngine,
  avatarCharacterSchema,
  createAvatarEngine,
  engineClipOf,
  engineFrame,
  pauseEngine,
  playEngineClip,
  pokeEngine,
  readAvatarLibrary,
  releaseEnginePose,
  resumeEngine,
  seekEngine,
  setEngineCompact,
  setEngineEmphasis,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEngineHandover,
  setEngineLookAt,
  setEngineMorph,
  setEnginePose,
  setEngineState,
  type AvatarEngine,
  type GestureName,
} from '@bible-strong/avatar-core'

// AvatarSwift is a second implementation of avatar-core. The files written here are what
// avatar-core does; the Swift tests (`ParityTests.swift`) play the same scenes and must find the
// same frames, and read character files against the same schema. After a change of the engine
// or of the character format, run `pnpm swift:parity`, then port the change to Swift until
// `swift test` passes.

const swift = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const parity = path.join(swift, 'parity')
const update = process.env.SWIFT_PARITY_UPDATE === '1'

type Step = [string, ...unknown[]]
type Scene = { id: string; seed?: number; compact?: boolean; library?: boolean; steps: Step[] }

const DT = 1 / 60
const round = (value: number) => {
  const rounded = Number(value.toFixed(9))
  return Object.is(rounded, -0) ? 0 : rounded
}

const snapshot = (engine: AvatarEngine) => {
  const frame = engineFrame(engine)
  return {
    state: engine.state,
    clip: engine.player.clip?.name ?? null,
    clipTime: round(engine.player.time),
    face: frame.face,
    position: frame.position.map(round),
    rotation: frame.rotation.map(round),
    squash: frame.squash.map(round),
    zoom: round(frame.zoom),
    lids: round(frame.lids),
    opacity: round(frame.opacity),
    eyeSize: round(frame.eyeSize),
    squashAnchor: round(frame.squashAnchor),
    eyeScales: frame.eyeScales.map(round),
    smile: round(frame.smile),
    orientation: frame.orientation ? frame.orientation.map(round) : null,
    spinner: frame.spinner
      ? {
          amount: round(frame.spinner.amount),
          round: round(frame.spinner.round),
          radius: round(frame.spinner.core.radius),
          x: round(frame.spinner.core.x),
          y: round(frame.spinner.core.y),
          turn: round(frame.spinner.core.turn),
          opacity: round(frame.spinner.core.opacity),
          drop: frame.spinner.core.drop ?? false,
          marks: frame.spinner.marks.length,
        }
      : null,
  }
}

const play = (scene: Scene, library: ReturnType<typeof readAvatarLibrary>['library']) => {
  const engine = createAvatarEngine({
    seed: scene.seed ?? 26,
    compact: scene.compact ?? false,
    ...(scene.library ? library : {}),
  })
  const frames: { time: number; frame: ReturnType<typeof snapshot> }[] = []
  let time = 0
  for (const [op, ...args] of scene.steps) {
    const [a, b] = args as [never, never]
    if (op === 'state') setEngineState(engine, a)
    else if (op === 'clip') {
      const clip = engineClipOf(engine, a)
      if (!clip) throw new Error(`${scene.id}: unknown clip ${String(a)}`)
      playEngineClip(engine, clip, { phase: b ?? 0 })
    } else if (op === 'morph') setEngineMorph(engine, a)
    else if (op === 'face') setEngineFace(engine, a)
    else if (op === 'emphasis') setEngineEmphasis(engine, a)
    else if (op === 'compact') setEngineCompact(engine, a)
    else if (op === 'handover') setEngineHandover(engine, a)
    else if (op === 'gaze') setEngineGaze(engine, a)
    else if (op === 'gazeAlways') setEngineGazeAlways(engine, a)
    else if (op === 'lookAt') setEngineLookAt(engine, a)
    else if (op === 'pose') setEnginePose(engine, a)
    else if (op === 'release') releaseEnginePose(engine)
    else if (op === 'poke') pokeEngine(engine, a as GestureName, b ?? 1)
    else if (op === 'seek') seekEngine(engine, a)
    else if (op === 'pause') pauseEngine(engine)
    else if (op === 'resume') resumeEngine(engine)
    else if (op === 'run') {
      const [seconds, every] = args as [number, number]
      const steps = Math.round(seconds / DT)
      const stride = Math.round(every / DT)
      for (let step = 1; step <= steps; step++) {
        advanceEngine(engine, DT)
        time += 1
        if (step % stride === 0) frames.push({ time: round(time * DT), frame: snapshot(engine) })
      }
    } else throw new Error(`${scene.id}: unknown step ${op}`)
  }
  return frames
}

const readJSON = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
const written = (file: string, value: unknown) => {
  const text = `${JSON.stringify(value, null, 1)}\n`
  if (update) fs.writeFileSync(file, text)
  return { text, stored: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' }
}
const STALE =
  'is not what avatar-core gives: run `pnpm swift:parity`, then port the change to Swift'

describe('AvatarSwift parity files', () => {
  test('the character schema is avatar-core’s', () => {
    const { text, stored } = written(
      path.join(swift, 'Resources', 'avatarCharacter.schema.json'),
      avatarCharacterSchema
    )
    expect(stored, `avatarCharacter.schema.json ${STALE}`).toBe(text)
  })

  test('the frames of the parity scenes are avatar-core’s', () => {
    const scenes = readJSON(path.join(parity, 'scenes.json')) as Scene[]
    const read = readAvatarLibrary(readJSON(path.join(parity, 'library.json')) as never)
    expect(read.problems).toEqual([])
    const frames = Object.fromEntries(scenes.map(scene => [scene.id, play(scene, read.library)]))
    const { text, stored } = written(path.join(parity, 'frames.json'), frames)
    expect(stored, `frames.json ${STALE}`).toBe(text)
  })
})
