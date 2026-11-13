import {
  clipEaseAt,
  sampleClipPose,
  sampleClipTrack,
  type ClipDefinition,
  type ClipKey,
} from '../clips'

describe('clip easing', () => {
  it('starts at 0, ends at 1 and is a straight line for a linear curve', () => {
    expect(clipEaseAt([0.42, 0, 0.58, 1], 0)).toBe(0)
    expect(clipEaseAt([0.42, 0, 0.58, 1], 1)).toBe(1)
    expect(clipEaseAt([0.3, 0.3, 0.7, 0.7], 0.37)).toBeCloseTo(0.37, 6)
  })

  it('matches the ease-in-out of CSS', () => {
    // cubic-bezier(0.42, 0, 0.58, 1) is symmetric about its middle.
    expect(clipEaseAt([0.42, 0, 0.58, 1], 0.5)).toBeCloseTo(0.5, 5)
    expect(clipEaseAt([0.42, 0, 0.58, 1], 0.25)).toBeCloseTo(0.1292, 3)
    expect(clipEaseAt([0.42, 0, 0.58, 1], 0.75)).toBeCloseTo(0.8708, 3)
  })

  it('overshoots when the curve does', () => {
    const values = Array.from({ length: 99 }, (_, index) =>
      clipEaseAt([0.4, 0.22, 0.28, 1.34], (index + 1) / 100)
    )
    expect(Math.max(...values)).toBeGreaterThan(1)
  })

  it('solves steep curves', () => {
    const ease = [0.96, -0.05, 0.2, 0.91] as const
    for (let step = 1; step < 20; step += 1) {
      const value = clipEaseAt(ease, step / 20)
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(clipEaseAt(ease, 0.999)).toBeCloseTo(1, 1)
  })
})

describe('clip tracks', () => {
  const keys: ClipKey<readonly [number, number]>[] = [
    { t: 1, v: [0, 10], ease: [0, 0, 1, 1] },
    { t: 3, v: [20, 30], ease: [0, 0, 1, 1] },
  ]

  it('holds the first value before the first key and the last after the last', () => {
    expect(sampleClipTrack(keys, 0)).toEqual([0, 10])
    expect(sampleClipTrack(keys, 9)).toEqual([20, 30])
  })

  it('moves every number of a key along the same curve', () => {
    expect(sampleClipTrack(keys, 2)).toEqual([10, 20])
  })

  it('keeps full turns: 360 is not brought back to 0', () => {
    const turn: ClipKey<readonly [number, number, number]>[] = [
      { t: 0, v: [0, 0, 0], ease: [0, 0, 1, 1] },
      { t: 2, v: [0, 360, 0] },
    ]
    expect(sampleClipTrack(turn, 1)[1]).toBeCloseTo(180, 6)
  })

  it('leaves unset what a clip has no track for', () => {
    const clip: ClipDefinition = {
      name: 'Turn',
      duration: 2,
      tracks: { rotation: [{ t: 0, v: [0, 20, 0] }] },
    }
    expect(sampleClipPose(clip, 1)).toEqual({ rotation: [0, 20, 0] })
  })
})
