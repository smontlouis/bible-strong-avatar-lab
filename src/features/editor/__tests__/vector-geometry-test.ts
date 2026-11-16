// @vitest-environment jsdom
import { readPath, writePath, type EditPath } from '@/features/editor/pathGeometry'
import {
  bendSegment,
  curveThrough,
  dragBox,
  flipPath,
  movePoints,
  pathBounds,
  pointsInBox,
  reverseSubpath,
  rotation,
  scaling,
  shapePath,
  smoothSubpath,
  snapAngle,
  snapPoint,
  transformPath,
} from '@/features/editor/vectorGeometry'

const box = { x: 20, y: 30, width: 60, height: 40 }
const near = (a: number[], b: number[], digits = 2) =>
  a.forEach((value, index) => expect(value).toBeCloseTo(b[index], digits))

describe('the vector geometry of the face editor', () => {
  it('draws shapes that fill the box they are drawn in', () => {
    for (const kind of ['rectangle', 'ellipse', 'polygon', 'star'] as const) {
      const bounds = pathBounds(readPath(shapePath(kind, box)))!
      near([bounds.x, bounds.y, bounds.width, bounds.height], [20, 30, 60, 40], 1)
    }
    expect(readPath(shapePath('rectangle', box))[0].points).toHaveLength(4)
    // Rounded corners add a curve at each corner.
    expect(readPath(shapePath('rectangle', box, { radius: 8 }))[0].points).toHaveLength(8)
    expect(readPath(shapePath('polygon', box, { count: 5 }))[0].points).toHaveLength(5)
    expect(readPath(shapePath('star', box, { count: 6, inner: 0.4 }))[0].points).toHaveLength(12)
    expect(
      shapePath('line', box, {}, [
        [10, 10],
        [90, 90],
      ])
    ).toBe('M10 10L90 90')
    expect(shapePath('ellipse', { x: 0, y: 0, width: 0, height: 10 })).toBe('')
  })

  it('makes the box of a drag square, or about its start', () => {
    expect(dragBox([10, 10], [40, 20])).toEqual({ x: 10, y: 10, width: 30, height: 10 })
    expect(dragBox([40, 20], [10, 10])).toEqual({ x: 10, y: 10, width: 30, height: 10 })
    expect(dragBox([10, 10], [40, 20], true)).toEqual({ x: 10, y: 10, width: 30, height: 30 })
    expect(dragBox([50, 50], [60, 70], false, true)).toEqual({
      x: 40,
      y: 30,
      width: 20,
      height: 40,
    })
    near(snapAngle([0, 0], [10, 1]), [Math.hypot(10, 1), 0])
  })

  it('moves, scales, turns and flips a whole mark', () => {
    const path = readPath('M10 10L30 10L30 20Z')
    const scaled = transformPath(path, scaling(2, 3, [10, 10]))
    near(scaled[0].points[2].at, [50, 40])
    const turned = transformPath(path, rotation(Math.PI / 2, [10, 10]))
    near(turned[0].points[1].at, [10, 30])
    const flipped = flipPath(path, 'x')
    near(flipped[0].points[0].at, [30, 10])
    near(flipped[0].points[1].at, [10, 10])
    // Handles turn with their points.
    const curve = readPath('M0 0C10 0 20 10 20 20')
    near(transformPath(curve, rotation(Math.PI / 2, [0, 0]))[0].points[0].out, [0, 10])
  })

  it('moves the points picked together, as a box around them picks them', () => {
    const path = readPath('M10 10L50 10L90 10')
    const picked = pointsInBox(path, { x: 0, y: 0, width: 60, height: 20 })
    expect(picked).toEqual([
      { subpath: 0, index: 0 },
      { subpath: 0, index: 1 },
    ])
    expect(writePath(movePoints(path, picked, [0, 5]))).toBe('M10 15L50 15L90 10')
  })

  it('bends a segment so that it passes where it is pulled', () => {
    const path: EditPath = readPath('M10 50L90 50')
    const bent = bendSegment(path, 0, 0, 0.5, [50, 30])
    const [start, end] = bent[0].points
    // At its middle a cubic is (P0 + 3 C1 + 3 C2 + P3) / 8.
    const middle = [
      (start.at[0] + 3 * (start.at[0] + start.out[0]) + 3 * (end.at[0] + end.in[0]) + end.at[0]) /
        8,
      (start.at[1] + 3 * (start.at[1] + start.out[1]) + 3 * (end.at[1] + end.in[1]) + end.at[1]) /
        8,
    ]
    near(middle, [50, 30])
  })

  it('smooths a path, and draws a curve through points but for its corners', () => {
    const smooth = smoothSubpath(readPath('M10 50L50 10L90 50'), 0)
    expect(Math.hypot(...smooth[0].points[1].out)).toBeGreaterThan(1)
    const curve = curveThrough(
      [
        [10, 50],
        [50, 10],
        [90, 50],
        [50, 90],
      ],
      new Set([2])
    )
    expect(curve.points.map(point => point.at)).toEqual([
      [10, 50],
      [50, 10],
      [90, 50],
      [50, 90],
    ])
    expect(Math.hypot(...curve.points[1].out)).toBeGreaterThan(1)
    expect(curve.points[2].in).toEqual([0, 0])
    expect(curve.points[2].out).toEqual([0, 0])
  })

  it('turns a path round, and snaps a point to the grid or to a point nearby', () => {
    const [reversed] = reverseSubpath(readPath('M0 0C10 0 20 10 20 20')[0]).points.slice(0, 1)
    expect(reversed.at).toEqual([20, 20])
    expect(reversed.out).toEqual([0, -10])
    expect(snapPoint([12, 18], 5, [], 2)).toEqual([10, 20])
    expect(snapPoint([12, 18], 5, [[13, 17]], 2)).toEqual([13, 17])
  })
})
