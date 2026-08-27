import { AudioLines, RotateCcw, Square } from 'lucide-react'
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
  speakTalkVoice,
  type AnimaleseLanguage,
  type AnimaleseSettings,
  type AnimaleseVoiceBank,
} from '@/features/talk/animalese'
import { TalkScriptEditor } from '@/features/talk/components/TalkScriptEditor'
import type { GameBoyPitchPreset } from '@/features/talk/gameBoySpeech'
import {
  compileTalkScript,
  loadTalkScriptDocument,
  persistTalkScriptDocument,
  type TalkScriptDocument,
  type TimedTalkCue,
} from '@/features/talk/talkScript'
import type { StudioController } from '@/features/studio/useStudioController'

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
    bodyNodes,
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
  const abortRef = useRef<AbortController | null>(null)
  const compiledScript = compileTalkScript(script, {
    expressionIds: expressions.map(expression => expression.id),
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
    clearTalkTransform()
    setTalkPlaybackStatus('idle')
  })
  useEffect(() => () => cleanupTalkMode(), [])

  const triggerCue = (cue: TimedTalkCue) => {
    if (cue.kind === 'expression') {
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

  const speak = async () => {
    if (!compiledScript.text.trim()) return
    stop()
    const playbackController = new AbortController()
    abortRef.current = playbackController
    setTalkBubbleText('')
    setTalkPlaybackStatus('loading')
    try {
      await speakTalkVoice(compiledScript.text, settings, {
        cues: compiledScript.cues,
        signal: playbackController.signal,
        onCue: triggerCue,
        onReady: () => setTalkPlaybackStatus('speaking'),
        onCharacter: character => setTalkBubbleText(current => current + character),
      })
      if (!playbackController.signal.aborted) setTalkPlaybackStatus('idle')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setTalkPlaybackStatus('error')
    } finally {
      if (abortRef.current === playbackController) abortRef.current = null
    }
  }

  const busy = talkPlaybackStatus === 'loading' || talkPlaybackStatus === 'speaking'

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
          <Button
            className="talk-primary-action"
            type="button"
            disabled={!compiledScript.text.trim()}
            onClick={() => (busy ? stop() : void speak())}
          >
            {busy ? <Square /> : <AudioLines />}
            {t(busy ? 'Arrêter la voix' : 'Faire parler')}
          </Button>
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
