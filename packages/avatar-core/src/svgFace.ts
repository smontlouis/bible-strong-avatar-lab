import { ARTBOARD_SIZE, type FaceMark, type StrokeCap, type StrokeJoin } from './drawnFaces.js'
import { flattenPath, type PathPoint } from './svgPath.js'

// An SVG file read into the marks of a face, without a DOM. The drawing is one eye, the eye on
// the left of the screen, its frame fitted to the artboard: the middle of the file's view is
// where the eye sits. A group whose id is `right` is the right eye, drawn as seen; without one,
// the right eye mirrors the left. Paths, lines, polylines, polygons, circles, ellipses and
// rectangles are read with their fill, stroke and transforms; colours are not, the eyes taking
// the character's. What cannot be read is listed, not guessed.

type Matrix = [number, number, number, number, number, number]
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
]

const apply = (m: Matrix, [x, y]: PathPoint): PathPoint => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
]

const numbers = (text: string) =>
  (text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number)

/** An SVG `transform` attribute as one matrix. */
const parseTransform = (text: string | undefined): Matrix => {
  if (!text) return IDENTITY
  let matrix = IDENTITY
  for (const [, name, args] of text.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = numbers(args)
    let next: Matrix = IDENTITY
    if (name === 'matrix' && v.length === 6) next = v as Matrix
    else if (name === 'translate') next = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]
    else if (name === 'scale') next = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]
    else if (name === 'rotate') {
      const angle = ((v[0] ?? 0) * Math.PI) / 180
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0]
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      next = multiply(multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [
        1,
        0,
        0,
        1,
        -cx,
        -cy,
      ])
    } else if (name === 'skewX') next = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0]
    else if (name === 'skewY') next = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]
    matrix = multiply(matrix, next)
  }
  return matrix
}

type Style = {
  fill: boolean
  fillRule: 'nonzero' | 'evenodd'
  stroke: boolean
  strokeWidth: number
  cap: StrokeCap
  join: StrokeJoin
}

const SKIPPED = new Set([
  'defs',
  'clippath',
  'mask',
  'symbol',
  'pattern',
  'filter',
  'lineargradient',
  'radialgradient',
  'style',
  'script',
  'text',
  'foreignobject',
  'switch',
  'marker',
])
const SILENT = new Set(['title', 'desc', 'metadata'])
const SHAPES = new Set(['path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect'])

/** The path data of a basic shape, in its own coordinates. */
const shapeData = (tag: string, attr: Record<string, string>): string | null => {
  const n = (key: string, fallback = 0) => {
    const value = parseFloat(attr[key] ?? '')
    return Number.isFinite(value) ? value : fallback
  }
  switch (tag) {
    case 'path':
      return attr.d ?? null
    case 'line':
      return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`
    case 'polyline':
    case 'polygon': {
      const v = numbers(attr.points ?? '')
      if (v.length < 4) return null
      let data = `M${v[0]} ${v[1]}`
      for (let index = 2; index + 1 < v.length; index += 2) data += `L${v[index]} ${v[index + 1]}`
      return tag === 'polygon' ? `${data}Z` : data
    }
    case 'circle':
    case 'ellipse': {
      const [cx, cy] = [n('cx'), n('cy')]
      const rx = tag === 'circle' ? n('r') : n('rx')
      const ry = tag === 'circle' ? n('r') : n('ry')
      if (!(rx > 0 && ry > 0)) return null
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`
    }
    case 'rect': {
      const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')]
      if (!(w > 0 && h > 0)) return null
      let rx = attr.rx !== undefined ? n('rx') : attr.ry !== undefined ? n('ry') : 0
      let ry = attr.ry !== undefined ? n('ry') : rx
      rx = Math.min(rx, w / 2)
      ry = Math.min(ry, h / 2)
      if (!(rx > 0 && ry > 0)) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
    }
  }
  return null
}

const attributesOf = (text: string) => {
  const attr: Record<string, string> = {}
  for (const [, key, , double, single] of text.matchAll(
    /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  )) {
    attr[key.toLowerCase()] = double ?? single ?? ''
  }
  // Inline style wins over attributes, as in a browser.
  for (const rule of (attr.style ?? '').split(';')) {
    const at = rule.indexOf(':')
    if (at > 0) attr[rule.slice(0, at).trim().toLowerCase()] = rule.slice(at + 1).trim()
  }
  return attr
}

const styled = (parent: Style, attr: Record<string, string>): Style => {
  const style = { ...parent }
  const none = (value: string | undefined) => value?.trim().toLowerCase() === 'none'
  if (attr.fill !== undefined) style.fill = !none(attr.fill)
  if (attr['fill-opacity'] !== undefined && parseFloat(attr['fill-opacity']) === 0)
    style.fill = false
  if (attr['fill-rule'] === 'evenodd' || attr['fill-rule'] === 'nonzero') {
    style.fillRule = attr['fill-rule']
  }
  if (attr.stroke !== undefined) style.stroke = !none(attr.stroke)
  if (attr['stroke-opacity'] !== undefined && parseFloat(attr['stroke-opacity']) === 0) {
    style.stroke = false
  }
  if (attr['stroke-width'] !== undefined) {
    const width = parseFloat(attr['stroke-width'])
    if (Number.isFinite(width)) style.strokeWidth = width
  }
  const cap = attr['stroke-linecap']
  if (cap === 'round' || cap === 'butt' || cap === 'square') style.cap = cap
  const join = attr['stroke-linejoin']
  if (join === 'round' || join === 'bevel') style.join = join
  else if (join === 'miter' || join === 'miter-clip' || join === 'arcs') style.join = 'miter'
  return style
}

type ReadMark = {
  eye: 'left' | 'right'
  lines: { points: PathPoint[]; closed: boolean }[]
  style: Style
  scale: number
}

/** Read an SVG file into the marks of a face's eyes, and what in it was not read. */
export const faceEyesFromSvg = (
  svg: string
): { eyes: { left: FaceMark[]; right?: FaceMark[] }; ignored: string[] } => {
  const ignored = new Map<string, number>()
  const note = (what: string) => ignored.set(what, (ignored.get(what) ?? 0) + 1)
  const text = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
  type Frame = { tag: string; matrix: Matrix; style: Style; eye: 'left' | 'right'; skip: boolean }
  const base: Style = {
    fill: true,
    fillRule: 'nonzero',
    stroke: false,
    strokeWidth: 1,
    cap: 'butt',
    join: 'miter',
  }
  const stack: Frame[] = [{ tag: '', matrix: IDENTITY, style: base, eye: 'left', skip: false }]
  const marks: ReadMark[] = []
  let view: [number, number, number, number] | null = null
  let sawSvg = false
  for (const [, closing, rawTag, rest, selfClosing] of text.matchAll(
    /<(\/?)([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
  )) {
    const tag = rawTag.toLowerCase().replace(/^svg:/, '')
    if (closing) {
      while (stack.length > 1) {
        const frame = stack.pop()!
        if (frame.tag === tag) break
      }
      continue
    }
    const parent = stack[stack.length - 1]
    const attr = attributesOf(rest)
    if (tag === 'svg' && !sawSvg) {
      sawSvg = true
      const box = numbers(attr.viewbox ?? '')
      if (box.length === 4 && box[2] > 0 && box[3] > 0) view = [box[0], box[1], box[2], box[3]]
      else {
        const [w, h] = [parseFloat(attr.width ?? ''), parseFloat(attr.height ?? '')]
        if (w > 0 && h > 0) view = [0, 0, w, h]
      }
    }
    const skip = parent.skip || SKIPPED.has(tag)
    if (!parent.skip && SKIPPED.has(tag)) note(`<${tag}>`)
    const id = (attr.id ?? '').toLowerCase()
    const eye: 'left' | 'right' =
      /(^|[-_\s])right($|[-_\s])/.test(id) || id === 'right' ? 'right' : parent.eye
    const frame: Frame = {
      tag,
      matrix: multiply(parent.matrix, parseTransform(attr.transform)),
      style: styled(parent.style, attr),
      eye,
      skip,
    }
    if (!skip) {
      if (SHAPES.has(tag)) {
        const data = shapeData(tag, attr)
        if (data) {
          try {
            const lines = flattenPath(data, 0.8).map(subpath => ({
              closed: subpath.closed,
              points: subpath.points.map(point => apply(frame.matrix, point)),
            }))
            const m = frame.matrix
            marks.push({
              eye,
              lines,
              style: frame.style,
              scale: Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])),
            })
          } catch (error) {
            note(`<${tag}> with path data that does not read (${(error as Error).message})`)
          }
        }
      } else if (tag === 'use' || tag === 'image') {
        note(`<${tag}>`)
      } else if (!['svg', 'g', 'a'].includes(tag) && !SILENT.has(tag)) {
        note(`<${tag}>`)
      }
      if (attr.filter || attr.mask || attr['clip-path']) note('filters, masks and clip paths')
      const fill = attr.fill?.trim() ?? ''
      if (/^url\(/.test(fill) || /^url\(/.test(attr.stroke ?? '')) note('gradients and patterns')
    }
    if (!selfClosing) stack.push(frame)
  }
  // The frame the drawing is fitted from: the file's view, or what the marks cover.
  if (!view) {
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const mark of marks) {
      for (const line of mark.lines) {
        for (const [x, y] of line.points) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }
    if (Number.isFinite(minX)) {
      const pad = Math.max(maxX - minX, maxY - minY) * 0.05
      view = [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad]
    } else view = [0, 0, ARTBOARD_SIZE, ARTBOARD_SIZE]
  }
  const [vx, vy, vw, vh] = view
  const fit = ARTBOARD_SIZE / Math.max(vw, vh)
  const toArtboard = ([x, y]: PathPoint): PathPoint => [
    ARTBOARD_SIZE / 2 + (x - (vx + vw / 2)) * fit,
    ARTBOARD_SIZE / 2 + (y - (vy + vh / 2)) * fit,
  ]
  const round = (value: number) => Math.round(value * 100) / 100
  const toMark = (mark: ReadMark): FaceMark | null => {
    const d = mark.lines
      .map(line => {
        const points = line.points.map(toArtboard)
        return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}${line.closed ? 'Z' : ''}`
      })
      .join('')
    if (!d || (!mark.style.fill && !mark.style.stroke)) return null
    const out: FaceMark = { d }
    if (!mark.style.fill) out.fill = false
    if (mark.style.fillRule === 'evenodd') out.fillRule = 'evenodd'
    if (mark.style.stroke && mark.style.strokeWidth > 0) {
      out.stroke = {
        width: round(mark.style.strokeWidth * mark.scale * fit),
        cap: mark.style.cap,
        join: mark.style.join,
      }
    } else if (!mark.style.fill) return null
    return out
  }
  const left = marks
    .filter(mark => mark.eye === 'left')
    .map(toMark)
    .filter((mark): mark is FaceMark => !!mark)
  const right = marks
    .filter(mark => mark.eye === 'right')
    .map(toMark)
    .filter((mark): mark is FaceMark => !!mark)
  if (!sawSvg) note('no <svg> element: read as loose shapes')
  return {
    eyes: right.length ? { left, right } : { left },
    ignored: [...ignored].map(([what, count]) => (count > 1 ? `${what} × ${count}` : what)),
  }
}
