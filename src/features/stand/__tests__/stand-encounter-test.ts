import { describe, expect, it } from 'vitest'
import { createStandEncounter, visitorSignals } from '../standEncounter'
import type { ObservedHand, Visitor } from '../standDirector'

const face: Visitor = { x: 0.5, y: 0.4, width: 0.1, height: 0.14 }
const smiling = { ...face, signals: { mouthSmileLeft: 0.8, mouthSmileRight: 0.7 } }
const thumb: ObservedHand = {
  x: 0.6,
  y: 0.4,
  side: 'Left',
  open: false,
  gesture: 'Thumb_Up',
  confidence: 0.9,
}
function tilted(degrees: number, aspect = 4 / 3): Visitor {
  const landmarks = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.4 }))
  landmarks[33] = { x: 0.45, y: 0.4 }
  landmarks[263] = { x: 0.55, y: 0.4 + Math.tan((degrees * Math.PI) / 180) * 0.1 * aspect }
  return { ...face, landmarks, frameAspectRatio: aspect }
}
const read = (encounter: ReturnType<typeof createStandEncounter>, at: number) =>
  encounter.sample(at, true, true, 1.5, 2.2)
const observeFor = (
  encounter: ReturnType<typeof createStandEncounter>,
  visitor: Visitor,
  from: number,
  until: number,
  hands: ObservedHand[] = []
) => {
  for (let at = from; at <= until; at += 100) encounter.observe(visitor, hands, false, at)
}

describe('Strobi encounters', () => {
  it('notices the passer-by, invites a wave at 1–2 m, and offers a smile if they wait', () => {
    const encounter = createStandEncounter()
    encounter.reset(100)
    expect(read(encounter, 500).cue).toBe('notice')
    expect(read(encounter, 3000).cue).toBe('wave')
    expect(encounter.sample(3000, true, true, 2.8, 2.2).cue).toBe('closer')
    expect(read(encounter, 13000).cue).toBe('smile')
    expect(encounter.sample(3000, true, false, 1.5, 2.2).cue).toBe('searching')
    expect(encounter.sample(3000, false, false, 1.5, 2.2).cue).toBe('idle')
  })

  it('lets a sustained smile break the ice without requiring a hand gesture', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    observeFor(encounter, smiling, 0, 500)
    expect(read(encounter, 500).friendly).toBe(false)
    observeFor(encounter, smiling, 600, 700)
    expect(read(encounter, 700)).toMatchObject({
      friendly: true,
      cue: 'smile-reply',
      discoveries: 1,
    })
    observeFor(encounter, smiling, 800, 9000)
    expect(read(encounter, 9000).reaction).toBeNull()
    expect(read(encounter, 9000).discoveries).toBe(1)
  })

  it('requires release before rewarding another smile and ignores threshold jitter', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    observeFor(encounter, smiling, 0, 3000)
    observeFor(
      encounter,
      { ...face, signals: { mouthSmileLeft: 0.4, mouthSmileRight: 0.4 } },
      3100,
      3600
    )
    observeFor(encounter, smiling, 3700, 4600)
    expect(read(encounter, 4600).reaction).toBeNull()
    observeFor(encounter, face, 4700, 5100)
    observeFor(encounter, smiling, 5200, 5800)
    expect(read(encounter, 5800).reaction).toBe('smile')
  })

  it('does not count brief signals or stitch a smile across missing frames', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    observeFor(encounter, smiling, 0, 300)
    observeFor(encounter, smiling, 800, 1100)
    observeFor(encounter, face, 1200, 1800, [{ ...thumb, confidence: 0.4 }])
    expect(read(encounter, 1800).friendly).toBe(false)
  })

  it('does not combine two different hands into a thumbs-up', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    observeFor(encounter, face, 0, 300, [thumb])
    observeFor(encounter, face, 400, 700, [{ ...thumb, side: 'Right' }])
    expect(read(encounter, 700).friendly).toBe(false)
    observeFor(encounter, face, 800, 1000, [{ ...thumb, side: 'Right' }])
    expect(read(encounter, 1000).reaction).toBe('thumbs-up')
  })

  it('acknowledges three distinct interactions, then invites the visitor to meet the team', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    encounter.observe(face, [], true, 0)
    expect(read(encounter, 0).cue).toBe('hello')
    observeFor(encounter, face, 100, 2400)
    expect(read(encounter, 2400).cue).toBe('smile')
    observeFor(encounter, smiling, 2500, 3200)
    expect(read(encounter, 3200).cue).toBe('smile-reply')
    observeFor(encounter, face, 3300, 5500)
    expect(read(encounter, 5500).cue).toBe('thumbs-up')
    observeFor(encounter, face, 5600, 6200, [thumb])
    expect(read(encounter, 6200).cue).toBe('thumbs-up-reply')
    expect(read(encounter, 8400)).toMatchObject({ cue: 'connection', discoveries: 3 })
    encounter.reset(9000)
    expect(read(encounter, 9100)).toMatchObject({ cue: 'notice', friendly: false, discoveries: 0 })
  })

  it('recognizes a held head tilt with the correct camera aspect ratio', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    for (const aspect of [4 / 3, 16 / 9])
      expect(visitorSignals(tilted(16, aspect)).tilt).toBeCloseTo(16)
    observeFor(encounter, tilted(-16), 0, 700)
    expect(read(encounter, 700).cue).toBe('tilt-reply')
    expect(visitorSignals({ ...face, signals: { mouthSmileLeft: NaN } })).toEqual({
      smile: 0,
      jaw: 0,
      tilt: 0,
    })
  })

  it('gives each reply time and never queues gestures held during it', () => {
    const encounter = createStandEncounter()
    encounter.reset(0)
    encounter.observe(face, [], true, 0)
    observeFor(encounter, smiling, 100, 3200)
    expect(read(encounter, 3200)).toMatchObject({ reaction: null, discoveries: 1 })
  })
})
