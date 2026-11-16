import {
  advanceEngine,
  createAvatarEngine,
  engineFrame,
  faceNames,
  faces as builtInFaces,
  flattenPath,
  renderCharacterFrame,
  setEngineFace,
  settlePlayerFace,
  type AvatarCharacter,
  type CompiledFace,
  type FaceDefinition,
  type FaceMark,
  type FaceName,
  type StrokeCap,
  type StrokeJoin,
} from '@bible-strong/avatar-core'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Code,
  Copy,
  Download,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

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
import { SectionCombobox } from '@/components/ui/section-combobox'
import { Switch } from '@/components/ui/switch'
import { characterViews } from '@/features/editor/CharacterSheet'
import { LinkProblemNote } from '@/features/editor/ClipExplorer'
import { NumericField } from '@/features/editor/controls'
import { DraftBanner } from '@/features/editor/DraftBanner'
import {
  builtInFaceAsDrawn,
  eyeSvgText,
  faceFileName,
  faceFileText,
  faceNameProblem,
  isBuiltInFaceName,
  marksFromSvgText,
} from '@/features/editor/faceLibrary'
import { restFrameWithFace } from '@/features/editor/CharacterPreview'
import { Scene } from '@/features/editor/Scene'
import type { ClipRef } from '@/features/editor/useClipLibrary'
import type { Editor } from '@/features/editor/useEditor'

// The Faces tab: the built-in faces, the drawn ones, and the editor of a drawn face. A drawn eye
// is a few marks on an artboard of 100 by 100, as in a vector tool; the sheet shows the face from
// every side, small, blinking, and coming and going, which is what to check in one screenshot.

const surface = 'rounded-2xl border border-border bg-card shadow-[0_4px_14px_rgb(24_28_35/5%)]'

const download = (name: string, text: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

/** A choice among a few, pressed when chosen. */
function Choices<Value extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string
  value: Value
  options: readonly { value: Value; label: string }[]
  onPick: (value: Value) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] font-semibold text-muted-foreground">{label}</span>
      <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label={label}>
        {options.map(option => (
          <button
            type="button"
            className={`h-6 flex-1 rounded-md px-1.5 text-[0.65rem] font-semibold ${
              value === option.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={value === option.value}
            key={option.value}
            onClick={() => onPick(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The built-in neutral eye on the artboard, dashed behind the marks, for the size of an eye. */
const NEUTRAL_GUIDE =
  'M50 26.5A21.5 21.5 0 0 1 71.5 48V52A21.5 21.5 0 0 1 28.5 52V48A21.5 21.5 0 0 1 50 26.5Z'

/** What is wrong with path data, or `null`. */
const pathProblem = (data: string) => {
  try {
    return flattenPath(data).length ? null : 'draws nothing'
  } catch (error) {
    return (error as Error).message
  }
}

function Artboard({
  marks,
  selected,
  onSelect,
  label,
}: {
  marks: readonly FaceMark[]
  selected: number | null
  onSelect: (index: number) => void
  label: string
}) {
  const lines = Array.from({ length: 9 }, (_, index) => (index + 1) * 10)
  return (
    <svg
      viewBox="-4 -4 108 108"
      className="aspect-square w-full max-w-64 rounded-xl bg-muted text-foreground"
      role="img"
      aria-label={label}
      data-artboard
    >
      <rect x={0} y={0} width={100} height={100} fill="white" />
      {lines.map(at => (
        <g key={at} stroke="#e4e7ec" strokeWidth={0.3}>
          <line x1={at} y1={0} x2={at} y2={100} />
          <line x1={0} y1={at} x2={100} y2={at} />
        </g>
      ))}
      <path d="M50 46V54M46 50H54" stroke="#9aa1ad" strokeWidth={0.5} />
      <path
        d={NEUTRAL_GUIDE}
        fill="none"
        stroke="#9aa1ad"
        strokeWidth={0.6}
        strokeDasharray="2 2"
      />
      {marks.map((mark, index) => (
        <path
          key={index}
          d={pathProblem(mark.d) ? '' : mark.d}
          fill={mark.fill === false ? 'none' : 'currentColor'}
          fillRule={mark.fillRule ?? 'nonzero'}
          stroke={mark.stroke ? 'currentColor' : 'none'}
          strokeWidth={mark.stroke?.width ?? 0}
          strokeLinecap={mark.stroke?.cap ?? 'butt'}
          strokeLinejoin={mark.stroke?.join ?? 'miter'}
          className="cursor-pointer"
          onClick={() => onSelect(index)}
        />
      ))}
      {selected !== null && marks[selected] && !pathProblem(marks[selected].d) && (
        <path
          d={marks[selected].d}
          fill="none"
          stroke="#5b7fe5"
          strokeWidth={0.8}
          strokeDasharray="2 1.5"
          pointerEvents="none"
        />
      )}
    </svg>
  )
}

const capOptions: { value: StrokeCap; label: string }[] = [
  { value: 'round', label: 'Rond' },
  { value: 'butt', label: 'Net' },
  { value: 'square', label: 'Carré' },
]
const joinOptions: { value: StrokeJoin; label: string }[] = [
  { value: 'round', label: 'Rond' },
  { value: 'miter', label: 'Pointu' },
  { value: 'bevel', label: 'Coupé' },
]

/** One eye of a drawn face: its artboard, its marks, and the SVG they are. */
function EyeEditor({
  editor,
  title,
  marks,
  onChange,
}: {
  editor: Editor
  title: string
  marks: FaceMark[]
  /** `tag` groups a burst of changes into one step of the history. */
  onChange: (marks: FaceMark[], tag?: string) => void
}) {
  const { t } = editor
  const [selected, setSelected] = useState<number | null>(marks.length ? 0 : null)
  const [code, setCode] = useState<string | null>(null)
  const [codeNote, setCodeNote] = useState<string | null>(null)
  const [pathDraft, setPathDraft] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const chosen = selected !== null ? marks[selected] : undefined
  useEffect(() => setPathDraft(null), [selected])

  const change = (index: number, next: FaceMark, tag?: string) =>
    onChange(
      marks.map((mark, at) => (at === index ? next : mark)),
      tag
    )
  const takeSvg = (text: string) => {
    const read = marksFromSvgText(text)
    if (!read.marks) {
      setCodeNote(`${t('Ce SVG ne se lit pas')} : ${read.problem}`)
      return false
    }
    onChange(read.marks)
    setSelected(0)
    setCodeNote(read.ignored.length ? `${t('Ignoré')} : ${read.ignored.join(', ')}` : null)
    return true
  }

  return (
    <div className="flex flex-col gap-2" data-eye-editor={title}>
      <p className="eyebrow">{t(title)}</p>
      <div className="grid gap-3 @md:grid-cols-[minmax(0,16rem)_1fr]">
        <Artboard
          marks={marks}
          selected={selected}
          onSelect={setSelected}
          label={`${t('Plan de travail')} · ${t(title)}`}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            {marks.map((mark, index) => (
              <div
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                  selected === index
                    ? 'bg-secondary text-secondary-foreground ring-1 ring-ring'
                    : 'bg-muted'
                }`}
                key={index}
              >
                <button
                  type="button"
                  className="flex-1 truncate text-left font-semibold"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                >
                  {t('Tracé')} {index + 1}
                  <span className="ml-1.5 font-normal opacity-70">
                    {[
                      mark.fill !== false ? t('rempli') : null,
                      mark.stroke ? `${t('contour')} ${mark.stroke.width}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={t('Monter le tracé')}
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...marks]
                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                    onChange(next)
                    setSelected(index - 1)
                  }}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={t('Descendre le tracé')}
                  disabled={index === marks.length - 1}
                  onClick={() => {
                    const next = [...marks]
                    ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                    onChange(next)
                    setSelected(index + 1)
                  }}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={t('Supprimer le tracé')}
                  disabled={marks.length === 1}
                  onClick={() => {
                    onChange(marks.filter((_, at) => at !== index))
                    setSelected(Math.max(0, index - 1))
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                onChange([...marks, { d: 'M50 30A20 20 0 1 0 50 70A20 20 0 1 0 50 30Z' }])
                setSelected(marks.length)
              }}
            >
              <Plus /> {t('Tracé')}
            </Button>
            <Button
              variant={code !== null ? 'secondary' : 'ghost'}
              size="sm"
              type="button"
              aria-pressed={code !== null}
              onClick={() => {
                setCode(code === null ? eyeSvgText(marks) : null)
                setCodeNote(null)
              }}
            >
              <Code /> {t('Code SVG')}
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => file.current?.click()}>
              <Upload /> {t('Importer un .svg')}
            </Button>
            <input
              ref={file}
              className="hidden"
              type="file"
              accept="image/svg+xml,.svg"
              aria-label={`${t('Importer un .svg')} · ${t(title)}`}
              onChange={async event => {
                const picked = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (picked) takeSvg(await picked.text())
              }}
            />
          </div>
          {codeNote && <p className="text-[0.7rem] text-muted-foreground">{codeNote}</p>}
        </div>
      </div>

      {code !== null && (
        <div className="flex flex-col gap-1.5">
          <textarea
            className="min-h-40 w-full rounded-lg border border-input bg-background p-2 font-mono text-[0.7rem] leading-relaxed"
            aria-label={`${t('Code SVG')} · ${t(title)}`}
            spellCheck={false}
            value={code}
            onChange={event => setCode(event.currentTarget.value)}
          />
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setCode(eyeSvgText(marks))}
            >
              {t('Rétablir')}
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                if (takeSvg(code)) setCode(null)
              }}
            >
              {t('Appliquer le SVG')}
            </Button>
          </div>
        </div>
      )}

      {chosen && selected !== null && (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-2.5" data-mark={selected + 1}>
          <label className="flex flex-col gap-1">
            <span className="text-[0.65rem] font-semibold text-muted-foreground">
              {t('Tracé')} {selected + 1} · d
            </span>
            <textarea
              className="min-h-16 w-full rounded-lg border border-input bg-background p-2 font-mono text-[0.7rem]"
              aria-label={`${t('Tracé')} ${selected + 1} · d`}
              aria-invalid={pathDraft !== null && pathProblem(pathDraft) !== null}
              spellCheck={false}
              value={pathDraft ?? chosen.d}
              onChange={event => {
                const value = event.currentTarget.value
                setPathDraft(value)
                if (!pathProblem(value)) change(selected, { ...chosen, d: value }, `d-${selected}`)
              }}
              onBlur={() => setPathDraft(null)}
            />
            {pathDraft !== null && pathProblem(pathDraft) && (
              <span className="text-[0.7rem] text-destructive">{pathProblem(pathDraft)}</span>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold">
              <Switch
                checked={chosen.fill !== false}
                aria-label={t('Remplir')}
                onCheckedChange={on => {
                  const next = { ...chosen }
                  if (on) delete next.fill
                  else next.fill = false
                  change(selected, next)
                }}
              />
              {t('Remplir')}
            </label>
            {chosen.fill !== false && (
              <label className="flex items-center gap-2 text-xs font-semibold">
                <Switch
                  checked={chosen.fillRule === 'evenodd'}
                  aria-label={t('Trous en pair-impair')}
                  onCheckedChange={on => {
                    const next = { ...chosen }
                    if (on) next.fillRule = 'evenodd'
                    else delete next.fillRule
                    change(selected, next)
                  }}
                />
                {t('Trous en pair-impair')}
              </label>
            )}
          </div>
          <NumericField
            label="Contour"
            value={chosen.stroke?.width ?? 0}
            min={0}
            max={60}
            step={0.5}
            onChange={width => {
              const next = { ...chosen }
              if (width > 0) next.stroke = { cap: 'round', join: 'round', ...chosen.stroke, width }
              else delete next.stroke
              change(selected, next, `stroke-${selected}`)
            }}
          />
          {chosen.stroke && (
            <div className="grid grid-cols-2 gap-2">
              <Choices
                label={t('Bouts')}
                value={chosen.stroke.cap ?? 'butt'}
                options={capOptions.map(option => ({ ...option, label: t(option.label) }))}
                onPick={cap => change(selected, { ...chosen, stroke: { ...chosen.stroke!, cap } })}
              />
              <Choices
                label={t('Angles')}
                value={chosen.stroke.join ?? 'miter'}
                options={joinOptions.map(option => ({ ...option, label: t(option.label) }))}
                onPick={join =>
                  change(selected, { ...chosen, stroke: { ...chosen.stroke!, join } })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// The views of the sheet, the face at every size worth checking, and the moments of a blink.
const SMALL_SIZES = [40, 24] as const
const BLINK_LIDS = [0, 0.35, 0.7, 1] as const
const CELL_VIEW = '-190 -190 380 380'
// The face comes from neutral and gives way to happy, at this rate.
const SWAP_FPS = 30

function Cell({
  character,
  frame,
  label,
  size,
  data,
}: {
  character: AvatarCharacter
  frame: Parameters<typeof renderCharacterFrame>[1]
  label: string
  size?: number
  data: Record<string, string>
}) {
  return (
    <span className="flex flex-col items-center gap-0.5 rounded-md bg-muted p-1" {...data}>
      <span
        className="relative aspect-square overflow-hidden rounded-sm"
        style={size ? { width: size } : { width: '100%' }}
      >
        <Scene
          scene={renderCharacterFrame(character, frame)}
          character={character}
          viewBox={CELL_VIEW}
          className="absolute inset-0 size-full"
        />
      </span>
      <span className="max-w-full truncate text-[0.6rem] font-semibold tabular-nums">{label}</span>
    </span>
  )
}

/** The frames of the face coming from `neutral` and giving way to `happy`, as on an avatar. */
const swapFrames = (face: string, drawn: Readonly<Record<string, CompiledFace>>) => {
  const engine = createAvatarEngine({ seed: 1, faces: drawn })
  settlePlayerFace(engine.player)
  const frames: { time: number; frame: ReturnType<typeof engineFrame>; to: string }[] = []
  for (const to of [face, face === 'happy' ? 'neutral' : 'happy']) {
    setEngineFace(engine, to)
    for (let step = 0; step < 0.4 * SWAP_FPS; step += 1) {
      advanceEngine(engine, 1 / SWAP_FPS)
      frames.push({ time: (frames.length + 1) / SWAP_FPS, frame: engineFrame(engine), to })
    }
  }
  return frames
}

/** The sheet of a face: from every side, small, blinking, and coming and going. */
export function FaceSheet({
  editor,
  face,
  drawn,
}: {
  editor: Editor
  face: string
  drawn: Readonly<Record<string, CompiledFace>>
}) {
  const { t, character } = editor
  if (!character) return null
  const rest = restFrameWithFace(face, drawn)
  const blinks = drawn[face]?.blinks ?? builtInFaces[face as FaceName]?.blinks ?? true
  return (
    <div className="flex flex-col gap-2" data-face-sheet={face}>
      <p className="eyebrow">{t('Planche du visage')}</p>
      <div className="grid grid-cols-4 gap-1">
        {characterViews.map(view => (
          <Cell
            character={character}
            frame={{ ...rest, rotation: view.rotation }}
            label={t(view.label)}
            data={{ 'data-view': view.id }}
            key={view.id}
          />
        ))}
      </div>
      <div className="grid grid-cols-[auto_1fr] items-start gap-3">
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{t('Petite taille')}</p>
          <div className="flex items-end gap-1">
            {SMALL_SIZES.map(size => (
              <Cell
                character={character}
                frame={rest}
                label={`${size} px`}
                size={size}
                data={{ 'data-size': String(size) }}
                key={size}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{t('Clignement')}</p>
          {!blinks && (
            <p className="text-[0.7rem] text-muted-foreground" data-blinks="false">
              {t('Ce visage ne cligne pas : les yeux restent ouverts.')}
            </p>
          )}
          <div className={`grid grid-cols-4 gap-1 ${blinks ? '' : 'hidden'}`}>
            {BLINK_LIDS.map(lids => (
              <Cell
                character={character}
                frame={{ ...rest, lids }}
                label={`${Math.round(lids * 100)} %`}
                data={{ 'data-lids': String(lids) }}
                key={lids}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="eyebrow">
        {t('Changement de visage')} · neutral → {face} → {face === 'happy' ? 'neutral' : 'happy'}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1">
        {swapFrames(face, drawn).map(({ time, frame, to }, index) => (
          <Cell
            character={character}
            frame={frame}
            label={time.toFixed(2)}
            data={{ 'data-step': String(index + 1), 'data-face': frame.face, 'data-to': to }}
            key={index}
          />
        ))}
      </div>
    </div>
  )
}

function FaceEditor({
  editor,
  face,
  faceRef,
  onShow,
}: {
  editor: Editor
  face: FaceDefinition
  faceRef: ClipRef
  /** Show a face by its name: on the stage, and in the tab. */
  onShow: (name: string | null) => void
}) {
  const { t, clipLibrary } = editor
  const isDraft = 'draft' in faceRef
  const [name, setName] = useState(face.name)
  const [leaving, setLeaving] = useState<'delete' | 'discard' | null>(null)
  useEffect(() => setName(face.name), [face.name])
  const source = isDraft ? clipLibrary.faceDraft?.source : undefined
  const others = clipLibrary.faces.filter(item => item.name !== source && item.name !== face.name)
  const problem = faceNameProblem(name, others, face.name)
  const problems = {
    empty: 'Le visage doit avoir un nom.',
    builtIn: 'Ce nom est celui d’un visage intégré.',
    taken: 'Un autre de tes visages porte déjà ce nom.',
  }
  const update = (next: FaceDefinition, tag?: string) => clipLibrary.updateFace(faceRef, next, tag)
  const rename = () => {
    const next = name.trim()
    if (problem || next === face.name) {
      if (problem) setName(face.name)
      return
    }
    update({ ...face, name: next })
    onShow(next)
  }
  const mirrored = face.eyes.right === undefined
  const users = isDraft ? [] : clipLibrary.usersOfFace(face.name)

  return (
    <div className={`${surface} @container flex flex-col gap-3 p-3`} data-face-editor>
      {isDraft && (
        <DraftBanner
          note={source ? `${t('Enregistrer remplace')} ${source}.` : undefined}
          saveLabel="Enregistrer dans mes visages"
          onSave={() => onShow(clipLibrary.saveFaceDraft())}
        />
      )}
      <div className="flex items-center gap-2">
        <Input
          aria-label={t('Nom du visage')}
          aria-invalid={problem !== null}
          value={name}
          className="h-9 flex-1 font-semibold"
          spellCheck={false}
          onChange={event => setName(event.currentTarget.value)}
          onBlur={rename}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setName(face.name)
              event.currentTarget.blur()
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('Annuler')}
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
          disabled={!clipLibrary.canRedo}
          onClick={clipLibrary.redo}
        >
          <Redo2 />
        </Button>
      </div>
      {problem && name.trim() !== face.name && (
        <p className="-mt-1.5 text-xs text-destructive">{t(problems[problem])}</p>
      )}

      <div className="grid gap-2 @md:grid-cols-2">
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>
            <strong className="block">{t('Cligne des yeux')}</strong>
            <span className="text-muted-foreground">
              {t('Les yeux se ferment quand l’avatar cligne.')}
            </span>
          </span>
          <Switch
            checked={face.blinks !== false}
            aria-label={t('Cligne des yeux')}
            onCheckedChange={on => {
              const next = { ...face }
              if (on) delete next.blinks
              else next.blinks = false
              update(next)
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>
            <strong className="block">{t('Œil droit en miroir')}</strong>
            <span className="text-muted-foreground">
              {t('Sinon, l’œil droit se dessine à part.')}
            </span>
          </span>
          <Switch
            checked={mirrored}
            aria-label={t('Œil droit en miroir')}
            onCheckedChange={on => {
              const eyes = { ...face.eyes }
              if (on) delete eyes.right
              else eyes.right = structuredClone(face.eyes.left)
              update({ ...face, eyes })
            }}
          />
        </label>
      </div>
      <NumericField
        label="Sourire de la bouche"
        value={face.smile ?? 0}
        min={-1}
        max={1}
        step={0.05}
        onChange={value => {
          const next = { ...face }
          if (value === 0) delete next.smile
          else next.smile = value
          update(next, 'smile')
        }}
      />

      <EyeEditor
        editor={editor}
        title={mirrored ? 'Les deux yeux' : 'Œil gauche'}
        marks={face.eyes.left}
        onChange={(marks, tag) =>
          update({ ...face, eyes: { ...face.eyes, left: marks } }, tag && `left-${tag}`)
        }
      />
      {!mirrored && (
        <EyeEditor
          editor={editor}
          title="Œil droit"
          marks={face.eyes.right!}
          onChange={(marks, tag) =>
            update({ ...face, eyes: { ...face.eyes, right: marks } }, tag && `right-${tag}`)
          }
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-1">
        {!isDraft && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            title={t('Ouvrir une copie de travail dans l’adresse, pour la donner à un agent')}
            onClick={() => onShow(clipLibrary.editFace(face.name))}
          >
            <Pencil /> {t('Brouillon')}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          type="button"
          title={t('Enregistrer le visage dans un fichier .face.json')}
          onClick={() => download(faceFileName(face), faceFileText(face))}
        >
          <Download /> {t('Exporter')}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          aria-label={t('Dupliquer le visage')}
          title={t('Dupliquer le visage')}
          onClick={() =>
            onShow(clipLibrary.duplicateFace(face.name, `${face.name}-${t('copie')}`, isDraft))
          }
        >
          <Copy />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          aria-label={t(isDraft ? 'Abandonner le brouillon' : 'Supprimer le visage')}
          title={t(isDraft ? 'Abandonner le brouillon' : 'Supprimer le visage')}
          onClick={() => setLeaving(isDraft ? 'discard' : 'delete')}
        >
          <Trash2 />
        </Button>
      </div>
      {users.length > 0 && (
        <p className="text-[0.7rem] text-muted-foreground">
          {t('Nommé par')} : {users.join(', ')}
        </p>
      )}

      <AlertDialog open={leaving !== null} onOpenChange={open => !open && setLeaving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {leaving === 'discard'
                ? t('Abandonner le brouillon ?')
                : `${t('Supprimer')} ${face.name} ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                leaving === 'discard'
                  ? 'Le brouillon disparaît de la page. Exporte-le d’abord pour en garder une copie.'
                  : 'Le visage est retiré de tes visages ; les clips et les états qui le nomment montrent neutral à sa place.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Garder')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leaving === 'discard') clipLibrary.discardFaceDraft()
                else clipLibrary.removeFace(face.name)
                setLeaving(null)
                onShow(null)
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

function Note({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-2 text-xs text-muted-foreground">{children}</p>
}

export function FacesPanel({ editor }: { editor: Editor }) {
  const { t, clipLibrary, setFace, setPlaying } = editor
  const file = useRef<HTMLInputElement>(null)
  const [imported, setImported] = useState<{ problem: string | null; ignored: string[] } | null>(
    null
  )
  const draft = clipLibrary.faceDraft
  // The face shown is the one the stage holds: a link or a pick sets it.
  const name = editor.face ?? draft?.face.name ?? clipLibrary.faces[0]?.name ?? 'neutral'
  const onDraft = draft !== null && draft.face.name === name
  const saved = onDraft ? undefined : clipLibrary.faces.find(face => face.name === name)
  const custom = onDraft ? draft.face : saved
  const builtIn =
    !custom && (faceNames as readonly string[]).includes(name) ? (name as FaceName) : null
  const drawn = clipLibrary.drawnFaces()
  const draftItem = draft ? `${draft.face.name} (${t('brouillon')})` : null

  const show = (shown: string | null) => {
    setFace(shown)
    setPlaying(true)
  }

  return (
    <div className="panel-stack">
      <div className={`${surface} flex flex-col gap-0.5 p-1.5`}>
        <SectionCombobox
          label={t('Visage')}
          value={onDraft ? draftItem : name}
          sections={[
            ...(draftItem ? [{ value: t('Brouillon'), items: [draftItem] }] : []),
            ...(clipLibrary.faces.length
              ? [{ value: t('Mes visages'), items: clipLibrary.faces.map(face => face.name) }]
              : []),
            { value: t('Visages intégrés'), items: [...faceNames] },
          ]}
          detail={item => (isBuiltInFaceName(item) ? undefined : t('dessiné'))}
          placeholder={t('Rechercher un visage…')}
          empty={t('Aucun visage')}
          onPick={item => show(item === draftItem && draft ? draft.face.name : item)}
        />
        <div className="flex flex-wrap items-center gap-1.5 px-1.5 pt-1 pb-1.5">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => show(clipLibrary.createFace(t('visage')))}
          >
            <Plus /> {t('Nouveau visage')}
          </Button>
          {builtIn && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              title={t(
                'Le visage intégré reste tel quel : la copie s’ouvre en brouillon, dessinée.'
              )}
              onClick={() =>
                show(
                  clipLibrary.openFaceDraft(
                    builtInFaceAsDrawn(builtIn, `${builtIn}-${t('dessiné')}`)
                  )
                )
              }
            >
              <Copy /> {t('Dupliquer pour dessiner')}
            </Button>
          )}
          <Button variant="ghost" size="sm" type="button" onClick={() => file.current?.click()}>
            <Upload /> {t('Importer un .svg ou .face.json')}
          </Button>
          <input
            ref={file}
            className="hidden"
            type="file"
            accept="image/svg+xml,.svg,application/json,.json"
            aria-label={t('Importer un .svg ou .face.json')}
            onChange={async event => {
              const chosen = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!chosen) return
              const read = clipLibrary.importFaceFile(await chosen.text(), chosen.name)
              setImported({ problem: read.problem, ignored: read.ignored })
              if (read.name) show(read.name)
            }}
          />
          <a
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            href="./face-authoring.md"
            target="_blank"
            rel="noreferrer"
            title={t('Le format des visages et leur lien, pour les agents qui en dessinent')}
          >
            <BookOpen className="size-3.5" /> {t('Guide')}
          </a>
        </div>
        {imported?.problem && (
          <p className="px-3 pb-2 text-xs text-destructive">
            {t('Ce fichier n’est pas un visage.')} {imported.problem}
          </p>
        )}
        {imported && !imported.problem && imported.ignored.length > 0 && (
          <Note>
            {t('Ignoré')} : {imported.ignored.join(', ')}
          </Note>
        )}
        <LinkProblemNote editor={editor} kind="face" />
      </div>

      {custom && (
        <FaceEditor
          editor={editor}
          face={custom}
          faceRef={onDraft ? { draft: true } : { name: custom.name }}
          onShow={show}
          key={onDraft ? 'draft' : custom.name}
        />
      )}
      {builtIn && (
        <div className={`${surface} p-3`}>
          <p className="text-xs text-muted-foreground">
            {t('Les visages intégrés ne se modifient pas : duplique-le pour le dessiner.')}
            {!builtInFaces[builtIn].blinks && ` ${t('Il ne cligne pas des yeux.')}`}
          </p>
        </div>
      )}
      <div className={`${surface} p-3`}>
        <FaceSheet editor={editor} face={name} drawn={drawn} />
      </div>
    </div>
  )
}
