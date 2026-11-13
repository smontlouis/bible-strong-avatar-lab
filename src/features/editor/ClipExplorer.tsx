import {
  clipNames,
  clips,
  pauseEngine,
  playEngineClip,
  resolveFaceName,
  sampleClipTrack,
  seekEngine,
  stateGroups,
  stateNames,
  states,
  type ClipDefinition,
  type ClipEase,
  type ClipFaceKey,
  type ClipKey,
} from '@bible-strong/avatar-core'
import { ChevronRight, Pause, Play, Repeat, SkipBack, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { SectionCombobox } from '@/components/ui/section-combobox'
import { CharacterPreview } from '@/features/editor/CharacterPreview'
import type { StageStatus } from '@/features/editor/Stage'
import type { Editor } from '@/features/editor/useEditor'

// A clip is read here, not written: its tracks, their keys, the curve each number follows and
// the easing that leads from a key to the next.

type TrackName = 'position' | 'rotation' | 'squash' | 'scale' | 'lids' | 'expression'
type NumericKey = ClipKey<readonly number[]>

const trackOrder: TrackName[] = ['position', 'rotation', 'squash', 'scale', 'lids', 'expression']

const trackMeta: Record<
  TrackName,
  { label: string; color: string; parts: string[]; unit: string; hint: string }
> = {
  position: {
    label: 'Position',
    color: '#2f855a',
    parts: ['X', 'Y'],
    unit: '',
    hint: 'largeurs du corps',
  },
  rotation: {
    label: 'Rotation',
    color: '#805ad5',
    parts: ['X', 'Y', 'Z'],
    unit: '°',
    hint: 'degrés',
  },
  squash: { label: 'Étirement', color: '#c05621', parts: ['X', 'Y'], unit: '×', hint: 'facteur' },
  scale: { label: 'Zoom', color: '#b7791f', parts: ['Zoom'], unit: '×', hint: 'facteur' },
  lids: {
    label: 'Paupières',
    color: '#2b6cb0',
    parts: ['Paupières'],
    unit: '',
    hint: '0 ouvert · 1 fermé',
  },
  expression: { label: 'Visage', color: '#4a5568', parts: [], unit: '', hint: '' },
}

const partColors = ['#c53030', '#2f855a', '#2b6cb0']
const LINEAR: ClipEase = [0, 0, 1, 1]
const CURVE_SAMPLES = 96
const speeds = [0.25, 0.5, 1, 2]

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const seconds = (value: number) => `${value.toFixed(2)} s`
const short = (value: number) => {
  const text = value.toFixed(Math.abs(value) >= 100 ? 1 : 3)
  return text.replace(/\.?0+$/, '') || '0'
}

const eyebrow = 'eyebrow'
const quiet = 'text-xs text-muted-foreground'

/** One number of a track over the whole clip, with its keys as points that can be picked. */
function Curve({
  keys,
  part,
  label,
  color,
  duration,
  selected,
  onPick,
}: {
  keys: readonly NumericKey[]
  part: number
  label: string
  color: string
  duration: number
  selected: number | null
  onPick: (index: number) => void
}) {
  const values = Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) => {
    const time = (index / CURVE_SAMPLES) * duration
    return sampleClipTrack(keys, time)[part]
  })
  let low = Math.min(...values, ...keys.map(key => key.v[part]))
  let high = Math.max(...values, ...keys.map(key => key.v[part]))
  if (high - low < 1e-6) {
    // A number that does not change is drawn in the middle, not along an edge.
    low -= 1
    high += 1
  }
  const up = (value: number) => 100 - ((value - low) / (high - low)) * 100
  const path = values
    .map(
      (value, index) =>
        `${index ? 'L' : 'M'}${((index / CURVE_SAMPLES) * 100).toFixed(2)} ${up(value).toFixed(2)}`
    )
    .join('')
  // The plot sits on the same columns as the lanes of the timeline, so that a time is at the
  // same place across in both and the playhead runs through them as one line.
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-stretch">
      <div className="flex flex-col justify-between py-1 pr-2 pl-2.5 text-[0.6rem] leading-none text-muted-foreground tabular-nums">
        <span className="flex items-baseline justify-between gap-1">
          <strong className="text-sm" style={{ color }}>
            {label}
          </strong>
          <span>{short(high)}</span>
        </span>
        <span className="text-right">{short(low)}</span>
      </div>
      <div className="relative h-20 cursor-ew-resize rounded-md bg-white ring-1 ring-border">
        <div className="absolute inset-y-2 right-2.5 left-2.5">
          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            className="pointer-events-none absolute -inset-y-2 w-0.5 -translate-x-1/2 bg-ring"
            style={{ left: 'calc(var(--at, 0) * 100%)' }}
          />
          {keys.map((key, index) => (
            <button
              type="button"
              data-still
              className="absolute grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center"
              style={{ left: `${(key.t / duration) * 100}%`, top: `${up(key.v[part])}%` }}
              aria-label={`${label} · ${seconds(key.t)} · ${short(key.v[part])}`}
              aria-pressed={selected === index}
              key={index}
              onClick={() => onPick(index)}
            >
              <span
                className={`rounded-full ${selected === index ? 'size-2.5 ring-2 ring-white' : 'size-1.5'}`}
                style={{ background: color }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The easing from a key to the next: how far the value has gone at each share of the time. */
function Easing({ ease }: { ease: ClipEase }) {
  const [x1, y1, x2, y2] = ease
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold">Bézier →</span>
      <svg
        className="h-14 w-20 rounded-lg bg-white ring-1 ring-border"
        viewBox="-0.12 -0.35 1.24 1.7"
        aria-hidden="true"
      >
        <path d="M0 1L1 0" stroke="var(--border)" strokeWidth={0.015} strokeDasharray="0.04 0.04" />
        <path
          d={`M0 1C${x1} ${1 - y1} ${x2} ${1 - y2} 1 0`}
          fill="none"
          stroke="var(--ring)"
          strokeWidth={0.035}
          strokeLinecap="round"
        />
      </svg>
      <code className="text-[0.7rem] text-foreground tabular-nums">
        {ease.map(value => value.toFixed(3)).join(' · ')}
      </code>
    </div>
  )
}

/**
 * The timeline of a clip: where the engine is in it, its tracks and their keys. Dragging on it,
 * or picking a key, stops the clip and shows it at that time. `live` is the timeline of a clip
 * a state is playing: the state goes on from wherever the clip is left.
 */
export function ClipTimeline({
  editor,
  clip,
  live = false,
  onTouch,
  header,
}: {
  editor: Editor
  clip: ClipDefinition
  live?: boolean
  /** Drawn above the timeline, inside it: it can follow the playhead through `--at`. */
  header?: ReactNode
  /** Called before the timeline of a state's clip is moved by hand. */
  onTouch?: () => void
}) {
  const { t, engine, playing, setPlaying, speed, setSpeed, character } = editor
  const root = useRef<HTMLDivElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const lane = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [open, setOpen] = useState<TrackName[]>([])
  const [selected, setSelected] = useState<{ track: TrackName; index: number } | null>(null)
  const [loops, setLoops] = useState(true)
  const once = useRef(false)
  once.current = !live && !loops
  const stop = useRef(() => {})
  stop.current = () => setPlaying(false)

  useEffect(() => {
    let request = 0
    let seen = engine.current.player.loopCount
    const tick = () => {
      const player = engine.current.player
      const here = player.clip?.name === clip.name
      if (once.current && here && player.loopCount !== seen) {
        // A clip played once stays on its last picture.
        pauseEngine(engine.current)
        seekEngine(engine.current, clip.duration)
        stop.current()
      }
      seen = player.loopCount
      const joining = here && player.join !== null
      const time = here && !joining ? Math.min(player.time, clip.duration) : 0
      const element = root.current
      if (element) {
        element.style.setProperty('--at', String(time / clip.duration))
        element.dataset.joining = String(joining)
      }
      if (clock.current) clock.current.textContent = `${seconds(time)} / ${seconds(clip.duration)}`
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [clip, engine])

  const seek = (time: number) => {
    if (live) onTouch?.()
    editor.clearStop()
    setPlaying(false)
    pauseEngine(engine.current)
    seekEngine(engine.current, clamp(time, 0, clip.duration))
  }
  const timeAt = (clientX: number) => {
    const box = lane.current!.getBoundingClientRect()
    return clamp((clientX - box.left) / (box.width || 1), 0, 1) * clip.duration
  }
  const toggle = () => {
    if (!playing && once.current && engine.current.player.time >= clip.duration - 0.01) {
      seekEngine(engine.current, 0)
    }
    setPlaying(!playing)
  }
  const pick = (track: TrackName, index: number) => {
    const keys = clip.tracks[track]
    if (!keys?.[index]) return
    setSelected({ track, index })
    setOpen(current => (current.includes(track) ? current : [...current, track]))
    seek(keys[index].t)
  }
  const toggleTrack = (track: TrackName) => {
    setOpen(current =>
      current.includes(track) ? current.filter(item => item !== track) : [...current, track]
    )
    if (selected?.track === track && open.includes(track)) setSelected(null)
  }

  const tracks = trackOrder.filter(name => clip.tracks[name]?.length)
  const laneArea = 'absolute inset-y-0 right-2.5 left-2.5'
  const playhead = (
    <span
      className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ring"
      style={{ left: 'calc(var(--at, 0) * 100%)' }}
    />
  )

  return (
    <div className="group flex flex-col gap-3" ref={root} data-joining="false">
      {header}
      <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
        <Button
          size="icon-sm"
          type="button"
          aria-label={t(playing ? 'Pause' : 'Lecture')}
          onClick={toggle}
        >
          {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Début')}
          onClick={() => seek(0)}
        >
          <SkipBack />
        </Button>
        <span className="px-1.5 font-mono text-[0.7rem] tabular-nums" ref={clock} />
        <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[0.6rem] font-semibold text-secondary-foreground group-data-[joining=true]:inline">
          {t('raccord')}
        </span>
        <div className="ml-auto flex items-center rounded-lg bg-background p-0.5 ring-1 ring-border">
          {speeds.map(value => (
            <button
              type="button"
              className={`h-6 rounded-md px-1.5 text-[0.65rem] font-semibold tabular-nums ${
                speed === value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={speed === value}
              aria-label={`${t('Vitesse')} ×${value}`}
              key={value}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
        {!live && (
          <Button
            variant={loops ? 'secondary' : 'ghost'}
            size="icon-sm"
            type="button"
            aria-pressed={loops}
            aria-label={t('Boucle')}
            onClick={() => setLoops(!loops)}
          >
            <Repeat />
          </Button>
        )}
      </div>

      <div
        className="flex touch-none flex-col gap-1 select-none"
        onPointerDown={event => {
          if ((event.target as HTMLElement).closest('[data-still]')) return
          dragging.current = true
          seek(timeAt(event.clientX))
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            // Without capture the drag still follows the pointer while it stays over the timeline.
          }
        }}
        onPointerMove={event => {
          if (dragging.current) seek(timeAt(event.clientX))
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <div className="grid cursor-ew-resize grid-cols-[5.5rem_1fr] items-center">
          <span />
          <div className="relative h-6">
            <div className={laneArea} ref={lane}>
              {[0, 0.25, 0.5, 0.75, 1].map(share => (
                <span
                  className={`absolute bottom-0 text-[0.6rem] whitespace-nowrap text-muted-foreground tabular-nums ${
                    share === 0 ? '' : share === 1 ? '-translate-x-full' : '-translate-x-1/2'
                  }`}
                  style={{ left: `${share * 100}%` }}
                  key={share}
                >
                  {seconds(share * clip.duration)}
                </span>
              ))}
              <span
                className="pointer-events-none absolute -bottom-1 size-2 -translate-x-1/2 rotate-45 bg-ring"
                style={{ left: 'calc(var(--at, 0) * 100%)' }}
              />
            </div>
          </div>
        </div>

        {tracks.map(name => {
          const meta = trackMeta[name]
          const keys = clip.tracks[name]!
          const isOpen = open.includes(name)
          const chosen = selected?.track === name ? selected.index : null
          return (
            <div className="flex flex-col gap-1" key={name}>
              <div className="grid grid-cols-[5.5rem_1fr] items-center">
                <button
                  type="button"
                  data-still
                  className="flex items-center gap-1 text-left text-xs font-semibold"
                  aria-expanded={isOpen}
                  onClick={() => toggleTrack(name)}
                >
                  <ChevronRight
                    className={`size-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                  {t(meta.label)}
                </button>
                <div className="relative h-7 cursor-ew-resize rounded-md bg-muted">
                  <div className={laneArea}>
                    {playhead}
                    {keys.map((key, index) => (
                      <button
                        type="button"
                        data-still
                        className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center"
                        style={{ left: `${(key.t / clip.duration) * 100}%` }}
                        aria-label={`${t(meta.label)} · ${seconds(key.t)} · ${
                          typeof key.v === 'string' ? key.v : key.v.map(short).join(', ')
                        }`}
                        aria-pressed={chosen === index}
                        key={index}
                        onClick={() => pick(name, index)}
                      >
                        <span
                          className={`rotate-45 ${
                            chosen === index ? 'size-3 ring-2 ring-ring ring-offset-1' : 'size-2.5'
                          }`}
                          style={{ background: meta.color }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="flex flex-col gap-2 rounded-lg bg-muted py-2.5">
                  <div data-still className="flex items-center justify-between px-2.5">
                    <p className="text-xs font-semibold">
                      {t(meta.label)}
                      {chosen !== null && (
                        <>
                          {' · '}
                          {chosen + 1} / {keys.length}{' '}
                          <span className="font-normal text-muted-foreground">
                            {seconds(keys[chosen].t)}
                          </span>
                        </>
                      )}
                      {chosen === null && (
                        <span className="font-normal text-muted-foreground">
                          {' · '}
                          {keys.length} {t('images clés')}
                        </span>
                      )}
                      {meta.hint && (
                        <span className="font-normal text-muted-foreground"> · {t(meta.hint)}</span>
                      )}
                    </p>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      type="button"
                      aria-label={t('Fermer')}
                      onClick={() => toggleTrack(name)}
                    >
                      <X />
                    </Button>
                  </div>

                  {name === 'expression' ? (
                    <div data-still className="@container px-2.5">
                      <div className="grid grid-cols-2 gap-1.5 @sm:grid-cols-3 @lg:grid-cols-4">
                        {(keys as ClipFaceKey[]).map((key, index) => (
                          <button
                            type="button"
                            className={`flex items-center gap-2 rounded-lg bg-white p-1.5 text-left ring-1 ${
                              chosen === index ? 'ring-2 ring-ring' : 'ring-border'
                            }`}
                            aria-pressed={chosen === index}
                            key={index}
                            onClick={() => pick(name, index)}
                          >
                            <span className="grid size-10 shrink-0 place-items-center [&_.avatar-preview]:size-full">
                              {key.v === 'blink' || !character ? (
                                <span className="text-lg leading-none text-muted-foreground">
                                  – –
                                </span>
                              ) : (
                                <CharacterPreview
                                  character={character}
                                  face={resolveFaceName(key.v)}
                                />
                              )}
                            </span>
                            <span className="min-w-0">
                              <strong className="block truncate text-xs">{key.v}</strong>
                              <span className="block text-[0.65rem] text-muted-foreground tabular-nums">
                                {seconds(key.t)}
                                {key.cut ? ` · ${t('sec')}` : ''}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {chosen !== null && (
                        <div
                          data-still
                          className={`grid gap-1.5 px-2.5 ${meta.parts.length === 3 ? 'grid-cols-3' : meta.parts.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
                        >
                          {meta.parts.map((part, index) => (
                            <div
                              className="flex items-baseline justify-between rounded-md bg-white px-2 py-1.5 ring-1 ring-border"
                              key={part}
                            >
                              <span
                                className="text-[0.65rem] font-semibold"
                                style={{
                                  color: meta.parts.length > 1 ? partColors[index] : meta.color,
                                }}
                              >
                                {t(part)}
                              </span>
                              <strong className="text-xs tabular-nums">
                                {short((keys as NumericKey[])[chosen].v[index])}
                                {meta.unit}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        {meta.parts.map((part, index) => (
                          <Curve
                            keys={keys as NumericKey[]}
                            part={index}
                            label={t(part)}
                            color={meta.parts.length > 1 ? partColors[index] : meta.color}
                            duration={clip.duration}
                            selected={chosen}
                            key={part}
                            onPick={picked => pick(name, picked)}
                          />
                        ))}
                      </div>
                      {chosen !== null &&
                        (chosen < keys.length - 1 ? (
                          <div data-still className="px-2.5">
                            <Easing ease={(keys as NumericKey[])[chosen].ease ?? LINEAR} />
                          </div>
                        ) : (
                          <p data-still className={`${quiet} px-2.5`}>
                            {t('Dernière image clé : la valeur tient jusqu’à la fin du clip.')}
                          </p>
                        ))}
                    </>
                  )}

                  {chosen !== null && (
                    <div data-still className="flex justify-between px-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={chosen === 0}
                        onClick={() => pick(name, chosen - 1)}
                      >
                        ← {chosen > 0 ? seconds(keys[chosen - 1].t) : ''}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={chosen === keys.length - 1}
                        onClick={() => pick(name, chosen + 1)}
                      >
                        {chosen < keys.length - 1 ? seconds(keys[chosen + 1].t) : ''} →
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// A surface of the inspector, as the Studio's cards draw them, with room of its own.
const surface = 'rounded-2xl border border-border bg-card shadow-[0_4px_14px_rgb(24_28_35/5%)]'

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
      {children}
    </span>
  )
}

const usesClip = (state: string, clip: string) =>
  states[state].clips.includes(clip) || (states[state].compactClips?.includes(clip) ?? false)

// The clips by family: `Working_B` belongs to `Working`.
const clipSections = Object.entries(
  clipNames.reduce<Record<string, string[]>>((families, name) => {
    const family = name.split('_')[0]
    ;(families[family] ??= []).push(name)
    return families
  }, {})
).map(([value, items]) => ({ value, items }))

const stateSections = stateGroups.map(group => ({ value: group.label, items: [...group.states] }))

export function ClipsPanel({ editor, status }: { editor: Editor; status: StageStatus }) {
  const { t, doing, setDoing, setPlaying, setTab } = editor
  // Stopped, nothing plays: the clip asked for is still the one shown.
  const clip = clips[status.clip] ?? ('clip' in doing ? clips[doing.clip] : undefined)
  const users = clip ? stateNames.filter(state => usesClip(state, clip.name)) : []
  return (
    <div className="panel-stack">
      <div className={`${surface} flex flex-col gap-0.5 p-1.5`}>
        <SectionCombobox
          label={t('Clip')}
          value={clip?.name ?? null}
          sections={clipSections}
          detail={name => (clips[name] ? seconds(clips[name].duration) : undefined)}
          placeholder={t('Rechercher un clip…')}
          empty={t('Aucun clip')}
          onPick={name => {
            setPlaying(true)
            setDoing({ clip: name })
          }}
        />
        {clip && (
          <div className="flex items-baseline gap-3 px-3 py-2">
            <span className="shrink-0 text-sm font-medium text-muted-foreground">
              {t('Utilisé par')}
            </span>
            <div className="flex flex-wrap justify-end gap-1">
              {users.length ? (
                users.map(state => (
                  <button
                    type="button"
                    className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-foreground hover:bg-secondary hover:text-secondary-foreground"
                    aria-label={`${t('État')} ${state}`}
                    key={state}
                    onClick={() => {
                      setTab('states')
                      setPlaying(true)
                      setDoing({ state })
                    }}
                  >
                    {state}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )}
      </div>
      {clip && (
        <div className={`${surface} p-3`}>
          <ClipTimeline editor={editor} clip={clip} key={clip.name} />
        </div>
      )}
    </div>
  )
}

export function StatesPanel({ editor, status }: { editor: Editor; status: StageStatus }) {
  const { t, doing, setDoing, setPlaying, engine } = editor
  // The state left for one of its clips: it stays shown until it is taken up again.
  const [left, setLeft] = useState<string | null>(null)
  const inspecting = left !== null && 'clip' in doing
  const name = inspecting ? left : (status.state ?? ('state' in doing ? doing.state : null))
  const state = name ? states[name] : undefined
  const clip = clips[status.clip]

  /** Leave the state for one of its clips, which then plays alone, round and round. */
  const inspect = (item: string, from?: number) => {
    if (!name) return
    setLeft(name)
    playEngineClip(engine.current, clips[item], {
      phase: from === undefined ? 0 : from / clips[item].duration,
      transition: 'cut',
    })
    setDoing({ clip: item })
  }
  const takeUp = (item: string) => {
    setLeft(null)
    setPlaying(true)
    setDoing({ state: item })
  }

  const policy = !state
    ? ''
    : state.next && state.holdSeconds !== undefined
      ? `${state.holdSeconds} s → ${state.next}`
      : state.next
        ? `${t('Dans l’ordre')} → ${state.next}`
        : state.clips.length > 1
          ? t('Mélangé')
          : t('Un seul clip')

  const tiles = state && name && (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="mr-1 text-lg font-semibold">{name}</h3>
        <Pill>{policy}</Pill>
        {state.face && <Pill>{state.face}</Pill>}
        {state.morph && <Pill>{state.morph}</Pill>}
        {inspecting && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-0.5 pl-2 text-[0.65rem] font-semibold text-secondary-foreground">
            {t('Clip seul')}
            <button
              type="button"
              className="grid size-5 place-items-center rounded-full bg-background text-secondary-foreground"
              aria-label={t('Reprendre l’état')}
              title={t('Reprendre l’état')}
              onClick={() => takeUp(name)}
            >
              <X className="size-3" />
            </button>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {state.clips.map((item, index) => {
          const playingNow = item === status.clip
          return (
            <button
              type="button"
              className={`relative flex items-center justify-between gap-2 overflow-hidden rounded-lg px-2.5 py-1.5 text-left ${
                playingNow
                  ? 'bg-secondary text-secondary-foreground ring-1 ring-ring'
                  : 'bg-muted hover:ring-1 hover:ring-border'
              }`}
              aria-pressed={playingNow}
              aria-label={`${t('Clip')} ${item}`}
              key={`${item}-${index}`}
              onClick={() => {
                inspect(item)
                setPlaying(true)
              }}
            >
              {playingNow && (
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 bg-ring/15"
                  style={{ width: 'calc(var(--at, 0) * 100%)' }}
                />
              )}
              <strong className="relative truncate text-xs">{item}</strong>
              <span className="relative shrink-0 text-[0.65rem] tabular-nums opacity-70">
                {seconds(clips[item].duration)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="panel-stack">
      <div className={`${surface} flex flex-col gap-0.5 p-1.5`}>
        <SectionCombobox
          label={t('État')}
          value={inspecting ? null : name}
          sections={stateSections}
          detail={item =>
            states[item].morph
              ? states[item].morph
              : states[item].clips.length > 1
                ? `${states[item].clips.length} clips`
                : undefined
          }
          placeholder={t('Rechercher un état…')}
          empty={t('Aucun état')}
          onPick={takeUp}
        />
      </div>
      {tiles && (
        <div className={`${surface} p-3`}>
          {clip ? (
            <ClipTimeline
              editor={editor}
              clip={clip}
              live={!inspecting}
              key={clip.name}
              header={tiles}
              onTouch={() => inspect(clip.name, engine.current.player.time)}
            />
          ) : (
            tiles
          )}
        </div>
      )}
    </div>
  )
}
