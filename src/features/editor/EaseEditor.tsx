import { clipEaseAt, type ClipEase } from '@bible-strong/avatar-core'
import { useEffect, useRef } from 'react'

import { Input } from '@/components/ui/input'
import {
  basicEases,
  boundedEase,
  easeDirections,
  easeFamilies,
  presetOfEase,
  sameEase,
  EASE_Y_MAX,
  EASE_Y_MIN,
} from '@/features/editor/clipEasings'
import { useStudioLanguage } from '@/i18n'

// The curve from a key to the next, set by a preset or by hand: its two control points are
// dragged on the graph, or typed. Time runs across, the share of the way up.

// The graph shows the values from VIEW_LOW to VIEW_HIGH: enough for Back's overshoot.
const VIEW_LOW = -0.6
const VIEW_HIGH = 1.6
const PREVIEW_SECONDS = 1.2
const PREVIEW_REST = 0.5

const across = (time: number) => time * 100
const up = (value: number) => ((VIEW_HIGH - value) / (VIEW_HIGH - VIEW_LOW)) * 100
const shown = (value: number) => Math.max(VIEW_LOW, Math.min(VIEW_HIGH, value))

const curvePath = (ease: ClipEase, x: (time: number) => number, y: (value: number) => number) => {
  const [x1, y1, x2, y2] = ease
  return `M${x(0)} ${y(0)}C${x(x1)} ${y(y1)} ${x(x2)} ${y(y2)} ${x(1)} ${y(1)}`
}

/** A small picture of a curve, for the presets. */
function Thumb({ ease }: { ease: ClipEase }) {
  return (
    <svg viewBox="-4 -10 40 44" className="h-6 w-7 overflow-visible" aria-hidden="true">
      <path d="M0 24H32" stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      <path
        d={curvePath(
          ease,
          time => time * 32,
          value => 24 - value * 24
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  )
}

function PresetButton({
  ease,
  label,
  current,
  caption = false,
  onPick,
}: {
  ease: ClipEase
  label: string
  current: ClipEase
  /** Whether the name is written under the picture. */
  caption?: boolean
  onPick: (ease: ClipEase) => void
}) {
  const active = sameEase(ease, current)
  return (
    <button
      type="button"
      className={`grid place-items-center rounded-md py-0.5 ${
        active
          ? 'bg-secondary text-secondary-foreground ring-1 ring-ring'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={() => onPick(ease)}
    >
      <Thumb ease={ease} />
      {caption && <span className="text-[0.6rem] leading-tight font-semibold">{label}</span>}
    </button>
  )
}

export function EaseEditor({
  ease,
  onChange,
}: {
  ease: ClipEase
  /** `tag` groups the changes of one drag into one step of the history. */
  onChange: (ease: ClipEase, tag: string) => void
}) {
  const { t } = useStudioLanguage()
  const graph = useRef<HTMLDivElement>(null)
  const ball = useRef<HTMLSpanElement>(null)
  const dragging = useRef<0 | 1 | null>(null)
  const easeRef = useRef(ease)
  easeRef.current = ease
  const preset = presetOfEase(ease)

  // A dot that runs along the curve, again and again: how the value moves, felt rather than read.
  useEffect(() => {
    let request = 0
    const start = performance.now()
    const tick = (now: number) => {
      const cycle = PREVIEW_SECONDS + PREVIEW_REST
      const time = (((now - start) / 1000) % cycle) / PREVIEW_SECONDS
      const progress = clipEaseAt(easeRef.current, Math.min(1, time))
      if (ball.current) ball.current.style.left = `${progress * 100}%`
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [])

  const pointAt = (clientX: number, clientY: number) => {
    const box = graph.current!.getBoundingClientRect()
    const time = (clientX - box.left) / (box.width || 1)
    const value = VIEW_HIGH - ((clientY - box.top) / (box.height || 1)) * (VIEW_HIGH - VIEW_LOW)
    return [time, value] as const
  }
  const drag = (handle: 0 | 1, clientX: number, clientY: number) => {
    const [time, value] = pointAt(clientX, clientY)
    const next = [...easeRef.current]
    next[handle * 2] = time
    next[handle * 2 + 1] = Math.max(VIEW_LOW, Math.min(VIEW_HIGH, value))
    onChange(boundedEase(next), `handle-${handle}`)
  }

  const [x1, y1, x2, y2] = ease
  const handles: [number, number][] = [
    [x1, y1],
    [x2, y2],
  ]
  const directionLabels = { in: 'In', out: 'Out', inOut: 'In-out' }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold">{t('Courbe vers l’image clé suivante')}</span>
        <span className="text-[0.7rem] text-muted-foreground">
          {preset ? t(preset.label) : t('Personnalisée')}
        </span>
      </div>

      <div className="rounded-lg bg-white p-2.5 ring-1 ring-border">
        <div className="relative h-44 touch-none select-none" ref={graph}>
          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              x={0}
              y={up(1)}
              width={100}
              height={up(0) - up(1)}
              fill="var(--muted)"
              stroke="var(--border)"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M${across(0)} ${up(0)}L${across(1)} ${up(1)}`}
              stroke="var(--border)"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M${across(0)} ${up(0)}L${across(x1)} ${up(shown(y1))}M${across(1)} ${up(1)}L${across(x2)} ${up(shown(y2))}`}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={curvePath(ease, across, value => up(value))}
              fill="none"
              stroke="var(--ring)"
              strokeWidth={2.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {handles.map(([time, value], handle) => (
            <button
              type="button"
              className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center active:cursor-grabbing"
              style={{ left: `${across(time)}%`, top: `${up(shown(value))}%` }}
              aria-label={t(
                handle === 0 ? 'Premier point de contrôle' : 'Second point de contrôle'
              )}
              key={handle}
              onPointerDown={event => {
                dragging.current = handle as 0 | 1
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={event => {
                if (dragging.current === handle) drag(handle as 0 | 1, event.clientX, event.clientY)
              }}
              onPointerUp={() => (dragging.current = null)}
              onPointerCancel={() => (dragging.current = null)}
            >
              <span className="size-3 rounded-full border-2 border-ring bg-white shadow-sm" />
            </button>
          ))}
        </div>
        <div className="relative mt-2 h-3 rounded-full bg-muted" aria-hidden="true">
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ring"
            ref={ball}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {(['x1', 'y1', 'x2', 'y2'] as const).map((name, index) => (
          <label className="flex flex-col gap-0.5" key={`${name}-${ease[index]}`}>
            <span className="text-[0.6rem] font-semibold text-muted-foreground">{name}</span>
            <Input
              type="number"
              step={0.01}
              min={index % 2 === 0 ? 0 : EASE_Y_MIN}
              max={index % 2 === 0 ? 1 : EASE_Y_MAX}
              defaultValue={String(ease[index])}
              aria-label={`${t('Courbe')} ${name}`}
              className="h-7 px-1.5 text-xs tabular-nums"
              onBlur={event => {
                const value = Number(event.currentTarget.value.replace(',', '.'))
                if (!Number.isFinite(value) || value === ease[index]) return
                const next = [...ease]
                next[index] = value
                onChange(boundedEase(next), `typed-${name}`)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow">{t('Préréglages')}</span>
        <div className="grid grid-cols-5 gap-0.5">
          {basicEases.map(item => (
            <PresetButton
              caption
              ease={item.ease}
              label={t(item.label)}
              current={ease}
              key={item.id}
              onPick={picked => onChange(picked, 'preset')}
            />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-[3.5rem_1fr_1fr_1fr] items-center gap-0.5 border-t border-border pt-1.5">
          <span />
          {easeDirections.map(direction => (
            <span
              className="text-center text-[0.6rem] font-semibold text-muted-foreground"
              key={direction}
            >
              {directionLabels[direction]}
            </span>
          ))}
          {easeFamilies.map(family => (
            <div className="contents" key={family.name}>
              <span className="text-[0.7rem] font-semibold text-muted-foreground">
                {family.name}
              </span>
              {easeDirections.map(direction => (
                <PresetButton
                  ease={family[direction]}
                  label={`${family.name} ${directionLabels[direction].toLowerCase()}`}
                  current={ease}
                  key={direction}
                  onPick={picked => onChange(picked, 'preset')}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
