import {
  flattenPath,
  signedArea,
  simplifyPolyline,
  type PathPoint,
  type Subpath,
} from './svgPath.js'

// Drawn faces. A drawn eye is a few marks, as in any vector tool: paths that are filled, or
// stroked with a width, round or square ends and round, sharp or cut corners, or both. Each is
// drawn on an artboard of 100 by 100, whose middle is where the eye sits on the face, y down as
// in SVG. The eye on the left of the screen is drawn as it is seen; the right one is its mirror,
// unless it is drawn too.
//
// A face is read once into shapes: every fill and every stroke becomes filled polygons in the
// eye's own frame (across outward, up up, in head radii), all turning the same way so that
// together, under SVG's `nonzero` rule, they make one shape. A hole is a polygon turning the
// other way, as a filled path with a hole is in SVG.

/** How many head radii the artboard's 100 units are. The built-in neutral eye is about 43 by 95. */
export const ARTBOARD_RADII = 0.6
export const ARTBOARD_SIZE = 100
const UNIT = ARTBOARD_RADII / ARTBOARD_SIZE

export type StrokeCap = 'round' | 'butt' | 'square'
export type StrokeJoin = 'round' | 'miter' | 'bevel'

/** One mark of an eye: path data on the artboard, filled, stroked, or both. */
export type FaceMark = {
  d: string
  /** Fill the path. A path that is not closed is filled as if it were. Default: filled. */
  fill?: boolean
  /** How a filled path with paths inside it makes holes, as SVG's `fill-rule`. */
  fillRule?: 'nonzero' | 'evenodd'
  stroke?: {
    /** In artboard units. */
    width: number
    cap?: StrokeCap
    join?: StrokeJoin
  }
}

/** A face as it is written: a name, and the marks of its eyes. */
export type FaceDefinition = {
  name: string
  /** Whether the eyes close when the avatar blinks. Default: they do. */
  blinks?: boolean
  /** What the face asks of a mouth, from -1 to 1: corners down, as they are, or up. Default 0. */
  smile?: number
  eyes: {
    left: FaceMark[]
    /** Drawn as seen on screen. Left out, the right eye is the left one's mirror. */
    right?: FaceMark[]
  }
}

/** An eye read into shapes: filled polygons in the eye's frame, across outward and up. */
export type DrawnEye = {
  kind: 'drawn'
  shapes: [number, number][][]
  /** Whether the shapes are drawn as smooth curves through their points. */
  smooth?: boolean
  /** How far the eye is closed while one face gives way to another: 0 open, 1 shut. */
  shut?: number
}

/** A face read and ready to draw. */
export type CompiledFace = {
  name: string
  blinks: boolean
  smile: number
  eyes: [DrawnEye, DrawnEye]
}

/** At most this many points in all the shapes of an eye; every one is laid on the head each frame. */
export const MAX_EYE_POINTS = 600

// A corner sharper than this turn is a corner: its stroke gets the mark's join.
const CORNER_TURN = 0.45
const CAP_STEPS = 8
const DISC_STEPS = 20
const MITER_LIMIT = 4

const sub = (a: PathPoint, b: PathPoint): PathPoint => [a[0] - b[0], a[1] - b[1]]
const length = ([x, y]: PathPoint) => Math.hypot(x, y)
const unit = (vector: PathPoint): PathPoint => {
  const size = length(vector) || 1
  return [vector[0] / size, vector[1] / size]
}
/** The normal to the left of a direction, y up. */
const leftOf = ([x, y]: PathPoint): PathPoint => [-y, x]
const counterclockwise = (polygon: PathPoint[]) =>
  signedArea(polygon) < 0 ? polygon.reverse() : polygon

const disc = (center: PathPoint, radius: number, steps = DISC_STEPS): PathPoint[] =>
  Array.from({ length: steps }, (_, step) => {
    const angle = (step / steps) * Math.PI * 2
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]
  })

/** The end of a run of a stroke, from its last point outward along `heading`. */
const capPoints = (point: PathPoint, heading: PathPoint, radius: number, cap: StrokeCap) => {
  const normal = leftOf(heading)
  if (cap === 'round') {
    // Half a circle from the right side round the front to the left side.
    const out: PathPoint[] = []
    const base = Math.atan2(-normal[1], -normal[0])
    for (let step = 1; step < CAP_STEPS; step += 1) {
      const angle = base + (step / CAP_STEPS) * Math.PI
      out.push([point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius])
    }
    return out
  }
  if (cap === 'square') {
    const ahead: PathPoint = [point[0] + heading[0] * radius, point[1] + heading[1] * radius]
    return [
      [ahead[0] - normal[0] * radius, ahead[1] - normal[1] * radius],
      [ahead[0] + normal[0] * radius, ahead[1] + normal[1] * radius],
    ] as PathPoint[]
  }
  return [] as PathPoint[]
}

/**
 * The outline of one run of a stroke: a line with no sharp corner, offset to both sides.
 * `startCap` and `endCap` are its ends; a run that meets another at a corner ends `butt`, a hair
 * past the corner so that the two overlap.
 */
const runOutline = (
  points: PathPoint[],
  radius: number,
  startCap: StrokeCap,
  endCap: StrokeCap
): PathPoint[] => {
  const last = points.length - 1
  const directions = points.slice(1).map((point, index) => unit(sub(point, points[index])))
  const normalAt = (index: number): PathPoint => {
    const before = directions[Math.max(0, index - 1)]
    const after = directions[Math.min(directions.length - 1, index)]
    const mean = unit([before[0] + after[0], before[1] + after[1]])
    const cosine = Math.max(0.3, mean[0] * after[0] + mean[1] * after[1])
    const normal = leftOf(mean)
    return [normal[0] / cosine, normal[1] / cosine]
  }
  const hair = radius * 0.02
  const ends = points.map(point => [point[0], point[1]] as PathPoint)
  if (startCap === 'butt') {
    ends[0] = [ends[0][0] - directions[0][0] * hair, ends[0][1] - directions[0][1] * hair]
  }
  if (endCap === 'butt') {
    const heading = directions[directions.length - 1]
    ends[last] = [ends[last][0] + heading[0] * hair, ends[last][1] + heading[1] * hair]
  }
  const outline: PathPoint[] = []
  for (let index = 0; index <= last; index += 1) {
    const normal = normalAt(index)
    outline.push([ends[index][0] + normal[0] * radius, ends[index][1] + normal[1] * radius])
  }
  outline.push(
    ...capPoints(ends[last], directions[directions.length - 1], radius, endCap).reverse()
  )
  for (let index = last; index >= 0; index -= 1) {
    const normal = normalAt(index)
    outline.push([ends[index][0] - normal[0] * radius, ends[index][1] - normal[1] * radius])
  }
  const back = directions[0]
  outline.push(...capPoints(ends[0], [-back[0], -back[1]], radius, startCap).reverse())
  return counterclockwise(outline)
}

/** What fills the corner between two runs of a stroke, on its outer side. */
const joinPiece = (
  corner: PathPoint,
  into: PathPoint,
  out: PathPoint,
  radius: number,
  join: StrokeJoin
): PathPoint[] | null => {
  if (join === 'round') return disc(corner, radius)
  const turn = into[0] * out[1] - into[1] * out[0]
  // The outer side is to the right of a left turn, and to the left of a right turn.
  const side = turn > 0 ? -1 : 1
  const a: PathPoint = [
    corner[0] + leftOf(into)[0] * radius * side,
    corner[1] + leftOf(into)[1] * radius * side,
  ]
  const b: PathPoint = [
    corner[0] + leftOf(out)[0] * radius * side,
    corner[1] + leftOf(out)[1] * radius * side,
  ]
  if (join === 'miter') {
    const between = unit([a[0] + b[0] - 2 * corner[0], a[1] + b[1] - 2 * corner[1]])
    const half = Math.acos(Math.max(-1, Math.min(1, into[0] * out[0] + into[1] * out[1]))) / 2
    const reach = radius / Math.max(Math.cos(half), 1e-6)
    if (reach / radius <= MITER_LIMIT) {
      return counterclockwise([
        corner,
        a,
        [corner[0] + between[0] * reach, corner[1] + between[1] * reach],
        b,
      ])
    }
  }
  return counterclockwise([corner, a, b])
}

/** The filled shapes of a stroke along a polyline. */
const strokeShapes = (
  subpath: Subpath,
  radius: number,
  cap: StrokeCap,
  join: StrokeJoin
): PathPoint[][] => {
  const points = subpath.points
  if (radius <= 0 || !points.length) return []
  if (points.length === 1) {
    if (cap === 'round') return [disc(points[0], radius)]
    if (cap === 'square') {
      const [x, y] = points[0]
      return [
        [
          [x - radius, y - radius],
          [x + radius, y - radius],
          [x + radius, y + radius],
          [x - radius, y + radius],
        ],
      ]
    }
    return []
  }
  const loop = subpath.closed && points.length > 2
  const count = points.length
  const at = (index: number) => points[((index % count) + count) % count]
  const into = (index: number) => unit(sub(at(index), at(index - 1)))
  const out = (index: number) => unit(sub(at(index + 1), at(index)))
  // Where the line turns sharply, or bends tighter than the stroke is wide, the stroke is cut:
  // each run is offset on its own and the corner is filled, which never folds the outline.
  const cuts: { index: number; join: StrokeJoin }[] = []
  for (let index = loop ? 0 : 1; index < (loop ? count : count - 1); index += 1) {
    const a = into(index)
    const b = out(index)
    const turn = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])))
    const shortest = Math.min(
      length(sub(at(index), at(index - 1))),
      length(sub(at(index + 1), at(index)))
    )
    if (turn > CORNER_TURN) cuts.push({ index, join })
    else if (turn > 1e-3 && shortest / turn < radius) cuts.push({ index, join: 'round' })
  }
  const shapes: PathPoint[][] = []
  const runBetween = (from: number, to: number) => {
    const run: PathPoint[] = []
    for (let index = from; index <= to; index += 1) run.push(at(index))
    return run
  }
  if (loop) {
    // A closed line is cut where it turns, or in two where it never does.
    const marks = cuts.length ? cuts.map(cut => cut.index) : [0, Math.floor(count / 2)]
    for (let index = 0; index < marks.length; index += 1) {
      const from = marks[index]
      const to = index + 1 < marks.length ? marks[index + 1] : marks[0] + count
      shapes.push(runOutline(runBetween(from, to), radius, 'butt', 'butt'))
    }
    if (!cuts.length) {
      for (const index of marks) shapes.push(disc(at(index), radius))
    }
  } else {
    const marks = [0, ...cuts.map(cut => cut.index), count - 1]
    for (let index = 0; index + 1 < marks.length; index += 1) {
      const from = marks[index]
      const to = marks[index + 1]
      shapes.push(
        runOutline(
          runBetween(from, to),
          radius,
          from === 0 ? cap : 'butt',
          to === count - 1 ? cap : 'butt'
        )
      )
    }
  }
  for (const cut of cuts) {
    const piece = joinPiece(at(cut.index), into(cut.index), out(cut.index), radius, cut.join)
    if (piece) shapes.push(piece)
  }
  return shapes
}

/** Whether a point is inside a polygon, by crossings. */
const inside = (point: PathPoint, polygon: readonly PathPoint[]) => {
  let crossings = false
  for (let index = 0, last = polygon.length - 1; index < polygon.length; last = index++) {
    const [xi, yi] = polygon[index]
    const [xj, yj] = polygon[last]
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      crossings = !crossings
    }
  }
  return crossings
}

/**
 * The fill of a mark's polygons, turned so that `nonzero` draws what the mark's rule draws: the
 * largest turns counterclockwise and the others keep their turn against it; under `evenodd`,
 * a polygon inside an odd number of others is a hole.
 */
const fillShapes = (polygons: PathPoint[][], rule: 'nonzero' | 'evenodd'): PathPoint[][] => {
  const usable = polygons.filter(
    polygon => polygon.length >= 3 && Math.abs(signedArea(polygon)) > 1e-12
  )
  if (!usable.length) return []
  if (rule === 'evenodd') {
    return usable.map(polygon => {
      const depth = usable.filter(other => other !== polygon && inside(polygon[0], other)).length
      const turned = counterclockwise(polygon.map(point => [point[0], point[1]] as PathPoint))
      return depth % 2 === 1 ? turned.reverse() : turned
    })
  }
  const largest = usable.reduce((best, polygon) =>
    Math.abs(signedArea(polygon)) > Math.abs(signedArea(best)) ? polygon : best
  )
  const flip = signedArea(largest) < 0
  return usable.map(polygon => (flip ? [...polygon].reverse() : polygon))
}

const pointCount = (shapes: readonly (readonly PathPoint[])[]) =>
  shapes.reduce((total, shape) => total + shape.length, 0)

/**
 * Read the marks of one eye into its shapes. `side` is -1 for the eye on the left of the screen,
 * whose outward is to the left, and 1 for the right one.
 */
const eyeShapes = (marks: readonly FaceMark[], side: -1 | 1, problems: string[], label: string) => {
  const toFrame = ([x, y]: PathPoint): PathPoint => [
    side * (x - ARTBOARD_SIZE / 2) * UNIT,
    -(y - ARTBOARD_SIZE / 2) * UNIT,
  ]
  const build = (tolerance: number) => {
    const shapes: PathPoint[][] = []
    marks.forEach((mark, index) => {
      let subpaths: Subpath[]
      try {
        subpaths = flattenPath(mark.d)
      } catch (error) {
        problems.push(`${label} mark ${index + 1}: ${(error as Error).message}`)
        return
      }
      const lines = subpaths.map(subpath => {
        const framed = subpath.points.map(toFrame)
        const simple = subpath.closed
          ? simplifyPolyline([...framed, framed[0]], tolerance).slice(0, -1)
          : simplifyPolyline(framed, tolerance)
        return { points: simple.length ? simple : framed.slice(0, 1), closed: subpath.closed }
      })
      if (mark.fill !== false) {
        shapes.push(
          ...fillShapes(
            lines.map(line => line.points.map(point => [...point] as PathPoint)),
            mark.fillRule ?? 'nonzero'
          )
        )
      }
      if (mark.stroke && mark.stroke.width > 0) {
        const radius = (mark.stroke.width / 2) * UNIT
        for (const line of lines) {
          shapes.push(
            ...strokeShapes(line, radius, mark.stroke.cap ?? 'butt', mark.stroke.join ?? 'miter')
          )
        }
      }
    })
    return shapes
  }
  let tolerance = 0.15 * UNIT
  let shapes = build(tolerance)
  // Too many points for every frame: drop the ones that matter least until it fits.
  while (pointCount(shapes) > MAX_EYE_POINTS && tolerance < 4 * UNIT) {
    tolerance *= 1.6
    shapes = build(tolerance)
  }
  if (pointCount(shapes) > MAX_EYE_POINTS) {
    problems.push(
      `${label} has ${pointCount(shapes)} points, more than ${MAX_EYE_POINTS}: simplify it`
    )
  }
  if (!shapes.length && marks.length) problems.push(`${label} draws nothing`)
  return shapes
}

/** The names of the built-in faces and of their aliases, which a drawn face cannot take. */
export const reservedFaceNames: readonly string[] = [
  'neutral',
  'happy',
  'surprised',
  'sad',
  'sleepy',
  'squinted',
  'calm',
  'inspecting',
  'confused',
  'blink',
  'thinking',
  'strange',
  'angry',
  'inspect',
  'squint',
  'idle',
  'smile',
  'sleep',
]

/** What is wrong with a name for a drawn face, or `null`. */
export const faceNameProblem = (name: unknown) => {
  if (typeof name !== 'string' || !name.trim()) return 'a face needs a name'
  if (name !== name.trim()) return 'a face name has no spaces at its ends'
  if (reservedFaceNames.includes(name.toLowerCase())) {
    return `"${name}" is the name of a built-in face`
  }
  return null
}

const isMark = (value: unknown): value is FaceMark => {
  if (!value || typeof value !== 'object') return false
  const mark = value as Record<string, unknown>
  if (typeof mark.d !== 'string') return false
  if (mark.fill !== undefined && typeof mark.fill !== 'boolean') return false
  if (mark.fillRule !== undefined && mark.fillRule !== 'nonzero' && mark.fillRule !== 'evenodd') {
    return false
  }
  if (mark.stroke !== undefined) {
    const stroke = mark.stroke as Record<string, unknown>
    if (!stroke || typeof stroke !== 'object') return false
    if (typeof stroke.width !== 'number' || !(stroke.width >= 0)) return false
    if (stroke.cap !== undefined && !['round', 'butt', 'square'].includes(stroke.cap as string)) {
      return false
    }
    if (stroke.join !== undefined && !['round', 'miter', 'bevel'].includes(stroke.join as string)) {
      return false
    }
  }
  return true
}

/** What is wrong with a face as it is written, or `null`: its shape, not how it draws. */
export const faceDefinitionProblem = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return 'a face is an object'
  const face = value as Record<string, unknown>
  const named = faceNameProblem(face.name)
  if (named) return named
  if (face.blinks !== undefined && typeof face.blinks !== 'boolean')
    return '"blinks" is true or false'
  if (
    face.smile !== undefined &&
    (typeof face.smile !== 'number' || face.smile < -1 || face.smile > 1)
  ) {
    return '"smile" is a number from -1 to 1'
  }
  const eyes = face.eyes as Record<string, unknown> | undefined
  if (!eyes || typeof eyes !== 'object') return 'a face has "eyes", with "left" and maybe "right"'
  for (const side of ['left', 'right'] as const) {
    const marks = eyes[side]
    if (side === 'right' && marks === undefined) continue
    if (!Array.isArray(marks) || !marks.length) return `"eyes.${side}" is a list of marks`
    const bad = marks.findIndex(mark => !isMark(mark))
    if (bad >= 0) {
      return `"eyes.${side}" mark ${bad + 1} needs "d", and "fill", "fillRule" and "stroke" as the guide says`
    }
  }
  return null
}

/**
 * Read a face into what draws it. `problems` says what could not be drawn: a path that is not
 * valid, an eye with too many points. Throws when the face itself is not valid.
 */
export const compileFace = (face: FaceDefinition): { face: CompiledFace; problems: string[] } => {
  const problem = faceDefinitionProblem(face)
  if (problem) throw new Error(problem)
  const problems: string[] = []
  const left = eyeShapes(face.eyes.left, -1, problems, 'left eye')
  // The right eye mirrors the left: in the eye's own frame, outward is the same for both.
  const right = face.eyes.right ? eyeShapes(face.eyes.right, 1, problems, 'right eye') : left
  return {
    face: {
      name: face.name,
      blinks: face.blinks ?? true,
      smile: face.smile ?? 0,
      eyes: [
        { kind: 'drawn', shapes: left },
        { kind: 'drawn', shapes: right },
      ],
    },
    problems,
  }
}

// Closing a drawn eye squashes it towards a line this far up from its bottom.
const LID_LINE = 0.4
// Shut while a face gives way to another, an eye keeps this much of its height.
const SHUT_HEIGHT = 0.03
// Closed by its eyelids, an eye is a flat bar this tall for its width, as a built-in eye is.
const CLOSED_EYE_RATIO = 0.42

/**
 * The shapes of a drawn eye as they are drawn: scaled by `size` about the eye's place, closed by
 * `lids` (squashed towards its lid line, down to a bar) and by `shut` (down to a hair).
 */
export const drawnEyeShapes = (
  eye: Readonly<DrawnEye>,
  size = 1,
  lids = 0
): [number, number][][] => {
  const shut = Math.max(0, Math.min(1, eye.shut ?? 0))
  const closing = Math.max(0, Math.min(1, lids))
  let shapes = eye.shapes.map(shape =>
    shape.map(([x, y]) => [x * size, y * size] as [number, number])
  )
  if (closing <= 1e-4 && shut <= 1e-4) return shapes
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const shape of shapes) {
    for (const [x, y] of shape) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  const height = maxY - minY
  if (!(height > 0)) return shapes
  const closedShare = Math.min(1, (CLOSED_EYE_RATIO * (maxX - minX)) / height)
  const lidded = 1 + (closedShare - 1) * closing
  const kept = lidded * (1 + (SHUT_HEIGHT - 1) * shut)
  const line = minY + LID_LINE * height
  shapes = shapes.map(shape =>
    shape.map(([x, y]) => [x, line + (y - line) * kept] as [number, number])
  )
  return shapes
}
