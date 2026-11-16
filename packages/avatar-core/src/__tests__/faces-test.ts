import {
  eyeOutline,
  eyePointOnFace,
  faceNames,
  faces,
  eyeMorphOf,
  inspectEyeScales,
  morphEyeShapes,
  resolveFaceName,
  type FaceEye,
} from '../faces'

const box = (points: [number, number][]) => ({
  width: Math.max(...points.map(point => point[0])) - Math.min(...points.map(point => point[0])),
  height: Math.max(...points.map(point => point[1])) - Math.min(...points.map(point => point[1])),
  x: Math.min(...points.map(point => point[0])),
  y: Math.min(...points.map(point => point[1])),
})
/** How far one box is from another: the largest move of an edge. */
const moved = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.x + a.width - (b.x + b.width)),
    Math.abs(a.y + a.height - (b.y + b.height))
  )
const pair = (name: (typeof faceNames)[number]) => faces[name].eyes

describe('faces', () => {
  it('has the nine faces, each with two eyes', () => {
    expect(Object.keys(faces).sort()).toEqual([...faceNames].sort())
    for (const name of faceNames) expect(faces[name].eyes).toHaveLength(2)
  })

  it('lets only upright, open eyes blink', () => {
    expect(faceNames.filter(name => faces[name].blinks)).toEqual([
      'neutral',
      'surprised',
      'inspecting',
    ])
  })

  it('reads the other names a face goes by, and neutral for an unknown one', () => {
    expect(resolveFaceName(' Smile ')).toBe('happy')
    expect(resolveFaceName('inspect')).toBe('inspecting')
    expect(resolveFaceName('angry')).toBe('neutral')
    expect(resolveFaceName('nonsense')).toBe('neutral')
  })

  it('draws the neutral eye as an upright bar 0.26 wide and 0.57 tall', () => {
    const size = box(eyeOutline(faces.neutral.eyes[0]))
    expect(size.width).toBeCloseTo(0.26, 2)
    expect(size.height).toBeCloseTo(0.57, 2)
  })

  it('draws the eyes of inspecting as two circles of two sizes', () => {
    const large = box(eyeOutline(faces.inspecting.eyes[0]))
    const small = box(eyeOutline(faces.inspecting.eyes[1]))
    expect(large.width).toBeCloseTo(0.54, 2)
    expect(large.height).toBeCloseTo(0.54, 2)
    expect(small.width).toBeCloseTo(0.36, 2)
  })

  it('draws calm as an oval', () => {
    const size = box(eyeOutline(faces.calm.eyes[0]))
    expect(size.width).toBeCloseTo(0.592, 2)
    expect(size.height).toBeCloseTo(0.494, 2)
  })

  it('closes an eye into a flat bar of its own width', () => {
    const closed = box(eyeOutline(faces.neutral.eyes[0], 1, 1))
    expect(closed.width).toBeCloseTo(0.26, 2)
    expect(closed.height).toBeCloseTo(0.26 * 0.42, 2)
    const half = box(eyeOutline(faces.neutral.eyes[0], 1, 0.5))
    expect(half.height).toBeGreaterThan(closed.height)
    expect(half.height).toBeLessThan(0.57)
  })

  it('passes from one face to another without a jump, both eyes', () => {
    for (const from of faceNames) {
      for (const to of faceNames) {
        for (const index of [0, 1] as const) {
          let previous = box(eyeOutline(pair(from)[index]))
          for (let step = 1; step <= 100; step += 1) {
            const eye = morphEyeShapes(pair(from), pair(to), step / 100)[index]
            const current = box(eyeOutline(eye))
            // A hundredth of the way moves an edge by a few hundredths at most. Between `sad`
            // and `confused` the line folds on itself halfway, and an edge moves a tenth.
            expect(
              moved(current, previous),
              `${from} → ${to}, eye ${index}, ${step}%`
            ).toBeLessThan(0.1)
            previous = current
          }
          expect(moved(previous, box(eyeOutline(pair(to)[index])))).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('ends a morph on the face itself', () => {
    const [left, right] = morphEyeShapes(pair('neutral'), pair('calm'), 1)
    expect(left).toBe(faces.calm.eyes[0])
    expect(right).toBe(faces.calm.eyes[1])
  })

  it('mixes the numbers of bent eyes, and passes through a capsule towards an oval', () => {
    expect(eyeMorphOf(pair('neutral'), pair('calm'))).toBe('oval')
    expect(eyeMorphOf(pair('calm'), pair('surprised'))).toBe('oval')
    // A smile is bent: its numbers are mixed, oval or not.
    expect(eyeMorphOf(pair('happy'), pair('calm'))).toBe('numbers')
    expect(eyeMorphOf(pair('sleepy'), pair('neutral'))).toBe('numbers')

    // Halfway from neutral to calm, the eye swells out of a capsule as wide as both.
    const [half] = morphEyeShapes(pair('neutral'), pair('calm'), 0.5)
    expect(half.ovalMix).toBeGreaterThan(0.5)
    expect(half.ovalMix).toBeLessThan(1)
    const start = box(eyeOutline(faces.neutral.eyes[0]))
    const end = box(eyeOutline(faces.calm.eyes[0]))
    const middle = box(eyeOutline(half))
    expect(middle.width).toBeGreaterThan(start.width)
    expect(middle.width).toBeLessThan(end.width)
  })

  it('goes on from an eye left halfway to an oval without a jump', () => {
    const halfway: [FaceEye, FaceEye] = morphEyeShapes(pair('neutral'), pair('calm'), 0.5)
    for (const to of faceNames) {
      for (const index of [0, 1] as const) {
        const before = box(eyeOutline(halfway[index]))
        const after = box(eyeOutline(morphEyeShapes(halfway, pair(to), 0.01)[index]))
        expect(moved(before, after), `→ ${to}, eye ${index}`).toBeLessThan(0.05)
      }
    }
  })

  it('trades the sizes of the eyes of inspecting from one lean to the other', () => {
    expect(inspectEyeScales(0, 1)).toEqual([1, 1])
    const [first, second] = inspectEyeScales(1, -1)
    expect(first).toBeCloseTo(1, 6)
    expect(second).toBeCloseTo(1, 6)
    const [swappedFirst, swappedSecond] = inspectEyeScales(1, 1)
    expect(swappedFirst).toBeCloseTo(0.18 / 0.27, 6)
    expect(swappedSecond).toBeCloseTo(0.27 / 0.18, 6)
  })

  it('sets the eyes on each side of the face, and wraps them on the head', () => {
    const [left] = eyePointOnFace(-1, 0, 0)
    const [right] = eyePointOnFace(1, 0, 0)
    expect(left).toBeCloseTo(-0.31535, 4)
    expect(right).toBeCloseTo(0.31535, 4)
    // Outward is away from the middle for both eyes; up on the face is up on the screen.
    expect(eyePointOnFace(-1, 0.1, 0)[0]).toBeLessThan(left)
    expect(eyePointOnFace(1, 0.1, 0)[0]).toBeGreaterThan(right)
    expect(eyePointOnFace(1, 0, 0.1)[1]).toBeLessThan(0)
    // A step outward covers less of the screen than its length: the head curves away.
    expect(eyePointOnFace(1, 0.4, 0)[0] - right).toBeLessThan(0.4)
  })
})
