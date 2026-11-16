import {
  clipNames,
  engineClipOf,
  spinnerOfMode,
  stateGroups,
  renderCharacterFrame,
} from '@bible-strong/avatar-core'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Link2,
  Pencil,
  Play,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

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
import { seconds as secondsText } from '@/features/editor/ClipExplorer'
import { stateFrameRates, type FrameRate } from '@/features/editor/clipLink'
import { NumericField } from '@/features/editor/controls'
import { DraftBanner } from '@/features/editor/DraftBanner'
import { Scene } from '@/features/editor/Scene'
import {
  moveInList,
  ruleOf,
  setStateClips,
  setStateFace,
  setStateHold,
  setStateMorph,
  setStateNext,
  setStateRule,
  stateFaceChoices,
  stateFileName,
  stateFileText,
  stateMorphChoices,
  stateNameProblem,
  stateRules,
  type CustomState,
  type StateRule,
} from '@/features/editor/stateLibrary'
import { runSeconds, stateRun, stateSheet, type RunSegment } from '@/features/editor/stateRun'
import type { ClipRef } from '@/features/editor/useClipLibrary'
import type { Editor } from '@/features/editor/useEditor'

// The editor of a custom state: its name, how it plays its clips (shuffled, once in order, or
// for a time) and what comes next, the face it holds and what it turns the body into, its lists
// of clips, and its run, the clips it plays over time as an engine plays them.

const surface = 'rounded-2xl border border-border bg-card shadow-[0_4px_14px_rgb(24_28_35/5%)]'
const CELL_VIEW = '-175 -175 350 350'

const ruleLabels: Record<StateRule, { label: string; hint: string }> = {
  shuffled: {
    label: 'Mélangé',
    hint: 'Tire ses clips au hasard, chacun une fois par tour, sans fin. Un clip listé deux fois sort deux fois plus souvent ; un seul clip boucle.',
  },
  sequence: {
    label: 'Une fois, puis…',
    hint: 'Joue chaque clip une fois, dans l’ordre de la liste, puis passe à l’état suivant.',
  },
  timed: {
    label: 'Pendant un temps, puis…',
    hint: 'Tire ses clips au hasard pendant le temps donné, puis passe à l’état suivant.',
  },
}

const download = (name: string, text: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

/** The sections of every clip a state may name: its own, the custom ones, the catalogue's. */
const useClipSections = (editor: Editor) => {
  const { t, clipLibrary } = editor
  const brought = clipLibrary.stateDraft?.document.newClips.map(clip => clip.name) ?? []
  const families = clipNames.reduce<Record<string, string[]>>((all, name) => {
    ;(all[name.split('_')[0]] ??= []).push(name)
    return all
  }, {})
  return [
    ...(brought.length ? [{ value: t('Apportés par le brouillon'), items: brought }] : []),
    ...(clipLibrary.clips.length
      ? [{ value: t('Mes clips'), items: clipLibrary.clips.map(clip => clip.name) }]
      : []),
    ...Object.entries(families).map(([value, items]) => ({ value, items })),
  ]
}

function ClipList({
  editor,
  label,
  list,
  onChange,
}: {
  editor: Editor
  label: string
  list: readonly string[]
  onChange: (list: string[]) => void
}) {
  const { t, engine } = editor
  const sections = useClipSections(editor)
  return (
    <div className="flex flex-col gap-1.5">
      <p className="eyebrow">{t(label)}</p>
      <ol className="flex flex-col gap-1">
        {list.map((name, index) => {
          const clip = engineClipOf(engine.current, name)
          return (
            <li
              className={`flex items-center gap-1 rounded-lg px-2 py-1 ${
                clip ? 'bg-muted' : 'bg-destructive/10 text-destructive'
              }`}
              data-state-clip={name}
              key={`${name}-${index}`}
            >
              <span className="w-5 text-[0.65rem] text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <strong className="min-w-0 flex-1 truncate text-xs">{name}</strong>
              <span className="text-[0.65rem] text-muted-foreground tabular-nums">
                {clip ? secondsText(clip.duration) : t('introuvable')}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                type="button"
                aria-label={`${t('Monter')} ${name}`}
                disabled={index === 0}
                onClick={() => onChange(moveInList(list, index, -1))}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                type="button"
                aria-label={`${t('Descendre')} ${name}`}
                disabled={index === list.length - 1}
                onClick={() => onChange(moveInList(list, index, 1))}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                type="button"
                aria-label={`${t('Retirer')} ${name}`}
                disabled={list.length === 1}
                onClick={() => onChange(list.filter((_, at) => at !== index))}
              >
                <X />
              </Button>
            </li>
          )
        })}
      </ol>
      <div className="rounded-xl bg-muted/60">
        <SectionCombobox
          label={t('Ajouter un clip')}
          value={null}
          sections={sections}
          detail={name => {
            const clip = engineClipOf(engine.current, name)
            return clip ? secondsText(clip.duration) : undefined
          }}
          placeholder={t('Rechercher un clip…')}
          empty={t('Aucun clip')}
          onPick={name => onChange([...list, name])}
        />
      </div>
    </div>
  )
}

/** Each play of the run, as a band over time and as a list. */
function StateRunView({
  editor,
  name,
  segments,
  seconds,
}: {
  editor: Editor
  name: string
  segments: RunSegment[]
  seconds: number
}) {
  const { t } = editor
  const hues = new Map<string, number>()
  const hueOf = (clip: string) => {
    if (!hues.has(clip)) hues.set(clip, (hues.size * 67 + 210) % 360)
    return hues.get(clip)!
  }
  return (
    <div className="flex flex-col gap-2" data-state-run={name}>
      <div className="relative h-9 overflow-hidden rounded-lg bg-muted">
        {segments.map((segment, index) => (
          <span
            className="absolute inset-y-0 flex items-center overflow-hidden border-r border-background px-1 text-[0.6rem] font-semibold whitespace-nowrap"
            style={{
              left: `${(segment.from / seconds) * 100}%`,
              width: `${((segment.to - segment.from) / seconds) * 100}%`,
              background: segment.joining
                ? 'repeating-linear-gradient(135deg, var(--muted), var(--muted) 3px, var(--background) 3px, var(--background) 6px)'
                : `oklch(0.86 0.07 ${hueOf(segment.clip)})`,
              opacity: segment.state === name ? 1 : 0.55,
            }}
            title={`${secondsText(segment.from)} – ${secondsText(segment.to)} · ${segment.clip}`}
            key={index}
          >
            {segment.joining ? '' : segment.clip}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-[0.6rem] text-muted-foreground tabular-nums">
        <span>0 s</span>
        <span>{secondsText(seconds / 2)}</span>
        <span>{secondsText(seconds)}</span>
      </div>
      <ol className="flex flex-col gap-0.5 text-xs">
        {segments.map((segment, index) => (
          <li
            className={`flex gap-2 rounded px-1.5 py-0.5 ${index % 2 ? '' : 'bg-muted/60'}`}
            data-run-segment={index + 1}
            data-from={segment.from.toFixed(3)}
            data-to={segment.to.toFixed(3)}
            data-state={segment.state}
            data-clip={segment.clip}
            data-joining={segment.joining}
            data-morph={segment.morph ?? ''}
            key={index}
          >
            <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
              {segment.from.toFixed(2)} – {segment.to.toFixed(2)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {segment.joining ? `${t('raccord vers')} ` : ''}
              <strong>{segment.clip}</strong>
              {segment.state !== name && (
                <span className="text-muted-foreground"> · {segment.state}</span>
              )}
              {segment.morph && (
                <span className="text-muted-foreground">
                  {' '}
                  · {spinnerOfMode[segment.morph] ?? segment.morph}
                </span>
              )}
              {segment.face && <span className="text-muted-foreground"> · {segment.face}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StateSheetView({
  editor,
  name,
  fps,
  seconds,
}: {
  editor: Editor
  name: string
  fps: FrameRate
  seconds: number
}) {
  const { t, character, clipLibrary } = editor
  if (!character) return null
  const frames = stateSheet(clipLibrary.engineLibrary(), name, fps, { seconds })
  return (
    <div className="flex flex-col gap-2" data-sheet>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {frames.length} {t('images')} · {secondsText(seconds)}
        </p>
        <div className="flex items-center rounded-lg bg-muted p-0.5">
          {stateFrameRates.map(rate => (
            <button
              type="button"
              className={`h-6 rounded-md px-2 text-[0.65rem] font-semibold tabular-nums ${
                fps === rate
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={fps === rate}
              aria-label={`${rate} ${t('images par seconde')}`}
              key={rate}
              onClick={() => clipLibrary.setStateView({ ...clipLibrary.stateView, fps: rate })}
            >
              {rate} i/s
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1">
        {frames.map(({ index, time, frame, clip }) => (
          <span
            className="flex flex-col items-center rounded-md bg-muted px-0.5 pt-0.5 pb-1"
            data-frame={index + 1}
            data-time={time.toFixed(3)}
            data-face={frame.face}
            data-clip={clip}
            title={`${index + 1} · ${secondsText(time)} · ${clip}`}
            key={index}
          >
            <span className="relative aspect-square w-full overflow-hidden rounded-sm">
              <svg
                viewBox={CELL_VIEW}
                className="absolute inset-0 size-full text-muted-foreground"
                aria-hidden="true"
              >
                <path
                  d="M-175 0H175M0 -175V175"
                  stroke="currentColor"
                  strokeOpacity={0.35}
                  strokeDasharray="6 6"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <Scene
                scene={renderCharacterFrame(character, frame)}
                character={character}
                viewBox={CELL_VIEW}
                className="absolute inset-0 size-full"
              />
            </span>
            <span className="text-[0.6rem] leading-none font-semibold tabular-nums">
              {index + 1}
            </span>
            <span className="max-w-full truncate text-[0.55rem] leading-tight text-muted-foreground">
              {time.toFixed(1)} · {clip}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function StateEditor({
  editor,
  state,
  stateRef,
}: {
  editor: Editor
  state: CustomState
  /** The draft, or the saved custom state being edited. */
  stateRef: ClipRef
}) {
  const { t, clipLibrary, setDoing, setPlaying, handover, setHandover } = editor
  const isDraft = 'draft' in stateRef
  const [name, setName] = useState(state.name)
  const [leaving, setLeaving] = useState<'delete' | 'discard' | null>(null)
  const [compactOpen, setCompactOpen] = useState(state.compactClips !== undefined)
  useEffect(() => setName(state.name), [state.name])
  const source = isDraft ? clipLibrary.stateDraft?.source : undefined
  const others = clipLibrary.states.filter(item => item.name !== source)
  const problem = stateNameProblem(name, others, state.name)
  const problems = {
    empty: 'L’état doit avoir un nom.',
    catalogue: 'Ce nom est celui d’un état du catalogue.',
    taken: 'Un autre de tes états porte déjà ce nom.',
  }
  const update = (next: CustomState, tag?: string) => clipLibrary.updateState(stateRef, next, tag)
  const rename = () => {
    const next = name.trim()
    if (problem || next === state.name) {
      if (problem) setName(state.name)
      return
    }
    update({ ...state, name: next })
    setDoing(isDraft ? { state: next, draft: true } : { state: next })
  }
  const show = (opened: string | null, draft: boolean) => {
    if (!opened) return
    setPlaying(true)
    setDoing(draft ? { state: opened, draft: true } : { state: opened })
  }
  const rule = ruleOf(state)
  const users = clipLibrary.states.filter(
    item => item.next === state.name && item.name !== state.name
  )

  const stateSections = [
    {
      value: t('Mes états'),
      items: [
        ...new Set([
          ...(isDraft ? [state.name] : []),
          ...clipLibrary.states.map(item => item.name),
        ]),
      ],
    },
    ...stateGroups.map(group => ({ value: group.label, items: [...group.states] })),
  ]

  const library = clipLibrary.engineLibrary()
  const runLength = runSeconds(library, state.name)
  // The run shows what the state does in an app, hand-over included, whatever the stage does.
  const segments = stateRun(library, state.name, { seconds: runLength })
  const sheet = clipLibrary.stateView.view === 'frames'

  return (
    <div className="panel-stack">
      <div className={`${surface} @container flex flex-col gap-3 p-3`}>
        {isDraft && (
          <DraftBanner
            note={source ? `${t('Enregistrer remplace')} ${source}.` : undefined}
            saveLabel="Enregistrer dans mes états"
            onSave={() => show(clipLibrary.saveStateDraft(), false)}
          />
        )}
        <div className="flex items-center gap-2">
          <Input
            aria-label={t('Nom de l’état')}
            aria-invalid={problem !== null}
            value={name}
            className="h-9 flex-1 font-semibold"
            spellCheck={false}
            onChange={event => setName(event.currentTarget.value)}
            onBlur={rename}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setName(state.name)
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
        {problem && name.trim() !== state.name && (
          <p className="-mt-1.5 text-xs text-destructive">{t(problems[problem])}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{t('Règle')}</p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="group">
            {stateRules.map(item => (
              <button
                type="button"
                className={`h-8 rounded-lg px-1 text-[0.7rem] font-semibold ${
                  rule === item
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={rule === item}
                key={item}
                onClick={() => update(setStateRule(state, item))}
              >
                {t(ruleLabels[item].label)}
              </button>
            ))}
          </div>
          <p className="text-[0.7rem] text-muted-foreground">{t(ruleLabels[rule].hint)}</p>
          {rule !== 'shuffled' && (
            <div className="grid gap-1.5 @lg:grid-cols-2">
              <div className="rounded-xl bg-muted/60">
                <SectionCombobox
                  label={t('État suivant')}
                  value={state.next ?? null}
                  sections={stateSections}
                  placeholder={t('Rechercher un état…')}
                  empty={t('Aucun état')}
                  onPick={next => update(setStateNext(state, next))}
                />
              </div>
              {rule === 'timed' && (
                <NumericField
                  label="Durée"
                  value={state.holdSeconds ?? 0}
                  min={0.1}
                  max={600}
                  step={0.1}
                  unit="s"
                  onChange={value => update(setStateHold(state, value), 'hold')}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{t('Visage tenu')}</p>
          <div className="flex flex-wrap gap-1">
            {[null, ...stateFaceChoices, ...clipLibrary.faces.map(face => face.name)].map(face => (
              <Button
                variant={(state.face ?? null) === face ? 'default' : 'outline'}
                size="sm"
                type="button"
                aria-pressed={(state.face ?? null) === face}
                key={face ?? 'none'}
                onClick={() => update(setStateFace(state, face))}
              >
                {face ?? t('Celui du clip')}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{t('Spinner')}</p>
          <div className="flex flex-wrap gap-1">
            {[null, ...stateMorphChoices].map(morph => (
              <Button
                variant={(state.morph ?? null) === morph ? 'default' : 'outline'}
                size="sm"
                type="button"
                aria-pressed={(state.morph ?? null) === morph}
                title={morph ? spinnerOfMode[morph] : undefined}
                key={morph ?? 'none'}
                onClick={() => update(setStateMorph(state, morph))}
              >
                {morph ?? t('Aucun')}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1">
          {!isDraft && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              title={t('Ouvrir une copie de travail dans l’adresse, pour la donner à un agent')}
              onClick={() => show(clipLibrary.editState(state.name), true)}
            >
              <Pencil /> {t('Brouillon')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            type="button"
            title={t('Enregistrer l’état et ses clips perso dans un fichier .state.json')}
            onClick={() =>
              download(
                stateFileName(state),
                stateFileText(state, [
                  ...clipLibrary.clips,
                  ...(isDraft ? (clipLibrary.stateDraft?.document.newClips ?? []) : []),
                ])
              )
            }
          >
            <Download /> {t('Exporter')}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            aria-label={t('Dupliquer l’état')}
            title={t('Dupliquer l’état')}
            onClick={() =>
              show(
                clipLibrary.duplicateState(state.name, `${state.name}-${t('copie')}`, isDraft),
                true
              )
            }
          >
            <Copy />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            aria-label={t(isDraft ? 'Abandonner le brouillon' : 'Supprimer l’état')}
            title={t(isDraft ? 'Abandonner le brouillon' : 'Supprimer l’état')}
            onClick={() => setLeaving(isDraft ? 'discard' : 'delete')}
          >
            <Trash2 />
          </Button>
        </div>
        {users.length > 0 && (
          <p className="text-[0.7rem] text-muted-foreground">
            <Link2 className="inline size-3" /> {t('Passent ensuite à cet état')} :{' '}
            {users.map(item => item.name).join(', ')}
          </p>
        )}
      </div>

      <div className={`${surface} flex flex-col gap-3 p-3`}>
        <ClipList
          editor={editor}
          label="Clips"
          list={state.clips}
          onChange={list => update(setStateClips(state, list))}
        />
        <label className="flex items-center justify-between gap-3 text-xs">
          <span>
            <strong className="block">{t('Liste pour petite taille')}</strong>
            <span className="text-muted-foreground">
              {t('Les clips que l’état tire quand l’avatar est affiché petit.')}
            </span>
          </span>
          <Switch
            checked={compactOpen}
            aria-label={t('Liste pour petite taille')}
            onCheckedChange={open => {
              setCompactOpen(open)
              update(setStateClips(state, open ? [state.clips[0]] : [], true))
            }}
          />
        </label>
        {compactOpen && state.compactClips && (
          <ClipList
            editor={editor}
            label="Clips en petite taille"
            list={state.compactClips}
            onChange={list => update(setStateClips(state, list, true))}
          />
        )}
      </div>

      <div className={`${surface} flex flex-col gap-3 p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            type="button"
            onClick={() => {
              setPlaying(true)
              setDoing(isDraft ? { state: state.name, draft: true } : { state: state.name })
            }}
          >
            <Play /> {t('Rejouer l’état')}
          </Button>
          {state.next && (
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ${
                handover
                  ? 'bg-secondary text-secondary-foreground ring-ring'
                  : 'text-muted-foreground ring-border hover:text-foreground'
              }`}
              aria-pressed={handover}
              onClick={() => setHandover(!handover)}
            >
              <Link2 className="size-3" aria-hidden="true" />
              {t('Enchaîner')}
            </button>
          )}
          <div className="ml-auto grid grid-cols-2 rounded-xl bg-muted p-1" role="group">
            {(['timeline', 'frames'] as const).map(mode => (
              <button
                type="button"
                className={`h-7 rounded-lg px-2 text-xs font-semibold ${
                  clipLibrary.stateView.view === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={clipLibrary.stateView.view === mode}
                key={mode}
                onClick={() => clipLibrary.setStateView({ ...clipLibrary.stateView, view: mode })}
              >
                {t(mode === 'timeline' ? 'Déroulé' : 'Planche')}
              </button>
            ))}
          </div>
        </div>
        {sheet ? (
          <StateSheetView
            editor={editor}
            name={state.name}
            fps={clipLibrary.stateView.fps}
            seconds={runLength}
          />
        ) : (
          <StateRunView editor={editor} name={state.name} segments={segments} seconds={runLength} />
        )}
      </div>

      <AlertDialog open={leaving !== null} onOpenChange={open => !open && setLeaving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {leaving === 'discard'
                ? t('Abandonner le brouillon ?')
                : `${t('Supprimer')} ${state.name} ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                leaving === 'discard'
                  ? 'Le brouillon disparaît de la page. Exporte-le d’abord pour en garder une copie.'
                  : 'L’état est retiré de tes états. Exporte-le d’abord pour en garder une copie.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Garder')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leaving === 'discard') clipLibrary.discardStateDraft()
                else clipLibrary.removeState(state.name)
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
