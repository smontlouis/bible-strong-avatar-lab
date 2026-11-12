import { Gauge, LoaderCircle, Move3D, Radio, Smile, Square, Waves } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { ControlSection, InspectorCard, PanelTitle } from '@/app/components/common'
import { NumericField } from '@/app/components/controls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldTitle } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useStudioLanguage } from '@/i18n'

import { defaultExpression } from '@/features/avatar/presets'
import {
  defaultAnimaleseSettings,
  prepareTalkVoice,
  type AnimaleseSettings,
  type AnimaleseVoiceBank,
} from '@/features/talk/animalese'
import {
  jevTransformPresets,
  JEV_NEUTRAL_EXPRESSION_ID,
  resolveJevMovementDecision,
  type JevDirectionDecision,
  type JevDirectionResponse,
  type JevExpressionOption,
} from '@/features/talk/jevDirection'
import { StreamTalkAudioPlayer } from '@/features/talk/streamAudioPlayer'
import {
  shouldCompleteStreamBeat,
  tokenizeSimulatedStream,
  waitForStreamToken,
  type StreamBeatStatus,
} from '@/features/talk/streamDirector'
import { talkTextOffsetAtTime } from '@/features/talk/talkTimeline'
import type { StudioController } from '@/features/studio/useStudioController'

type StreamBeatView = {
  id: string
  text: string
  status: StreamBeatStatus
  expression?: string
  movement?: string
  intensity?: number
}

const englishDemo =
  'Hello! I have something important to tell you. Come a little closer… actually, that may be too close! Let us take a step back. Perfect, now we can continue.'
const frenchDemo =
  'Bonjour ! J’ai quelque chose d’important à te raconter. Approche-toi un peu… finalement, c’est peut-être trop près ! Reculons légèrement. Parfait, maintenant nous pouvons continuer.'

export function StreamModePanel({ controller }: { controller: StudioController }) {
  const { t } = useStudioLanguage()
  const {
    clearTalkTransform,
    expressions,
    language,
    setTalkBubbleText,
    setTalkPlaybackStatus,
    transitionTalkToExpression,
    transitionTalkTransform,
  } = controller
  const [sourceText, setSourceText] = useState(language === 'fr' ? frenchDemo : englishDemo)
  const [receivedText, setReceivedText] = useState('')
  const [beats, setBeats] = useState<StreamBeatView[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenDelayMs, setTokenDelayMs] = useState(140)
  const [settings, setSettings] = useState<AnimaleseSettings>(() => ({
    ...defaultAnimaleseSettings,
    voiceBank: 'rpg',
  }))
  const [player] = useState(() => new StreamTalkAudioPlayer())
  const streamAbortRef = useRef<AbortController | null>(null)
  const beatListRef = useRef<HTMLDivElement>(null)
  const playingBeatId = beats.find(beat => beat.status === 'playing')?.id

  useEffect(() => {
    if (!playingBeatId) return
    const activeBeat = beatListRef.current?.querySelector<HTMLElement>(
      `[data-beat-id="${playingBeatId}"]`
    )
    activeBeat?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }, [playingBeatId])

  const updateBeat = (id: string, patch: Partial<StreamBeatView>) =>
    setBeats(current => current.map(beat => (beat.id === id ? { ...beat, ...patch } : beat)))

  const stop = () => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    player.stop()
    setRunning(false)
    setTalkPlaybackStatus('idle')
  }

  const cleanup = useEffectEvent(() => {
    streamAbortRef.current?.abort()
    player.stop()
    clearTalkTransform()
    setTalkPlaybackStatus('idle')
  })
  useEffect(() => () => cleanup(), [])

  const start = async () => {
    if (!sourceText.trim() || running) return
    stop()
    const controller = new AbortController()
    streamAbortRef.current = controller
    const signal = controller.signal
    const expressionOptions: JevExpressionOption[] = [
      { id: JEV_NEUTRAL_EXPRESSION_ID, label: 'neutral' },
      ...expressions.map((expression, index) => ({
        id: expression.id,
        label: expression.semanticKey ?? `expression-${index}`,
      })),
    ]
    let received = ''
    let pendingBeat = ''
    let previousBeat = ''
    let beatIndex = 0
    let activeExpressionId = JEV_NEUTRAL_EXPRESSION_ID
    let movementActive = false
    let scheduled = Promise.resolve()
    const playbackFinishes: Promise<void>[] = []
    const spokenParts: string[] = []

    setRunning(true)
    setError(null)
    setReceivedText('')
    setBeats([])
    setTalkBubbleText('')
    setTalkPlaybackStatus('loading')
    clearTalkTransform()
    transitionTalkToExpression(defaultExpression, null, 180)

    const finalizeBeat = (rawText: string) => {
      const text = rawText.trim()
      if (!text) return
      const id = `stream-beat-${beatIndex}`
      beatIndex += 1
      const spokenBefore = spokenParts.join(' ')
      const prefix = spokenBefore ? `${spokenBefore} ` : ''
      const startsAt = Math.max(0, received.lastIndexOf(text))
      const beat = {
        id,
        text,
        startOffset: startsAt,
        endOffset: startsAt + text.length,
        previousText: previousBeat || undefined,
      }
      previousBeat = text
      spokenParts.push(text)
      setBeats(current => [...current, { id, text, status: 'directing' }])

      const ready = (async () => {
        const directionRequest = fetch('/api/direct-dialogue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: received.trim(),
            beats: [beat],
            expressions: expressionOptions,
            movements: jevTransformPresets.map(({ id: movementId, label, description }) => ({
              id: movementId,
              label,
              description,
            })),
          }),
          signal,
        }).then(async response => {
          const payload = (await response.json()) as JevDirectionResponse & { error?: string }
          if (!response.ok) throw new Error(payload.error ?? 'Jev direction failed.')
          return payload.decisions[0]
        })
        const audioRequest = prepareTalkVoice(text, settings, signal)
        const decision = await directionRequest
        if (!decision) throw new Error('Jev returned no direction for this beat.')
        updateBeat(id, {
          status: 'synthesizing',
          expression:
            expressionOptions.find(option => option.id === decision.expressionId)?.label ??
            'neutral',
          movement: decision.movementId ?? undefined,
          intensity: decision.intensity,
        })
        const audio = await audioRequest
        return { audio, decision }
      })()

      scheduled = scheduled.then(async () => {
        const { audio, decision } = await ready
        if (signal.aborted) return
        updateBeat(id, { status: 'queued' })
        const { finished } = await player.enqueue(audio, {
          signal,
          volume: settings.volume,
          onStart: () => {
            updateBeat(id, { status: 'playing' })
            setTalkPlaybackStatus('speaking')
            applyDecision(decision)
          },
          onTime: timeMs => {
            const offset = talkTextOffsetAtTime(audio, timeMs)
            setTalkBubbleText(`${prefix}${text.slice(0, offset)}`)
          },
          onEnd: () => {
            updateBeat(id, { status: 'played' })
            setTalkBubbleText(`${prefix}${text}`)
          },
        })
        playbackFinishes.push(finished)
        void finished.catch(() => undefined)
      })
    }

    const applyDecision = (decision: JevDirectionDecision) => {
      const nextExpressionId = decision.expressionId ?? JEV_NEUTRAL_EXPRESSION_ID
      const expressionChanged = nextExpressionId !== activeExpressionId
      if (expressionChanged) {
        if (nextExpressionId === JEV_NEUTRAL_EXPRESSION_ID) {
          transitionTalkToExpression(defaultExpression, null, 350)
        } else {
          const index = expressions.findIndex(expression => expression.id === nextExpressionId)
          if (index >= 0) transitionTalkToExpression(expressions[index], index, 350)
        }
        activeExpressionId = nextExpressionId
      }
      const movement = resolveJevMovementDecision(decision)
      if (movement) {
        transitionTalkTransform(movement.transform, movement.durationMs)
        movementActive = true
      } else if (movementActive) {
        if (!expressionChanged) {
          transitionTalkTransform({ tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 }, 450)
        }
        movementActive = false
      }
    }

    try {
      for (const token of tokenizeSimulatedStream(sourceText)) {
        if (signal.aborted) throw new DOMException('Stream stopped.', 'AbortError')
        received += token
        pendingBeat += token
        setReceivedText(received)
        if (shouldCompleteStreamBeat(pendingBeat)) {
          finalizeBeat(pendingBeat)
          pendingBeat = ''
        }
        await waitForStreamToken(tokenDelayMs, signal)
      }
      finalizeBeat(pendingBeat)
      await scheduled
      await Promise.all(playbackFinishes)
      if (!signal.aborted) {
        setTalkPlaybackStatus('idle')
        setRunning(false)
        streamAbortRef.current = null
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      controller.abort()
      player.stop()
      streamAbortRef.current = null
      setError(cause instanceof Error ? cause.message : t('Le stream a échoué.'))
      setTalkPlaybackStatus('error')
      setRunning(false)
    }
  }

  const statusCounts = beats.reduce<Partial<Record<StreamBeatStatus, number>>>((counts, beat) => {
    counts[beat.status] = (counts[beat.status] ?? 0) + 1
    return counts
  }, {})

  return (
    <div className="panel-stack stream-panel-stack">
      <ControlSection
        title={t('Flux simulé')}
        subtitle={t(
          'Simule une réponse LLM, dirige chaque beat avec Jev et prépare son audio en continu.'
        )}
      >
        <InspectorCard className="stream-console-card">
          <PanelTitle
            title={t('Texte source')}
            subtitle={t('Le texte est émis progressivement comme un flux de tokens.')}
          />
          <Textarea
            className="stream-source-input"
            value={sourceText}
            disabled={running}
            onChange={event => setSourceText(event.currentTarget.value)}
          />
          <div className="stream-settings-grid">
            <NumericField
              label={t('Intervalle des tokens')}
              value={tokenDelayMs}
              min={20}
              max={500}
              step={5}
              unit="ms"
              onChange={setTokenDelayMs}
            />
            <Field orientation="horizontal">
              <FieldTitle>{t('Banque de voix')}</FieldTitle>
              <Select
                value={settings.voiceBank}
                items={[
                  { value: 'animalese', label: t('Animalese') },
                  { value: 'rpg', label: t('RPG Blips') },
                  { value: 'game-boy', label: t('Game boy') },
                ]}
                onValueChange={value =>
                  value &&
                  setSettings(current => ({ ...current, voiceBank: value as AnimaleseVoiceBank }))
                }
              >
                <SelectTrigger aria-label={t('Banque de voix')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="animalese">{t('Animalese')}</SelectItem>
                  <SelectItem value="rpg">{t('RPG Blips')}</SelectItem>
                  <SelectItem value="game-boy">{t('Game boy')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button
            className="stream-start-button"
            type="button"
            disabled={!sourceText.trim()}
            onClick={() => (running ? stop() : void start())}
          >
            {running ? <Square /> : <Radio />}
            {t(running ? 'Arrêter le stream' : 'Démarrer le stream')}
          </Button>
          {error ? <p className="talk-jev-error">{error}</p> : null}
        </InspectorCard>
      </ControlSection>

      <ControlSection
        title={t('Pipeline en direct')}
        subtitle={t('Chaque beat avance indépendamment jusqu’à sa lecture.')}
      >
        <InspectorCard className="stream-monitor-card">
          <div className="stream-status-rail" aria-label={t('État du pipeline')}>
            {(['directing', 'synthesizing', 'queued', 'playing', 'played'] as const).map(status => (
              <div className={`stream-status is-${status}`} key={status}>
                <span>{statusCounts[status] ?? 0}</span>
                <small>{t(status)}</small>
              </div>
            ))}
          </div>
          <div className={`stream-receiver${running ? ' is-live' : ''}`}>
            <div className="stream-receiver-header">
              <span>
                <Waves /> {t('Flux reçu')}
              </span>
              {running ? (
                <Badge>{t('En direct')}</Badge>
              ) : (
                <Badge variant="outline">{t('Prêt')}</Badge>
              )}
            </div>
            <p>
              {receivedText || t('Le texte reçu apparaîtra ici…')}
              <i aria-hidden="true" />
            </p>
          </div>
          <div className="stream-beat-list" ref={beatListRef}>
            {beats.map((beat, index) => (
              <article
                aria-current={beat.status === 'playing' ? 'step' : undefined}
                className={`stream-beat is-${beat.status}`}
                data-beat-id={beat.id}
                key={beat.id}
              >
                <span className="stream-beat-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="stream-beat-content">
                  <p>{beat.text}</p>
                  <div className="stream-beat-tags">
                    {beat.expression ? (
                      <span className="stream-beat-tag is-expression">
                        <Smile />
                        {beat.expression}
                      </span>
                    ) : null}
                    {beat.movement ? (
                      <span className="stream-beat-tag is-movement">
                        <Move3D />
                        {beat.movement}
                      </span>
                    ) : null}
                    {beat.movement && beat.intensity !== undefined ? (
                      <span className="stream-beat-tag is-intensity">
                        <Gauge />
                        {Math.round(beat.intensity * 100)}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <Badge variant="outline">
                  {beat.status === 'directing' || beat.status === 'synthesizing' ? (
                    <LoaderCircle className="is-spinning" />
                  ) : null}
                  {t(beat.status)}
                </Badge>
              </article>
            ))}
          </div>
        </InspectorCard>
      </ControlSection>
    </div>
  )
}
