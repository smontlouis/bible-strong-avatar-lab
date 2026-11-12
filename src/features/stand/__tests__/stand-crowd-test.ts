import { describe, expect, it } from 'vitest'
import { defaultExpression } from '@/features/avatar/presets'
import {
  chooseCompanions,
  DEFAULT_COMPANION_IDS,
  COMPANION_CONFIRM_MS,
  COMPANION_EXIT_MS,
  COMPANION_LOSS_MS,
  createStandCrowd,
  placeCompanions,
  sampleCompanion,
  type Companion,
} from '../standCrowd'
import { createStandDirector, type Visitor } from '../standDirector'
import { createStandEncounter, collectionActions, secretActions } from '../standEncounter'
import { createStandSimulator } from '../standSimulator'

const face = (x: number, width = 0.1): Visitor => ({ x, y: 0.4, width, height: width * 1.6 })
const main = face(0.5, 0.14)
const left = face(0.2)
const right = face(0.8)

function run(
  crowd: ReturnType<typeof createStandCrowd>,
  faces: Visitor[],
  from: number,
  until: number,
  primary: Visitor | null = main
) {
  let companions: readonly Companion[] = []
  for (let at = from; at <= until; at += 100) {
    crowd.observe({ timestamp: at, faces, hands: [] }, primary)
    companions = crowd.sample(at)
  }
  return companions
}

describe('stand crowd', () => {
  it('hooks a companion to each stable additional visitor, never to the main one', () => {
    const crowd = createStandCrowd(3)
    expect(run(crowd, [main, left], 0, COMPANION_CONFIRM_MS - 100)).toHaveLength(0)
    const companions = run(crowd, [main, left, right], COMPANION_CONFIRM_MS, 2000)
    expect(companions.map(c => [c.slot, c.face.x])).toEqual([
      [0, 0.2],
      [1, 0.8],
    ])
  })

  it('keeps a companion through a short gap, then waves goodbye and frees the slot', () => {
    const crowd = createStandCrowd(3)
    run(crowd, [main, left], 0, 1000)
    expect(run(crowd, [main], 1100, 1100 + COMPANION_LOSS_MS - 200)[0].leftAt).toBeNull()
    // Lost after 1.5 s: the companion waves goodbye during its exit, then leaves.
    const leaving = run(crowd, [main], 2500, 3300)
    expect(leaving[0].leftAt).not.toBeNull()
    expect(run(crowd, [main], 3400, 3400 + COMPANION_EXIT_MS)).toHaveLength(0)
    expect(run(crowd, [main, right], 6000, 7000)[0].slot).toBe(0)
  })

  it('hands a visitor over when they become the main visitor', () => {
    const crowd = createStandCrowd(3)
    run(crowd, [main, left], 0, 1000)
    const handover = run(crowd, [left], 1100, 1300, left)
    expect(handover[0].leftAt).not.toBeNull()
  })

  it('respects the number of chosen characters, and fewer slots send extras away', () => {
    const crowd = createStandCrowd(1)
    expect(run(crowd, [main, left, right], 0, 1000)).toHaveLength(1)
    crowd.setSlots(0)
    expect(run(crowd, [main, left, right], 1100, 1200)[0].leftAt).not.toBeNull()
  })

  it('chooses the operator’s characters, else Nova and Citrus, else the first ones', () => {
    const [nova, citrus] = DEFAULT_COMPANION_IDS
    const library = ['strobi', 'freddy', citrus, nova, 'kirby'].map(id => ({ id }))
    expect(chooseCompanions(library, 'strobi', []).map(a => a.id)).toEqual([nova, citrus])
    expect(chooseCompanions(library, 'strobi', ['kirby', 'gone', 'strobi']).map(a => a.id)).toEqual(
      ['kirby']
    )
    const custom = ['strobi', 'a', 'b', 'c', 'd'].map(id => ({ id }))
    expect(chooseCompanions(custom, 'strobi', []).map(a => a.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('companion placement and pose', () => {
  const companion = (slot: number, x: number): Companion => ({
    slot,
    trackId: slot,
    face: face(x),
    since: 0,
    leftAt: null,
    visible: true,
  })
  const layout = { mirror: true, width: 1920, center: 960, clearance: 200, size: 200 }

  it('stands in front of its person, outside the main character and without overlap', () => {
    // Mirrored camera: a person at camera x 0.2 stands on the right of the screen.
    const [placed] = placeCompanions([companion(0, 0.2)], { ...layout, exploring: false })
    expect(placed.x).toBeCloseTo(0.8 * 1920)
    const [centred] = placeCompanions([companion(0, 0.52)], { ...layout, exploring: false })
    expect(Math.abs(centred.x - 960)).toBeGreaterThanOrEqual(300)
    const pair = placeCompanions([companion(0, 0.2), companion(1, 0.22)], {
      ...layout,
      exploring: false,
    })
    expect(Math.abs(pair[0].x - pair[1].x)).toBeGreaterThanOrEqual(170)
  })

  it('keeps its side while its person sways in front of the main character', () => {
    const [first] = placeCompanions([companion(0, 0.49)], { ...layout, exploring: false })
    const previous = new Map([[0, first.x]])
    for (const x of [0.47, 0.5, 0.53, 0.51]) {
      const [placed] = placeCompanions([companion(0, x)], { ...layout, exploring: false, previous })
      expect(Math.sign(placed.x - 960)).toBe(Math.sign(first.x - 960))
    }
  })

  it('gathers around the main character while exploring', () => {
    const placed = placeCompanions([companion(0, 0.2), companion(1, 0.8)], {
      ...layout,
      exploring: true,
    })
    expect(placed.map(p => p.x).sort((a, b) => a - b)).toEqual([760, 1160])
  })

  it('looks towards its person from where it stands, and fades in and out', () => {
    const person = companion(0, 0.2)
    const facing = sampleCompanion(person, 3000, defaultExpression, {
      mirror: true,
      reducedMotion: false,
      screenX: 0.8,
    })
    const fromLeft = sampleCompanion(person, 3000, defaultExpression, {
      mirror: true,
      reducedMotion: false,
      screenX: 0.2,
    })
    expect(Math.abs(facing.expression.headY)).toBeLessThan(Math.abs(fromLeft.expression.headY))
    expect(facing.presence).toBe(1)
    expect(
      sampleCompanion(person, 50, defaultExpression, {
        mirror: true,
        reducedMotion: false,
        screenX: 0.8,
      }).presence
    ).toBeLessThan(0.2)
    const gone = sampleCompanion({ ...person, leftAt: 0 }, COMPANION_EXIT_MS, defaultExpression, {
      mirror: true,
      reducedMotion: true,
      screenX: 0.8,
    })
    expect(gone.presence).toBe(0)
    expect(
      Object.values(gone.expression)
        .filter(v => typeof v === 'number')
        .every(Number.isFinite)
    ).toBe(true)
  })
})

describe('victory and the secret thumbs-down', () => {
  const visitor = face(0.5, 0.14)
  const sign = (gesture: string) => ({
    x: 0.6,
    y: 0.5,
    side: 'Right',
    open: false,
    gesture,
    confidence: 0.9,
  })
  const hold = (
    encounter: ReturnType<typeof createStandEncounter>,
    gesture: string,
    from: number
  ) => {
    for (let at = from; at <= from + 700; at += 100)
      encounter.observe(visitor, [sign(gesture)], false, at)
  }

  it('recognizes a held V and a held thumbs-down as new discoveries', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    hold(encounter, 'Victory', 3000)
    expect(encounter.sample(3700, true, true, 1.5, 2.2).cue).toBe('victory-reply')
    hold(encounter, 'Thumb_Down', 6500)
    const frame = encounter.sample(7200, true, true, 1.5, 2.2)
    expect(frame.cue).toBe('thumbs-down-reply')
    expect(frame.discovered).toEqual(['victory', 'thumbs-down'])
  })

  it('suggests the V but never the secret gesture', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    hold(encounter, 'Thumb_Up', 3000)
    const suggested = new Set<string>()
    for (let at = 6000; at < 70000; at += 1000)
      suggested.add(encounter.sample(at, true, true, 1.5, 2.2).cue)
    expect(suggested).toContain('victory')
    for (const secret of secretActions) expect(suggested).not.toContain(secret)
    expect(collectionActions).toHaveLength(6)
  })

  it('sulks, then forgives, with finite geometry', () => {
    const director = createStandDirector()
    const settings = { mirror: false, proximity: 2.2, reducedMotion: false }
    for (let at = 100; at <= 3000; at += 100)
      director.observe({ timestamp: at, faces: [visitor], hands: [] })
    for (let at = 3100; at <= 3800; at += 100)
      director.observe({ timestamp: at, faces: [visitor], hands: [sign('Thumb_Down')] })
    const sulking = director.sample(4000, defaultExpression, settings)
    const neutral = director.sample(2900, defaultExpression, settings)
    expect(sulking.cue).toBe('thumbs-down-reply')
    expect(sulking.expression.mouthCurve).toBeLessThan(0)
    expect(sulking.expression.heightLeft).toBeLessThan(neutral.expression.heightLeft)
    const forgiving = director.sample(5300, defaultExpression, settings)
    expect(forgiving.expression.mouthCurve).toBeGreaterThan(0)
  })
})

describe('simulated groups', () => {
  it('adds other visitors while the director keeps the main one', () => {
    const simulator = createStandSimulator()
    const director = createStandDirector()
    const crowd = createStandCrowd(3)
    simulator.press('visitor', 0)
    for (let at = 0; at <= 400; at += 66) director.observe(simulator.observe(at))
    simulator.press('addVisitor', 400)
    simulator.press('addVisitor', 400)
    let companions: readonly Companion[] = []
    for (let at = 466; at <= 2000; at += 66) {
      const observation = simulator.observe(at)
      director.observe(observation)
      crowd.observe(observation, director.inspect(at, true).target)
      companions = crowd.sample(at)
    }
    expect(observationFaces(simulator)).toBe(3)
    expect(companions).toHaveLength(2)
    expect(director.inspect(2000, true).target?.x).toBeCloseTo(0.5)
  })
})

const observationFaces = (simulator: ReturnType<typeof createStandSimulator>) =>
  simulator.observe(3000).faces.length
