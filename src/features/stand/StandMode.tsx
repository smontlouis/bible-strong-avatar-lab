import { ArrowLeft, Camera, Maximize, Settings2, ShieldCheck, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { StandCameraSelect } from './StandCameraSelect'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { StudioAvatar } from '@/features/avatar/avatars'
import { useStudioLanguage } from '@/i18n'
import { StandAvatar } from './StandAvatar'
import { StandInvitation } from './StandInvitation'
import { StandHands, type HandStatus } from './StandHands'
import { StandResources } from './StandResources'
import { standResources, type StandResourceId } from './resourceCatalog'
import type { StandCue } from './standEncounter'
import { startStandCamera, type CameraStatus } from './standCamera'
import { StandDiagnostics } from './StandDiagnostics'
import { createStandDirector, type StandMood, type StandObservation } from './standDirector'
import { readStandSettings, saveStandSettings, type StandSettings } from './standSettings'
import './standMode.css'
import './standResources.css'

const moodLabels: Record<StandMood, string> = {
  idle: 'Dans sa bulle',
  wary: 'Un peu méfiant…',
  curious: 'Curieux',
  greeting: 'Coucou !',
  playful: 'Prêt à jouer',
}
const errors: Partial<Record<CameraStatus, string>> = {
  denied: 'Autorisez la caméra dans votre navigateur, puis réessayez.',
  unavailable: 'Caméra indisponible. Vérifiez son branchement et utilisez HTTPS ou localhost.',
  failed:
    'Le suivi a été interrompu. Vérifiez votre connexion pour charger les modèles, puis réessayez.',
}

export default function StandMode({
  avatar,
  reducedMotion,
  onExit,
}: {
  avatar: StudioAvatar
  reducedMotion: boolean
  onExit: () => void
}) {
  const { t } = useStudioLanguage()
  const root = useRef<HTMLElement>(null)
  const panel = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const debugVideo = useRef<HTMLVideoElement>(null)
  const debug = new URLSearchParams(window.location.search).has('debug')
  const observation = useRef<StandObservation | null>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const [director, setDirector] = useState(createStandDirector)
  const [settings, setSettings] = useState(readStandSettings)
  const { cameraId, mirror, proximity, invitations, resources, landmarks } = settings
  const updateSetting = <K extends keyof StandSettings>(key: K, value: StandSettings[K]) => {
    setSettings(current => ({ ...current, [key]: value }))
  }
  useEffect(() => {
    saveStandSettings(settings)
  }, [settings])
  const keepSettingsOpen = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<CameraStatus | 'idle'>('idle')
  const [panelOpen, setPanelOpen] = useState(true)
  const [activeResource, setActiveResource] = useState<StandResourceId | null>(null)
  const [hand, setHand] = useState<HandStatus>({ mode: 'hidden', hover: null })
  const [presentation, setPresentation] = useState<{ mood: StandMood; cue: StandCue }>({
    mood: 'idle',
    cue: 'idle',
  })
  const [calibrationResult, setCalibrationResult] = useState<'done' | 'missing' | null>(null)
  const [fullscreenUnavailable, setFullscreenUnavailable] = useState(false)
  const close = useEffectEvent(onExit)
  const running = status === 'running'
  const error = status !== 'idle' ? errors[status] : undefined
  const showPanel = panelOpen || !running
  const exploring = resources && running && !showPanel

  useEffect(() => {
    if (showPanel && panel.current) panel.current.scrollTop = 0
  }, [showPanel])

  useEffect(() => {
    root.current?.focus()
    let hadFullscreen = false
    const fullscreenChanged = () => {
      if (document.fullscreenElement) hadFullscreen = true
      else if (hadFullscreen) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('fullscreenchange', fullscreenChanged)
    window.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChanged)
      window.removeEventListener('keydown', escape, true)
      if (document.fullscreenElement === document.documentElement)
        void document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!attempt || !video.current) return
    observation.current = null
    return startStandCamera(
      video.current,
      next => {
        director.observe(next)
        observation.current = next
      },
      next => {
        setStatus(next)
        if (next === 'running') {
          setPanelOpen(keepSettingsOpen.current)
          if (!keepSettingsOpen.current) root.current?.focus()
        }
      },
      cameraId
    )
  }, [attempt, director, cameraId])

  const fullscreen = () => {
    setFullscreenUnavailable(false)
    if (!document.documentElement.requestFullscreen) {
      setFullscreenUnavailable(true)
      return
    }
    void document.documentElement.requestFullscreen().catch(() => setFullscreenUnavailable(true))
  }
  const start = () => {
    keepSettingsOpen.current = false
    setActiveResource(null)
    setCalibrationResult(null)
    setStatus('loading')
    setDirector(createStandDirector())
    setAttempt(current => current + 1)
    fullscreen()
  }
  const togglePanel = () => {
    setPanelOpen(current => !current)
  }
  const handAction = (action: string) => {
    if (action === 'close' || action === 'reset') setActiveResource(null)
    else if (action === 'up' || action === 'down') {
      const scroller = root.current?.querySelector<HTMLElement>('[data-stand-scroll]')
      if (scroller) scroller.scrollTop += scroller.clientHeight * 0.7 * (action === 'up' ? -1 : 1)
    } else {
      const resource = standResources.find(resource => `open:${resource.id}` === action)
      if (resource) setActiveResource(resource.id)
    }
  }

  return (
    <main
      className={`stand-mode${showPanel ? ' stand-configuring' : exploring ? ` stand-exploring${activeResource ? ' stand-reading' : ''}` : running && invitations ? ' stand-presenting' : ''}`}
      data-reduced-motion={reducedMotion}
      ref={root}
      tabIndex={-1}
      aria-label={t('Mode stand')}
    >
      <div className="stand-scene">
        <StandAvatar
          avatar={avatar}
          director={director}
          settings={{ mirror, proximity, reducedMotion }}
          onPresentation={setPresentation}
        />
      </div>
      {running && invitations && !showPanel && !exploring && (
        <StandInvitation cue={presentation.cue} name={avatar.name} />
      )}
      {exploring && (
        <>
          <StandResources
            active={activeResource}
            onOpen={setActiveResource}
            onClose={() => setActiveResource(null)}
            hand={hand}
            root={root}
            cue={presentation.cue}
          />
        </>
      )}
      {running && resources && (
        <StandHands
          root={root}
          observation={observation}
          director={director}
          mirror={mirror}
          reader={activeResource}
          enabled={exploring}
          onAction={handAction}
          onStatus={setHand}
        />
      )}
      {debug && running && !showPanel && (
        <StandDiagnostics
          compact
          sourceVideo={video}
          video={debugVideo}
          observation={observation}
          director={director}
          visible
          mirror={mirror}
          status={status}
          mood={moodLabels[presentation.mood]}
          cue={presentation.cue}
          handMode={hand.mode}
        />
      )}
      <div className="stand-toolbar">
        <Button variant="secondary" onClick={onExit} aria-label={t('Retour au studio')}>
          <ArrowLeft />
          <span>{t('Quitter')}</span>
        </Button>
        {running && (
          <Button
            ref={settingsButton}
            variant="secondary"
            onClick={togglePanel}
            aria-expanded={showPanel}
            aria-controls="stand-settings"
          >
            <Settings2 />
            {t('Réglages du stand')}
          </Button>
        )}
      </div>
      <aside
        id="stand-settings"
        ref={panel}
        className="stand-panel"
        hidden={!showPanel}
        aria-label={t('Réglages du stand')}
      >
        <div className="stand-panel-heading">
          <span className="stand-eyebrow">{t('RENCONTREZ VOTRE AVATAR')}</span>
          {running && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('Masquer les réglages')}
              onClick={() => {
                setPanelOpen(false)
                settingsButton.current?.focus()
              }}
            >
              <X />
            </Button>
          )}
        </div>
        <h1>{t(running ? 'Réglages du stand' : 'Mode stand')}</h1>
        {!running && <p className="stand-intro">{t('Un peu méfiant. Bientôt complice.')}</p>}
        {!running && (
          <p className="stand-description">
            {t(
              'Approchez-vous, laissez-le vous observer… puis faites-lui coucou pour briser la glace.'
            )}
          </p>
        )}
        <StandCameraSelect
          value={cameraId}
          status={status}
          onChange={id => {
            if (id === cameraId) return
            keepSettingsOpen.current = true
            setPanelOpen(true)
            setActiveResource(null)
            setCalibrationResult(null)
            setDirector(createStandDirector())
            if (attempt) setStatus('loading')
            updateSetting('cameraId', id)
          }}
        />
        <StandDiagnostics
          video={video}
          observation={observation}
          director={director}
          overlay={landmarks}
          onOverlayChange={value => updateSetting('landmarks', value)}
          visible={showPanel}
          mirror={mirror}
          status={status}
          mood={moodLabels[presentation.mood]}
          cue={presentation.cue}
          handMode={hand.mode}
        />
        <div className="stand-settings-controls">
          <div className="stand-setting-row">
            <label htmlFor="stand-resources">
              {t('Afficher les ressources et la main virtuelle')}
            </label>
            <Switch
              id="stand-resources"
              checked={resources}
              onCheckedChange={value => {
                updateSetting('resources', value)
                if (!value) setActiveResource(null)
              }}
            />
          </div>
          <div className="stand-setting-row">
            <label htmlFor="stand-mirror">{t('Inverser le suivi horizontal')}</label>
            <Switch
              id="stand-mirror"
              checked={mirror}
              onCheckedChange={value => updateSetting('mirror', value)}
            />
          </div>
          <div className="stand-setting-row">
            <label htmlFor="stand-invitations">{t('Afficher les invitations à jouer')}</label>
            <Switch
              id="stand-invitations"
              checked={invitations}
              onCheckedChange={value => updateSetting('invitations', value)}
            />
          </div>
          {running && (
            <div className="stand-calibration">
              <Button
                variant="secondary"
                onClick={() =>
                  setCalibrationResult(
                    director.calibrateGaze(performance.now()) ? 'done' : 'missing'
                  )
                }
              >
                {t('Calibrer le regard')}
              </Button>
              <p className="stand-note">
                {t('Placez-vous au centre de l’écran, à votre distance habituelle, puis calibrez.')}
              </p>
              {calibrationResult && (
                <p className="stand-note" role="status">
                  {t(
                    calibrationResult === 'done'
                      ? 'Regard centré. Vous pouvez vous déplacer.'
                      : 'Aucun visage suivi. Placez-vous devant la caméra et réessayez.'
                  )}
                </p>
              )}
            </div>
          )}
          <div className="stand-proximity">
            <span id="stand-proximity-label">
              {t('Distance d’accueil')} · ≈ {proximity.toFixed(1)} m
            </span>
            <Slider
              aria-labelledby="stand-proximity-label"
              min={1}
              max={3}
              step={0.1}
              value={proximity}
              onValueChange={value =>
                updateSetting('proximity', Array.isArray(value) ? value[0] : value)
              }
            />
            <div>
              <span>{t('Plus près')}</span>
              <span>{t('Plus loin')}</span>
            </div>
            <p className="stand-note">
              {t(
                'Réglé pour des visiteurs à 1–2 m. Strobi se rapproche progressivement quand ils avancent.'
              )}
            </p>
          </div>
        </div>
        {error && (
          <p className="stand-error" role="alert">
            {t(error)}
          </p>
        )}
        {fullscreenUnavailable && (
          <p className="stand-note" role="status">
            {t('Plein écran indisponible. Le mode stand reste actif dans cette fenêtre.')}
          </p>
        )}
        {running ? (
          <Button
            className="stand-start"
            onClick={() => {
              fullscreen()
              setPanelOpen(false)
              settingsButton.current?.focus()
            }}
          >
            <Maximize />
            {t('Reprendre le plein écran')}
          </Button>
        ) : (
          <Button className="stand-start" onClick={start} disabled={status === 'loading'}>
            <Camera />
            {t(
              status === 'loading'
                ? 'Préparation…'
                : error
                  ? 'Réessayer'
                  : 'Activer la caméra et démarrer'
            )}
          </Button>
        )}
        <p className="stand-privacy">
          <ShieldCheck />
          <span>
            {t(
              'Images analysées sur cet appareil, sans enregistrement ni envoi. Une connexion est nécessaire au chargement des modèles.'
            )}
          </span>
        </p>
        <p className="stand-exit-hint">{t('Échap pour quitter et éteindre la caméra.')}</p>
      </aside>
    </main>
  )
}
