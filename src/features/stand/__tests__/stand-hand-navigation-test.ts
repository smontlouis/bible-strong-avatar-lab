import { describe, expect, it } from 'vitest'
import { createHandNavigation, projectHand, type HandTarget } from '../standHandNavigation'
import { createStandDirector, type ObservedHand, type Visitor } from '../standDirector'
import { defaultExpression } from '@/features/avatar/presets'

const face: Visitor = { x: 0.5, y: 0.35, width: 0.1, height: 0.14 }
const viewport = { width: 1000, height: 800 }
const palm: ObservedHand = {
  x: 0.5,
  y: 0.5,
  side: 'Right',
  open: true,
  gesture: 'Open_Palm',
  confidence: 0.95,
}
const closed = { ...palm, open: false, gesture: 'Closed_Fist' }
function harness() {
  const navigation = createHandNavigation()
  let time = 0
  const input = {
    visitor: face as Visitor | null,
    visitorId: 1,
    mirror: false,
    viewport,
    targets: [] as HandTarget[],
    petBounds: null as HandTarget | null,
    scrollBounds: null as HandTarget | null,
    context: 'cards',
  }
  const tick = (hand: ObservedHand | null = palm, delta = 50, other: Visitor[] = []) => {
    time += delta
    return navigation.sample({
      ...input,
      at: time,
      observation: { timestamp: time, faces: [face, ...other], hands: hand ? [hand] : [] },
    })
  }
  const run = (hand: ObservedHand | null, count: number) =>
    Array.from({ length: count }, () => tick(hand))
  return { navigation, input, tick, run, now: () => time }
}
const whole = { id: 'open:lexicon', x: 0, y: 0, width: 1000, height: 800 }

describe('visitor hand navigation', () => {
  it('requires a sustained pointing hand to acquire control, never a fist', () => {
    const h = harness()
    expect(h.run(closed, 20).every(frame => frame.mode === 'hidden')).toBe(true)
    expect(h.run(palm, 5).every(frame => frame.mode === 'hidden')).toBe(true)
    expect(h.run(palm, 3).at(-1)?.mode).toBe('moving')
  })
  it('acquires a detected relaxed hand even when no gesture is classified', () => {
    const h = harness()
    const relaxed = { ...palm, open: false, gesture: 'None', confidence: 0.1 }
    h.input.targets = [whole]
    const frames = h.run(relaxed, 40)
    expect(frames.some(frame => frame.mode === 'selecting')).toBe(true)
    expect(frames.filter(frame => frame.activate)).toHaveLength(0)
    expect(h.run(closed, 6).some(frame => frame.activate)).toBe(true)
  })
  it('keeps hover without clicking when an open palm intermittently has no gesture label', () => {
    const h = harness()
    h.input.targets = [whole]
    const frames = Array.from({ length: 40 }, (_, i) =>
      h.tick(i % 2 ? palm : { ...palm, open: false, gesture: 'None', confidence: 0.2 })
    )
    expect(frames.filter(frame => frame.activate)).toHaveLength(0)
  })
  it('grabs the avatar with a fist, rotates outside its bounds and releases on opening or loss', () => {
    const h = harness()
    h.input.petBounds = { id: 'head', x: 300, y: 250, width: 400, height: 400 }
    h.run(palm, 20)
    const grabbed = h.run(closed, 6).at(-1)!
    expect(grabbed.mode).toBe('rotating')
    expect(grabbed.rotation?.start).toEqual(grabbed.rotation?.point)
    const moved = h.run({ ...closed, x: 0.65 }, 8).at(-1)!
    expect(moved.rotation?.point[0]).toBeGreaterThan(moved.rotation!.start[0])
    expect(moved.activate).toBeNull()
    expect(moved.scrollDelta).toBe(0)
    // Releases once the hand is clearly open, or lost, beyond the grace periods.
    expect(h.run(palm, 4).at(-1)?.rotation).toBeNull()
    h.run(closed, 6)
    expect(h.run(null, 6).at(-1)?.rotation).toBeNull()
  })
  it('gives cards priority over avatar rotation and never grabs by crossing with a held fist', () => {
    const h = harness()
    h.input.petBounds = whole
    h.input.targets = [whole]
    h.run(palm, 20)
    expect(h.run(closed, 6).every(frame => frame.rotation === null)).toBe(true)
    h.input.targets = []
    expect(h.run(closed, 6).every(frame => frame.rotation === null)).toBe(true)
  })
  it('keeps a held avatar rotation when the hand occludes the face', () => {
    const h = harness()
    h.input.petBounds = whole
    h.run(palm, 20)
    h.run(closed, 6)
    h.input.visitor = null
    const frames = h.run({ ...closed, x: 0.55 }, 50)
    expect(frames.every(frame => frame.mode === 'rotating')).toBe(true)
    // A single missed detection keeps the grip; a real loss ends it.
    expect(h.tick(null).mode).toBe('rotating')
    expect(h.run(null, 6).at(-1)?.mode).toBe('hidden')
    h.run(null, 20)
    expect(h.run(palm, 20).every(frame => frame.mode === 'hidden')).toBe(true)
  })
  it('keeps control when the same face returns after the director expires its identity', () => {
    const h = harness()
    h.input.petBounds = whole
    h.run(palm, 20)
    h.run(closed, 6)
    h.input.visitor = null
    h.run(closed, 40)
    h.input.visitor = { ...face }
    h.input.visitorId++
    // The observation carries this exact face, as the director does in production.
    h.input.visitor = face
    expect(h.tick(closed).mode).toBe('rotating')
  })
  it('maps a comfortable reach to all six card locations and mirrors horizontally', () => {
    const left = projectHand({ x: 0.25, y: 0.3 }, face, false, viewport)
    const right = projectHand({ x: 0.75, y: 0.3 }, face, false, viewport)
    const bottom = projectHand({ x: 0.5, y: 0.75 }, face, false, viewport)
    expect(left.x).toBe(36)
    expect(right.x).toBe(964)
    expect(bottom.y).toBe(764)
    expect(projectHand({ x: 0.25, y: 0.3 }, face, true, viewport).x).toBe(right.x)
  })
  it('covers the display with 28.6% less movement while preserving the resting position', () => {
    const centerY = face.y + 0.5 * 0.245
    const center = projectHand({ x: face.x, y: centerY }, face, false, viewport)
    expect(center).toEqual({ x: 500, y: 400 })
    expect(projectHand({ x: face.x - 0.5 / 1.4 / 2, y: centerY }, face, false, viewport).x).toBe(36)
    expect(projectHand({ x: face.x + 0.5 / 1.4 / 2, y: centerY }, face, false, viewport).x).toBe(
      964
    )
    expect(
      projectHand({ x: face.x, y: centerY + 0.525 / 1.4 / 2 }, face, false, viewport).y
    ).toBeCloseTo(764)
  })
  it('never activates by hovering, regardless of duration', () => {
    const h = harness()
    h.input.targets = [whole]
    const frames = h.run(palm, 240)
    expect(frames.some(frame => frame.mode === 'selecting')).toBe(true)
    expect(frames.every(frame => frame.activate === null)).toBe(true)
    expect(h.run(closed, 6).filter(frame => frame.activate)).toHaveLength(1)
  })
  it('clicks promptly on closing a fist, then needs an open hand before another click', () => {
    const h = harness()
    h.run(palm, 20)
    h.input.targets = [whole]
    h.run(palm, 2)
    const clicks = h.run(closed, 20)
    expect(clicks.filter(frame => frame.activate)).toHaveLength(1)
    expect(clicks.findIndex(frame => frame.activate)).toBe(3)
    expect(clicks.every(frame => frame.scrollDelta === 0)).toBe(true)
    h.run(palm, 5)
    expect(h.run(closed, 6).filter(frame => frame.activate)).toHaveLength(1)
  })
  it('does not accept a single fist frame or an uncertain classifier result', () => {
    const h = harness()
    h.run(palm, 20)
    h.input.targets = [whole]
    h.tick(palm)
    expect(h.tick({ ...closed, confidence: 0.4 }).activate).toBeNull()
    h.run(palm, 4)
    expect(h.tick(closed).activate).toBeNull()
    h.run(palm, 4)
    expect(h.tick(palm).activate).toBeNull()
  })
  it('a held click cannot activate a new screen or turn into a drag', () => {
    const h = harness()
    h.run(palm, 20)
    h.input.targets = [whole]
    h.tick(palm)
    h.run(closed, 6)
    h.input.context = 'lexicon'
    h.input.targets = [{ ...whole, id: 'close' }]
    h.input.scrollBounds = whole
    expect(h.run(closed, 30).every(frame => !frame.activate && frame.scrollDelta === 0)).toBe(true)
    h.run(palm, 5)
    expect(h.run(closed, 6).filter(frame => frame.activate)).toHaveLength(1)
  })
  it('click targets take priority over scroll regions and a drag cannot click while crossing a control', () => {
    const h = harness()
    h.input.scrollBounds = whole
    h.run(palm, 20)
    h.input.targets = [{ ...whole, id: 'down' }]
    const clicks = h.run(closed, 8)
    expect(clicks.some(frame => frame.activate === 'down')).toBe(true)
    expect(clicks.every(frame => frame.scrollDelta === 0 && frame.mode !== 'grabbing')).toBe(true)
    h.input.targets = []
    h.run(palm, 5)
    h.run(closed, 6)
    h.input.targets = [{ ...whole, id: 'up' }]
    const drag = Array.from({ length: 6 }, (_, i) => h.tick({ ...closed, y: 0.5 - i * 0.01 }))
    expect(drag.some(frame => frame.scrollDelta > 0)).toBe(true)
    expect(drag.every(frame => !frame.activate)).toBe(true)
  })
  it('stops immediately on loss and never completes a dwell with stale frames', () => {
    const h = harness()
    h.input.targets = [whole]
    h.run(palm, 18)
    const gone = h.tick(null)
    expect(gone).toMatchObject({ mode: 'hidden', activate: null, scrollDelta: 0 })
    const stale = h.navigation.sample({
      ...h.input,
      at: h.now() + 500,
      observation: { timestamp: h.now(), faces: [face], hands: [palm] },
    })
    expect(stale.mode).toBe('hidden')
  })
  it('never switches to the other hand without reacquiring it', () => {
    const h = harness()
    h.run(palm, 25)
    expect(h.tick({ ...palm, side: 'Left' }).mode).toBe('hidden')
    expect(h.run({ ...palm, side: 'Left' }, 5).every(frame => frame.mode === 'hidden')).toBe(true)
  })
  it('rejects another visitor’s hand even if it is inside the outer reach rectangle', () => {
    const h = harness()
    const other = { ...face, x: 0.77 }
    const frames = Array.from({ length: 30 }, () => h.tick({ ...palm, x: 0.74 }, 50, [other]))
    expect(frames.every(frame => frame.mode === 'hidden')).toBe(true)
  })
  it('clears actions when visitor ownership, mirroring or the open resource changes', () => {
    for (const change of ['visitor', 'mirror', 'context'] as const) {
      const h = harness()
      h.input.targets = [whole]
      h.run(palm, 18)
      if (change === 'visitor') {
        h.input.visitorId++
        h.input.visitor = { ...face, x: 0.9 }
      }
      if (change === 'mirror') h.input.mirror = true
      if (change === 'context') h.input.context = 'lexicon'
      expect(h.run(palm, 16).every(frame => frame.activate === null)).toBe(true)
    }
  })
  it('clutches scrolling inside the reader, then stops on release or tracking loss', () => {
    const h = harness()
    h.input.scrollBounds = whole
    h.input.context = 'lexicon'
    h.run(palm, 20)
    h.run(closed, 6)
    const drag = Array.from({ length: 6 }, (_, i) => h.tick({ ...closed, y: 0.5 - i * 0.015 }))
    expect(drag.some(frame => frame.mode === 'grabbing' && frame.scrollDelta > 0)).toBe(true)
    // Opening the hand pauses at once, then lets go.
    const opened = h.run(palm, 5)
    expect(opened.every(frame => frame.scrollDelta === 0)).toBe(true)
    expect(opened.at(-1)?.mode).not.toBe('grabbing')
    h.run(closed, 6)
    expect(h.run(null, 8).every(frame => frame.scrollDelta === 0)).toBe(true)
    h.input.scrollBounds = { ...whole, x: 0, width: 100 }
    h.run(palm, 5)
    expect(h.run(closed, 6).every(frame => frame.scrollDelta === 0)).toBe(true)
  })
  it('keeps scrolling while the classifier doubts a moving fist', () => {
    const h = harness()
    h.input.scrollBounds = whole
    h.input.context = 'lexicon'
    h.run(palm, 20)
    h.run(closed, 6)
    const doubt = { ...closed, gesture: 'None', confidence: 0.3 }
    const drag = Array.from({ length: 12 }, (_, i) =>
      h.tick({ ...(i % 3 === 1 ? doubt : closed), y: 0.5 - i * 0.012 })
    )
    expect(drag.every(frame => frame.mode === 'grabbing')).toBe(true)
    expect(drag.filter((_, i) => i % 3 === 1).some(frame => frame.scrollDelta > 0)).toBe(true)
    // Doubt that lasts ends the grip.
    expect(h.run(doubt, 10).at(-1)?.mode).not.toBe('grabbing')
  })
  it('resumes the same drag when the hand closes again within the grace period', () => {
    const h = harness()
    h.input.scrollBounds = whole
    h.input.context = 'lexicon'
    h.run(palm, 20)
    h.run(closed, 6)
    expect(h.tick(palm).mode).toBe('grabbing')
    const resumed = Array.from({ length: 5 }, (_, i) => h.tick({ ...closed, y: 0.5 - i * 0.015 }))
    expect(resumed.every(frame => frame.mode === 'grabbing')).toBe(true)
    expect(resumed.some(frame => frame.scrollDelta > 0)).toBe(true)
  })
  it('keeps a grip when handedness flips on the fist, and accepts a less certain fist', () => {
    const h = harness()
    h.input.scrollBounds = whole
    h.input.context = 'lexicon'
    h.run(palm, 20)
    h.run({ ...closed, confidence: 0.55 }, 6)
    const flipped = h.run({ ...closed, side: 'Left', y: 0.49 }, 6)
    expect(flipped.every(frame => frame.mode === 'grabbing')).toBe(true)
    expect(flipped.at(-1)?.sign).toEqual({ gesture: 'Closed_Fist', confidence: 0.95 })
  })
})

describe('gentle petting', () => {
  const petFrames = (motion: (i: number) => ObservedHand, targets: HandTarget[] = []) => {
    const h = harness()
    h.input.petBounds = { id: 'head', x: 280, y: 220, width: 440, height: 440 }
    h.input.targets = targets
    h.run(palm, 24)
    return Array.from({ length: 40 }, (_, i) => h.tick(motion(i)))
  }
  it('recognizes gentle strokes across the upper head, with bounded strength', () => {
    const frames = petFrames(i => ({ ...palm, x: 0.5 + Math.sin(i / 5) * 0.045 }))
    expect(frames.some(frame => frame.mode === 'petting')).toBe(true)
    expect(frames.every(frame => frame.pet.strength >= 0 && frame.pet.strength <= 1)).toBe(true)
  })
  it('rejects a stationary palm, a fist and movements over a resource card', () => {
    for (const frames of [
      petFrames(() => palm),
      petFrames(() => closed),
      petFrames(i => ({ ...palm, x: 0.5 + Math.sin(i / 5) * 0.045 }), [whole]),
    ])
      expect(frames.every(frame => frame.pet.strength === 0)).toBe(true)
  })
  it('rejects fast sweeps across the head', () => {
    const frames = petFrames(i => ({ ...palm, x: i % 2 ? 0.59 : 0.41 }))
    expect(frames.every(frame => frame.pet.strength === 0)).toBe(true)
  })
  it('relaxes Strobi, keeps gaze bounded and releases the pose when the hand disappears', () => {
    const director = createStandDirector()
    director.observe({ timestamp: 100, faces: [face], hands: [] })
    director.setHandInteraction(150, true, { strength: 1, x: 0.6, y: -0.3 })
    const settings = { mirror: true, proximity: 2.2, reducedMotion: true }
    const petted = director.sample(200, defaultExpression, settings)
    expect(petted.cue).toBe('petted')
    expect(petted.expression.heightLeft).toBeLessThan(defaultExpression.heightLeft * 0.5)
    expect(petted.x).toBe(0)
    expect(petted.y).toBeCloseTo(0)
    expect(Math.abs(petted.expression.headY)).toBeLessThanOrEqual(14)
    expect(director.sample(600, defaultExpression, settings).cue).not.toBe('petted')
    director.observe({ timestamp: 2000, faces: [face], hands: [] })
    expect(director.sample(2000, defaultExpression, settings).mood).toBe('wary')
  })
})
