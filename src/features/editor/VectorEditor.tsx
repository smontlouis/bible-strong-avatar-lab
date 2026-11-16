import type { FaceMark } from '@bible-strong/avatar-core'
import {
  Circle,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  HelpCircle,
  Magnet,
  Maximize2,
  MousePointer2,
  PenTool,
  Pentagon,
  Slash,
  Spline,
  Square,
  Star,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NumericField } from '@/features/editor/controls'
import {
  appendPoint,
  insertPoint,
  kindOf,
  moveHandle,
  nearestSpot,
  readPath,
  removePoint,
  setClosed,
  setPointKind,
  writePath,
  type EditPath,
  type PointKind,
  type Vec,
} from '@/features/editor/pathGeometry'
import type { Editor } from '@/features/editor/useEditor'
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
  transformData,
  transformPath,
  translation,
  type Box,
  type ShapeKind,
} from '@/features/editor/vectorGeometry'

// The artboard of a drawn eye as a small vector tool. Two ways to work on a mark, as in Figma:
// picked whole (a box to move, scale and turn it), or opened to its points (a double click, or
// Enter) to move them, add and take out, bend a segment by pulling it, and make corners or
// curves. Tools draw new marks: a pen point by point, a curve that stays smooth through the
// points it is given, and shapes drawn in a box. Every change rewrites path data.

type Tool = 'select' | 'pen' | 'curve' | 'hand' | ShapeKind
type View = { x: number; y: number; size: number }
type Picked = { subpath: number; index: number }
type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const FULL_VIEW: View = { x: -4, y: -4, size: 108 }
const MIN_SIZE = 12
const MAX_SIZE = 260
const DOUBLE_MS = 350
/** A line drawn by the pen or the curve, until the person changes it: round, of a mid width. */
const LINE_MARK: Omit<FaceMark, 'd'> = {
  fill: false,
  stroke: { width: 8, cap: 'round', join: 'round' },
}
/** The neutral eye behind the marks, dashed, for the size of an eye. */
const NEUTRAL_GUIDE =
  'M50 26.5A21.5 21.5 0 0 1 71.5 48V52A21.5 21.5 0 0 1 28.5 52V48A21.5 21.5 0 0 1 50 26.5Z'
const HANDLES: { id: HandleId; at: (box: Box) => Vec; cursor: string }[] = [
  { id: 'nw', at: b => [b.x, b.y], cursor: 'nwse-resize' },
  { id: 'n', at: b => [b.x + b.width / 2, b.y], cursor: 'ns-resize' },
  { id: 'ne', at: b => [b.x + b.width, b.y], cursor: 'nesw-resize' },
  { id: 'e', at: b => [b.x + b.width, b.y + b.height / 2], cursor: 'ew-resize' },
  { id: 'se', at: b => [b.x + b.width, b.y + b.height], cursor: 'nwse-resize' },
  { id: 's', at: b => [b.x + b.width / 2, b.y + b.height], cursor: 'ns-resize' },
  { id: 'sw', at: b => [b.x, b.y + b.height], cursor: 'nesw-resize' },
  { id: 'w', at: b => [b.x, b.y + b.height / 2], cursor: 'ew-resize' },
]

type Drag =
  | { kind: 'pan'; from: View; start: { x: number; y: number }; width: number }
  | { kind: 'move'; from: string; start: Vec }
  | { kind: 'scale'; from: EditPath; box: Box; handle: HandleId }
  | { kind: 'rotate'; from: EditPath; center: Vec; start: number }
  | { kind: 'points'; from: EditPath; picked: Picked[]; start: Vec }
  | { kind: 'handle'; from: EditPath; picked: Picked; which: 'in' | 'out'; pointKind: PointKind }
  | { kind: 'bend'; from: EditPath; subpath: number; curve: number; time: number }
  | { kind: 'marquee'; start: Vec; now: Vec; add: Picked[] }
  | { kind: 'pen'; mark: number; subpath: number; at: Vec }
  | { kind: 'shape'; shape: ShapeKind; start: Vec; now: Vec }

const pointKey = (picked: Picked) => `${picked.subpath}:${picked.index}`
const samePoint = (a: Picked, b: Picked) => a.subpath === b.subpath && a.index === b.index

const tools: { tool: Tool; icon: typeof Circle; title: string; key: string }[] = [
  { tool: 'select', icon: MousePointer2, title: 'Sélection', key: 'V' },
  { tool: 'pen', icon: PenTool, title: 'Plume', key: 'P' },
  { tool: 'curve', icon: Spline, title: 'Courbe', key: 'C' },
  { tool: 'rectangle', icon: Square, title: 'Rectangle', key: 'R' },
  { tool: 'ellipse', icon: Circle, title: 'Ellipse', key: 'O' },
  { tool: 'polygon', icon: Pentagon, title: 'Polygone', key: 'G' },
  { tool: 'star', icon: Star, title: 'Étoile', key: 'S' },
  { tool: 'line', icon: Slash, title: 'Ligne', key: 'L' },
  { tool: 'hand', icon: Hand, title: 'Main', key: 'H' },
]

const kindLabels: { value: PointKind; label: string; title: string }[] = [
  {
    value: 'corner',
    label: 'Angle',
    title: 'Les poignées bougent chacune de leur côté, ou il n’y en a pas',
  },
  {
    value: 'smooth',
    label: 'Asymétrique',
    title: 'Les poignées restent alignées, chacune de sa longueur',
  },
  {
    value: 'symmetric',
    label: 'Symétrique',
    title: 'Les poignées restent alignées et de même longueur',
  },
]

/** The keys of the editor, as its help lists them. */
const shortcuts: { keys: string; label: string }[] = [
  { keys: 'V · P · C · H', label: 'Sélection, plume, courbe, main' },
  { keys: 'R · O · G · S · L', label: 'Rectangle, ellipse, polygone, étoile, ligne' },
  { keys: 'Maj en tirant une forme', label: 'Carré, cercle, forme régulière ; ligne à 45°' },
  { keys: 'Alt en tirant une forme', label: 'Depuis son centre' },
  { keys: 'Double-clic ou Entrée sur un tracé', label: 'Ouvrir ses points' },
  { keys: 'Échap', label: 'Fermer les points, finir un tracé, désélectionner' },
  { keys: 'Glisser un segment', label: 'Le courber' },
  { keys: 'Double-clic sur un segment', label: 'Ajouter un point' },
  { keys: 'Double-clic sur un point', label: 'Angle ou courbe' },
  { keys: 'Alt en tirant une poignée', label: 'Casser la courbe en angle' },
  { keys: 'Maj + clic, ou cadre', label: 'Choisir plusieurs points' },
  { keys: 'Plume : clic, ou clic-glisser', label: 'Un angle, ou une courbe' },
  { keys: 'Plume : clic sur le dernier point', label: 'Retirer sa poignée de sortie' },
  { keys: 'Plume : sur une extrémité', label: 'Continuer le tracé' },
  { keys: 'Premier point', label: 'Fermer le tracé' },
  { keys: 'Courbe : Alt + clic', label: 'Un point en angle' },
  { keys: 'Suppr', label: 'Retirer les points, ou le tracé' },
  { keys: '⌘D', label: 'Dupliquer le tracé' },
  { keys: 'Flèches (Maj : ×10)', label: 'Déplacer le tracé ou les points' },
  { keys: 'Espace en glissant · ⌘ + molette', label: 'Se déplacer · zoomer' },
]

export function VectorEditor({
  editor,
  marks,
  selected,
  onSelect,
  onChange,
  label,
}: {
  editor: Editor
  marks: readonly FaceMark[]
  /** The mark picked. */
  selected: number | null
  onSelect: (index: number | null) => void
  /** `tag` groups a burst of changes (a drag) into one step of the history. */
  onChange: (marks: FaceMark[], tag?: string) => void
  label: string
}) {
  const { t } = editor
  const svg = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState<View>(FULL_VIEW)
  const [tool, setToolState] = useState<Tool>('select')
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<Picked[]>([])
  // How each point's handles move: path data does not keep it, the editor does.
  const [kinds, setKinds] = useState<Record<string, PointKind>>({})
  const [snap, setSnap] = useState(true)
  const [panning, setPanning] = useState(false)
  const [help, setHelp] = useState(false)
  const [shape, setShape] = useState({ radius: 0, sides: 6, points: 5, inner: 0.5 })
  const [pointer, setPointer] = useState<Vec | null>(null)
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const drag = useRef<Drag | null>(null)
  // What a pen or a curve is drawing, until it is closed or ended.
  // Path data cannot hold the handle out of an open path's last point: the pen keeps it until
  // the next point is set.
  const pen = useRef<{ mark: number; subpath: number; out: Vec } | null>(null)
  const curve = useRef<{ mark: number; points: Vec[]; corners: Set<number> } | null>(null)
  const lastDown = useRef<{ at: number; x: number; y: number }>({ at: 0, x: 0, y: 0 })
  useEffect(() => {
    setPicked([])
    setKinds({})
    if (selected === null) setEditing(false)
  }, [selected])

  const mark = selected !== null ? marks[selected] : undefined
  const path: EditPath = mark ? readPath(mark.d) : []
  const box = mark && !editing ? pathBounds(path) : null
  // Sizes on screen stay the same whatever the zoom: they are a share of what is shown.
  const unit = view.size / 108
  const reach = 3.2 * unit
  const firstPicked = picked[0]
  const point =
    editing && picked.length === 1
      ? path[firstPicked.subpath]?.points[firstPicked.index]
      : undefined
  const kindOfPicked = (at: Picked) => {
    const found = path[at.subpath]?.points[at.index]
    return kinds[pointKey(at)] ?? (found ? kindOf(found) : 'corner')
  }

  const writeMark = (index: number, d: string, tag?: string, list: readonly FaceMark[] = marks) =>
    onChange(
      list.map((item, at) => (at === index ? { ...item, d } : item)),
      tag
    )
  const write = (next: EditPath, tag?: string) => {
    if (selected !== null) writeMark(selected, writePath(next), tag)
  }

  /** A pointer's place on the artboard. */
  const toArtboard = (clientX: number, clientY: number): Vec => {
    const element = svg.current!
    const matrix = element.getScreenCTM?.()
    if (matrix) {
      const at = element.createSVGPoint()
      at.x = clientX
      at.y = clientY
      const local = at.matrixTransform(matrix.inverse())
      return [local.x, local.y]
    }
    const rect = element.getBoundingClientRect()
    return [
      view.x + ((clientX - rect.left) / (rect.width || 1)) * view.size,
      view.y + ((clientY - rect.top) / (rect.height || 1)) * view.size,
    ]
  }
  /** Every point of every mark but the ones moved: what a point snaps to. */
  const snapTargets = (except?: number) =>
    marks.flatMap((item, index) =>
      index === except ? [] : readPath(item.d).flatMap(subpath => subpath.points.map(p => p.at))
    )
  const snapped = (at: Vec, except?: number, others?: Vec[]): Vec =>
    snap ? snapPoint(at, 1, others ?? snapTargets(except), reach * 0.8) : at

  const zoomAbout = (factor: number, about: Vec) => {
    const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, view.size * factor))
    const share = size / view.size
    setView({
      x: about[0] - (about[0] - view.x) * share,
      y: about[1] - (about[1] - view.y) * share,
      size,
    })
  }

  const finishDrawing = () => {
    pen.current = null
    curve.current = null
    setPreview(null)
  }
  const setTool = (next: Tool) => {
    finishDrawing()
    setToolState(next)
    if (next !== 'select') setEditing(false)
  }

  const addMark = (next: FaceMark, tag?: string) => {
    onChange([...marks, next], tag)
    onSelect(marks.length)
    return marks.length
  }
  const removeMark = () => {
    if (selected === null || marks.length < 2) return
    onChange(marks.filter((_, index) => index !== selected))
    onSelect(Math.max(0, selected - 1))
  }
  const duplicateMark = () => {
    if (!mark) return
    addMark({ ...structuredClone(mark), d: transformData(mark.d, translation(4, 4)) })
  }

  /** The pen's path, its last point given the handle out the pen keeps. */
  const penPath = (drawing: { mark: number; subpath: number; out: Vec }): EditPath => {
    const current = readPath(marks[drawing.mark]?.d ?? '')
    const points = current[drawing.subpath]?.points
    if (!points?.length) return current
    const last = points[points.length - 1]
    return current.map((item, at) =>
      at === drawing.subpath
        ? { ...item, points: [...points.slice(0, -1), { ...last, out: drawing.out }] }
        : item
    )
  }

  /** What the pen would do where the pointer is. */
  const penTarget = (at: Vec) => {
    const drawing = pen.current
    if (drawing && marks[drawing.mark]) {
      const current = readPath(marks[drawing.mark].d)[drawing.subpath]
      if (current) {
        const first = current.points[0]
        const last = current.points[current.points.length - 1]
        if (
          current.points.length > 1 &&
          Math.hypot(first.at[0] - at[0], first.at[1] - at[1]) < reach
        ) {
          return { kind: 'close' as const }
        }
        if (Math.hypot(last.at[0] - at[0], last.at[1] - at[1]) < reach)
          return { kind: 'cusp' as const }
      }
      return { kind: 'point' as const }
    }
    if (mark) {
      for (const [index, subpath] of path.entries()) {
        if (subpath.closed || !subpath.points.length) continue
        const ends = [0, subpath.points.length - 1]
        for (const end of ends) {
          const p = subpath.points[end].at
          if (Math.hypot(p[0] - at[0], p[1] - at[1]) < reach) {
            return {
              kind: 'continue' as const,
              subpath: index,
              start: end === 0 && subpath.points.length > 1,
            }
          }
        }
      }
      const spot = nearestSpot(path, at)
      if (spot && spot.distance < reach) return { kind: 'add' as const, spot }
    }
    return { kind: 'new' as const }
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const element = event.currentTarget
    element.focus({ preventScroll: true })
    const raw = toArtboard(event.clientX, event.clientY)
    const target = event.target as Element
    const role = (target.closest('[data-role]') as SVGElement | null)?.dataset
    const now = performance.now()
    const double =
      now - lastDown.current.at < DOUBLE_MS &&
      Math.hypot(event.clientX - lastDown.current.x, event.clientY - lastDown.current.y) < 6
    lastDown.current = { at: double ? 0 : now, x: event.clientX, y: event.clientY }
    const capture = () => element.setPointerCapture(event.pointerId)

    if (tool === 'hand' || panning || event.button === 1) {
      drag.current = {
        kind: 'pan',
        from: view,
        start: { x: event.clientX, y: event.clientY },
        width: element.getBoundingClientRect().width || 1,
      }
      capture()
      return
    }

    if (tool === 'pen') {
      const target = penTarget(raw)
      const drawing = pen.current
      if (target.kind === 'close' && drawing) {
        writeMark(drawing.mark, writePath(setClosed(penPath(drawing), drawing.subpath, true)))
        finishDrawing()
        return
      }
      if (target.kind === 'cusp' && drawing) {
        // On the last point: its handle out goes, for a corner after a curve.
        pen.current = { ...drawing, out: [0, 0] }
        setPreview(null)
        return
      }
      if (drawing) {
        const current = penPath(drawing)
        const points = current[drawing.subpath].points
        const from = points[points.length - 1].at
        const at = event.shiftKey ? snapAngle(from, raw) : snapped(raw)
        writeMark(
          drawing.mark,
          writePath(appendPoint(current, drawing.subpath, at)),
          `pen-${drawing.mark}`
        )
        pen.current = { ...drawing, out: [0, 0] }
        drag.current = { kind: 'pen', mark: drawing.mark, subpath: drawing.subpath, at }
        capture()
        return
      }
      if (target.kind === 'continue' && selected !== null) {
        // From an end of an open path: it goes on from there.
        const next = target.start
          ? path.map((item, at) => (at === target.subpath ? reverseSubpath(item) : item))
          : path
        if (target.start) write(next)
        const ends = next[target.subpath].points
        pen.current = { mark: selected, subpath: target.subpath, out: ends[ends.length - 1].out }
        return
      }
      if (target.kind === 'add' && selected !== null) {
        const added = insertPoint(path, target.spot)
        if (added.index >= 0) write(added.path)
        return
      }
      const at = snapped(raw)
      const fresh: EditPath = [{ closed: false, points: [{ at, in: [0, 0], out: [0, 0] }] }]
      const index = addMark({ ...LINE_MARK, d: writePath(fresh) }, `pen-${marks.length}`)
      pen.current = { mark: index, subpath: 0, out: [0, 0] }
      drag.current = { kind: 'pen', mark: index, subpath: 0, at }
      capture()
      return
    }

    if (tool === 'curve') {
      const drawing = curve.current
      const at = snapped(raw)
      if (drawing && marks[drawing.mark]) {
        const first = drawing.points[0]
        if (drawing.points.length > 2 && Math.hypot(first[0] - raw[0], first[1] - raw[1]) < reach) {
          writeMark(
            drawing.mark,
            writePath([curveThrough(drawing.points, drawing.corners, true)]),
            `curve-${drawing.mark}`
          )
          finishDrawing()
          return
        }
        const points = [...drawing.points, at]
        const corners = new Set(drawing.corners)
        if (event.altKey) corners.add(points.length - 1)
        curve.current = { ...drawing, points, corners }
        writeMark(drawing.mark, writePath([curveThrough(points, corners)]), `curve-${drawing.mark}`)
        return
      }
      const corners = new Set<number>(event.altKey ? [0] : [])
      const index = addMark(
        { ...LINE_MARK, d: writePath([curveThrough([at], corners)]) },
        `curve-${marks.length}`
      )
      curve.current = { mark: index, points: [at], corners }
      return
    }

    if (tool !== 'select') {
      const start = snapped(raw)
      drag.current = { kind: 'shape', shape: tool, start, now: start }
      capture()
      return
    }

    // The select tool, on a mark picked whole.
    if (!editing) {
      if (role?.role === 'rotate' && mark && box) {
        const center: Vec = [box.x + box.width / 2, box.y + box.height / 2]
        drag.current = {
          kind: 'rotate',
          from: path,
          center,
          start: Math.atan2(raw[1] - center[1], raw[0] - center[0]),
        }
        capture()
        return
      }
      if (role?.role === 'box' && mark && box) {
        drag.current = { kind: 'scale', from: path, box, handle: role.handle as HandleId }
        capture()
        return
      }
      if (role?.role === 'mark') {
        const index = Number(role.mark)
        if (double) {
          onSelect(index)
          setEditing(true)
          return
        }
        if (index !== selected) onSelect(index)
        drag.current = { kind: 'move', from: marks[index].d, start: raw }
        capture()
        return
      }
      if (!double) onSelect(null)
      return
    }

    // The select tool, on the points of the mark opened.
    if (role?.role === 'handle' && point && firstPicked) {
      const which = role.which as 'in' | 'out'
      const kind = event.altKey ? 'corner' : kindOfPicked(firstPicked)
      if (event.altKey) setKinds({ ...kinds, [pointKey(firstPicked)]: 'corner' })
      drag.current = { kind: 'handle', from: path, picked: firstPicked, which, pointKind: kind }
      capture()
      return
    }
    if (role?.role === 'point') {
      const at = { subpath: Number(role.subpath), index: Number(role.index) }
      if (double) {
        // A point goes from corner to curve and back.
        const current = path[at.subpath].points[at.index]
        const next = kindOf(current) === 'corner' ? 'symmetric' : 'corner'
        write(setPointKind(path, at.subpath, at.index, next))
        setPicked([at])
        setKinds({ ...kinds, [pointKey(at)]: next })
        return
      }
      let next = picked
      if (event.shiftKey) {
        next = picked.some(item => samePoint(item, at))
          ? picked.filter(item => !samePoint(item, at))
          : [...picked, at]
      } else if (!picked.some(item => samePoint(item, at))) next = [at]
      setPicked(next)
      drag.current = { kind: 'points', from: path, picked: next, start: raw }
      capture()
      return
    }
    const spot = nearestSpot(path, raw)
    if (spot && spot.distance < reach) {
      if (double) {
        const added = insertPoint(path, spot)
        if (added.index >= 0) {
          write(added.path)
          setPicked([{ subpath: spot.subpath, index: added.index }])
        }
        return
      }
      drag.current = {
        kind: 'bend',
        from: path,
        subpath: spot.subpath,
        curve: spot.curve,
        time: spot.time,
      }
      capture()
      return
    }
    if (role?.role === 'mark' && Number(role.mark) !== selected) {
      setEditing(false)
      onSelect(Number(role.mark))
      return
    }
    if (double) {
      setEditing(false)
      return
    }
    drag.current = { kind: 'marquee', start: raw, now: raw, add: event.shiftKey ? picked : [] }
    if (!event.shiftKey) setPicked([])
    capture()
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const raw = toArtboard(event.clientX, event.clientY)
    const current = drag.current
    if (!current) {
      if (tool === 'pen' || tool === 'curve') setPointer(raw)
      updatePreview(raw, event.shiftKey)
      return
    }
    switch (current.kind) {
      case 'pan': {
        const ratio = current.from.size / current.width
        setView({
          ...current.from,
          x: current.from.x - (event.clientX - current.start.x) * ratio,
          y: current.from.y - (event.clientY - current.start.y) * ratio,
        })
        return
      }
      case 'move': {
        let by: Vec = [raw[0] - current.start[0], raw[1] - current.start[1]]
        if (event.shiftKey) by = Math.abs(by[0]) > Math.abs(by[1]) ? [by[0], 0] : [0, by[1]]
        if (snap) by = [Math.round(by[0]), Math.round(by[1])]
        if (selected !== null)
          writeMark(selected, transformData(current.from, translation(...by)), 'move')
        return
      }
      case 'scale': {
        const { box: from, handle } = current
        const corner = HANDLES.find(item => item.id === handle)!.at(from)
        const center: Vec = [from.x + from.width / 2, from.y + from.height / 2]
        const opposite: Vec = [
          from.x + from.x + from.width - corner[0],
          from.y + from.y + from.height - corner[1],
        ]
        const anchor = event.altKey ? center : opposite
        const at = snapped(raw, selected ?? undefined)
        const across = handle.includes('e') || handle.includes('w')
        const upDown = handle.includes('n') || handle.includes('s')
        let sx =
          across && Math.abs(corner[0] - anchor[0]) > 1e-6
            ? (at[0] - anchor[0]) / (corner[0] - anchor[0])
            : 1
        let sy =
          upDown && Math.abs(corner[1] - anchor[1]) > 1e-6
            ? (at[1] - anchor[1]) / (corner[1] - anchor[1])
            : 1
        if (event.shiftKey) {
          const uniform =
            across && upDown
              ? Math.max(Math.abs(sx), Math.abs(sy))
              : across
                ? Math.abs(sx)
                : Math.abs(sy)
          sx = Math.sign(sx || 1) * uniform
          sy = Math.sign(sy || 1) * uniform
        }
        write(transformPath(current.from, scaling(sx, sy, anchor)), 'transform')
        return
      }
      case 'rotate': {
        let angle =
          Math.atan2(raw[1] - current.center[1], raw[0] - current.center[0]) - current.start
        if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
        write(transformPath(current.from, rotation(angle, current.center)), 'transform')
        return
      }
      case 'points': {
        const anchor = current.from[current.picked[0].subpath]?.points[current.picked[0].index]
        if (!anchor) return
        let by: Vec = [raw[0] - current.start[0], raw[1] - current.start[1]]
        if (snap) {
          const others = current.from.flatMap((subpath, at) =>
            subpath.points
              .filter(
                (_, index) => !current.picked.some(p => p.subpath === at && p.index === index)
              )
              .map(p => p.at)
          )
          const landed = snapped(
            [anchor.at[0] + by[0], anchor.at[1] + by[1]],
            selected ?? undefined,
            [...snapTargets(selected ?? undefined), ...others]
          )
          by = [landed[0] - anchor.at[0], landed[1] - anchor.at[1]]
        }
        write(movePoints(current.from, current.picked, by), 'points')
        return
      }
      case 'handle':
        write(
          moveHandle(
            current.from,
            current.picked.subpath,
            current.picked.index,
            current.which,
            raw,
            current.pointKind
          ),
          'points'
        )
        return
      case 'bend':
        write(bendSegment(current.from, current.subpath, current.curve, current.time, raw), 'bend')
        return
      case 'marquee': {
        current.now = raw
        const area = dragBox(current.start, raw)
        setMarquee(area)
        const inside = pointsInBox(path, area)
        setPicked([
          ...current.add,
          ...inside.filter(item => !current.add.some(other => samePoint(other, item))),
        ])
        return
      }
      case 'pen': {
        // Dragging after a click pulls the point's handles: a curve through it.
        const out: Vec = [raw[0] - current.at[0], raw[1] - current.at[1]]
        if (Math.hypot(out[0], out[1]) < 0.8 * unit) return
        const now = readPath(marks[current.mark]?.d ?? '')
        const points = now[current.subpath]?.points
        if (!points) return
        const last = points[points.length - 1]
        // Alt pulls the handle out alone: a corner whose way in stays as it was.
        const into: Vec = event.altKey ? last.in : [-out[0], -out[1]]
        if (pen.current) pen.current = { ...pen.current, out }
        writeMark(
          current.mark,
          writePath(
            now.map((item, at) =>
              at === current.subpath
                ? { ...item, points: [...points.slice(0, -1), { ...last, in: into, out }] }
                : item
            )
          ),
          `pen-${current.mark}`
        )
        return
      }
      case 'shape': {
        current.now = raw
        setPreview(
          shapeData(current.shape, current.start, snapped(raw), event.shiftKey, event.altKey)
        )
        return
      }
    }
  }

  const shapeData = (kind: ShapeKind, start: Vec, end: Vec, square: boolean, centered: boolean) => {
    if (kind === 'line')
      return shapePath('line', dragBox(start, end), {}, [
        start,
        square ? snapAngle(start, end) : end,
      ])
    const area = dragBox(start, end, square, centered)
    return shapePath(kind, area, {
      radius: shape.radius,
      count: kind === 'polygon' ? shape.sides : shape.points,
      inner: shape.inner,
    })
  }

  const updatePreview = (raw: Vec, shift: boolean) => {
    if (tool === 'pen' && pen.current && marks[pen.current.mark]) {
      const subpath = penPath(pen.current)[pen.current.subpath]
      const last = subpath?.points[subpath.points.length - 1]
      if (!last) return setPreview(null)
      const to = shift ? snapAngle(last.at, raw) : raw
      // The next segment as it would be: from the last point, along its handle out.
      const handle: Vec = [last.at[0] + last.out[0], last.at[1] + last.out[1]]
      setPreview(
        Math.hypot(...last.out) > 1e-6
          ? `M${last.at[0]} ${last.at[1]}C${handle[0]} ${handle[1]} ${to[0]} ${to[1]} ${to[0]} ${to[1]}`
          : `M${last.at[0]} ${last.at[1]}L${to[0]} ${to[1]}`
      )
      return
    }
    if (tool === 'curve' && curve.current) {
      const { points, corners } = curve.current
      setPreview(writePath([curveThrough([...points, raw], corners)]))
      return
    }
    if (preview && !drag.current) setPreview(null)
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current
    drag.current = null
    setMarquee(null)
    if (current?.kind === 'shape') {
      const end = snapped(toArtboard(event.clientX, event.clientY))
      let d = shapeData(current.shape, current.start, end, event.shiftKey, event.altKey)
      // A click without a drag draws the shape at a size of its own, about the click.
      if (!d || Math.hypot(end[0] - current.start[0], end[1] - current.start[1]) < 2 * unit) {
        const half = current.shape === 'line' ? 20 : 20
        d = shapeData(
          current.shape,
          [current.start[0] - half, current.start[1] - (current.shape === 'line' ? 0 : half)],
          [current.start[0] + half, current.start[1] + (current.shape === 'line' ? 0 : half)],
          false,
          false
        )
      }
      setPreview(null)
      addMark(current.shape === 'line' ? { ...LINE_MARK, d } : { d }, 'shape')
      setToolState('select')
    }
  }

  const removePicked = () => {
    if (!picked.length) return
    // From the last to the first, so that the indices of the others stay right.
    const order = [...picked].sort((a, b) => b.subpath - a.subpath || b.index - a.index)
    let next = path
    for (const item of order) next = removePoint(next, item.subpath, item.index)
    if (!next.length && marks.length > 1) removeMark()
    else write(next)
    setPicked([])
  }

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const command = event.metaKey || event.ctrlKey
    if (event.key === ' ') {
      event.preventDefault()
      setPanning(true)
      return
    }
    if (command && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateMark()
      return
    }
    if (command) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (editing && picked.length) removePicked()
      else if (!editing) removeMark()
      return
    }
    if (event.key === 'Escape') {
      if (pen.current || curve.current) finishDrawing()
      else if (editing && picked.length) setPicked([])
      else if (editing) setEditing(false)
      else onSelect(null)
      return
    }
    if (event.key === 'Enter') {
      if (pen.current || curve.current) finishDrawing()
      else if (mark && tool === 'select') setEditing(!editing)
      return
    }
    if (event.key === '?') {
      setHelp(true)
      return
    }
    const arrows: Record<string, Vec> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    if (arrows[event.key] && mark) {
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const by: Vec = [arrows[event.key][0] * step, arrows[event.key][1] * step]
      if (editing && picked.length) write(movePoints(path, picked, by), 'nudge')
      else if (!editing && selected !== null)
        writeMark(selected, transformData(mark.d, translation(...by)), 'nudge')
      return
    }
    const choice = tools.find(item => item.key.toLowerCase() === event.key.toLowerCase())
    if (choice && !event.altKey) setTool(choice.tool)
  }

  // The wheel with Command or Control, or a pinch, zooms about the pointer; zoomed in, the wheel
  // moves about. Listened to natively, to keep the page from scrolling then.
  const wheel = useRef<(event: WheelEvent) => void>(() => {})
  wheel.current = event => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      zoomAbout(Math.exp(event.deltaY * 0.01), toArtboard(event.clientX, event.clientY))
      return
    }
    if (view.size < FULL_VIEW.size - 0.5) {
      event.preventDefault()
      const rect = svg.current!.getBoundingClientRect()
      const ratio = view.size / (rect.width || 1)
      setView({ ...view, x: view.x + event.deltaX * ratio, y: view.y + event.deltaY * ratio })
    }
  }
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const listener = (event: WheelEvent) => wheel.current(event)
    element.addEventListener('wheel', listener, { passive: false })
    return () => element.removeEventListener('wheel', listener)
  }, [])

  // What the pen would do, said by the cursor.
  const penHint = tool === 'pen' && pointer ? penTarget(pointer).kind : null
  const cursor =
    tool === 'hand' || panning
      ? 'cursor-grab'
      : tool === 'select'
        ? ''
        : penHint === 'close' || penHint === 'continue'
          ? 'cursor-pointer'
          : penHint === 'add'
            ? 'cursor-copy'
            : 'cursor-crosshair'
  const center: Vec = [view.x + view.size / 2, view.y + view.size / 2]
  const shown = editing
    ? path.flatMap((subpath, at) =>
        subpath.points.flatMap((item, index) => {
          const near = picked.some(p => p.subpath === at && Math.abs(p.index - index) <= 1)
          return near ? [{ at, index, point: item }] : []
        })
      )
    : []
  const hintOf = penHint
    ? {
        close: 'Fermer le tracé',
        continue: 'Continuer le tracé',
        add: 'Ajouter un point',
        cusp: 'Retirer la poignée',
        point: '',
        new: '',
      }[penHint]
    : ''

  return (
    <div className="flex flex-col gap-1.5" data-vector-editor>
      <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-muted p-1">
        {tools.map(({ tool: value, icon: Icon, title, key }) => (
          <Button
            variant={tool === value ? 'secondary' : 'ghost'}
            size="icon-sm"
            type="button"
            aria-pressed={tool === value}
            aria-label={`${t(title)} (${key})`}
            title={`${t(title)} (${key})`}
            key={value}
            onClick={() => setTool(value)}
          >
            <Icon />
          </Button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          variant={snap ? 'secondary' : 'ghost'}
          size="icon-sm"
          type="button"
          aria-pressed={snap}
          aria-label={t('Magnétisme')}
          title={t('Magnétisme : à la grille et aux points')}
          onClick={() => setSnap(!snap)}
        >
          <Magnet />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Dézoomer')}
          onClick={() => zoomAbout(1.5, center)}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Zoomer')}
          onClick={() => zoomAbout(1 / 1.5, center)}
        >
          <ZoomIn />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Tout voir')}
          title={t('Tout voir')}
          onClick={() => setView(FULL_VIEW)}
        >
          <Maximize2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Raccourcis de l’éditeur')}
          title={`${t('Raccourcis de l’éditeur')} (?)`}
          onClick={() => setHelp(true)}
        >
          <HelpCircle />
        </Button>
        <span className="ml-auto px-1 text-[0.65rem] text-muted-foreground tabular-nums">
          {Math.round((FULL_VIEW.size / view.size) * 100)} %
        </span>
      </div>

      {(tool === 'rectangle' || tool === 'polygon' || tool === 'star') && (
        <div className="grid grid-cols-2 gap-2" data-shape-options>
          {tool === 'rectangle' && (
            <NumericField
              label="Arrondi des coins"
              value={shape.radius}
              min={0}
              max={50}
              step={1}
              onChange={radius => setShape({ ...shape, radius })}
            />
          )}
          {tool === 'polygon' && (
            <NumericField
              label="Côtés"
              value={shape.sides}
              min={3}
              max={12}
              step={1}
              onChange={sides => setShape({ ...shape, sides: Math.round(sides) })}
            />
          )}
          {tool === 'star' && (
            <>
              <NumericField
                label="Branches"
                value={shape.points}
                min={3}
                max={12}
                step={1}
                onChange={points => setShape({ ...shape, points: Math.round(points) })}
              />
              <NumericField
                label="Creux"
                value={shape.inner}
                min={0.1}
                max={0.95}
                step={0.05}
                onChange={inner => setShape({ ...shape, inner })}
              />
            </>
          )}
        </div>
      )}

      <svg
        ref={svg}
        viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`}
        className={`aspect-square w-full max-w-[28rem] touch-none rounded-xl bg-muted text-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-ring ${cursor}`}
        role="application"
        aria-label={label}
        tabIndex={0}
        data-artboard
        data-mode={editing ? 'points' : 'object'}
        data-tool={tool}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
          setMarquee(null)
        }}
        onPointerLeave={() => setPointer(null)}
        onKeyDown={onKeyDown}
        onKeyUp={event => {
          if (event.key === ' ') setPanning(false)
        }}
        onBlur={() => setPanning(false)}
      >
        <rect x={0} y={0} width={100} height={100} fill="white" />
        {Array.from({ length: 9 }, (_, index) => (index + 1) * 10).map(at => (
          <g key={at} stroke="#e4e7ec" strokeWidth={0.6}>
            <line x1={at} y1={0} x2={at} y2={100} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={at} x2={100} y2={at} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <path
          d="M50 46V54M46 50H54"
          stroke="#9aa1ad"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={NEUTRAL_GUIDE}
          fill="none"
          stroke="#9aa1ad"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {marks.map((item, index) => {
          const valid = readPath(item.d).length > 0
          return (
            <path
              key={index}
              d={valid ? item.d : ''}
              fill={item.fill === false ? 'none' : 'currentColor'}
              fillRule={item.fillRule ?? 'nonzero'}
              stroke={item.stroke ? 'currentColor' : 'none'}
              strokeWidth={item.stroke?.width ?? 0}
              strokeLinecap={item.stroke?.cap ?? 'butt'}
              strokeLinejoin={item.stroke?.join ?? 'miter'}
              // A mark without fill is picked by its stroke; a thin one by its line too.
              pointerEvents={item.fill === false ? 'stroke' : 'visiblePainted'}
              opacity={editing && index !== selected ? 0.35 : 1}
              className={tool === 'select' && !editing ? 'cursor-move' : ''}
              data-role="mark"
              data-mark={index}
            />
          )
        })}
        {preview && (
          <path
            d={preview}
            fill="none"
            stroke="#5b7fe5"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            data-preview
          />
        )}
        {mark && (
          <path
            d={mark.d}
            fill="none"
            stroke="#5b7fe5"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents={editing ? 'stroke' : 'none'}
            strokeOpacity={editing ? 1 : 0.8}
          />
        )}
        {box && tool === 'select' && (
          <g data-transform-box>
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              fill="none"
              stroke="#5b7fe5"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <line
              x1={box.x + box.width / 2}
              y1={box.y}
              x2={box.x + box.width / 2}
              y2={box.y - 7 * unit}
              stroke="#5b7fe5"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <circle
              cx={box.x + box.width / 2}
              cy={box.y - 7 * unit}
              r={1.6 * unit}
              fill="white"
              stroke="#5b7fe5"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              className="cursor-grab"
              data-role="rotate"
            />
            {HANDLES.filter(
              handle =>
                (box.width > 1e-6 || !['n', 's'].includes(handle.id)) &&
                (box.height > 1e-6 || !['e', 'w'].includes(handle.id))
            ).map(handle => {
              const [x, y] = handle.at(box)
              const size = 2.4 * unit
              return (
                <rect
                  key={handle.id}
                  x={x - size / 2}
                  y={y - size / 2}
                  width={size}
                  height={size}
                  fill="white"
                  stroke="#5b7fe5"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: handle.cursor }}
                  data-role="box"
                  data-handle={handle.id}
                />
              )
            })}
          </g>
        )}
        {editing &&
          mark &&
          path.map((line, subpathIndex) =>
            line.points.map((item, index) => {
              const chosen = picked.some(p => p.subpath === subpathIndex && p.index === index)
              const size = 2.4 * unit
              return (
                <rect
                  key={`${subpathIndex}-${index}`}
                  x={item.at[0] - size / 2}
                  y={item.at[1] - size / 2}
                  width={size}
                  height={size}
                  rx={kindOf(item) === 'corner' ? 0 : size / 2}
                  fill={chosen ? '#5b7fe5' : 'white'}
                  stroke="#5b7fe5"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-move"
                  data-role="point"
                  data-subpath={subpathIndex}
                  data-index={index}
                />
              )
            })
          )}
        {shown.map(({ at, index, point: item }) =>
          (['in', 'out'] as const).map(which => {
            if (Math.hypot(...item[which]) < 1e-6) return null
            const handle: Vec = [item.at[0] + item[which][0], item.at[1] + item[which][1]]
            const own = point === item
            return (
              <g key={`${at}-${index}-${which}`}>
                <line
                  x1={item.at[0]}
                  y1={item.at[1]}
                  x2={handle[0]}
                  y2={handle[1]}
                  stroke="#5b7fe5"
                  strokeWidth={1}
                  strokeOpacity={own ? 1 : 0.5}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <circle
                  cx={handle[0]}
                  cy={handle[1]}
                  r={(own ? 1.3 : 1) * unit}
                  fill="white"
                  stroke="#5b7fe5"
                  strokeWidth={1.5}
                  strokeOpacity={own ? 1 : 0.5}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents={own ? 'all' : 'none'}
                  className="cursor-pointer"
                  data-role={own ? 'handle' : undefined}
                  data-which={which}
                />
              </g>
            )
          })
        )}
        {marquee && (
          <rect
            x={marquee.x}
            y={marquee.y}
            width={marquee.width}
            height={marquee.height}
            fill="#5b7fe5"
            fillOpacity={0.08}
            stroke="#5b7fe5"
            strokeWidth={1}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
      </svg>

      <p className="min-h-4 text-[0.65rem] text-muted-foreground" data-hint>
        {hintOf
          ? t(hintOf)
          : tool === 'select'
            ? t(
                editing
                  ? 'Points : glisser un segment le courbe, double-clic dessus ajoute un point, Échap pour finir.'
                  : 'Glisser pour déplacer, la boîte pour redimensionner ou tourner, double-clic pour les points.'
              )
            : tool === 'pen'
              ? t(
                  'Clic : un angle · clic-glisser : une courbe · premier point : fermer · Entrée : finir.'
                )
              : tool === 'curve'
                ? t(
                    'Chaque clic ajoute un point par lequel la courbe passe · Alt + clic : un angle · Entrée : finir.'
                  )
                : tool === 'hand'
                  ? t('Glisser pour se déplacer.')
                  : t(
                      'Tirer pour dessiner · Maj : régulier · Alt : depuis le centre · un clic : une forme toute faite.'
                    )}
      </p>

      {mark && selected !== null && (
        <div className="flex flex-wrap items-center gap-1" data-mark-tools>
          {point && firstPicked && (
            <div
              className="flex rounded-lg bg-muted p-0.5"
              role="group"
              aria-label={t('Type de point')}
            >
              {kindLabels.map(option => (
                <button
                  type="button"
                  className={`h-6 rounded-md px-2 text-[0.65rem] font-semibold ${
                    kindOfPicked(firstPicked) === option.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-pressed={kindOfPicked(firstPicked) === option.value}
                  title={t(option.title)}
                  key={option.value}
                  onClick={() => {
                    write(setPointKind(path, firstPicked.subpath, firstPicked.index, option.value))
                    setKinds({ ...kinds, [pointKey(firstPicked)]: option.value })
                  }}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
          )}
          {editing && picked.length > 0 && (
            <Button variant="ghost" size="sm" type="button" onClick={removePicked}>
              <Trash2 /> {t(picked.length > 1 ? 'Retirer les points' : 'Retirer le point')}
            </Button>
          )}
          {editing && firstPicked && path[firstPicked.subpath] && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() =>
                write(setClosed(path, firstPicked.subpath, !path[firstPicked.subpath].closed))
              }
            >
              {t(path[firstPicked.subpath].closed ? 'Ouvrir le tracé' : 'Fermer le tracé')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            title={t('Toutes ses lignes deviennent des courbes')}
            onClick={() => write(path.reduce((next, _, index) => smoothSubpath(next, index), path))}
          >
            <Wand2 /> {t('Lisser')}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={t('Retourner horizontalement')}
            title={t('Retourner horizontalement')}
            onClick={() => write(flipPath(path, 'x'))}
          >
            <FlipHorizontal2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={t('Retourner verticalement')}
            title={t('Retourner verticalement')}
            onClick={() => write(flipPath(path, 'y'))}
          >
            <FlipVertical2 />
          </Button>
          <Button
            variant={editing ? 'secondary' : 'ghost'}
            size="sm"
            type="button"
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
          >
            {t(editing ? 'Fermer les points' : 'Modifier les points')}
          </Button>
        </div>
      )}

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent style={{ width: 'min(520px, calc(100vw - 32px))' }}>
          <DialogHeader>
            <DialogTitle>{t('Raccourcis de l’éditeur')}</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2 overflow-y-auto px-7 py-5 text-sm">
            {shortcuts.map(item => (
              <div className="contents" key={item.label}>
                <dt>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
                    {t(item.keys)}
                  </kbd>
                </dt>
                <dd className="text-muted-foreground">{t(item.label)}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  )
}
