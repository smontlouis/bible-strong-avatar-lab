// @vitest-environment jsdom
import { flattenPath } from '@bible-strong/avatar-core'

import {
  appendPoint,
  insertPoint,
  kindOf,
  moveHandle,
  movePoint,
  nearestSpot,
  readPath,
  removePoint,
  setClosed,
  setLastHandles,
  setPointKind,
  writePath,
  type EditPath,
} from '@/features/editor/pathGeometry'

/** The polylines the core draws a path as, to compare two paths' shapes. */
const lines = (d: string) => flattenPath(d, 0.5).map(subpath => subpath.points)
const toSegment = ([x, y]: number[], [ax, ay]: number[], [bx, by]: number[]) => {
  const length = (bx - ax) ** 2 + (by - ay) ** 2
  const t = length
    ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length))
    : 0
  return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)))
}
/** How far, at most, a point of one path is from the other path. */
const farthest = (a: string, b: string) => {
  const other = lines(b)
  return Math.max(
    ...lines(a)
      .flat()
      .map(point =>
        Math.min(
          ...other.flatMap(line =>
            line.length === 1
              ? [Math.hypot(point[0] - line[0][0], point[1] - line[0][1])]
              : line.slice(1).map((end, index) => toSegment(point, line[index], end))
          )
        )
      )
  )
}

describe('the geometry of the face editor', () => {
  it('reads path data into points and writes the same shape back', () => {
    for (const d of [
      'M50 10L61 38L92 39L68 58L76 88L50 71L24 88L32 58L8 39L39 38Z',
      'M22 50A28 28 0 1 0 78 50A28 28 0 1 0 22 50Z',
      'M28 28L72 72M72 28L28 72',
      'M26 58Q50 34 74 58',
      'M50 26.5V73.5',
    ]) {
      const written = writePath(readPath(d))
      expect(farthest(d, written), d).toBeLessThan(0.3)
      expect(farthest(written, d), d).toBeLessThan(0.3)
    }
    expect(readPath('M10 10L20')).toEqual([])
    const [cross] = [readPath('M28 28L72 72M72 28L28 72')]
    expect(cross).toHaveLength(2)
    expect(writePath(cross)).toBe('M28 28L72 72M72 28L28 72')
  })

  it('adds a point on a curve without changing its shape, and takes one out', () => {
    const d = 'M22 50A28 28 0 1 0 78 50A28 28 0 1 0 22 50Z'
    const path = readPath(d)
    // Between two points of the circle, half way down its right side.
    const spot = nearestSpot(path, [70, 70])!
    expect(spot.distance).toBeLessThan(1.5)
    const { path: more, index } = insertPoint(path, spot)
    expect(more[0].points).toHaveLength(path[0].points.length + 1)
    expect(more[0].points[index].at[0]).toBeCloseTo(50 + 28 * Math.SQRT1_2, 0)
    expect(farthest(writePath(more), d)).toBeLessThan(0.3)
    // On a point already there, nothing is cut.
    const onPoint = nearestSpot(path, [50, 79])!
    expect(insertPoint(path, onPoint).index).toBe(-1)
    const fewer = removePoint(more, 0, index)
    expect(fewer[0].points).toHaveLength(path[0].points.length)
    expect(removePoint(readPath('M10 10L20 20'), 0, 0)[0].points).toHaveLength(1)
    expect(removePoint(readPath('M10 10'), 0, 0)).toEqual([])
  })

  it('makes a point a corner, smooth or symmetric, and moves handles as each does', () => {
    let path: EditPath = readPath('M10 50L50 20L90 50')
    expect(kindOf(path[0].points[1])).toBe('corner')
    path = setPointKind(path, 0, 1, 'symmetric')
    const point = path[0].points[1]
    expect(kindOf(point)).toBe('symmetric')
    // In line with its neighbours, from left to right.
    expect(point.out[1]).toBeCloseTo(0, 6)
    expect(point.out[0]).toBeGreaterThan(0)
    // A symmetric point's other handle mirrors the one moved.
    path = moveHandle(path, 0, 1, 'out', [70, 10], 'symmetric')
    expect(path[0].points[1].in).toEqual([-20, 10])
    // A smooth point keeps the other handle's length, in line.
    path = setPointKind(path, 0, 1, 'smooth')
    path = moveHandle(path, 0, 1, 'out', [50 + 30, 20], 'smooth')
    const smooth = path[0].points[1]
    expect(smooth.in[1]).toBeCloseTo(0, 6)
    expect(Math.hypot(...smooth.in)).toBeCloseTo(Math.hypot(20, 10), 6)
    // A corner's handles move on their own.
    path = moveHandle(path, 0, 1, 'out', [50, 0], 'corner')
    expect(kindOf(path[0].points[1])).toBe('corner')
    expect(path[0].points[1].in).toEqual(smooth.in)
    path = movePoint(path, 0, 1, [55, 25])
    expect(path[0].points[1].at).toEqual([55, 25])
    expect(path[0].points[1].in).toEqual(smooth.in)
  })

  it('draws as a pen does: points with handles, then closed', () => {
    let path: EditPath = [{ points: [{ at: [20, 50], in: [0, 0], out: [0, 0] }], closed: false }]
    path = appendPoint(path, 0, [50, 20])
    path = setLastHandles(path, 0, [15, 0])
    path = appendPoint(path, 0, [80, 50])
    path = setClosed(path, 0, true)
    expect(writePath(path)).toBe('M20 50C20 50 35 20 50 20C65 20 80 50 80 50Z')
  })
})
