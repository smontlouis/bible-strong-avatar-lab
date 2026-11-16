import {
  fromPaper,
  paperScope,
  readPath,
  toPaper,
  writePath,
  type EditPath,
  type EditPoint,
  type EditSubpath,
  type Vec,
} from '@/features/editor/pathGeometry'

// What the face editor does to whole marks and with its tools, beside moving points: shapes
// drawn in a box, a mark moved, scaled, turned or flipped, a path smoothed, a curve drawn through
// points, a segment bent under the pointer. Paper.js draws the shapes and smooths; the rest is
// plain numbers on the points and their handles.

export type ShapeKind = 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line'
export type ShapeOptions = {
  /** Rectangle: the radius of its corners. */
  radius?: number
  /** Polygon: its sides; star: its points. */
  count?: number
  /** Star: how deep it is, the inner radius against the outer, 0 to 1. */
  inner?: number
}
export type Box = { x: number; y: number; width: number; height: number }

const ZERO: Vec = [0, 0]

/** The box a drag draws from one corner to another. `square` keeps it square, `centered` grows it about its start. */
export const dragBox = (from: Vec, to: Vec, square = false, centered = false): Box => {
  let dx = to[0] - from[0]
  let dy = to[1] - from[1]
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * side
    dy = Math.sign(dy || 1) * side
  }
  if (centered) {
    return {
      x: from[0] - Math.abs(dx),
      y: from[1] - Math.abs(dy),
      width: 2 * Math.abs(dx),
      height: 2 * Math.abs(dy),
    }
  }
  return {
    x: Math.min(from[0], from[0] + dx),
    y: Math.min(from[1], from[1] + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  }
}

/** A line from one point to another; with `snap`, at a multiple of 45°. */
export const snapAngle = (from: Vec, to: Vec): Vec => {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const length = Math.hypot(dx, dy)
  return [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length]
}

/** The path data of a shape in a box (for a line, from one corner to the other). */
export const shapePath = (
  kind: ShapeKind,
  box: Box,
  options: ShapeOptions = {},
  line?: [Vec, Vec]
): string => {
  if (kind === 'line') {
    const [from, to] = line ?? [
      [box.x, box.y] as Vec,
      [box.x + box.width, box.y + box.height] as Vec,
    ]
    return writePath([
      {
        closed: false,
        points: [
          { at: from, in: ZERO, out: ZERO },
          { at: to, in: ZERO, out: ZERO },
        ],
      },
    ])
  }
  if (box.width < 1e-6 || box.height < 1e-6) return ''
  const { Path, Rectangle, Point, Size } = paperScope()
  const rectangle = new Rectangle(new Point(box.x, box.y), new Size(box.width, box.height))
  let shape: paper.Path
  if (kind === 'rectangle') {
    const radius = Math.max(0, Math.min(options.radius ?? 0, box.width / 2, box.height / 2))
    shape = new Path.Rectangle({ rectangle, radius, insert: false })
  } else if (kind === 'ellipse') {
    shape = new Path.Ellipse({ rectangle, insert: false })
  } else {
    const center = new Point(0, 0)
    shape =
      kind === 'polygon'
        ? new Path.RegularPolygon({
            center,
            sides: Math.max(3, Math.round(options.count ?? 6)),
            radius: 1,
            insert: false,
          })
        : new Path.Star({
            center,
            points: Math.max(3, Math.round(options.count ?? 5)),
            radius1: 1,
            radius2: Math.max(0.05, Math.min(1, options.inner ?? 0.5)),
            insert: false,
          })
    // Drawn about its middle at the size of one, then fitted to the box, as a vector tool does.
    shape.fitBounds(rectangle, true)
    const bounds = shape.bounds
    shape.scale(box.width / bounds.width, box.height / bounds.height, bounds.center)
    shape.position = rectangle.center
  }
  return writePath([fromPaper(shape)])
}

/** The box a path's line fills, curves included, strokes not. */
export const pathBounds = (path: EditPath): Box | null => {
  const filled = path.filter(subpath => subpath.points.length)
  if (!filled.length) return null
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const subpath of filled) {
    if (subpath.points.length === 1) {
      const [x, y] = subpath.points[0].at
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      continue
    }
    const bounds = toPaper(subpath).bounds
    minX = Math.min(minX, bounds.left)
    minY = Math.min(minY, bounds.top)
    maxX = Math.max(maxX, bounds.right)
    maxY = Math.max(maxY, bounds.bottom)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** A matrix `[a, b, c, d, e, f]`, as SVG writes it: x' = a x + c y + e, y' = b x + d y + f. */
export type Matrix = [number, number, number, number, number, number]

export const translation = (dx: number, dy: number): Matrix => [1, 0, 0, 1, dx, dy]
export const scaling = (sx: number, sy: number, about: Vec): Matrix => [
  sx,
  0,
  0,
  sy,
  about[0] - sx * about[0],
  about[1] - sy * about[1],
]
export const rotation = (angle: number, about: Vec): Matrix => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    cos,
    sin,
    -sin,
    cos,
    about[0] - cos * about[0] + sin * about[1],
    about[1] - sin * about[0] - cos * about[1],
  ]
}

/** Every point and handle of a path carried by a matrix. */
export const transformPath = (path: EditPath, [a, b, c, d, e, f]: Matrix): EditPath => {
  const point = ([x, y]: Vec): Vec => [a * x + c * y + e, b * x + d * y + f]
  const vector = ([x, y]: Vec): Vec => [a * x + c * y, b * x + d * y]
  return path.map(subpath => ({
    ...subpath,
    points: subpath.points.map(item => ({
      at: point(item.at),
      in: vector(item.in),
      out: vector(item.out),
    })),
  }))
}

/** Path data carried by a matrix. */
export const transformData = (d: string, matrix: Matrix) =>
  writePath(transformPath(readPath(d), matrix))

/** A path flipped about the middle of its box, across (`x`) or up and down (`y`). */
export const flipPath = (path: EditPath, axis: 'x' | 'y'): EditPath => {
  const box = pathBounds(path)
  if (!box) return path
  const center: Vec = [box.x + box.width / 2, box.y + box.height / 2]
  return transformPath(path, axis === 'x' ? scaling(-1, 1, center) : scaling(1, -1, center))
}

/** Some points of a path moved together, their handles with them. */
export const movePoints = (
  path: EditPath,
  picked: readonly { subpath: number; index: number }[],
  by: Vec
): EditPath =>
  path.map((subpath, at) => ({
    ...subpath,
    points: subpath.points.map((point, index) =>
      picked.some(item => item.subpath === at && item.index === index)
        ? { ...point, at: [point.at[0] + by[0], point.at[1] + by[1]] as Vec }
        : point
    ),
  }))

/** The points of a path inside a box, as a box drawn around them picks them. */
export const pointsInBox = (path: EditPath, box: Box) =>
  path.flatMap((subpath, at) =>
    subpath.points.flatMap((point, index) =>
      point.at[0] >= box.x &&
      point.at[0] <= box.x + box.width &&
      point.at[1] >= box.y &&
      point.at[1] <= box.y + box.height
        ? [{ subpath: at, index }]
        : []
    )
  )

/** A subpath smoothed: every point a curve, its handles set by its neighbours. */
export const smoothSubpath = (path: EditPath, subpath: number): EditPath => {
  const paperPath = toPaper(path[subpath])
  paperPath.smooth({ type: 'continuous' })
  return path.map((item, at) => (at === subpath ? fromPaper(paperPath) : item))
}

/**
 * The curve through some points, as a curvature tool draws it: smooth through each point, but
 * for the corners, whose handles are none.
 */
export const curveThrough = (
  points: readonly Vec[],
  corners: ReadonlySet<number>,
  closed = false
): EditSubpath => {
  const base: EditSubpath = { closed, points: points.map(at => ({ at, in: ZERO, out: ZERO })) }
  if (points.length < 3 && !closed) return base
  const paperPath = toPaper(base)
  paperPath.smooth({ type: 'catmull-rom', factor: 0.5 })
  const smooth = fromPaper(paperPath)
  return {
    closed,
    points: smooth.points.map((point, index) =>
      corners.has(index) ? { ...point, in: ZERO, out: ZERO } : point
    ),
  }
}

const bezierAt = (p0: Vec, c1: Vec, c2: Vec, p3: Vec, t: number): Vec => {
  const r = 1 - t
  const a = r * r * r
  const b = 3 * r * r * t
  const c = 3 * r * t * t
  const d = t * t * t
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1],
  ]
}

/**
 * A segment bent so that the point found at `time` along it goes to `to`: both of its handles
 * move by the same amount, the way a vector tool bends a line pulled by its middle.
 */
export const bendSegment = (
  path: EditPath,
  subpath: number,
  curve: number,
  time: number,
  to: Vec
): EditPath => {
  const points = path[subpath].points
  const startIndex = curve
  const endIndex = (curve + 1) % points.length
  const start = points[startIndex]
  const end = points[endIndex]
  if (!start || !end) return path
  // A straight segment is first a curve with handles a third of the way along it.
  const third: Vec = [(end.at[0] - start.at[0]) / 3, (end.at[1] - start.at[1]) / 3]
  const out: Vec = Math.hypot(...start.out) > 1e-6 ? start.out : third
  const into: Vec = Math.hypot(...end.in) > 1e-6 ? end.in : [-third[0], -third[1]]
  const t = Math.max(0.05, Math.min(0.95, time))
  const c1: Vec = [start.at[0] + out[0], start.at[1] + out[1]]
  const c2: Vec = [end.at[0] + into[0], end.at[1] + into[1]]
  const now = bezierAt(start.at, c1, c2, end.at, t)
  const weight = 3 * t * (1 - t)
  const by: Vec = [(to[0] - now[0]) / weight, (to[1] - now[1]) / weight]
  const next: EditPoint[] = points.map((point, index) => {
    if (index === startIndex) return { ...point, out: [out[0] + by[0], out[1] + by[1]] as Vec }
    if (index === endIndex) return { ...point, in: [into[0] + by[0], into[1] + by[1]] as Vec }
    return point
  })
  return path.map((item, at) => (at === subpath ? { ...item, points: next } : item))
}

/** A subpath turned the other way round, so that its first point is its last. */
export const reverseSubpath = (subpath: EditSubpath): EditSubpath => ({
  closed: subpath.closed,
  points: [...subpath.points]
    .reverse()
    .map(point => ({ at: point.at, in: point.out, out: point.in })),
})

/** A point snapped to the grid of `step`, and to the points given when one is nearer than `reach`. */
export const snapPoint = (at: Vec, step: number, others: readonly Vec[], reach: number): Vec => {
  let best: Vec | null = null
  let distance = reach
  for (const other of others) {
    const away = Math.hypot(other[0] - at[0], other[1] - at[1])
    if (away < distance) {
      distance = away
      best = other
    }
  }
  if (best) return [best[0], best[1]]
  return [Math.round(at[0] / step) * step, Math.round(at[1] / step) * step]
}
