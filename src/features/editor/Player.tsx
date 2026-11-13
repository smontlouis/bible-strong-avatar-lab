import { faceNames, gestureNames, pokeEngine, resolveFaceName } from '@bible-strong/avatar-core'
import { Popover } from '@base-ui/react/popover'
import {
  ArrowUpFromLine,
  ChevronDown,
  MoveVertical,
  Pause,
  Play,
  RotateCw,
  Square,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { CharacterPreview } from '@/features/editor/CharacterPreview'
import type { StageStatus } from '@/features/editor/Stage'
import type { Editor } from '@/features/editor/useEditor'

// The player: what the avatar is doing, and what lies over everything it does (the face it
// holds, the gestures laid over it). It stays at the bottom of every tab but the body's page.

const gestureIcons = { nod: MoveVertical, bounce: ArrowUpFromLine, spin: RotateCw } as const

const seconds = (value: number) => `${value.toFixed(1)} s`

function FacePicker({ editor, shown }: { editor: Editor; shown: string }) {
  const { t, character, face, setFace } = editor
  if (!character) return null
  const choices: (string | null)[] = [null, ...faceNames]
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t('Visage')}
        className="flex h-9 items-center gap-1.5 rounded-lg px-1.5 text-xs font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 data-[popup-open]:bg-muted"
      >
        <span className="size-7 shrink-0 [&_.avatar-preview]:size-full">
          <CharacterPreview character={character} face={resolveFaceName(face ?? shown)} />
        </span>
        <span className="max-w-20 truncate">{face ?? t('Auto')}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-50" side="top" sideOffset={8}>
          <Popover.Popup className="w-72 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none">
            <p className="eyebrow px-1 pb-1.5">{t('Visage tenu')}</p>
            <div className="grid grid-cols-5 gap-1">
              {choices.map(name => {
                const active = face === name
                return (
                  <button
                    type="button"
                    className={`flex flex-col items-center gap-0.5 rounded-lg p-1 text-[0.6rem] font-semibold ${
                      active
                        ? 'bg-secondary text-secondary-foreground ring-1 ring-ring'
                        : 'hover:bg-muted'
                    }`}
                    aria-pressed={active}
                    aria-label={name ?? t('Automatique')}
                    key={name ?? 'auto'}
                    onClick={() => setFace(name)}
                  >
                    <span className="size-9 [&_.avatar-preview]:size-full">
                      <CharacterPreview
                        character={character}
                        face={resolveFaceName(name ?? shown)}
                      />
                    </span>
                    <span className="w-full truncate text-center">{name ?? t('Auto')}</span>
                  </button>
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Player({
  editor,
  status,
  name,
}: {
  editor: Editor
  status: StageStatus
  /** What the avatar is doing, as the controls name it. */
  name: string
}) {
  const { t, engine, playing, stopped, held, doing, setTab } = editor
  const fill = useRef<HTMLSpanElement>(null)
  const clock = useRef<HTMLSpanElement>(null)

  // The clip's progress, drawn at every frame without going through React.
  useEffect(() => {
    let request = 0
    const tick = () => {
      const player = engine.current.player
      const clip = player.clip
      const joining = player.join !== null
      const share = clip && !joining ? Math.min(1, player.time / clip.duration) : 0
      if (fill.current) fill.current.style.width = `${share * 100}%`
      if (clock.current) {
        clock.current.textContent = clip
          ? `${seconds(joining ? 0 : Math.min(player.time, clip.duration))} / ${seconds(clip.duration)}`
          : ''
      }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [engine])

  const playback = stopped ? 'stopped' : playing ? 'playing' : 'paused'
  const label =
    playback === 'playing' ? 'En lecture' : playback === 'paused' ? 'En pause' : 'Arrêté'
  const state = status.state ?? ('state' in doing && !status.clip ? doing.state : null)
  const clip = status.clip || ('clip' in doing ? doing.clip : '')
  const dot =
    playback === 'playing'
      ? 'bg-emerald-600'
      : playback === 'paused'
        ? 'bg-amber-600'
        : 'bg-muted-foreground'
  const link =
    'truncate rounded-md px-1 font-semibold hover:bg-muted hover:text-secondary-foreground'

  return (
    <div className="editor-player flex flex-col gap-2" aria-label={`${t(label)} : ${name}`}>
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span
          className={`size-1.5 shrink-0 rounded-full ${dot} ring-4 ring-current/10`}
          aria-hidden="true"
        />
        {state && (
          <>
            <button type="button" className={link} onClick={() => setTab('states')}>
              {state}
            </button>
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
          </>
        )}
        {status.joining ? (
          <span className="px-1 text-muted-foreground">{t('raccord')}</span>
        ) : (
          clip && (
            <button type="button" className={link} onClick={() => setTab('clips')}>
              {clip}
            </button>
          )
        )}
        {held && <span className="truncate text-muted-foreground">· {t('posé à la main')}</span>}
        {stopped && <span className="text-muted-foreground">· {t('arrêté')}</span>}
        <span
          className="ml-auto shrink-0 font-mono text-[0.7rem] text-muted-foreground tabular-nums"
          ref={clock}
        />
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-ring" ref={fill} />
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          type="button"
          aria-label={t(playing ? `Mettre ${name} en pause` : `Reprendre ${name}`)}
          onClick={() => editor.setPlaying(!playing)}
        >
          {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t(`Arrêter ${name}`)}
          onClick={editor.stop}
        >
          <Square fill="currentColor" />
        </Button>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <FacePicker editor={editor} shown={status.face} />
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <div className="ml-auto flex items-center gap-0.5">
          {gestureNames.map(gesture => {
            const Icon = gestureIcons[gesture as keyof typeof gestureIcons] ?? RotateCw
            return (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-label={gesture}
                title={gesture}
                key={gesture}
                onClick={() => pokeEngine(engine.current, gesture)}
              >
                <Icon />
                <span className="max-[440px]:hidden">{gesture}</span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
