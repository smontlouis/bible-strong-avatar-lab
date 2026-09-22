import { AudioLines, LoaderCircle, Pause, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { ControlSection, InspectorCard, PanelTitle } from '@/app/components/common'
import { NumericField } from '@/app/components/controls'
import { Button } from '@/components/ui/button'
import { Field, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStudioLanguage } from '@/i18n'

import {
  defaultAnimaleseSettings,
  playPreparedTalkVoice,
  prepareTalkVoice,
  type AnimaleseLanguage,
  type AnimaleseSettings,
  type AnimaleseVoiceBank,
} from '@/features/talk/animalese'
import { TalkScriptEditor } from '@/features/talk/components/TalkScriptEditor'
import { TalkTimeline, type TalkTimelineMarker } from '@/features/talk/components/TalkTimeline'
import type { GameBoyPitchPreset } from '@/features/talk/gameBoySpeech'
import {
  compileTalkScript,
  loadTalkScriptDocument,
  persistTalkScriptDocument,
  type TalkScriptDocument,
  type TalkTransform,
  type TimedTalkCue,
} from '@/features/talk/talkScript'
import type { StudioController } from '@/features/studio/useStudioController'
import {
  clampTalkTime,
  talkHighlightOffsetAtTime,
  talkSequenceStepIndexAtTime,
  talkTextOffsetAtTime,
  talkTimeAtTextOffset,
  talkWordRangeAtOffset,
  type PreparedTalkVoice,
  type TalkTextRange,
} from '@/features/talk/talkTimeline'
import { resolveSequenceExpression } from '@/features/animation/sequences'
import { defaultExpression } from '@/features/avatar/presets'
import {
  createJevDirectedTalkDocument,
  jevTransformPresets,
  JEV_NEUTRAL_EXPRESSION_ID,
  segmentTalkDirectionBeats,
  type JevDirectionResponse,
  type JevExpressionOption,
} from '@/features/talk/jevDirection'

const defaultTalkScript: TalkScriptDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Bonjour ! Aujourd’hui, ' },
        {
          type: 'avatarCue',
          attrs: { kind: 'expression', targetId: 'expression-11', label: 'joyful-wide' },
        },
        {
          type: 'text',
          text: 'j’ai quelque chose d’assez incroyable à te raconter. Au début, je pensais que ce serait une journée tout à fait ordinaire, mais ',
        },
        {
          type: 'avatarCue',
          attrs: { kind: 'expression', targetId: 'expression-03', label: 'surprised-left' },
        },
        {
          type: 'text',
          text: 'une surprise m’attendait juste au coin de la rue. J’ai pris une grande inspiration, j’ai regardé autour de moi, puis ',
        },
        {
          type: 'avatarCue',
          attrs: { kind: 'expression', targetId: 'expression-17', label: 'playful-right' },
        },
        {
          type: 'text',
          text: 'je me suis lancé avec un immense sourire. Alors, prêt à découvrir la suite de cette aventure avec moi ?',
        },
      ],
    },
  ],
}

export function TalkModePanel({ controller }: { controller: StudioController }) {
  const { t } = useStudioLanguage()
  const {
    activeAvatar,
    activeAvatarEyes,
    activeExpression,
    bodyNodes,
    canvasExpression,
    clearTalkTransform,
    expressions,
    launchTalkSequence,
    sequences,
    setTalkBubbleText,
    setTalkPlaybackStatus,
    surface,
    talkPlaybackStatus,
    transitionTalkToExpression,
    transitionTalkTransform,
  } = controller
  const [script, setScript] = useState(() =>
    loadTalkScriptDocument(activeAvatar.id, defaultTalkScript)
  )
  const [settings, setSettings] = useState(defaultAnimaleseSettings)
  const [timeline, setTimeline] = useState<PreparedTalkVoice | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [activeTextRange, setActiveTextRange] = useState<TalkTextRange | null>(null)
  const [scrubSound, setScrubSound] = useState(true)
  const [jevDirecting, setJevDirecting] = useState(false)
  const [jevError, setJevError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const preparationAbortRef = useRef<AbortController | null>(null)
  const scrubPreviewAbortRef = useRef<AbortController | null>(null)
  const playheadRef = useRef(0)
  const resumeAfterScrubRef = useRef(false)
  const lastScrubPreviewAtRef = useRef(0)
  const baselineExpressionRef = useRef(canvasExpression)
  const baselineExpressionIndexRef = useRef(activeExpression)
  const talkExpressionIds = [
    JEV_NEUTRAL_EXPRESSION_ID,
    ...expressions.map(expression => expression.id),
  ]
  const compiledScript = compileTalkScript(script, {
    expressionIds: talkExpressionIds,
    animationIds: sequences.map(sequence => sequence.id),
  })

  const updateSettings = (patch: Partial<AnimaleseSettings>) =>
    setSettings(current => ({ ...current, ...patch }))

  const selectLanguage = (language: AnimaleseLanguage) =>
    setSettings(current => ({ ...current, language }))

  const selectVoiceBank = (voiceBank: AnimaleseVoiceBank) =>
    setSettings(current => ({ ...current, voiceBank }))

  const updateScript = (nextScript: TalkScriptDocument) => {
    setScript(nextScript)
    persistTalkScriptDocument(activeAvatar.id, nextScript)
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setTalkPlaybackStatus('idle')
  }

  const cleanupTalkMode = useEffectEvent(() => {
    abortRef.current?.abort()
    preparationAbortRef.current?.abort()
    scrubPreviewAbortRef.current?.abort()
    clearTalkTransform()
    setTalkPlaybackStatus('idle')
  })
  useEffect(() => () => cleanupTalkMode(), [])

  useEffect(() => {
    const text = compiledScript.text
    stop()
    preparationAbortRef.current?.abort()
    scrubPreviewAbortRef.current?.abort()
    setTimeline(null)
    setPlayheadMs(0)
    playheadRef.current = 0
    setActiveTextRange(null)
    setTalkBubbleText('')
    if (!text.trim()) {
      setTimelineLoading(false)
      return
    }
    const preparationController = new AbortController()
    preparationAbortRef.current = preparationController
    setTimelineLoading(true)
    const timeout = window.setTimeout(() => {
      void prepareTalkVoice(text, settings, preparationController.signal)
        .then(prepared => {
          if (preparationController.signal.aborted) return
          baselineExpressionRef.current = canvasExpression
          baselineExpressionIndexRef.current = activeExpression
          setTimeline(prepared)
          setActiveTextRange(talkWordRangeAtOffset(text, 0))
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setTalkPlaybackStatus('error')
        })
        .finally(() => {
          if (preparationAbortRef.current === preparationController) {
            preparationAbortRef.current = null
            setTimelineLoading(false)
          }
        })
    }, 280)
    return () => {
      window.clearTimeout(timeout)
      preparationController.abort()
    }
  }, [compiledScript.text, settings])

  const triggerCue = (cue: TimedTalkCue) => {
    if (cue.kind === 'expression') {
      if (cue.targetId === JEV_NEUTRAL_EXPRESSION_ID) {
        transitionTalkToExpression(defaultExpression, null, cue.durationMs)
        return
      }
      const index = expressions.findIndex(expression => expression.id === cue.targetId)
      if (index >= 0) transitionTalkToExpression(expressions[index], index, cue.durationMs)
      return
    }
    if (cue.kind === 'transform') {
      transitionTalkTransform(cue.transform, cue.durationMs)
      return
    }
    const sequence = sequences.find(item => item.id === cue.targetId)
    if (sequence) launchTalkSequence(sequence)
  }

  const cueTime = (cue: TimedTalkCue, prepared = timeline) =>
    prepared ? talkTimeAtTextOffset(prepared, cue.offset) : 0

  const applyAvatarStateAtTime = (
    timeMs: number,
    prepared = timeline,
    transitionMs = 0,
    cues = compiledScript.cues
  ) => {
    if (!prepared) return
    let targetExpression = baselineExpressionRef.current
    let targetExpressionIndex = baselineExpressionIndexRef.current
    let targetTransform: TalkTransform | null = null
    for (const cue of cues) {
      const startsAt = cueTime(cue, prepared)
      if (startsAt > timeMs) continue
      if (cue.kind === 'expression') {
        if (cue.targetId === JEV_NEUTRAL_EXPRESSION_ID) {
          targetExpression = defaultExpression
          targetExpressionIndex = null
          targetTransform = null
          continue
        }
        const index = expressions.findIndex(expression => expression.id === cue.targetId)
        if (index >= 0) {
          targetExpression = expressions[index]
          targetExpressionIndex = index
          targetTransform = null
        }
        continue
      }
      if (cue.kind === 'transform') {
        targetTransform = cue.transform
        continue
      }
      const sequence = sequences.find(item => item.id === cue.targetId)
      if (!sequence) continue
      const stepIndex = talkSequenceStepIndexAtTime(sequence, timeMs - startsAt)
      const step = stepIndex === null ? undefined : sequence.steps[stepIndex]
      if (!step) continue
      const resolved = resolveSequenceExpression(expressions, step.expressionId)
      if (resolved.expression) {
        targetExpression = resolved.expression
        targetExpressionIndex = resolved.index
        targetTransform = null
      }
    }
    clearTalkTransform()
    transitionTalkToExpression(targetExpression, targetExpressionIndex, transitionMs)
    if (targetTransform) {
      transitionTalkTransform(targetTransform, transitionMs)
    }
  }

  const reflectTime = (
    timeMs: number,
    prepared = timeline,
    updateAvatar = false,
    cues = compiledScript.cues
  ) => {
    if (!prepared) return
    const time = clampTalkTime(prepared, timeMs)
    const textOffset = talkTextOffsetAtTime(prepared, time)
    const highlightOffset = talkHighlightOffsetAtTime(prepared, time)
    playheadRef.current = time
    setPlayheadMs(time)
    setTalkBubbleText(compiledScript.text.slice(0, textOffset))
    setActiveTextRange(talkWordRangeAtOffset(compiledScript.text, highlightOffset))
    if (updateAvatar) applyAvatarStateAtTime(time, prepared, 0, cues)
  }

  const speak = async (startMs = playheadRef.current, cues = compiledScript.cues) => {
    if (!timeline || !compiledScript.text.trim()) return
    stop()
    const playbackController = new AbortController()
    abortRef.current = playbackController
    const playbackStart = startMs >= timeline.durationMs ? 0 : startMs
    reflectTime(playbackStart, timeline, true, cues)
    let nextCueIndex = cues.findIndex(cue => cueTime(cue, timeline) > playbackStart)
    if (nextCueIndex < 0) nextCueIndex = cues.length
    setTalkPlaybackStatus('loading')
    try {
      await playPreparedTalkVoice(timeline, {
        signal: playbackController.signal,
        offsetMs: playbackStart,
        volume: settings.volume,
        onReady: () => setTalkPlaybackStatus('speaking'),
        onTime: timeMs => {
          while (nextCueIndex < cues.length && cueTime(cues[nextCueIndex], timeline) <= timeMs) {
            triggerCue(cues[nextCueIndex])
            nextCueIndex += 1
          }
          reflectTime(timeMs, timeline)
        },
      })
      if (!playbackController.signal.aborted) setTalkPlaybackStatus('idle')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setTalkPlaybackStatus('error')
    } finally {
      if (abortRef.current === playbackController) abortRef.current = null
    }
  }

  const directWithJev = async () => {
    const text = compiledScript.text
    if (!text.trim() || jevDirecting) return
    const beats = segmentTalkDirectionBeats(text)
    const expressionOptions: JevExpressionOption[] = [
      { id: JEV_NEUTRAL_EXPRESSION_ID, label: 'neutral' },
      ...expressions.map((expression, index) => ({
        id: expression.id,
        label: expression.semanticKey ?? `${t('Expression')} ${String(index).padStart(2, '0')}`,
      })),
    ]
    stop()
    clearTalkTransform()
    transitionTalkToExpression(defaultExpression, null, 180)
    baselineExpressionRef.current = defaultExpression
    baselineExpressionIndexRef.current = null
    setJevError(null)
    setJevDirecting(true)
    try {
      const response = await fetch('/api/direct-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          beats,
          expressions: expressionOptions,
          movements: jevTransformPresets.map(({ id, label, description }) => ({
            id,
            label,
            description,
          })),
        }),
      })
      const payload = (await response.json()) as JevDirectionResponse & { error?: string }
      if (!response.ok)
        throw new Error(payload.error ?? t('Jev n’a pas pu mettre en scène ce texte.'))
      const directedDocument = createJevDirectedTalkDocument(
        text,
        beats,
        payload.decisions,
        expressionOptions
      )
      const directedScript = compileTalkScript(directedDocument, {
        expressionIds: talkExpressionIds,
        animationIds: sequences.map(sequence => sequence.id),
      })
      updateScript(directedDocument)
      await speak(0, directedScript.cues)
    } catch (error) {
      setJevError(
        error instanceof Error ? error.message : t('Jev n’a pas pu mettre en scène ce texte.')
      )
    } finally {
      setJevDirecting(false)
    }
  }

  const seek = (timeMs: number, previewAudio = true) => {
    if (!timeline) return
    reflectTime(timeMs, timeline)
    applyAvatarStateAtTime(timeMs, timeline, 180)
    if (!previewAudio || !scrubSound || performance.now() - lastScrubPreviewAtRef.current < 75) {
      return
    }
    lastScrubPreviewAtRef.current = performance.now()
    scrubPreviewAbortRef.current?.abort()
    const previewController = new AbortController()
    scrubPreviewAbortRef.current = previewController
    void playPreparedTalkVoice(timeline, {
      signal: previewController.signal,
      offsetMs: timeMs,
      previewDurationMs: 90,
      volume: settings.volume,
    }).catch(error => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setTalkPlaybackStatus('error')
      }
    })
  }

  const beginScrub = () => {
    resumeAfterScrubRef.current = talkPlaybackStatus === 'speaking'
    abortRef.current?.abort()
    abortRef.current = null
    setTalkPlaybackStatus('idle')
  }

  const endScrub = (timeMs: number) => {
    seek(timeMs, false)
    if (!resumeAfterScrubRef.current) return
    resumeAfterScrubRef.current = false
    void speak(timeMs)
  }

  const busy = talkPlaybackStatus === 'loading' || talkPlaybackStatus === 'speaking'
  const timelineMarkers: TalkTimelineMarker[] = compiledScript.cues.map((cue, index) => ({
    id: `${cue.kind}-${index}-${cue.offset}`,
    kind: cue.kind,
    label: cue.label,
    timeMs: cueTime(cue),
  }))

  return (
    <div className="panel-stack talk-panel-stack">
      <ControlSection
        title={t('Dialogue')}
        subtitle={t('Écris une phrase et fais parler l’avatar directement dans le navigateur.')}
      >
        <InspectorCard className="talk-composer-card">
          <PanelTitle
            title={t('Texte de l’avatar')}
            subtitle={t('Le texte reste local et n’est envoyé à aucun service.')}
          />
          <TalkScriptEditor
            activeTextRange={activeTextRange}
            document={script}
            expressions={expressions}
            previewContext={{
              surface,
              bodyNodes,
              colors: activeAvatar.colors,
              avatarEyes: activeAvatarEyes,
              renderStyle: activeAvatar.renderStyle,
            }}
            sequences={sequences}
            placeholder={t('Écris ce que ton avatar doit dire…')}
            t={t}
            onChange={updateScript}
          />
          <TalkTimeline
            currentMs={playheadMs}
            durationMs={timeline?.durationMs ?? 0}
            loading={timelineLoading}
            markers={timelineMarkers}
            playing={talkPlaybackStatus === 'speaking'}
            scrubSound={scrubSound}
            t={t}
            onPlayPause={() => (busy ? stop() : void speak())}
            onReset={() => seek(0, false)}
            onScrubEnd={endScrub}
            onScrubStart={beginScrub}
            onSeek={seek}
            onToggleScrubSound={() => setScrubSound(current => !current)}
          />
          <div className="talk-playback-actions">
            <Button
              className="talk-primary-action"
              type="button"
              disabled={!compiledScript.text.trim() || timelineLoading || !timeline || jevDirecting}
              onClick={() => (busy ? stop() : void speak())}
            >
              {busy ? <Pause /> : <AudioLines />}
              {t(busy ? 'Mettre le dialogue en pause' : 'Faire parler')}
            </Button>
            <Button
              className="talk-jev-action"
              type="button"
              variant="outline"
              disabled={
                !compiledScript.text.trim() || jevDirecting || busy || timelineLoading || !timeline
              }
              onClick={() => void directWithJev()}
            >
              {jevDirecting ? <LoaderCircle className="is-spinning" /> : <Sparkles />}
              {t(jevDirecting ? 'Jev choisit les expressions…' : 'Laisser Jev mettre en scène')}
            </Button>
          </div>
          {jevError ? <p className="talk-jev-error">{jevError}</p> : null}
        </InspectorCard>
      </ControlSection>

      <ControlSection
        title={t('Voix')}
        subtitle={t('Les réglages affichés dépendent de la banque sélectionnée.')}
      >
        <InspectorCard className="talk-settings-card">
          <Field className="talk-language-field" orientation="horizontal">
            <FieldTitle>{t('Banque de voix')}</FieldTitle>
            <Select
              value={settings.voiceBank}
              items={[
                { value: 'animalese', label: t('Animalese') },
                { value: 'rpg', label: t('RPG Blips') },
                { value: 'game-boy', label: t('Game boy') },
              ]}
              onValueChange={value => value && selectVoiceBank(value as AnimaleseVoiceBank)}
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
          {settings.voiceBank === 'animalese' ? (
            <Field className="talk-language-field" orientation="horizontal">
              <FieldTitle>{t('Langue de la voix')}</FieldTitle>
              <Select
                value={settings.language}
                items={[
                  { value: 'fr', label: t('Français') },
                  { value: 'en', label: t('Anglais') },
                  { value: 'ja', label: t('Japonais') },
                ]}
                onValueChange={value => value && selectLanguage(value as AnimaleseLanguage)}
              >
                <SelectTrigger aria-label={t('Langue de la voix')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">{t('Français')}</SelectItem>
                  <SelectItem value="en">{t('Anglais')}</SelectItem>
                  <SelectItem value="ja">{t('Japonais')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {settings.voiceBank === 'game-boy' ? (
            <Field className="talk-language-field" orientation="horizontal">
              <FieldTitle>{t('Registre de voix')}</FieldTitle>
              <Select
                value={settings.gameBoyPitch}
                items={[
                  { value: 'low', label: t('Grave · 100 Hz') },
                  { value: 'male', label: t('Masculine · 120 Hz') },
                  { value: 'medium', label: t('Moyenne · 150 Hz') },
                  { value: 'female', label: t('Féminine · 180 Hz') },
                  { value: 'high', label: t('Aiguë · 280 Hz') },
                ]}
                onValueChange={value =>
                  value && updateSettings({ gameBoyPitch: value as GameBoyPitchPreset })
                }
              >
                <SelectTrigger aria-label={t('Registre de voix')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('Grave · 100 Hz')}</SelectItem>
                  <SelectItem value="male">{t('Masculine · 120 Hz')}</SelectItem>
                  <SelectItem value="medium">{t('Moyenne · 150 Hz')}</SelectItem>
                  <SelectItem value="female">{t('Féminine · 180 Hz')}</SelectItem>
                  <SelectItem value="high">{t('Aiguë · 280 Hz')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <>
              <NumericField
                label={t('Hauteur de voix')}
                value={settings.pitch}
                min={0.5}
                max={3}
                step={0.1}
                unit="×"
                onChange={pitch => updateSettings({ pitch })}
              />
              <NumericField
                label={t('Variation aléatoire')}
                value={settings.randomness}
                min={0}
                max={1}
                step={0.1}
                onChange={randomness => updateSettings({ randomness })}
              />
              <NumericField
                label={t('Fréquence mélodique')}
                value={settings.melodyRate}
                min={0}
                max={1}
                step={0.01}
                onChange={melodyRate => updateSettings({ melodyRate })}
              />
              <NumericField
                label={t('Amplitude mélodique')}
                value={settings.melodyAmplitude}
                min={0}
                max={1}
                step={0.01}
                onChange={melodyAmplitude => updateSettings({ melodyAmplitude })}
              />
            </>
          )}
          <NumericField
            label={t('Vitesse de parole')}
            value={settings.speed}
            min={1}
            max={10}
            step={1}
            onChange={speed => updateSettings({ speed })}
          />
          <NumericField
            label={t('Volume')}
            value={settings.volume}
            min={0}
            max={2}
            step={0.1}
            unit="×"
            onChange={volume => updateSettings({ volume })}
          />
          {settings.voiceBank === 'game-boy' ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => setSettings(defaultAnimaleseSettings)}
            >
              <RotateCcw />
              {t('Réinitialiser les réglages de voix')}
            </Button>
          ) : null}
        </InspectorCard>
      </ControlSection>

      {settings.voiceBank === 'game-boy' ? null : (
        <ControlSection
          title={t('Rythme')}
          subtitle={t('Pauses et ponctuation utilisées pour cadencer les phrases.')}
        >
          <InspectorCard className="talk-settings-card">
            <NumericField
              label={t('Pause entre les mots')}
              value={settings.spaceDelay}
              min={0}
              max={5}
              step={0.01}
              unit="s"
              onChange={spaceDelay => updateSettings({ spaceDelay })}
            />
            <NumericField
              label={t('Pause de ponctuation')}
              value={settings.punctuationDelay}
              min={0}
              max={5}
              step={0.1}
              unit="s"
              onChange={punctuationDelay => updateSettings({ punctuationDelay })}
            />
            {settings.voiceBank === 'animalese' ? (
              <NumericField
                label={t('Tentatives de chargement')}
                value={settings.maxRetries}
                min={0}
                max={100}
                step={1}
                onChange={maxRetries => updateSettings({ maxRetries })}
              />
            ) : null}
            <Field className="talk-punctuation-field">
              <FieldTitle>{t('Caractères de ponctuation')}</FieldTitle>
              <Input
                value={settings.punctuations}
                onChange={event => updateSettings({ punctuations: event.currentTarget.value })}
              />
            </Field>
            <Button
              variant="outline"
              type="button"
              onClick={() => setSettings(defaultAnimaleseSettings)}
            >
              <RotateCcw />
              {t('Réinitialiser les réglages de voix')}
            </Button>
          </InspectorCard>
        </ControlSection>
      )}

      <p className="talk-attribution">
        {t('Synthèse Animalese locale propulsée par')}{' '}
        <a href="https://github.com/izure1/animalese-tts" target="_blank" rel="noreferrer">
          Animalese TTS
        </a>
        . {t('Les bips RPG sont générés directement par le navigateur.')}{' '}
        {t('La synthèse Game Boy adapte')}{' '}
        <a href="https://github.com/paladin-t/gb-speech" target="_blank" rel="noreferrer">
          gb-speech
        </a>
        .
      </p>
    </div>
  )
}
