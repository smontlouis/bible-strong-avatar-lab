import { flattenPath } from '@bible-strong/avatar-core'
import paper from 'paper/dist/paper-core'

// The geometry of the face editor: a mark's path data as points with their handles, as a vector
// tool shows them, and back. Paper.js reads the path data (arcs and quadratic curves become cubic
// ones) and cuts a curve where a point is added without changing its shape; the rest is plain
// numbers. Everything is on the artboard, y down.

export type Vec = [number, number]
/** A point of a path, with its handles relative to it: zero for none. */
export type EditPoint = { at: Vec; in: Vec; out: Vec }
export type EditSubpath = { points: EditPoint[]; closed: boolean }
export type EditPath = EditSubpath[]
/** How a point's handles move together. */
export type PointKind = 'corner' | 'smooth' | 'symmetric'

let scope: paper.PaperScope | null = null
/** A Paper.js scope with a project and no view: geometry only, nothing drawn. */
export const paperScope = () => {
  if (!scope) {
    scope = new paper.PaperScope()
    new scope.Project(null as unknown as HTMLCanvasElement)
  }
  scope.activate()
  return scope
}

const ZERO: Vec = [0, 0]
const length = ([x, y]: Vec) => Math.hypot(x, y)
const isZero = (vector: Vec) => length(vector) < 1e-6
const scale = ([x, y]: Vec, by: number): Vec => [x * by, y * by]
const unit = (vector: Vec): Vec => {
  const size = length(vector)
  return size < 1e-9 ? ZERO : [vector[0] / size, vector[1] / size]
}

/** The points of path data. A path that does not read is no path. */
export const readPath = (d: string): EditPath => {
  const { CompoundPath } = paperScope()
  let compound: paper.CompoundPath
  try {
    // Read strictly first, as the packages read it: Paper.js would take half a path.
    flattenPath(d)
    compound = new CompoundPath({ pathData: d, insert: false })
  } catch {
    return []
  }
  return (compound.children as paper.Path[])
    .map(child => ({
      closed: child.closed,
      points: child.segments.map(segment => ({
        at: [segment.point.x, segment.point.y] as Vec,
        in: [segment.handleIn.x, segment.handleIn.y] as Vec,
        out: [segment.handleOut.x, segment.handleOut.y] as Vec,
      })),
    }))
    .filter(subpath => subpath.points.length > 0)
}

const number = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return String(Object.is(rounded, -0) ? 0 : rounded)
}
const pair = ([x, y]: Vec) => `${number(x)} ${number(y)}`
const plus = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]]

/** Path data for the points: straight lines where there are no handles, cubic curves where there are. */
export const writePath = (path: EditPath): string =>
  path
    .filter(subpath => subpath.points.length > 0)
    .map(subpath => {
      const { points } = subpath
      const piece = (from: EditPoint, to: EditPoint) =>
        isZero(from.out) && isZero(to.in)
          ? `L${pair(to.at)}`
          : `C${pair(plus(from.at, from.out))} ${pair(plus(to.at, to.in))} ${pair(to.at)}`
      let data = `M${pair(points[0].at)}`
      for (let index = 1; index < points.length; index += 1) {
        data += piece(points[index - 1], points[index])
      }
      if (subpath.closed && points.length > 1) {
        const last = points[points.length - 1]
        const first = points[0]
        // The way back to the first point is drawn when it is a curve; a straight one is `Z`.
        if (!(isZero(last.out) && isZero(first.in))) data += piece(last, first)
        data += 'Z'
      }
      return data
    })
    .join('')

export const toPaper = (subpath: EditSubpath) => {
  const { Path, Segment, Point } = paperScope()
  return new Path({
    segments: subpath.points.map(
      point =>
        new Segment(
          new Point(point.at[0], point.at[1]),
          new Point(point.in[0], point.in[1]),
          new Point(point.out[0], point.out[1])
        )
    ),
    closed: subpath.closed,
    insert: false,
  })
}

export const fromPaper = (path: paper.Path): EditSubpath => ({
  closed: path.closed,
  points: path.segments.map(segment => ({
    at: [segment.point.x, segment.point.y] as Vec,
    in: [segment.handleIn.x, segment.handleIn.y] as Vec,
    out: [segment.handleOut.x, segment.handleOut.y] as Vec,
  })),
})

/** Where on the path a point is nearest: which subpath, which curve, how far along it, how far away. */
export type PathSpot = { subpath: number; curve: number; time: number; at: Vec; distance: number }

export const nearestSpot = (path: EditPath, point: Vec): PathSpot | null => {
  const { Point } = paperScope()
  let best: PathSpot | null = null
  path.forEach((subpath, index) => {
    if (subpath.points.length < 2) return
    const location = toPaper(subpath).getNearestLocation(new Point(point[0], point[1]))
    if (!location) return
    const distance = Math.hypot(location.point.x - point[0], location.point.y - point[1])
    if (!best || distance < best.distance) {
      best = {
        subpath: index,
        curve: location.index,
        time: location.time,
        at: [location.point.x, location.point.y],
        distance,
      }
    }
  })
  return best
}

const withSubpath = (path: EditPath, index: number, next: EditSubpath | null): EditPath =>
  next
    ? path.map((subpath, at) => (at === index ? next : subpath))
    : path.filter((_, at) => at !== index)

/** A point added where a spot is, the curve keeping its shape. The new point's index is returned. */
export const insertPoint = (path: EditPath, spot: PathSpot): { path: EditPath; index: number } => {
  const paperPath = toPaper(path[spot.subpath])
  const curve = paperPath.curves[spot.curve]
  // On a point that is already there, there is nothing to cut.
  if (!curve || spot.time < 1e-3 || spot.time > 1 - 1e-3) return { path, index: -1 }
  curve.divideAtTime(spot.time)
  return { path: withSubpath(path, spot.subpath, fromPaper(paperPath)), index: spot.curve + 1 }
}

/** A point taken out. A subpath left with no point goes with it. */
export const removePoint = (path: EditPath, subpath: number, index: number): EditPath => {
  const points = path[subpath].points.filter((_, at) => at !== index)
  return withSubpath(path, subpath, points.length ? { ...path[subpath], points } : null)
}

/** How a point's handles move together, read from them. */
export const kindOf = (point: EditPoint): PointKind => {
  if (isZero(point.in) || isZero(point.out)) return 'corner'
  const a = unit(point.in)
  const b = unit(point.out)
  const opposite = a[0] * b[0] + a[1] * b[1] < -0.999
  if (!opposite) return 'corner'
  return Math.abs(length(point.in) - length(point.out)) <
    0.02 * Math.max(length(point.in), length(point.out))
    ? 'symmetric'
    : 'smooth'
}

const updatePoint = (path: EditPath, subpath: number, index: number, next: EditPoint): EditPath =>
  withSubpath(path, subpath, {
    ...path[subpath],
    points: path[subpath].points.map((point, at) => (at === index ? next : point)),
  })

/** A point made a corner, smooth (handles in line), or symmetric (in line and as long). */
export const setPointKind = (
  path: EditPath,
  subpath: number,
  index: number,
  kind: PointKind
): EditPath => {
  const { points, closed } = path[subpath]
  const point = points[index]
  if (kind === 'corner') return updatePoint(path, subpath, index, { ...point, in: ZERO, out: ZERO })
  const neighbour = (by: 1 | -1) => {
    const at = index + by
    if (at >= 0 && at < points.length) return points[at].at
    return closed && points.length > 1 ? points[(at + points.length) % points.length].at : null
  }
  const before = neighbour(-1)
  const after = neighbour(1)
  // Handles in line: along their own line when there are some, else from neighbour to neighbour.
  let direction =
    !isZero(point.out) && !isZero(point.in)
      ? unit([point.out[0] - point.in[0], point.out[1] - point.in[1]])
      : unit([
          (after ?? point.at)[0] - (before ?? point.at)[0],
          (after ?? point.at)[1] - (before ?? point.at)[1],
        ])
  if (isZero(direction)) direction = [1, 0]
  const reach = (other: Vec | null, own: Vec) =>
    !isZero(own)
      ? length(own)
      : other
        ? length([other[0] - point.at[0], other[1] - point.at[1]]) / 3
        : 10
  let inLength = reach(before, point.in)
  let outLength = reach(after, point.out)
  if (kind === 'symmetric') inLength = outLength = (inLength + outLength) / 2
  return updatePoint(path, subpath, index, {
    ...point,
    in: scale(direction, -inLength),
    out: scale(direction, outLength),
  })
}

/** A point moved, its handles with it. */
export const movePoint = (path: EditPath, subpath: number, index: number, to: Vec): EditPath =>
  updatePoint(path, subpath, index, { ...path[subpath].points[index], at: to })

/**
 * A handle moved to a place on the artboard. The other handle follows as `kind` says: mirrored
 * (symmetric), kept in line at its own length (smooth), or left where it is (corner). The kind is
 * the editor's to keep: path data holds handles, not how they were meant to move.
 */
export const moveHandle = (
  path: EditPath,
  subpath: number,
  index: number,
  which: 'in' | 'out',
  to: Vec,
  kind: PointKind
): EditPath => {
  const point = path[subpath].points[index]
  const moved: Vec = [to[0] - point.at[0], to[1] - point.at[1]]
  const other = which === 'in' ? 'out' : 'in'
  let follow = point[other]
  if (kind === 'symmetric') follow = scale(moved, -1)
  else if (kind === 'smooth' && !isZero(point[other])) {
    follow = scale(unit(moved), -length(point[other]))
  }
  return updatePoint(path, subpath, index, { ...point, [which]: moved, [other]: follow })
}

/** A point added at the end of a subpath, as a pen adds it, with a handle out (in is its mirror). */
export const appendPoint = (path: EditPath, subpath: number, at: Vec, out: Vec = ZERO): EditPath =>
  withSubpath(path, subpath, {
    ...path[subpath],
    points: [...path[subpath].points, { at, in: scale(out, -1), out }],
  })

/** The handles of the last point a pen set, as it drags. */
export const setLastHandles = (path: EditPath, subpath: number, out: Vec): EditPath => {
  const points = path[subpath].points
  return updatePoint(path, subpath, points.length - 1, {
    ...points[points.length - 1],
    in: scale(out, -1),
    out,
  })
}

export const setClosed = (path: EditPath, subpath: number, closed: boolean): EditPath =>
  withSubpath(path, subpath, { ...path[subpath], closed })
