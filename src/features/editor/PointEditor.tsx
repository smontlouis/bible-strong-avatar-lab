import type { FaceMark } from '@bible-strong/avatar-core'
import { Hand, Maximize2, MousePointer2, PenTool, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { Button } from '@/components/ui/button'
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
  type PointKind,
  type Vec,
} from '@/features/editor/pathGeometry'
import type { Editor } from '@/features/editor/useEditor'

// The artboard of a drawn eye as a vector tool shows it: the marks, and the points and handles
// of the one picked, to move, add, take out and make corners or curves; a pen to draw a new
// mark; zoom and a hand to move about. Every change rewrites the mark's path data.

type Tool = 'select' | 'pen' | 'hand'
type View = { x: number; y: number; size: number }
type Picked = { subpath: number; index: number }

const FULL_VIEW: View = { x: -4, y: -4, size: 108 }
const MIN_SIZE = 12
const MAX_SIZE = 260
/** The marks a pen draws, until the person changes them: a round line. */
const PEN_MARK: Omit<FaceMark, 'd'> = {
  fill: false,
  stroke: { width: 8, cap: 'round', join: 'round' },
}
/** The neutral eye behind the marks, dashed, for the size of an eye. */
const NEUTRAL_GUIDE =
  'M50 26.5A21.5 21.5 0 0 1 71.5 48V52A21.5 21.5 0 0 1 28.5 52V48A21.5 21.5 0 0 1 50 26.5Z'

type Drag =
  | { kind: 'point'; from: EditPath; picked: Picked; start: Vec }
  | { kind: 'handle'; from: EditPath; picked: Picked; which: 'in' | 'out'; pointKind: PointKind }
  | { kind: 'pan'; from: View; start: { x: number; y: number }; width: number }
  | { kind: 'pen'; mark: number; subpath: number; at: Vec }

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

export function PointEditor({
  editor,
  marks,
  selected,
  onSelect,
  onChange,
  label,
}: {
  editor: Editor
  marks: readonly FaceMark[]
  /** The mark picked, whose points are shown. */
  selected: number | null
  onSelect: (index: number | null) => void
  /** `tag` groups a burst of changes (a drag) into one step of the history. */
  onChange: (marks: FaceMark[], tag?: string) => void
  label: string
}) {
  const { t } = editor
  const svg = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState<View>(FULL_VIEW)
  const [tool, setTool] = useState<Tool>('select')
  const [picked, setPicked] = useState<Picked | null>(null)
  // How the picked point's handles move: path data does not keep it, the editor does.
  const [pointKind, setPointKindState] = useState<PointKind | null>(null)
  const [panning, setPanning] = useState(false)
  const drag = useRef<Drag | null>(null)
  // The mark a pen is drawing, and its subpath, until it is closed or ended.
  const pen = useRef<{ mark: number; subpath: number } | null>(null)
  useEffect(() => {
    setPicked(null)
    setPointKindState(null)
  }, [selected])

  const mark = selected !== null ? marks[selected] : undefined
  const path: EditPath = mark ? readPath(mark.d) : []
  const point = picked ? path[picked.subpath]?.points[picked.index] : undefined
  const kind = point ? (pointKind ?? kindOf(point)) : null
  // Sizes on screen stay the same whatever the zoom: they are a share of what is shown.
  const unit = view.size / 108
  const reach = 3.2 * unit

  const write = (next: EditPath, tag?: string) => {
    if (selected === null) return
    onChange(
      marks.map((item, index) => (index === selected ? { ...item, d: writePath(next) } : item)),
      tag
    )
  }

  /** A pointer's place on the artboard. */
  const toArtboard = (clientX: number, clientY: number): Vec => {
    const element = svg.current!
    const matrix = element.getScreenCTM?.()
    if (matrix) {
      const point = element.createSVGPoint()
      point.x = clientX
      point.y = clientY
      const at = point.matrixTransform(matrix.inverse())
      return [at.x, at.y]
    }
    const box = element.getBoundingClientRect()
    return [
      view.x + ((clientX - box.left) / (box.width || 1)) * view.size,
      view.y + ((clientY - box.top) / (box.height || 1)) * view.size,
    ]
  }

  const zoomAbout = (factor: number, about: Vec) => {
    const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, view.size * factor))
    const share = size / view.size
    setView({
      x: about[0] - (about[0] - view.x) * share,
      y: about[1] - (about[1] - view.y) * share,
      size,
    })
  }

  const endPen = () => {
    pen.current = null
  }

  const pick = (next: Picked | null) => {
    setPicked(next)
    setPointKindState(null)
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const element = event.currentTarget
    element.focus({ preventScroll: true })
    const at = toArtboard(event.clientX, event.clientY)
    const target = event.target as Element
    if (tool === 'hand' || panning || event.button === 1) {
      drag.current = {
        kind: 'pan',
        from: view,
        start: { x: event.clientX, y: event.clientY },
        width: element.getBoundingClientRect().width || 1,
      }
      element.setPointerCapture(event.pointerId)
      return
    }
    if (tool === 'pen') {
      const drawing = pen.current
      if (drawing && marks[drawing.mark]) {
        const current = readPath(marks[drawing.mark].d)
        const subpath = current[drawing.subpath]
        const first = subpath?.points[0]
        // Back on the first point: the path closes, and the pen is done with it.
        if (
          first &&
          subpath.points.length > 1 &&
          Math.hypot(first.at[0] - at[0], first.at[1] - at[1]) < reach
        ) {
          onChange(
            marks.map((item, index) =>
              index === drawing.mark
                ? { ...item, d: writePath(setClosed(current, drawing.subpath, true)) }
                : item
            )
          )
          endPen()
          return
        }
        const next = appendPoint(current, drawing.subpath, at)
        onChange(
          marks.map((item, index) =>
            index === drawing.mark ? { ...item, d: writePath(next) } : item
          ),
          `pen-${drawing.mark}`
        )
        drag.current = { kind: 'pen', mark: drawing.mark, subpath: drawing.subpath, at }
      } else {
        const index = marks.length
        const fresh: EditPath = [{ closed: false, points: [{ at, in: [0, 0], out: [0, 0] }] }]
        onChange([...marks, { ...PEN_MARK, d: writePath(fresh) }], `pen-${index}`)
        onSelect(index)
        pen.current = { mark: index, subpath: 0 }
        drag.current = { kind: 'pen', mark: index, subpath: 0, at }
      }
      element.setPointerCapture(event.pointerId)
      return
    }
    const role = target.closest('[data-role]') as HTMLElement | SVGElement | null
    const data = role?.dataset
    if (data?.role === 'handle' && picked && point) {
      const which = data.which as 'in' | 'out'
      drag.current = {
        kind: 'handle',
        from: path,
        picked,
        which,
        pointKind: event.altKey ? 'corner' : (kind ?? 'corner'),
      }
      if (event.altKey) setPointKindState('corner')
      element.setPointerCapture(event.pointerId)
      return
    }
    if (data?.role === 'point') {
      const next = { subpath: Number(data.subpath), index: Number(data.index) }
      if (!picked || picked.subpath !== next.subpath || picked.index !== next.index) pick(next)
      drag.current = { kind: 'point', from: path, picked: next, start: at }
      element.setPointerCapture(event.pointerId)
      return
    }
    if (data?.role === 'mark') {
      const index = Number(data.mark)
      if (index !== selected) onSelect(index)
      else pick(null)
      return
    }
    pick(null)
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current
    if (!current) return
    if (current.kind === 'pan') {
      const ratio = current.from.size / current.width
      setView({
        ...current.from,
        x: current.from.x - (event.clientX - current.start.x) * ratio,
        y: current.from.y - (event.clientY - current.start.y) * ratio,
      })
      return
    }
    const at = toArtboard(event.clientX, event.clientY)
    if (current.kind === 'pen') {
      const out: Vec = [at[0] - current.at[0], at[1] - current.at[1]]
      if (Math.hypot(out[0], out[1]) < 0.8 * unit) return
      const now = readPath(marks[current.mark]?.d ?? '')
      if (!now[current.subpath]) return
      onChange(
        marks.map((item, index) =>
          index === current.mark
            ? { ...item, d: writePath(setLastHandles(now, current.subpath, out)) }
            : item
        ),
        `pen-${current.mark}`
      )
      return
    }
    if (current.kind === 'point') {
      const from = current.from[current.picked.subpath].points[current.picked.index]
      const to: Vec = [from.at[0] + at[0] - current.start[0], from.at[1] + at[1] - current.start[1]]
      write(movePoint(current.from, current.picked.subpath, current.picked.index, to), 'points')
      return
    }
    write(
      moveHandle(
        current.from,
        current.picked.subpath,
        current.picked.index,
        current.which,
        at,
        current.pointKind
      ),
      'points'
    )
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const onDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== 'select' || selected === null) return
    const role = (event.target as Element).closest('[data-role]') as SVGElement | null
    if (role?.dataset.role === 'point') {
      // A point goes from corner to curve and back.
      const at = { subpath: Number(role.dataset.subpath), index: Number(role.dataset.index) }
      const current = path[at.subpath].points[at.index]
      const next = kindOf(current) === 'corner' ? 'symmetric' : 'corner'
      write(setPointKind(path, at.subpath, at.index, next))
      pick(at)
      setPointKindState(next)
      return
    }
    // On the picked mark's line: a point is added there, the curve keeping its shape.
    const spot = nearestSpot(path, toArtboard(event.clientX, event.clientY))
    if (!spot || spot.distance > reach) return
    const added = insertPoint(path, spot)
    if (added.index < 0) return
    write(added.path)
    pick({ subpath: spot.subpath, index: added.index })
  }

  const removePicked = () => {
    if (!picked) return
    write(removePoint(path, picked.subpath, picked.index))
    pick(null)
  }

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === ' ') {
      event.preventDefault()
      setPanning(true)
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && picked) {
      event.preventDefault()
      removePicked()
      return
    }
    if (event.key === 'Escape' || event.key === 'Enter') {
      if (pen.current) endPen()
      else pick(null)
      return
    }
    const arrows: Record<string, Vec> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    if (arrows[event.key] && picked && point) {
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const [dx, dy] = arrows[event.key]
      write(
        movePoint(path, picked.subpath, picked.index, [
          point.at[0] + dx * step,
          point.at[1] + dy * step,
        ]),
        'nudge'
      )
    }
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
      const box = svg.current!.getBoundingClientRect()
      const ratio = view.size / (box.width || 1)
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

  const handleOf = (which: 'in' | 'out') =>
    point && Math.hypot(...point[which]) > 1e-6
      ? ([point.at[0] + point[which][0], point.at[1] + point[which][1]] as Vec)
      : null
  const subpath = picked ? path[picked.subpath] : undefined
  const center: Vec = [view.x + view.size / 2, view.y + view.size / 2]

  return (
    <div className="flex flex-col gap-1.5" data-point-editor>
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ['select', MousePointer2, 'Sélection (V)'],
            [
              'pen',
              PenTool,
              'Plume (P) : un clic par point, glisser pour courber, revenir au premier point pour fermer',
            ],
            ['hand', Hand, 'Main (H, ou Espace) : se déplacer'],
          ] as const
        ).map(([value, Icon, title]) => (
          <Button
            variant={tool === value ? 'secondary' : 'ghost'}
            size="icon-sm"
            type="button"
            aria-pressed={tool === value}
            aria-label={t(title)}
            title={t(title)}
            key={value}
            onClick={() => {
              setTool(value)
              endPen()
            }}
          >
            <Icon />
          </Button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
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
        <span className="ml-auto px-1.5 text-[0.65rem] text-muted-foreground tabular-nums">
          {Math.round((FULL_VIEW.size / view.size) * 100)} %
        </span>
      </div>

      <svg
        ref={svg}
        viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`}
        className={`aspect-square w-full max-w-[26rem] touch-none rounded-xl bg-muted text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          tool === 'hand' || panning ? 'cursor-grab' : tool === 'pen' ? 'cursor-crosshair' : ''
        }`}
        role="application"
        aria-label={label}
        tabIndex={0}
        data-artboard
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        onKeyUp={event => {
          if (event.key === ' ') setPanning(false)
          if (event.key === 'v' || event.key === 'V') setTool('select')
          if (event.key === 'p' || event.key === 'P') setTool('pen')
          if (event.key === 'h' || event.key === 'H') setTool('hand')
        }}
        onBlur={() => setPanning(false)}
      >
        <rect x={0} y={0} width={100} height={100} fill="white" />
        {Array.from({ length: 9 }, (_, index) => (index + 1) * 10).map(at => (
          <g key={at} stroke="#e4e7ec" strokeWidth={0.6} vectorEffect="non-scaling-stroke">
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
              // A mark without fill is picked by its stroke, or by its line when it has none.
              pointerEvents={item.fill === false ? 'stroke' : 'visiblePainted'}
              data-role="mark"
              data-mark={index}
            />
          )
        })}
        {mark && (
          <g pointerEvents="none">
            <path
              d={mark.d}
              fill="none"
              stroke="#5b7fe5"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
        {mark &&
          path.map((line, subpathIndex) =>
            line.points.map((item, index) => {
              const chosen = picked?.subpath === subpathIndex && picked.index === index
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
        {point &&
          (['in', 'out'] as const).map(which => {
            const handle = handleOf(which)
            if (!handle) return null
            return (
              <g key={which}>
                <line
                  x1={point.at[0]}
                  y1={point.at[1]}
                  x2={handle[0]}
                  y2={handle[1]}
                  stroke="#5b7fe5"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <circle
                  cx={handle[0]}
                  cy={handle[1]}
                  r={1.3 * unit}
                  fill="white"
                  stroke="#5b7fe5"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                  data-role="handle"
                  data-which={which}
                />
              </g>
            )
          })}
      </svg>

      {point && picked && subpath && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          data-picked-point={`${picked.subpath}-${picked.index}`}
        >
          <div
            className="flex rounded-lg bg-muted p-0.5"
            role="group"
            aria-label={t('Type de point')}
          >
            {kindLabels.map(option => (
              <button
                type="button"
                className={`h-6 rounded-md px-2 text-[0.65rem] font-semibold ${
                  kind === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={kind === option.value}
                title={t(option.title)}
                key={option.value}
                onClick={() => {
                  write(setPointKind(path, picked.subpath, picked.index, option.value))
                  setPointKindState(option.value)
                }}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={removePicked}>
            <Trash2 /> {t('Retirer le point')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => write(setClosed(path, picked.subpath, !subpath.closed))}
          >
            {t(subpath.closed ? 'Ouvrir le tracé' : 'Fermer le tracé')}
          </Button>
        </div>
      )}
      <p className="text-[0.65rem] leading-snug text-muted-foreground">
        {t(
          'Double-clic sur le tracé : ajouter un point · double-clic sur un point : angle ou courbe · Suppr : retirer · Alt en tirant une poignée : angle · Espace en glissant : se déplacer · ⌘ + molette : zoom'
        )}
      </p>
    </div>
  )
}
