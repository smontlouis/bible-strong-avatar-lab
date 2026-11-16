// SVG path data read without a DOM: `M L H V C S Q T A Z`, absolute and relative, turned into
// lines. Curves are cut into short straight pieces, so what comes out is a list of polylines,
// each open or closed. It runs wherever the core runs, React Native's UI thread included, but is
// meant to run once, when a drawing is read, not at every frame.

export type PathPoint = [number, number]
/** One run of the pen: its points in order, and whether it closes back on its first. */
export type Subpath = { points: PathPoint[]; closed: boolean }

/** How long, at most, a straight piece of a curve is, in the drawing's own units. */
const DEFAULT_STEP = 2.5
const MAX_CURVE_PIECES = 64

const isCommand = (char: string) => /[MmLlHhVvCcSsQqTtAaZz]/.test(char)

/** The numbers and commands of path data, in order. Arc flags may be packed: `a1 1 0 01 2 2`. */
const tokens = (data: string) => {
  const out: (string | number)[] = []
  let index = 0
  let arcArgument = -1
  const number = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/
  while (index < data.length) {
    const char = data[index]
    if (/[\s,]/.test(char)) {
      index += 1
      continue
    }
    if (isCommand(char)) {
      out.push(char)
      arcArgument = char === 'A' || char === 'a' ? 0 : -1
      index += 1
      continue
    }
    // The fourth and fifth numbers of each arc are flags, one digit each.
    if (arcArgument >= 0 && (arcArgument % 7 === 3 || arcArgument % 7 === 4)) {
      if (char !== '0' && char !== '1') throw new Error(`bad arc flag at ${index}`)
      out.push(Number(char))
      arcArgument += 1
      index += 1
      continue
    }
    const match = number.exec(data.slice(index))
    if (!match) throw new Error(`unexpected "${char}" at ${index}`)
    out.push(Number(match[0]))
    if (arcArgument >= 0) arcArgument += 1
    index += match[0].length
  }
  return out
}

const piecesFor = (length: number, step: number) =>
  Math.max(2, Math.min(MAX_CURVE_PIECES, Math.ceil(length / step)))

const distance = (a: PathPoint, b: PathPoint) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** The points of an elliptical arc after its start, as SVG defines it from its end points. */
const arcPoints = (
  from: PathPoint,
  radii: [number, number],
  angle: number,
  large: boolean,
  sweep: boolean,
  to: PathPoint,
  step: number
): PathPoint[] => {
  let [rx, ry] = [Math.abs(radii[0]), Math.abs(radii[1])]
  if (rx < 1e-9 || ry < 1e-9 || distance(from, to) < 1e-9) return [to]
  const phi = (angle * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (from[0] - to[0]) / 2
  const dy = (from[1] - to[1]) / 2
  const x1 = cos * dx + sin * dy
  const y1 = -sin * dx + cos * dy
  // Radii too small for the end points grow until they reach.
  const scale = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (scale > 1) {
    rx *= Math.sqrt(scale)
    ry *= Math.sqrt(scale)
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
  const root = Math.sqrt(Math.max(0, numerator / denominator)) * (large === sweep ? -1 : 1)
  const cx1 = (root * rx * y1) / ry
  const cy1 = (-root * ry * x1) / rx
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2
  const angleOf = (ux: number, uy: number, vx: number, vy: number) => {
    const turn = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return turn
  }
  const start = angleOf(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
  let span = angleOf((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
  if (!sweep && span > 0) span -= Math.PI * 2
  if (sweep && span < 0) span += Math.PI * 2
  const pieces = piecesFor((Math.abs(span) * (rx + ry)) / 2, step)
  const points: PathPoint[] = []
  for (let piece = 1; piece <= pieces; piece += 1) {
    const at = start + (span * piece) / pieces
    const ex = rx * Math.cos(at)
    const ey = ry * Math.sin(at)
    points.push(piece === pieces ? to : [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy])
  }
  return points
}

const cubicPoints = (
  from: PathPoint,
  first: PathPoint,
  second: PathPoint,
  to: PathPoint,
  step: number
): PathPoint[] => {
  const pieces = piecesFor(
    distance(from, first) + distance(first, second) + distance(second, to),
    step
  )
  const points: PathPoint[] = []
  for (let piece = 1; piece <= pieces; piece += 1) {
    const t = piece / pieces
    const rest = 1 - t
    const a = rest * rest * rest
    const b = 3 * rest * rest * t
    const c = 3 * rest * t * t
    const d = t * t * t
    points.push([
      a * from[0] + b * first[0] + c * second[0] + d * to[0],
      a * from[1] + b * first[1] + c * second[1] + d * to[1],
    ])
  }
  return points
}

const quadraticPoints = (from: PathPoint, control: PathPoint, to: PathPoint, step: number) =>
  cubicPoints(
    from,
    [from[0] + ((control[0] - from[0]) * 2) / 3, from[1] + ((control[1] - from[1]) * 2) / 3],
    [to[0] + ((control[0] - to[0]) * 2) / 3, to[1] + ((control[1] - to[1]) * 2) / 3],
    to,
    step
  )

/**
 * The polylines of path data. `step` is how long, at most, a piece of a curve is. A path that is
 * not valid throws, saying where.
 */
export const flattenPath = (data: string, step = DEFAULT_STEP): Subpath[] => {
  const list = tokens(data)
  const subpaths: Subpath[] = []
  let current: Subpath | null = null
  let pen: PathPoint = [0, 0]
  let start: PathPoint = [0, 0]
  // The last control point, for S and T, and the command it came from.
  let control: PathPoint | null = null
  let previous = ''
  let index = 0
  let command = ''
  const take = () => {
    const value = list[index]
    if (typeof value !== 'number') throw new Error(`"${command}" is missing a number`)
    index += 1
    return value
  }
  const moreNumbers = () => typeof list[index] === 'number'
  const lineTo = (point: PathPoint) => {
    if (!current) {
      current = { points: [pen], closed: false }
      subpaths.push(current)
    }
    current.points.push(point)
    pen = point
  }
  while (index < list.length) {
    const token = list[index]
    if (typeof token === 'string') {
      command = token
      index += 1
    } else if (!command) {
      throw new Error('path data must start with a command')
    } else if (command === 'M') {
      command = 'L'
    } else if (command === 'm') {
      command = 'l'
    }
    const relative = command === command.toLowerCase()
    const at = (x: number, y: number): PathPoint => (relative ? [pen[0] + x, pen[1] + y] : [x, y])
    const upper = command.toUpperCase()
    switch (upper) {
      case 'M': {
        const point = at(take(), take())
        pen = point
        start = point
        current = { points: [point], closed: false }
        subpaths.push(current)
        control = null
        break
      }
      case 'L':
        lineTo(at(take(), take()))
        control = null
        break
      case 'H': {
        const x = take()
        lineTo([relative ? pen[0] + x : x, pen[1]])
        control = null
        break
      }
      case 'V': {
        const y = take()
        lineTo([pen[0], relative ? pen[1] + y : y])
        control = null
        break
      }
      case 'C': {
        const first = at(take(), take())
        const second = at(take(), take())
        const to = at(take(), take())
        const from = pen
        for (const point of cubicPoints(from, first, second, to, step)) lineTo(point)
        control = second
        break
      }
      case 'S': {
        const second = at(take(), take())
        const to = at(take(), take())
        const from = pen
        const first: PathPoint =
          control && /[CcSs]/.test(previous)
            ? [2 * from[0] - control[0], 2 * from[1] - control[1]]
            : from
        for (const point of cubicPoints(from, first, second, to, step)) lineTo(point)
        control = second
        break
      }
      case 'Q': {
        const middle = at(take(), take())
        const to = at(take(), take())
        const from = pen
        for (const point of quadraticPoints(from, middle, to, step)) lineTo(point)
        control = middle
        break
      }
      case 'T': {
        const to = at(take(), take())
        const from = pen
        const middle: PathPoint =
          control && /[QqTt]/.test(previous)
            ? [2 * from[0] - control[0], 2 * from[1] - control[1]]
            : from
        for (const point of quadraticPoints(from, middle, to, step)) lineTo(point)
        control = middle
        break
      }
      case 'A': {
        const radii: [number, number] = [take(), take()]
        const angle = take()
        const large = take() === 1
        const sweep = take() === 1
        const to = at(take(), take())
        for (const point of arcPoints(pen, radii, angle, large, sweep, to, step)) {
          lineTo(point)
        }
        control = null
        break
      }
      case 'Z': {
        const open = current as Subpath | null
        if (open) open.closed = true
        pen = start
        current = null
        control = null
        break
      }
      default:
        throw new Error(`unknown command "${command}"`)
    }
    previous = command
    // A command without its numbers, as `M` alone, is not repeated forever.
    if (upper === 'Z' && moreNumbers()) throw new Error('"Z" takes no numbers')
  }
  // Points that repeat are dropped; a pen that only moved draws nothing.
  return subpaths
    .map(subpath => ({
      closed: subpath.closed,
      points: subpath.points.filter(
        (point, at) => at === 0 || distance(point, subpath.points[at - 1]) > 1e-9
      ),
    }))
    .filter(subpath => subpath.points.length > 0)
}

/** Ramer–Douglas–Peucker: the fewest points that stay within `tolerance` of the line. */
export const simplifyPolyline = (points: readonly PathPoint[], tolerance: number): PathPoint[] => {
  if (points.length <= 2 || tolerance <= 0) return points.map(point => [point[0], point[1]])
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    const [ax, ay] = points[first]
    const [bx, by] = points[last]
    const length = Math.hypot(bx - ax, by - ay)
    let farthest = -1
    let farIndex = -1
    for (let index = first + 1; index < last; index += 1) {
      const [px, py] = points[index]
      const away =
        length < 1e-12
          ? Math.hypot(px - ax, py - ay)
          : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
      if (away > farthest) {
        farthest = away
        farIndex = index
      }
    }
    if (farthest > tolerance && farIndex > 0) {
      keep[farIndex] = true
      stack.push([first, farIndex], [farIndex, last])
    }
  }
  return points.filter((_, index) => keep[index]).map(point => [point[0], point[1]])
}

/** Twice the signed area of a closed polygon: positive when it turns counterclockwise, y up. */
export const signedArea = (points: readonly PathPoint[]) => {
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[(index + 1) % points.length]
    total += x1 * y2 - x2 * y1
  }
  return total
}
