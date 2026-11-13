import { clips, states } from '../catalogue'
import { characterFromLegacyDefinition, renderCharacterFrame } from '../character'
import {
  advanceEngine,
  createAvatarEngine,
  engineFrame,
  playEngineClip,
  setEngineState,
  type AvatarEngine,
} from '../engine'
import { drawSpinner, spinnerOfMode, spinnerPatterns } from '../spinners'
import type { AvatarDefinition } from '../avatarDefinition'

const STEP = 1 / 60
const run = (engine: AvatarEngine, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += STEP) advanceEngine(engine, STEP)
}

const legacy: AvatarDefinition = {
  schema: 'bible-strong/avatar-definition',
  schemaVersion: 1,
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [],
  },
  colors: { body: '#5b7fe5', eyes: '#17191d' },
  expressions: {
    neutral: {
      head: { x: 0, y: 0, z: 0 },
      eyes: {
        left: { width: 30, height: 60, x: 0, y: 0, angle: 0 },
        right: { width: 30, height: 60, x: 0, y: 0, angle: 0 },
        spacing: 70,
      },
      perspective: 1,
      motion: { eyes: 'none', body: 'none' },
    },
  },
  expressionOrder: ['neutral'],
  animations: {},
  animationOrder: [],
}
const character = characterFromLegacyDefinition(legacy)

describe('spinner patterns', () => {
  it('has a pattern for everything a state asks the body to turn into', () => {
    const asked = new Set(Object.values(states).flatMap(state => state.morph ?? []))
    for (const mode of asked) expect(spinnerOfMode[mode]).toBeDefined()
    expect(new Set(Object.values(spinnerOfMode))).toEqual(new Set(spinnerPatterns))
  })

  it.each(spinnerPatterns)('draws %s with finite numbers at every weight and time', pattern => {
    for (const weight of [0, 0.01, 0.3, 0.7, 1]) {
      for (let time = 0; time < 8; time += 0.137) {
        const drawing = drawSpinner(pattern, weight, time, time % 4)
        expect(
          Object.values(drawing.core).every(
            value => typeof value === 'boolean' || Number.isFinite(value)
          )
        ).toBe(true)
        for (const mark of drawing.marks) {
          const numbers = Object.values(mark).flatMap(value =>
            typeof value === 'number' ? [value] : Array.isArray(value) ? value.flat() : []
          )
          expect(numbers.every(Number.isFinite)).toBe(true)
          expect(mark.opacity).toBeGreaterThan(0)
          expect(mark.opacity).toBeLessThanOrEqual(1.0001)
        }
      }
    }
  })

  it('draws nothing around the body when the pattern is not there yet', () => {
    for (const pattern of spinnerPatterns) {
      const drawing = drawSpinner(pattern, 0, 0, 0)
      expect(drawing.marks.filter(mark => mark.opacity > 0.05)).toHaveLength(0)
      expect(drawing.core.x).toBeCloseTo(0, 6)
      expect(drawing.core.y).toBeCloseTo(0, 6)
    }
  })

  it('fills the arc of progress in a little over two seconds', () => {
    const arcAt = (shot: number) =>
      drawSpinner('progress', 1, shot, shot).marks.find(
        mark => mark.kind === 'ring' && mark.share !== undefined
      ) as { share: number } | undefined
    expect(arcAt(0)?.share ?? 0).toBe(0)
    expect(arcAt(1.0625)!.share).toBeCloseTo(0.5, 3)
    expect(arcAt(2.2)!.share).toBe(1)
  })
})

describe('turning into a spinner', () => {
  it('turns the body into a small disc without a face, and brings it back', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'idle')
    run(engine, 0.5)
    expect(engineFrame(engine).spinner).toBeNull()

    setEngineState(engine, 'thinking')
    run(engine, 1.5)
    const frame = engineFrame(engine)
    expect(frame.spinner!.amount).toBeGreaterThan(0.99)
    expect(frame.spinner!.round).toBeCloseTo(1, 3)
    const scene = renderCharacterFrame(character, frame)
    expect(scene.geometry.leftVisible).toBe(false)
    // The body is a disc 22 units of 114 wide: under a fifth of its size.
    expect(scene.transform[0]).toBeGreaterThan(0.15)
    expect(scene.transform[0]).toBeLessThan(0.24)
    expect(scene.spinner!.marks.length).toBe(2)

    setEngineState(engine, 'idle')
    run(engine, 1.5)
    expect(engineFrame(engine).spinner).toBeNull()
    expect(renderCharacterFrame(character, engineFrame(engine)).geometry.leftVisible).toBe(true)
  })

  it('does not jump: the body shrinks and grows over time', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'idle')
    run(engine, 0.3)
    setEngineState(engine, 'orbit')
    let previous = renderCharacterFrame(character, engineFrame(engine)).transform[0]
    for (let step = 0; step < 90; step += 1) {
      advanceEngine(engine, STEP)
      const size = renderCharacterFrame(character, engineFrame(engine)).transform[0]
      expect(Math.abs(size - previous)).toBeLessThan(0.08)
      previous = size
    }
  })

  it('stops the clip while the body is a spinner, and lets it go on afterwards', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'waiting')
    run(engine, 2)
    const stopped = engine.player.time
    run(engine, 1)
    expect(engine.player.time - stopped).toBeLessThan(0.02)
    setEngineState(engine, 'streaming')
    run(engine, 2)
    expect(engine.player.clip?.name.startsWith('Streaming')).toBe(true)
    expect(engine.player.time).toBeGreaterThan(0.3)
  })

  it('lets one pattern leave while another comes in', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'thinking')
    run(engine, 1.5)
    setEngineState(engine, 'radar')
    advanceEngine(engine, STEP)
    expect(engine.morphing.leaving?.pattern).toBe('dots')
    expect(engine.morphing.current?.pattern).toBe('radar')
    // The body stays a disc from one to the other.
    expect(engineFrame(engine).spinner!.amount).toBeGreaterThan(0.95)
    run(engine, 1.5)
    expect(engine.morphing.leaving).toBeNull()
  })

  it('brings the avatar back between two shots of progress', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'progress')
    run(engine, 2)
    expect(engineFrame(engine).spinner!.amount).toBeGreaterThan(0.95)
    run(engine, 1.6)
    // 3.6 s in: the shot ended at 2.5 s, the avatar is back until 4 s.
    expect(engineFrame(engine).spinner?.amount ?? 0).toBeLessThan(0.1)
    run(engine, 1.4)
    expect(engineFrame(engine).spinner!.amount).toBeGreaterThan(0.9)
  })

  it('ends a visit to a spinner facing the way it started', () => {
    const engine = createAvatarEngine()
    playEngineClip(engine, clips.Blocked_B)
    run(engine, 0.5)
    const before = engineFrame(engine).rotation[1]
    setEngineState(engine, 'thinking')
    run(engine, 2)
    setEngineState(engine, 'sad')
    run(engine, 3)
    const turn = engineFrame(engine).rotation[1] - before
    expect(Math.abs(turn - Math.round(turn / 360) * 360)).toBeLessThan(0.5)
  })

  it('draws every spinner state on a character without a broken path', () => {
    for (const name of Object.keys(states).filter(key => states[key].morph)) {
      const engine = createAvatarEngine()
      setEngineState(engine, name)
      for (let step = 0; step < 300; step += 1) {
        advanceEngine(engine, STEP)
        const scene = renderCharacterFrame(character, engineFrame(engine))
        expect(scene.transform.every(Number.isFinite)).toBe(true)
        for (const mark of scene.spinner?.marks ?? []) expect(mark.d).not.toContain('NaN')
      }
    }
  })
})
