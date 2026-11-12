import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

import { formatTalkTime } from '@/features/talk/talkTimeline'
import type { TalkCueKind } from '@/features/talk/talkScript'

export type TalkTimelineMarker = {
  id: string
  kind: TalkCueKind
  label: string
  timeMs: number
}

export function TalkTimeline({
  currentMs,
  durationMs,
  loading,
  markers,
  playing,
  scrubSound,
  t,
  onPlayPause,
  onReset,
  onScrubEnd,
  onScrubStart,
  onSeek,
  onToggleScrubSound,
}: {
  currentMs: number
  durationMs: number
  loading: boolean
  markers: TalkTimelineMarker[]
  playing: boolean
  scrubSound: boolean
  t: (value: string) => string
  onPlayPause: () => void
  onReset: () => void
  onScrubEnd: (timeMs: number) => void
  onScrubStart: () => void
  onSeek: (timeMs: number) => void
  onToggleScrubSound: () => void
}) {
  const disabled = loading || durationMs <= 0
  const scrubbingRef = useRef(false)
  return (
    <div className="talk-timeline" aria-label={t('Timeline du dialogue')}>
      <div className="talk-timeline-transport">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          aria-label={t(playing ? 'Mettre le dialogue en pause' : 'Lire le dialogue')}
          onClick={onPlayPause}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <time>{formatTalkTime(currentMs)}</time>
        <time>{loading ? '···' : formatTalkTime(durationMs)}</time>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-pressed={scrubSound}
          aria-label={t(scrubSound ? 'Couper le son du scrub' : 'Activer le son du scrub')}
          title={t(scrubSound ? 'Couper le son du scrub' : 'Activer le son du scrub')}
          onClick={onToggleScrubSound}
        >
          {scrubSound ? <Volume2 /> : <VolumeX />}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled || currentMs === 0}
          aria-label={t('Revenir au début')}
          title={t('Revenir au début')}
          onClick={onReset}
        >
          <RotateCcw />
        </Button>
      </div>
      <div className="talk-timeline-track-wrap">
        <div className="talk-timeline-markers" aria-hidden="true">
          {markers.map(marker => (
            <span
              className={`talk-timeline-marker is-${marker.kind}`}
              key={marker.id}
              style={{ left: `${durationMs <= 0 ? 0 : (marker.timeMs / durationMs) * 100}%` }}
              title={marker.label}
            />
          ))}
        </div>
        <Slider
          aria-label={t('Position dans le dialogue')}
          min={0}
          max={Math.max(1, durationMs)}
          step={10}
          value={Math.min(currentMs, Math.max(1, durationMs))}
          disabled={disabled}
          onValueChange={value => {
            const nextValue = typeof value === 'number' ? value : (value[0] ?? 0)
            if (!scrubbingRef.current) {
              scrubbingRef.current = true
              onScrubStart()
            }
            onSeek(nextValue)
          }}
          onValueCommitted={value => {
            const nextValue = typeof value === 'number' ? value : (value[0] ?? 0)
            scrubbingRef.current = false
            onScrubEnd(nextValue)
          }}
        />
      </div>
    </div>
  )
}
