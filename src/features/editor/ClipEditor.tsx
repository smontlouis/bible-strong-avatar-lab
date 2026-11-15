import {
  resolveFaceName,
  type ClipDefinition,
  type ClipEase,
  type ClipFaceKey,
  type ClipKey,
} from '@bible-strong/avatar-core'
import { ArrowLeft, ArrowRight, Copy, Download, Plus, Redo2, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { CharacterPreview } from '@/features/editor/CharacterPreview'
import {
  ClipTransport,
  Curve,
  partColors,
  seconds,
  short,
  trackMeta,
  useClipPlayback,
} from '@/features/editor/ClipExplorer'
import { DEFAULT_EASE, LINEAR_EASE } from '@/features/editor/clipEasings'
import {
  addClipKey,
  clipFaceChoices,
  clipFileName,
  clipFileText,
  clipNameProblem,
  deleteClipKey,
  MAX_CLIP_SECONDS,
  MIN_CLIP_SECONDS,
  moveClipKey,
  renameClip,
  setClipDuration,
  setClipFaceKey,
  setClipKeyEase,
  setClipKeyValue,
  setClipRestTime,
  setClipSquashAnchor,
  setClipTrackEase,
  trackOrder,
  type NumericTrackName,
  type TrackName,
} from '@/features/editor/clipLibrary'
import { NumericField } from '@/features/editor/controls'
import { EaseEditor } from '@/features/editor/EaseEditor'
import type { Editor } from '@/features/editor/useEditor'

// The editor of a custom clip: its settings, its tracks with their keys, which are added,
// dragged in time and removed, and the key picked, with its value and the curve to the next.

type NumericKey = ClipKey<readonly number[]>
type Selection = { track: TrackName; index: number }

/** How close, in pixels, a dragged key comes to a time before it lands on it. */
const SNAP_PIXELS = 6
/** Without a time to land on, a dragged key falls on hundredths of a second. */
const TIME_STEP = 0.01
/** Two presses on a lane this close in time and space add a key. */
const DOUBLE_PRESS_MS = 400
const DOUBLE_PRESS_PIXELS = 6

const steps: Record<NumericTrackName, { step: number; min?: number; max?: number }> = {
  position: { step: 0.01 },
  rotation: { step: 1 },
  squash: { step: 0.01, min: 0.05 },
  scale: { step: 0.01, min: 0.25, max: 2.5 },
  lids: { step: 0.01, min: 0, max: 1 },
}

const surface = 'rounded-2xl border border-border bg-card shadow-[0_4px_14px_rgb(24_28_35/5%)]'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const download = (clip: ClipDefinition) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([clipFileText(clip)], { type: 'application/json' }))
  link.download = clipFileName(clip)
  link.click()
  URL.revokeObjectURL(link.href)
}

function ClipSettings({ editor, clip }: { editor: Editor; clip: ClipDefinition }) {
  const { t, clipLibrary, setDoing, setPlaying } = editor
  const [name, setName] = useState(clip.name)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => setName(clip.name), [clip.name])
  const problem = clipNameProblem(name, clipLibrary.clips, clip.name)
  const problems = {
    empty: 'Le clip doit avoir un nom.',
    catalogue: 'Ce nom est celui d’un clip du catalogue.',
    taken: 'Un autre de tes clips porte déjà ce nom.',
  }
  const rename = () => {
    const next = name.trim()
    if (problem || next === clip.name) {
      if (problem) setName(clip.name)
      return
    }
    clipLibrary.update(clip.name, renameClip(clip, next))
    setDoing({ clip: next })
  }
  const update = (next: ClipDefinition, tag: string) => clipLibrary.update(clip.name, next, tag)

  return (
    <div className={`${surface} @container flex flex-col gap-3 p-3`}>
      <div className="flex items-center gap-2">
        <Input
          aria-label={t('Nom du clip')}
          aria-invalid={problem !== null}
          value={name}
          className="h-9 flex-1 font-semibold"
          spellCheck={false}
          onChange={event => setName(event.currentTarget.value)}
          onBlur={rename}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setName(clip.name)
              event.currentTarget.blur()
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Annuler')}
          title={`${t('Annuler')} (⌘Z)`}
          disabled={!clipLibrary.canUndo}
          onClick={clipLibrary.undo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Rétablir')}
          title={`${t('Rétablir')} (⇧⌘Z)`}
          disabled={!clipLibrary.canRedo}
          onClick={clipLibrary.redo}
        >
          <Redo2 />
        </Button>
      </div>
      {problem && name.trim() !== clip.name && (
        <p className="-mt-1.5 text-xs text-destructive">{t(problems[problem])}</p>
      )}

      <div className="grid gap-1.5 @lg:grid-cols-2">
        <NumericField
          label="Durée"
          value={clip.duration}
          min={MIN_CLIP_SECONDS}
          max={MAX_CLIP_SECONDS}
          step={0.05}
          unit="s"
          onChange={value => update(setClipDuration(clip, value), 'duration')}
        />
        <NumericField
          label="Pose de repos"
          value={clip.workArea?.start ?? 0}
          min={0}
          max={clip.duration}
          step={0.01}
          unit="s"
          onChange={value => update(setClipRestTime(clip, value), 'rest')}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {t('Étirement depuis')}
          </span>
          {[
            { value: 0, label: 'le centre' },
            { value: -1, label: 'la base' },
          ].map(option => (
            <Button
              variant={(clip.squashAnchor ?? 0) === option.value ? 'default' : 'outline'}
              size="sm"
              type="button"
              aria-pressed={(clip.squashAnchor ?? 0) === option.value}
              key={option.value}
              onClick={() => update(setClipSquashAnchor(clip, option.value), 'anchor')}
            >
              {t(option.label)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            type="button"
            title={t('Enregistrer le clip dans un fichier .clip.json')}
            onClick={() => download(clip)}
          >
            <Download /> {t('Exporter')}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            aria-label={t('Dupliquer le clip')}
            title={t('Dupliquer le clip')}
            onClick={() => {
              const copy = clipLibrary.duplicate(clip.name, `${clip.name} ${t('copie')}`)
              if (copy) {
                setPlaying(false)
                setDoing({ clip: copy })
              }
            }}
          >
            <Copy />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            aria-label={t('Supprimer le clip')}
            title={t('Supprimer le clip')}
            onClick={() => setDeleting(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Supprimer')} {clip.name} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('Le clip est retiré de tes clips. Exporte-le d’abord pour en garder une copie.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Garder')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clipLibrary.remove(clip.name)
                setDoing({ state: 'idle' })
                setPlaying(true)
              }}
            >
              {t('Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FacePicker({
  editor,
  value,
  onPick,
}: {
  editor: Editor
  value: string
  onPick: (face: string) => void
}) {
  const { t, character } = editor
  return (
    <div className="@container">
      <div className="grid grid-cols-3 gap-1.5 @sm:grid-cols-4 @lg:grid-cols-5">
        {clipFaceChoices.map(face => (
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 rounded-lg bg-white p-1.5 ring-1 ${
              value === face ? 'ring-2 ring-ring' : 'ring-border hover:ring-ring/50'
            }`}
            aria-pressed={value === face}
            aria-label={`${t('Visage')} ${face}`}
            key={face}
            onClick={() => onPick(face)}
          >
            <span className="grid size-10 place-items-center [&_.avatar-preview]:size-full">
              {face === 'blink' || !character ? (
                <span className="text-lg leading-none text-muted-foreground">– –</span>
              ) : (
                <CharacterPreview character={character} face={resolveFaceName(face)} />
              )}
            </span>
            <span className="max-w-full truncate text-[0.65rem] font-semibold">{face}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function KeyInspector({
  editor,
  clip,
  selection,
  onSelect,
  seek,
}: {
  editor: Editor
  clip: ClipDefinition
  selection: Selection
  onSelect: (selection: Selection | null) => void
  seek: (time: number) => void
}) {
  const { t, clipLibrary } = editor
  const { track, index } = selection
  const keys = (clip.tracks[track] ?? []) as (NumericKey | ClipFaceKey)[]
  const key = keys[index]
  if (!key) return null
  const meta = trackMeta[track]
  const update = (next: ClipDefinition, tag: string) =>
    clipLibrary.update(clip.name, next, `${track}-${tag}`)
  const go = (next: number) => {
    onSelect({ track, index: next })
    seek(keys[next].t)
  }
  const last = index === keys.length - 1

  return (
    <div className={`${surface} @container flex flex-col gap-3 p-3`}>
      <div className="flex items-center gap-1.5">
        <span
          className="size-2.5 shrink-0 rotate-45"
          style={{ background: meta.color }}
          aria-hidden="true"
        />
        <p className="flex-1 text-sm font-semibold">
          {t(meta.label)}
          <span className="font-normal text-muted-foreground">
            {' · '}
            {t('image clé')} {index + 1} / {keys.length}
          </span>
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Image clé précédente')}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ArrowLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Image clé suivante')}
          disabled={last}
          onClick={() => go(index + 1)}
        >
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          aria-label={t('Supprimer l’image clé')}
          title={`${t('Supprimer l’image clé')} (⌫)`}
          onClick={() => {
            clipLibrary.update(clip.name, deleteClipKey(clip, track, index))
            onSelect(keys.length > 1 ? { track, index: Math.max(0, index - 1) } : null)
          }}
        >
          <Trash2 />
        </Button>
      </div>

      <NumericField
        label="Temps"
        value={key.t}
        min={0}
        max={clip.duration}
        step={0.01}
        unit="s"
        onChange={value => {
          const moved = moveClipKey(clip, track, index, value)
          update(moved.clip, `time-${index}`)
          onSelect({ track, index: moved.index })
          seek(value)
        }}
      />

      {track === 'expression' ? (
        <>
          <FacePicker
            editor={editor}
            value={(key as ClipFaceKey).v}
            onPick={face => update(setClipFaceKey(clip, index, { v: face }), `face-${index}`)}
          />
          <label className="flex items-center justify-between gap-3 text-xs">
            <span>
              <strong className="block">{t('Changement sec')}</strong>
              <span className="text-muted-foreground">
                {t('Le visage change d’un coup, sans fondu.')}
              </span>
            </span>
            <Switch
              checked={(key as ClipFaceKey).cut === true}
              aria-label={t('Changement sec')}
              onCheckedChange={cut => update(setClipFaceKey(clip, index, { cut }), `cut-${index}`)}
            />
          </label>
        </>
      ) : (
        <>
          <div
            className={`grid gap-1.5 ${meta.parts.length > 1 ? '@lg:grid-cols-2' : ''} ${
              meta.parts.length === 3 ? '@3xl:grid-cols-3' : ''
            }`}
          >
            {meta.parts.map((part, component) => (
              <NumericField
                label={part}
                value={(key as NumericKey).v[component]}
                min={steps[track as NumericTrackName].min}
                max={steps[track as NumericTrackName].max}
                step={steps[track as NumericTrackName].step}
                unit={meta.unit}
                key={part}
                onChange={value =>
                  update(
                    setClipKeyValue(clip, track as NumericTrackName, index, component, value),
                    `value-${index}-${component}`
                  )
                }
              />
            ))}
          </div>
          <p className="-mt-1.5 text-[0.7rem] text-muted-foreground">{t(meta.hint)}</p>
          {last ? (
            <p className="text-xs text-muted-foreground">
              {t('Dernière image clé : la valeur tient jusqu’à la fin du clip.')}
            </p>
          ) : (
            <>
              <EaseEditor
                ease={(key as NumericKey).ease ?? LINEAR_EASE}
                onChange={(ease: ClipEase, tag) =>
                  update(
                    setClipKeyEase(clip, track as NumericTrackName, index, ease),
                    `ease-${index}-${tag}`
                  )
                }
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="self-start"
                onClick={() =>
                  clipLibrary.update(
                    clip.name,
                    setClipTrackEase(
                      clip,
                      track as NumericTrackName,
                      (key as NumericKey).ease ?? DEFAULT_EASE
                    )
                  )
                }
              >
                {t('Appliquer cette courbe à toute la piste')}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function ClipEditor({ editor, clip }: { editor: Editor; clip: ClipDefinition }) {
  const { t, clipLibrary, engine } = editor
  const lane = useRef<HTMLDivElement>(null)
  const [loops, setLoops] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  // The track whose curves are drawn under the lanes.
  const [shown, setShown] = useState<NumericTrackName | null>(null)
  const scrubbing = useRef(false)
  const lastPress = useRef<{ track: string; x: number; at: number } | null>(null)
  const dragged = useRef<{
    track: TrackName
    index: number
    from: ClipDefinition
    x: number
    moved: boolean
  } | null>(null)
  const { root, clock, seek, toggle } = useClipPlayback(editor, clip, { loops })

  // A key the history took away is no longer picked.
  const selected = selection && clip.tracks[selection.track]?.[selection.index] ? selection : null
  const curveTrack = selected && selected.track !== 'expression' ? selected.track : (shown ?? null)

  const timeAt = (clientX: number) => {
    const box = lane.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - box.left) / (box.width || 1))) * clip.duration
  }
  /** Where a key dragged to a time lands: on a time worth landing on when it is close. */
  const snap = (time: number, track: TrackName, free: boolean) => {
    if (free) return time
    const width = lane.current?.getBoundingClientRect().width || 1
    const reach = (SNAP_PIXELS / width) * clip.duration
    const targets = [
      0,
      clip.duration,
      clip.workArea?.start ?? 0,
      ...trackOrder
        .filter(other => other !== track)
        .flatMap(other => (clip.tracks[other] ?? []).map(key => key.t)),
    ]
    let best: number | null = null
    for (const target of targets) {
      if (
        Math.abs(target - time) <= reach &&
        (best === null || Math.abs(target - time) < Math.abs(best - time))
      ) {
        best = target
      }
    }
    return best ?? Math.round(time / TIME_STEP) * TIME_STEP
  }

  const select = (next: Selection | null) => {
    setSelection(next)
    if (next && next.track !== 'expression') setShown(next.track)
  }
  const addKey = (track: TrackName, time: number) => {
    const added = addClipKey(clip, track, time)
    clipLibrary.update(clip.name, added.clip)
    select({ track, index: added.index })
    seek(added.clip.tracks[track]![added.index].t)
  }
  const playheadTime = () =>
    engine.current.player.clip?.name === clip.name ? engine.current.player.time : 0

  // Keys of the keyboard: remove the picked key, add one at the playhead, undo and redo.
  const keyboard = useRef<(event: KeyboardEvent) => void>(() => {})
  keyboard.current = event => {
    if (isTyping(event.target)) return
    const command = event.metaKey || event.ctrlKey
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) clipLibrary.redo()
      else clipLibrary.undo()
      return
    }
    if (command && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      clipLibrary.redo()
      return
    }
    if (command || event.altKey) return
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
      event.preventDefault()
      const count = clip.tracks[selected.track]!.length
      clipLibrary.update(clip.name, deleteClipKey(clip, selected.track, selected.index))
      select(count > 1 ? { ...selected, index: Math.max(0, selected.index - 1) } : null)
      return
    }
    if (event.key.toLowerCase() === 'k') {
      const track = selected?.track ?? shown
      if (track) addKey(track, playheadTime())
    }
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyboard.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const laneArea = 'absolute inset-y-0 right-2.5 left-2.5'
  const playhead = (
    <span
      className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ring"
      style={{ left: 'calc(var(--at, 0) * 100%)' }}
    />
  )
  const restShare = (clip.workArea?.start ?? 0) / clip.duration
  const ticks = Array.from({ length: 5 }, (_, index) => index / 4)

  return (
    <div className="panel-stack" style={{ ['--label' as string]: '6.5rem' }}>
      <ClipSettings editor={editor} clip={clip} />

      <div className={`${surface} group flex flex-col gap-3 p-3`} ref={root} data-joining="false">
        <ClipTransport
          editor={editor}
          clock={clock}
          toggle={toggle}
          seek={seek}
          loops={loops}
          setLoops={setLoops}
        />

        <div
          className="flex touch-none flex-col gap-1 select-none"
          onPointerDown={event => {
            if ((event.target as HTMLElement).closest('[data-still]')) return
            // A double press on a lane adds a key there. The scrub captures the pointer, which
            // takes the browser's own double click away from the lane.
            const track = (event.target as HTMLElement).closest<HTMLElement>('[data-lane]')?.dataset
              .lane as TrackName | undefined
            const before = lastPress.current
            const now = event.timeStamp
            if (
              track &&
              before?.track === track &&
              now - before.at < DOUBLE_PRESS_MS &&
              Math.abs(event.clientX - before.x) < DOUBLE_PRESS_PIXELS
            ) {
              lastPress.current = null
              addKey(track, snap(timeAt(event.clientX), track, event.altKey))
              return
            }
            lastPress.current = track ? { track, x: event.clientX, at: now } : null
            scrubbing.current = true
            seek(timeAt(event.clientX))
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
              // Without capture the scrub still follows the pointer over the timeline.
            }
          }}
          onPointerMove={event => {
            if (scrubbing.current) seek(timeAt(event.clientX))
          }}
          onPointerUp={() => (scrubbing.current = false)}
          onPointerCancel={() => (scrubbing.current = false)}
        >
          <div className="grid cursor-ew-resize grid-cols-[var(--label)_1fr] items-center">
            <span />
            <div className="relative h-6">
              <div className={laneArea} ref={lane}>
                {ticks.map(share => (
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
                  className="pointer-events-none absolute -top-1 h-2.5 w-px bg-secondary-foreground/60"
                  style={{ left: `${restShare * 100}%` }}
                  title={t('Pose de repos')}
                />
                <span
                  className="pointer-events-none absolute -bottom-1 size-2 -translate-x-1/2 rotate-45 bg-ring"
                  style={{ left: 'calc(var(--at, 0) * 100%)' }}
                />
              </div>
            </div>
          </div>

          {trackOrder.map(track => {
            const meta = trackMeta[track]
            const keys = clip.tracks[track] ?? []
            const present = keys.length > 0
            const isShown = curveTrack === track
            return (
              <div className="grid grid-cols-[var(--label)_1fr] items-center" key={track}>
                <div data-still className="flex items-center gap-0.5 pr-1">
                  <button
                    type="button"
                    className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs font-semibold ${
                      present ? '' : 'text-muted-foreground'
                    } ${isShown ? 'bg-secondary text-secondary-foreground' : ''}`}
                    aria-pressed={isShown}
                    disabled={track === 'expression' || !present}
                    title={track === 'expression' ? undefined : t('Voir les courbes de la piste')}
                    onClick={() => {
                      setShown(isShown ? null : (track as NumericTrackName))
                      if (isShown) setSelection(null)
                    }}
                  >
                    {t(meta.label)}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    type="button"
                    aria-label={`${t('Ajouter une image clé')} · ${t(meta.label)}`}
                    title={`${t('Ajouter une image clé à la tête de lecture')} (K)`}
                    onClick={() => addKey(track, playheadTime())}
                  >
                    <Plus />
                  </Button>
                </div>
                <div
                  className={`relative h-7 cursor-ew-resize rounded-md ${
                    present ? 'bg-muted' : 'bg-transparent ring-1 ring-border ring-inset'
                  }`}
                  data-lane={track}
                  title={present ? undefined : t('Double-clic pour ajouter une image clé')}
                >
                  <div className={laneArea}>
                    {playhead}
                    {keys.map((key, index) => {
                      const chosen = selected?.track === track && selected.index === index
                      return (
                        <button
                          type="button"
                          data-still
                          data-key
                          className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center active:cursor-grabbing"
                          style={{ left: `${(key.t / clip.duration) * 100}%` }}
                          aria-label={`${t(meta.label)} · ${seconds(key.t)} · ${
                            typeof key.v === 'string' ? key.v : key.v.map(short).join(', ')
                          }`}
                          aria-pressed={chosen}
                          key={index}
                          onPointerDown={event => {
                            event.stopPropagation()
                            select({ track, index })
                            seek(key.t)
                            dragged.current = {
                              track,
                              index,
                              from: clip,
                              x: event.clientX,
                              moved: false,
                            }
                            event.currentTarget.setPointerCapture(event.pointerId)
                          }}
                          onPointerMove={event => {
                            const drag = dragged.current
                            if (!drag) return
                            if (!drag.moved && Math.abs(event.clientX - drag.x) < 3) return
                            drag.moved = true
                            const time = snap(timeAt(event.clientX), track, event.altKey)
                            const moved = moveClipKey(drag.from, drag.track, drag.index, time)
                            clipLibrary.update(clip.name, moved.clip, `drag-${track}`)
                            setSelection({ track, index: moved.index })
                            seek(time)
                          }}
                          onPointerUp={() => (dragged.current = null)}
                          onPointerCancel={() => (dragged.current = null)}
                        >
                          <span
                            className={`rotate-45 ${
                              chosen ? 'size-3 ring-2 ring-ring ring-offset-1' : 'size-2.5'
                            }`}
                            style={{ background: meta.color }}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {curveTrack && clip.tracks[curveTrack]?.length ? (
          <div className="flex flex-col gap-1.5" data-still>
            {trackMeta[curveTrack].parts.map((part, component) => (
              <Curve
                keys={clip.tracks[curveTrack] as NumericKey[]}
                part={component}
                label={t(part)}
                color={
                  trackMeta[curveTrack].parts.length > 1
                    ? partColors[component]
                    : trackMeta[curveTrack].color
                }
                duration={clip.duration}
                selected={selected?.track === curveTrack ? selected.index : null}
                key={part}
                onPick={index => {
                  select({ track: curveTrack, index })
                  seek(clip.tracks[curveTrack]![index].t)
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t(
              Object.keys(clip.tracks).length
                ? 'Choisis une image clé pour la régler. Glisse-la pour la déplacer ; Alt la laisse libre.'
                : 'Ajoute une image clé avec + sur une piste, ou double-clique sur la piste.'
            )}
          </p>
        )}
      </div>

      {selected && (
        <KeyInspector
          editor={editor}
          clip={clip}
          selection={selected}
          onSelect={select}
          seek={seek}
        />
      )}
    </div>
  )
}
