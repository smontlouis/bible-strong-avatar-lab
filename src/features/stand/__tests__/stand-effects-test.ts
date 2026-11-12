import { describe, expect, it } from 'vitest'
import { createParticleField, MAX_PARTICLES } from '../standParticles'
import { createStandSimulator } from '../standSimulator'
import { createStandDirector } from '../standDirector'
import { defaultExpression } from '@/features/avatar/presets'
import {
  createHandNavigation,
  projectHand,
  snapRadius,
  snapTarget,
  unprojectHand,
  type HandTarget,
} from '../standHandNavigation'
import type { ObservedHand, Visitor } from '../standDirector'

const settings = { mirror: true, proximity: 2.2, reducedMotion: false }

function seeded() {
  let value = 7
  return () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
}

describe('stand particles', () => {
  it('bursts, moves and expires particles deterministically', () => {
    const field = createParticleField(seeded())
    field.burst('celebrate', 500, 400)
    const count = field.particles().length
    expect(count).toBeGreaterThan(40)
    const before = field.particles()[0].y
    field.step(50)
    expect(field.particles()[0].y).not.toBe(before)
    for (let index = 0; index < 60; index++) field.step(100)
    expect(field.particles()).toHaveLength(0)
  })

  it('caps the scene by dropping the oldest particles', () => {
    const field = createParticleField(seeded())
    for (let index = 0; index < 12; index++) field.burst('celebrate', 0, 0)
    expect(field.particles()).toHaveLength(MAX_PARTICLES)
  })

  it('keeps ambient motes sparse', () => {
    const field = createParticleField(seeded())
    for (let index = 0; index < 2000; index++) field.ambient(1920, 1080)
    const motes = field.particles().filter(particle => particle.kind === 'dust')
    expect(motes.length).toBeLessThanOrEqual(26)
    expect(motes.every(mote => mote.vy < 0)).toBe(true)
  })

  it('produces only finite values after long frames', () => {
    const field = createParticleField(seeded())
    field.burst('approve', 100, 100)
    field.step(10_000)
    expect(field.particles().every(p => Number.isFinite(p.x + p.y + p.vx + p.vy))).toBe(true)
  })
})

describe('stand simulator', () => {
  const run = (
    simulator: ReturnType<typeof createStandSimulator>,
    director: ReturnType<typeof createStandDirector>,
    from: number,
    until: number
  ) => {
    for (let at = from; at <= until; at += 66) director.observe(simulator.observe(at))
  }

  it('drives the real director from arrival to a recognized wave and smile', () => {
    const simulator = createStandSimulator()
    const director = createStandDirector()
    simulator.press('visitor', 0)
    run(simulator, director, 0, 500)
    expect(director.sample(500, defaultExpression, settings).cue).toBe('notice')
    simulator.press('closer', 600)
    simulator.press('closer', 600)
    simulator.press('closer', 600)
    run(simulator, director, 600, 2900)
    expect(director.sample(2900, defaultExpression, settings).cue).toBe('wave')
    simulator.press('wave', 3000)
    run(simulator, director, 3000, 4800)
    expect(director.sample(4800, defaultExpression, settings).discovered).toContain('wave')
    // Gestures are not queued during a reply: smile once Strobi has finished.
    run(simulator, director, 4800, 6600)
    simulator.press('smile', 6600)
    run(simulator, director, 6600, 8000)
    expect(director.sample(8000, defaultExpression, settings).discovered).toContain('smile')
  })

  it('reports a distant visitor as needing to come closer', () => {
    const simulator = createStandSimulator()
    const director = createStandDirector()
    simulator.press('visitor', 0)
    run(simulator, director, 0, 3000)
    const frame = director.sample(3000, defaultExpression, settings)
    expect(frame.cue).toBe('closer')
    expect(frame.progress).toBeGreaterThan(0)
    expect(frame.progress).toBeLessThan(1)
  })

  it('places the synthetic hand where hand navigation will project it', () => {
    const origin: Visitor = { x: 0.52, y: 0.4, width: 0.09, height: 0.14 }
    const viewport = { width: 1920, height: 1080 }
    for (const mirror of [true, false]) {
      const point = { x: 1400, y: 300 }
      const projected = projectHand(
        unprojectHand(point, origin, mirror, viewport),
        origin,
        mirror,
        viewport
      )
      expect(projected.x).toBeCloseTo(point.x)
      expect(projected.y).toBeCloseTo(point.y)
    }
  })
})

describe('snapping the hand cursor to controls', () => {
  const face: Visitor = { x: 0.5, y: 0.35, width: 0.1, height: 0.14 }
  const viewport = { width: 1000, height: 800 }
  const radius = snapRadius(viewport)
  const card: HandTarget = { id: 'open:lexicon', x: 400, y: 300, width: 200, height: 200 }
  const other: HandTarget = { id: 'open:themes', x: 400, y: 560, width: 200, height: 200 }

  it('snaps to the nearest control within the radius and ignores farther ones', () => {
    expect(snapTarget({ x: 600 + radius - 5, y: 400 }, [card], null, radius, false)?.id).toBe(
      card.id
    )
    expect(snapTarget({ x: 600 + radius + 5, y: 400 }, [card], null, radius, false)).toBeUndefined()
    // Between two cards, the closer one wins.
    expect(snapTarget({ x: 500, y: 515 }, [card, other], null, radius, false)?.id).toBe(card.id)
    expect(snapTarget({ x: 500, y: 550 }, [card, other], null, radius, false)?.id).toBe(other.id)
  })

  it('holds the hovered control a little further and does not flicker between neighbours', () => {
    expect(snapTarget({ x: 600 + radius * 1.4, y: 400 }, [card], card.id, radius, false)?.id).toBe(
      card.id
    )
    // Slightly closer to the other card, but not clearly: stay.
    expect(snapTarget({ x: 500, y: 535 }, [card, other], card.id, radius, false)?.id).toBe(card.id)
    // Inside the other card: switch.
    expect(snapTarget({ x: 500, y: 600 }, [card, other], card.id, radius, false)?.id).toBe(other.id)
  })

  it('needs a direct hit from inside the reader text, where a fist scrolls', () => {
    expect(snapTarget({ x: 500, y: 520 }, [card], null, radius, true)).toBeUndefined()
    expect(snapTarget({ x: 500, y: 400 }, [card], null, radius, true)?.id).toBe(card.id)
  })

  it('reports the snapped control and clicks it even from just outside', () => {
    const navigation = createHandNavigation()
    let at = 0
    const tick = (point: { x: number; y: number }, fist = false) => {
      at += 50
      const hand: ObservedHand = {
        ...unprojectHand(point, face, false, viewport),
        side: 'Right',
        open: !fist,
        gesture: fist ? 'Closed_Fist' : 'Open_Palm',
        confidence: 0.95,
      }
      return navigation.sample({
        at,
        observation: { timestamp: at, faces: [face], hands: [hand] },
        visitor: face,
        visitorId: 1,
        mirror: false,
        viewport,
        targets: [card],
        petBounds: null,
        scrollBounds: null,
        context: 'cards',
      })
    }
    const outside = { x: 600 + radius * 0.6, y: 400 }
    let frame = tick(outside)
    for (let index = 0; index < 30; index++) frame = tick(outside)
    expect(frame.mode).toBe('selecting')
    expect(frame.snap).toEqual(card)
    const clicks = Array.from({ length: 6 }, () => tick(outside, true))
    expect(clicks.filter(frame => frame.activate === card.id)).toHaveLength(1)
  })
})
