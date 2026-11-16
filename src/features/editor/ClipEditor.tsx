import {
  resolveFaceName,
  type ClipDefinition,
  type ClipEase,
  type ClipFaceKey,
  type ClipKey,
  MAX_EYE_SIZE,
  MIN_EYE_SIZE,
} from '@bible-strong/avatar-core'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Keyboard,
  MoveHorizontal,
  PanelBottom,
  PanelBottomClose,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { ClipSheet } from '@/features/editor/ClipSheet'
import { DraftBanner } from '@/features/editor/DraftBanner'
import { EaseEditor } from '@/features/editor/EaseEditor'
import type { ClipRef } from '@/features/editor/useClipLibrary'
import {
  clampView,
  followView,
  fullView,
  isFullView,
  MIN_VIEW_SECONDS,
  panView,
  shareOf,
  tickStep,
  tickTimes,
  timeOfShare,
  zoomView,
  type TimelineView,
} from '@/features/editor/timelineView'
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
  eyeSize: { step: 0.01, min: MIN_EYE_SIZE, max: MAX_EYE_SIZE },
  opacity: { step: 0.01, min: 0, max: 1 },
}

const surface = 'rounded-2xl border border-border bg-card shadow-[0_4px_14px_rgb(24_28_35/5%)]'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
/** A control that takes the arrows and the space bar for itself. */
const takesKeys = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest('[role=slider],[role=listbox],[role=option],[role=menu],[role=combobox]')

/** The keys of the timeline, as the help lists them; words among the keys are translated. */
const shortcuts: readonly { keys: string[]; label: string }[] = [
  { keys: ['Espace'], label: 'Lecture / pause' },
  { keys: ['←', '→'], label: 'Une image avant / après' },
  { keys: ['⇧←', '⇧→'], label: 'Une seconde avant / après' },
  { keys: [',', '.'], label: 'Clé précédente / suivante' },
  { keys: ['Début', 'Fin'], label: 'Début / fin du clip' },
  { keys: ['L'], label: 'Boucle' },
  { keys: ['K'], label: 'Ajouter une clé à la tête de lecture' },
  { keys: ['⌥←', '⌥→'], label: 'Déplacer la clé choisie d’une image' },
  { keys: ['Suppr'], label: 'Supprimer la clé choisie' },
  { keys: ['Échap'], label: 'Désélectionner la clé' },
  { keys: ['+', '−'], label: 'Zoomer / dézoomer' },
  { keys: ['F'], label: 'Tout voir' },
  { keys: ['⌘ + molette'], label: 'Zoomer sous le pointeur' },
  { keys: ['⌘Z', '⇧⌘Z'], label: 'Annuler / rétablir' },
  { keys: ['?'], label: 'Cette aide' },
]
const wordKeys = new Set(['Espace', 'Début', 'Fin', 'Suppr', 'Échap', '⌘ + molette'])

const download = (clip: ClipDefinition) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([clipFileText(clip)], { type: 'application/json' }))
  link.download = clipFileName(clip)
  link.click()
  URL.revokeObjectURL(link.href)
}

function ClipSettings({
  editor,
  clip,
  clipRef,
}: {
  editor: Editor
  clip: ClipDefinition
  clipRef: ClipRef
}) {
  const { t, clipLibrary, setDoing, setPlaying } = editor
  const isDraft = 'draft' in clipRef
  const [name, setName] = useState(clip.name)
  const [leaving, setLeaving] = useState<'delete' | 'discard' | null>(null)
  useEffect(() => setName(clip.name), [clip.name])
  // A draft opened from a saved clip may keep that clip's name: saving puts it in its place.
  const source = isDraft ? clipLibrary.draft?.source : undefined
  const others = clipLibrary.clips.filter(item => item.name !== source)
  const problem = clipNameProblem(name, others, clip.name)
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
    clipLibrary.update(clipRef, renameClip(clip, next))
    setDoing(isDraft ? { clip: next, draft: true } : { clip: next })
  }
  const update = (next: ClipDefinition, tag: string) => clipLibrary.update(clipRef, next, tag)
  const openSaved = (saved: string | null) => {
    if (!saved) return
    setPlaying(false)
    setDoing({ clip: saved })
  }
  const openDraft = (opened: string | null) => {
    if (!opened) return
    setPlaying(false)
    setDoing({ clip: opened, draft: true })
  }

  return (
    <div className={`${surface} @container flex flex-col gap-3 p-3`}>
      {isDraft && (
        <DraftBanner
          note={source ? `${t('Enregistrer remplace')} ${source}.` : undefined}
          saveLabel="Enregistrer dans mes clips"
          onSave={() => openSaved(clipLibrary.saveDraft())}
        />
      )}
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
          {!isDraft && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              title={t('Ouvrir une copie de travail dans l’adresse, pour la donner à un agent')}
              onClick={() => openDraft(clipLibrary.edit(clip.name))}
            >
              <Pencil /> {t('Brouillon')}
            </Button>
          )}
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
            onClick={() =>
              openDraft(clipLibrary.duplicate(clip.name, `${clip.name} ${t('copie')}`, isDraft))
            }
          >
            <Copy />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            aria-label={t(isDraft ? 'Abandonner le brouillon' : 'Supprimer le clip')}
            title={t(isDraft ? 'Abandonner le brouillon' : 'Supprimer le clip')}
            onClick={() => setLeaving(isDraft ? 'discard' : 'delete')}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <AlertDialog open={leaving !== null} onOpenChange={open => !open && setLeaving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {leaving === 'discard'
                ? t('Abandonner le brouillon ?')
                : `${t('Supprimer')} ${clip.name} ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                leaving === 'discard'
                  ? 'Le brouillon disparaît de la page. Exporte-le d’abord pour en garder une copie.'
                  : 'Le clip est retiré de tes clips. Exporte-le d’abord pour en garder une copie.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Garder')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leaving === 'discard') clipLibrary.discardDraft()
                else clipLibrary.remove(clip.name)
                setLeaving(null)
                setDoing({ state: 'idle' })
                setPlaying(true)
              }}
            >
              {t(leaving === 'discard' ? 'Abandonner' : 'Supprimer')}
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
  clipRef,
  selection,
  onSelect,
  seek,
}: {
  editor: Editor
  clip: ClipDefinition
  clipRef: ClipRef
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
    clipLibrary.update(clipRef, next, `${track}-${tag}`)
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
            clipLibrary.update(clipRef, deleteClipKey(clip, track, index))
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
                    clipRef,
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

export function ClipEditor({
  editor,
  clip,
  clipRef,
}: {
  editor: Editor
  clip: ClipDefinition
  /** The draft, or the saved custom clip being edited. */
  clipRef: ClipRef
}) {
  const { t, clipLibrary, engine } = editor
  const sheet = clipLibrary.view.view === 'frames'
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
  const duration = clip.duration
  // The window of the clip the timeline shows; `null` shows it whole, whatever its length.
  const [zoom, setZoom] = useState<TimelineView | null>(null)
  const view = zoom ? clampView(zoom, duration) : fullView(duration)
  const span = view.end - view.start
  const setView = (next: TimelineView) => setZoom(isFullView(next, duration) ? null : next)
  const viewRef = useRef(view)
  viewRef.current = view
  const across = (time: number) => `${shareOf(view, time) * 100}%`
  // The timeline sits in the panel, or across the bottom of the page under the stage.
  const dock = editor.timelineDock
  const docked = editor.timelineDocked && dock !== null
  const [area, setArea] = useState<HTMLDivElement | null>(null)
  const overview = useRef<HTMLDivElement>(null)
  const overviewDrag = useRef<{
    mode: 'move' | 'start' | 'end'
    x: number
    from: TimelineView
  } | null>(null)
  /** Seek, and bring the time into the window if it is outside. */
  const seekShown = (time: number) => {
    seek(time)
    if (zoom) setView(followView(view, time, duration))
  }
  const zoomBy = (factor: number) => {
    const now = playheadTime()
    const about = now >= view.start && now <= view.end ? now : (view.start + view.end) / 2
    setView(zoomView(view, factor, about, duration))
  }

  // A key the history took away is no longer picked.
  const selected = selection && clip.tracks[selection.track]?.[selection.index] ? selection : null
  const curveTrack = selected && selected.track !== 'expression' ? selected.track : (shown ?? null)

  const timeAt = (clientX: number) => {
    const box = lane.current!.getBoundingClientRect()
    return timeOfShare(view, Math.max(0, Math.min(1, (clientX - box.left) / (box.width || 1))))
  }
  /** Where a key dragged to a time lands: on a time worth landing on when it is close. */
  const snap = (time: number, track: TrackName, free: boolean) => {
    if (free) return time
    const width = lane.current?.getBoundingClientRect().width || 1
    const reach = (SNAP_PIXELS / width) * span
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
    clipLibrary.update(clipRef, added.clip)
    select({ track, index: added.index })
    seek(added.clip.tracks[track]![added.index].t)
  }
  const playheadTime = () =>
    engine.current.player.clip?.name === clip.name ? engine.current.player.time : 0

  const [help, setHelp] = useState(false)
  const fps = clipLibrary.view.fps
  /** The time a frame before or after this one, on the grid of the sheet's frames. */
  const frameFrom = (time: number, by: 1 | -1) =>
    by > 0 ? (Math.floor(time * fps + 1e-6) + 1) / fps : (Math.ceil(time * fps - 1e-6) - 1) / fps
  /** The key before or after the playhead: on the picked or shown track, else on any. */
  const keyFrom = (time: number, by: 1 | -1) => {
    const track = selected?.track ?? shown
    const keys = (track ? [track] : trackOrder).flatMap(name =>
      (clip.tracks[name] ?? []).map((key, index) => ({ track: name, index, t: key.t }))
    )
    const ahead = keys
      .filter(key => (by > 0 ? key.t > time + 1e-4 : key.t < time - 1e-4))
      .sort((a, b) => (a.t - b.t) * by)
    return ahead[0] ?? null
  }

  // Keys of the keyboard: play, walk the clip, pick and move keys, zoom, undo and redo.
  const keyboard = useRef<(event: KeyboardEvent) => void>(() => {})
  keyboard.current = event => {
    if (isTyping(event.target) || help) return
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
    const arrow = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (arrow && takesKeys(event.target)) return
    if (arrow && event.altKey && !command && selected) {
      event.preventDefault()
      const key = clip.tracks[selected.track]![selected.index]
      const moved = moveClipKey(clip, selected.track, selected.index, frameFrom(key.t, arrow))
      clipLibrary.update(clipRef, moved.clip)
      select({ track: selected.track, index: moved.index })
      seekShown(moved.clip.tracks[selected.track]![moved.index].t)
      return
    }
    if (command || event.altKey) return
    if (arrow) {
      event.preventDefault()
      const now = playheadTime()
      seekShown(event.shiftKey ? now + arrow : frameFrom(now, arrow))
      return
    }
    if (event.key === ' ' && !takesKeys(event.target)) {
      event.preventDefault()
      toggle()
      return
    }
    if (event.key === ',' || event.key === '.') {
      const key = keyFrom(playheadTime(), event.key === '.' ? 1 : -1)
      if (key) {
        if (selected?.track === key.track || shown === key.track) {
          select({ track: key.track, index: key.index })
        }
        seekShown(key.t)
      }
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      seekShown(event.key === 'Home' ? 0 : duration)
      return
    }
    if (event.key.toLowerCase() === 'l') setLoops(!loops)
    if (event.key === 'Escape' && selected) select(null)
    if (event.key === '?') setHelp(true)
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
      event.preventDefault()
      const count = clip.tracks[selected.track]!.length
      clipLibrary.update(clipRef, deleteClipKey(clip, selected.track, selected.index))
      select(count > 1 ? { ...selected, index: Math.max(0, selected.index - 1) } : null)
      return
    }
    if (event.key.toLowerCase() === 'k') {
      const track = selected?.track ?? shown
      if (track) addKey(track, playheadTime())
    }
    // The window: closer, further, or the whole clip.
    if (event.key === '+' || event.key === '=') zoomBy(0.5)
    if (event.key === '-' || event.key === '_') zoomBy(2)
    if (event.key.toLowerCase() === 'f') setZoom(null)
  }

  // Zoomed, the window turns its page as the clip plays past it.
  const zoomed = zoom !== null
  useEffect(() => {
    if (!zoomed) return
    let request = 0
    const tick = () => {
      const player = engine.current.player
      if (player.playing && player.clip?.name === clip.name && !player.join) {
        const next = followView(viewRef.current, player.time, clip.duration)
        if (next !== viewRef.current) setZoom(next)
      }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [zoomed, clip, engine])

  // A pinch, or the wheel with Command or Control, zooms about the pointer; a sideways scroll
  // moves the window along the clip. Listened to natively, to keep the page from scrolling.
  const wheel = useRef<(event: WheelEvent) => void>(() => {})
  wheel.current = event => {
    const box = lane.current?.getBoundingClientRect()
    if (!box) return
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const about = timeOfShare(
        view,
        Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
      )
      setView(zoomView(view, Math.exp(event.deltaY * 0.01), about, duration))
      return
    }
    const sideways = event.shiftKey ? event.deltaY : event.deltaX
    if (zoom && Math.abs(sideways) > Math.abs(event.shiftKey ? 0 : event.deltaY)) {
      event.preventDefault()
      setView(panView(view, (sideways / (box.width || 1)) * span, duration))
    }
  }
  useEffect(() => {
    if (!area) return
    const listener = (event: WheelEvent) => wheel.current(event)
    area.addEventListener('wheel', listener, { passive: false })
    return () => area.removeEventListener('wheel', listener)
  }, [area])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyboard.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const laneArea = 'absolute inset-y-0 right-2.5 left-2.5'
  const playhead = (
    <span
      className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ring"
      style={{ left: 'calc((var(--at, 0) - var(--vs, 0)) / var(--vw, 1) * 100%)' }}
    />
  )
  const ticks = tickTimes(view, tickStep(view, docked ? 16 : 6))
  const allKeys = trackOrder.flatMap(track =>
    (clip.tracks[track] ?? []).map(key => ({ t: key.t, color: trackMeta[track].color }))
  )

  const timelineCard = (
    <div
      className={`${surface} group flex flex-col gap-3 p-3${docked ? ' h-full rounded-none border-0 shadow-none' : ''}`}
      ref={root}
      data-joining="false"
      data-timeline
      style={
        {
          '--label': '6.5rem',
          '--vs': view.start / duration,
          '--vw': span / duration,
        } as CSSProperties
      }
    >
      <div
        className="grid grid-cols-2 rounded-xl bg-muted p-1"
        role="group"
        aria-label={t('Affichage du clip')}
      >
        {(['timeline', 'frames'] as const).map(mode => (
          <button
            type="button"
            className={`h-7 rounded-lg text-xs font-semibold ${
              clipLibrary.view.view === mode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={clipLibrary.view.view === mode}
            key={mode}
            onClick={() => clipLibrary.setView({ ...clipLibrary.view, view: mode })}
          >
            {t(mode === 'timeline' ? 'Timeline' : 'Planche')}
          </button>
        ))}
      </div>
      <ClipTransport
        editor={editor}
        clock={clock}
        toggle={toggle}
        seek={seek}
        loops={loops}
        setLoops={setLoops}
      >
        {!sheet && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label={t('Dézoomer')}
              title={`${t('Dézoomer')} (−)`}
              disabled={!zoom}
              onClick={() => zoomBy(2)}
            >
              <ZoomOut />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label={t('Zoomer')}
              title={`${t('Zoomer')} (+, ⌘ + molette)`}
              disabled={span <= MIN_VIEW_SECONDS + 1e-6}
              onClick={() => zoomBy(0.5)}
            >
              <ZoomIn />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label={t('Tout voir')}
              title={`${t('Tout voir')} (F)`}
              disabled={!zoom}
              onClick={() => setZoom(null)}
            >
              <MoveHorizontal />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Raccourcis clavier')}
          title={`${t('Raccourcis clavier')} (?)`}
          onClick={() => setHelp(true)}
        >
          <Keyboard />
        </Button>
        {dock && (
          <Button
            variant={docked ? 'secondary' : 'ghost'}
            size="icon-sm"
            type="button"
            aria-pressed={docked}
            aria-label={t(docked ? 'Remettre la timeline dans le panneau' : 'Agrandir la timeline')}
            title={t(docked ? 'Remettre la timeline dans le panneau' : 'Agrandir la timeline')}
            onClick={() => editor.setTimelineDocked(!docked)}
          >
            {docked ? <PanelBottomClose /> : <PanelBottom />}
          </Button>
        )}
      </ClipTransport>

      {sheet ? (
        <ClipSheet
          editor={editor}
          clip={clip}
          fps={clipLibrary.view.fps}
          onFps={fps => clipLibrary.setView({ ...clipLibrary.view, fps })}
          onPick={seek}
        />
      ) : (
        <>
          <div
            className="flex touch-none flex-col gap-1 select-none"
            ref={setArea}
            onPointerDown={event => {
              if ((event.target as HTMLElement).closest('[data-still]')) return
              // A double press on a lane adds a key there. The scrub captures the pointer, which
              // takes the browser's own double click away from the lane.
              const track = (event.target as HTMLElement).closest<HTMLElement>('[data-lane]')
                ?.dataset.lane as TrackName | undefined
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
              <div className="relative h-6 overflow-x-clip">
                <div className={laneArea} ref={lane}>
                  {ticks.map(time => {
                    const share = shareOf(view, time)
                    return (
                      <span
                        className={`absolute bottom-0 text-[0.6rem] whitespace-nowrap text-muted-foreground tabular-nums ${
                          share < 0.04
                            ? ''
                            : share > 0.96
                              ? '-translate-x-full'
                              : '-translate-x-1/2'
                        }`}
                        style={{ left: `${share * 100}%` }}
                        key={time}
                      >
                        {seconds(time)}
                      </span>
                    )
                  })}
                  <span
                    className="pointer-events-none absolute -top-1 h-2.5 w-px bg-secondary-foreground/60"
                    style={{ left: across(clip.workArea?.start ?? 0) }}
                    title={t('Pose de repos')}
                  />
                  <span
                    className="pointer-events-none absolute -bottom-1 size-2 -translate-x-1/2 rotate-45 bg-ring"
                    style={{ left: 'calc((var(--at, 0) - var(--vs, 0)) / var(--vw, 1) * 100%)' }}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[var(--label)_1fr] items-center" data-still>
              <span className="pl-1 text-[0.6rem] text-muted-foreground tabular-nums">
                {zoom ? `${seconds(view.start)} – ${seconds(view.end)}` : ''}
              </span>
              <div
                className="relative mx-2.5 h-3.5 cursor-pointer rounded-full bg-muted"
                ref={overview}
                aria-label={t('Aperçu du clip')}
                data-overview
                onPointerDown={event => {
                  const box = overview.current!.getBoundingClientRect()
                  const time = ((event.clientX - box.left) / (box.width || 1)) * duration
                  const edge = (8 / (box.width || 1)) * duration
                  const mode =
                    Math.abs(time - view.start) < edge && zoom
                      ? 'start'
                      : Math.abs(time - view.end) < edge && zoom
                        ? 'end'
                        : 'move'
                  let from = view
                  if (mode === 'move' && (time < view.start || time > view.end)) {
                    // A press outside the window brings it there.
                    from = panView(view, time - (view.start + view.end) / 2, duration)
                    setView(from)
                  }
                  overviewDrag.current = { mode, x: event.clientX, from }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={event => {
                  const drag = overviewDrag.current
                  if (!drag) return
                  const box = overview.current!.getBoundingClientRect()
                  const by = ((event.clientX - drag.x) / (box.width || 1)) * duration
                  if (drag.mode === 'move') setView(panView(drag.from, by, duration))
                  else if (drag.mode === 'start') {
                    setView(
                      clampView(
                        {
                          start: Math.min(drag.from.start + by, drag.from.end - MIN_VIEW_SECONDS),
                          end: drag.from.end,
                        },
                        duration
                      )
                    )
                  } else {
                    setView(
                      clampView(
                        {
                          start: drag.from.start,
                          end: Math.max(drag.from.end + by, drag.from.start + MIN_VIEW_SECONDS),
                        },
                        duration
                      )
                    )
                  }
                }}
                onPointerUp={() => (overviewDrag.current = null)}
                onPointerCancel={() => (overviewDrag.current = null)}
              >
                {allKeys.map((key, index) => (
                  <span
                    className="pointer-events-none absolute top-1/2 h-1.5 w-px -translate-y-1/2 opacity-70"
                    style={{ left: `${(key.t / duration) * 100}%`, background: key.color }}
                    key={index}
                  />
                ))}
                <span
                  className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ring"
                  style={{ left: 'calc(var(--at, 0) * 100%)' }}
                />
                <span
                  className={`absolute inset-y-0 rounded-full ring-1 ring-ring ${zoom ? 'cursor-grab bg-ring/20' : 'bg-transparent'}`}
                  style={{
                    left: `${(view.start / duration) * 100}%`,
                    width: `${(span / duration) * 100}%`,
                  }}
                >
                  {zoom && (
                    <>
                      <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-full bg-ring/50" />
                      <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-full bg-ring/50" />
                    </>
                  )}
                </span>
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
                    className={`relative h-7 cursor-ew-resize overflow-hidden rounded-md ${
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
                            style={{ left: across(key.t) }}
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
                              clipLibrary.update(clipRef, moved.clip, `drag-${track}`)
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
                  view={view}
                  selected={selected?.track === curveTrack ? selected.index : null}
                  key={part}
                  onPick={index => {
                    select({ track: curveTrack, index })
                    seekShown(clip.tracks[curveTrack]![index].t)
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
        </>
      )}
    </div>
  )

  return (
    <div className="panel-stack" style={{ ['--label' as string]: '6.5rem' }}>
      <ClipSettings editor={editor} clip={clip} clipRef={clipRef} />

      {docked ? createPortal(timelineCard, dock!) : timelineCard}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent style={{ width: 'min(460px, calc(100vw - 32px))' }}>
          <DialogHeader>
            <DialogTitle>{t('Raccourcis clavier')}</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2 overflow-y-auto px-7 py-5 text-sm">
            {shortcuts.map(shortcut => (
              <div className="contents" key={shortcut.label}>
                <dt className="flex gap-1">
                  {shortcut.keys.map(key => (
                    <kbd
                      className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]"
                      key={key}
                    >
                      {wordKeys.has(key) ? t(key) : key}
                    </kbd>
                  ))}
                </dt>
                <dd className="text-muted-foreground">{t(shortcut.label)}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
      {docked && (
        <div
          className={`${surface} flex items-center justify-between gap-2 p-3 text-xs text-muted-foreground`}
        >
          {t('La timeline est en bas, sous la scène.')}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => editor.setTimelineDocked(false)}
          >
            <PanelBottomClose /> {t('La remettre ici')}
          </Button>
        </div>
      )}

      {selected && !sheet && (
        <KeyInspector
          editor={editor}
          clip={clip}
          clipRef={clipRef}
          selection={selected}
          onSelect={select}
          seek={seekShown}
        />
      )}
    </div>
  )
}
