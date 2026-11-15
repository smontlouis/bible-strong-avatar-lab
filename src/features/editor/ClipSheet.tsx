import { renderCharacterFrame, type ClipDefinition, type ClipKey } from '@bible-strong/avatar-core'

import { Curve, partColors, seconds, trackMeta } from '@/features/editor/ClipExplorer'
import { clipSheet } from '@/features/editor/clipFrames'
import { trackOrder, type NumericTrackName } from '@/features/editor/clipLibrary'
import { frameRates, type FrameRate } from '@/features/editor/clipLink'
import { Scene } from '@/features/editor/Scene'
import type { Editor } from '@/features/editor/useEditor'

// The sheet of a clip: the avatar drawn at every frame, side by side, then the curves of its
// tracks. The whole clip is seen at once, the way an animator checks spacing: frames close
// together are slow, frames far apart fast. It is what an agent reads from one screenshot.

// A little wider than the stage's view, so that a body that moves stays inside its cell.
const CELL_VIEW = '-175 -175 350 350'

/**
 * The same marks behind every cell: where the body's middle is at rest. Without them a move of a
 * few pixels from one cell to the next does not show.
 */
function CellGuides() {
  return (
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
  )
}

export function ClipSheet({
  editor,
  clip,
  fps,
  onFps,
  onPick,
}: {
  editor: Editor
  clip: ClipDefinition
  fps: FrameRate
  onFps: (fps: FrameRate) => void
  /** A frame picked: the stage is shown at its time. */
  onPick: (time: number) => void
}) {
  const { t, character } = editor
  if (!character) return null
  const frames = clipSheet(clip, fps)
  const numeric = trackOrder.filter(
    (track): track is NumericTrackName => track !== 'expression' && !!clip.tracks[track]?.length
  )
  const faces = clip.tracks.expression ?? []

  return (
    <div className="flex flex-col gap-3" data-sheet>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {frames.length} {t('images')} · {seconds(clip.duration)}
        </p>
        <div className="flex items-center rounded-lg bg-muted p-0.5">
          {frameRates.map(rate => (
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
              onClick={() => onFps(rate)}
            >
              {rate} i/s
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1">
        {frames.map(({ index, time, frame }) => (
          <button
            type="button"
            className="flex flex-col items-center rounded-md bg-muted px-0.5 pt-0.5 pb-1 hover:ring-1 hover:ring-ring"
            aria-label={`${t('Image')} ${index + 1} · ${seconds(time)} · ${frame.face}`}
            title={`${index + 1} · ${seconds(time)} · ${frame.face}`}
            key={index}
            onClick={() => onPick(time)}
          >
            <span className="relative aspect-square w-full">
              <CellGuides />
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
            <span className="text-[0.55rem] leading-tight text-muted-foreground tabular-nums">
              {time.toFixed(2)}
            </span>
          </button>
        ))}
      </div>

      {numeric.map(track => (
        <div className="flex flex-col gap-1" key={track}>
          <span className="eyebrow">{t(trackMeta[track].label)}</span>
          {trackMeta[track].parts.map((part, component) => (
            <Curve
              keys={clip.tracks[track] as ClipKey<readonly number[]>[]}
              part={component}
              label={t(part)}
              color={
                trackMeta[track].parts.length > 1 ? partColors[component] : trackMeta[track].color
              }
              duration={clip.duration}
              selected={null}
              key={part}
              onPick={index => onPick(clip.tracks[track]![index].t)}
            />
          ))}
        </div>
      ))}
      {faces.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="eyebrow">{t('Visage')}</span>
          <div className="grid grid-cols-[var(--label,5.5rem)_1fr]">
            <span />
            <div className="relative h-7 rounded-md bg-muted">
              <div className="absolute inset-y-0 right-2.5 left-2.5">
                {faces.map((key, index) => (
                  <span
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-background px-1 text-[0.6rem] font-semibold ring-1 ring-border"
                    style={{ left: `${(key.t / clip.duration) * 100}%` }}
                    key={index}
                  >
                    {key.v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
