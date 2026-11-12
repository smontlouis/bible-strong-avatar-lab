import { ArrowLeft, Camera, Maximize, Settings2, ShieldCheck, X } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'

import { Button } from '@/components/ui/button'
import { StandCameraSelect } from './StandCameraSelect'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { StudioAvatar } from '@/features/avatar/avatars'
import { useStudioLanguage } from '@/i18n'
import { StandAvatar, type StandFrame } from './StandAvatar'
import { StandBrand, StandQr } from './StandBrand'
import { StandCompanions } from './StandCompanions'
import { StandEffects } from './StandEffects'
import {
  StandBadges,
  StandBubble,
  StandCoach,
  StandInstruction,
  type CoachProgress,
} from './StandGuide'
import { StandHands, type HandStatus } from './StandHands'
import { StandResources } from './StandResources'
import { StandSimulatorPanel } from './StandSimulatorPanel'
import { standResources, type StandResourceId } from './resourceCatalog'
import { bubbleCopy, isReplyCue } from './standCopy'
import { collectionActions, secretActions, type StandAction, type StandCue } from './standEncounter'
import { startStandCamera, type CameraStatus } from './standCamera'
import { StandDiagnostics } from './StandDiagnostics'
import { createStandDirector, type StandMood, type StandObservation } from './standDirector'
import type { HandFrame } from './standHandNavigation'
import { chooseCompanions, createStandCrowd } from './standCrowd'
import { createStandJourney, type StandStage } from './standJourney'
import { createParticleField, type StandBurst } from './standParticles'
import { readStandSettings, saveStandSettings, type StandSettings } from './standSettings'
import { createStandSimulator, startStandSimulation } from './standSimulator'
import './standMode.css'
import './standStage.css'
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
const cueBursts: Partial<Record<StandCue, StandBurst>> = {
  hello: 'celebrate',
  'smile-reply': 'smile',
  'thumbs-up-reply': 'approve',
  'victory-reply': 'victory',
  'tilt-reply': 'tilt',
  'thumbs-down-reply': 'sulk',
  farewell: 'farewell',
}
const noCoaching: CoachProgress = { raised: false, aimed: false, opened: false }
type Presentation = { mood: StandMood; cue: StandCue; stage: StandStage; discovered: StandAction[] }
type SimulatorState = ReturnType<typeof createStandSimulator>['state']

export default function StandMode({
  avatar,
  avatars,
  reducedMotion,
  autoStart = false,
  onExit,
}: {
  avatar: StudioAvatar
  avatars: StudioAvatar[]
  reducedMotion: boolean
  autoStart?: boolean
  onExit: () => void
}) {
  const { t } = useStudioLanguage()
  const root = useRef<HTMLElement>(null)
  const panel = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const debugVideo = useRef<HTMLVideoElement>(null)
  const search = new URLSearchParams(window.location.search)
  const debug = search.has('debug')
  // `/stand?simulate` drives a synthetic visitor from the keyboard and pointer.
  const simulate = search.has('simulate')
  const observation = useRef<StandObservation | null>(null)
  const handSign = useRef<HandFrame['sign']>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const [director, setDirector] = useState(createStandDirector)
  const [journey, setJourney] = useState(createStandJourney)
  const [particles] = useState(() => createParticleField())
  const [crowd] = useState(() => createStandCrowd(3))
  const gestureProgress = useMotionValue(0)
  const [settings, setSettings] = useState(readStandSettings)
  const { cameraId, mirror, proximity, invitations, resources, landmarks, companions } = settings
  const companionAvatars = chooseCompanions(avatars, avatar.id, settings.companionIds)
  const otherAvatars = avatars.filter(other => other.id !== avatar.id)
  useEffect(() => {
    crowd.setSlots(companions ? companionAvatars.length : 0)
  }, [crowd, companions, companionAvatars.length])
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
  // A configured stand opened at /stand starts without showing the settings.
  const [booting, setBooting] = useState(() => autoStart && (simulate || settings.configured))
  const [activeResource, setActiveResource] = useState<StandResourceId | null>(null)
  const [hand, setHand] = useState<HandStatus>({ mode: 'hidden', hover: null })
  const [presentation, setPresentation] = useState<Presentation>({
    mood: 'idle',
    cue: 'idle',
    stage: 'attract',
    discovered: [],
  })
  const presented = useRef(presentation)
  const [coach, setCoach] = useState(noCoaching)
  const [simulation, setSimulation] = useState<SimulatorState | null>(null)
  const dozedAt = useRef(-Infinity)
  const [attractLine, setAttractLine] = useState(0)
  // Strobi introduces its friends when a group arrives (at most every 30 s).
  const [introducing, setIntroducing] = useState(false)
  const [companionCount, setCompanionCount] = useState(0)
  const introducedAt = useRef(-Infinity)
  const [calibrationResult, setCalibrationResult] = useState<'done' | 'missing' | null>(null)
  const [fullscreenUnavailable, setFullscreenUnavailable] = useState(false)
  const close = useEffectEvent(onExit)
  const readMirror = useEffectEvent(() => mirror)
  const running = status === 'running'
  const error = status !== 'idle' ? errors[status] : undefined
  const showPanel = (panelOpen || !running) && !booting
  const live = running && !showPanel
  const { stage, cue, discovered } = presentation
  const exploring = live && stage === 'explore'
  const reading = exploring && activeResource !== null

  const burst = useEffectEvent((name: StandBurst, scale = 1, dx = 0, dy = -0.2) => {
    if (reducedMotion || !live) return
    const head = root.current?.querySelector('[data-stand-pet-target]')?.getBoundingClientRect()
    if (head?.width)
      particles.burst(
        name,
        head.x + head.width * (0.5 + dx),
        head.y + head.height * (0.5 + dy),
        scale
      )
  })

  // Every rendered frame: gesture progress stays in a Motion value, React only
  // hears about coarse changes of mood, cue, stage or discoveries.
  const presentFrame = (frame: StandFrame, at: number) => {
    const target = isReplyCue(frame.cue) ? 1 : frame.progress
    const smoothing = target < gestureProgress.get() ? 0.5 : 0.3
    gestureProgress.set(gestureProgress.get() + (target - gestureProgress.get()) * smoothing)
    const { stage } = journey.sample({
      at,
      present: frame.present,
      friendly: frame.friendly,
      cue: frame.cue,
      resources: resources && running,
    })
    const previous = presented.current
    if (
      previous.mood !== frame.mood ||
      previous.cue !== frame.cue ||
      previous.stage !== stage ||
      previous.discovered.join() !== frame.discovered.join()
    ) {
      presented.current = { mood: frame.mood, cue: frame.cue, stage, discovered: frame.discovered }
      setPresentation(presented.current)
      if (previous.stage === 'explore' && stage !== 'explore') setActiveResource(null)
      if (stage === 'attract' && previous.stage !== 'attract') setCoach(noCoaching)
      if (frame.cue !== previous.cue && cueBursts[frame.cue]) burst(cueBursts[frame.cue]!)
      // The sulk ends in forgiveness: hearts once the pout is over.
      if (frame.cue === 'thumbs-down-reply' && previous.cue !== frame.cue)
        setTimeout(() => burst('farewell', 0.8), 1400)
      const suggested = (actions: StandAction[]) =>
        actions.filter(action => !secretActions.has(action)).length
      const allSuggested = collectionActions.length - secretActions.size
      if (
        frame.discovered.length === collectionActions.length &&
        previous.discovered.length < collectionActions.length
      )
        burst('celebrate', 1.4)
      else if (
        suggested(frame.discovered) === allSuggested &&
        suggested(previous.discovered) < allSuggested
      )
        burst('celebrate', 1.15)
    }
    if (live && frame.sleepy > 0.5 && at - dozedAt.current > 1300) {
      dozedAt.current = at
      burst('zzz', 1, 0.3, -0.4)
    }
  }

  useEffect(() => {
    if (showPanel && panel.current) panel.current.scrollTop = 0
  }, [showPanel])

  useEffect(() => {
    if (!live || stage !== 'attract') return
    const timer = setInterval(() => setAttractLine(line => line + 1), 7000)
    return () => clearInterval(timer)
  }, [live, stage])

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
    if (!attempt || !video.current || !root.current) return
    observation.current = null
    const observe = (next: StandObservation) => {
      director.observe(next)
      crowd.observe(next, director.inspect(next.timestamp, false).target)
      observation.current = next
    }
    const report = (next: CameraStatus) => {
      setStatus(next)
      // A failed automatic start falls back to the settings and their error.
      if (next !== 'loading') setBooting(false)
      if (next === 'running' && !simulate)
        setSettings(current => (current.configured ? current : { ...current, configured: true }))
      if (next === 'running') {
        setPanelOpen(keepSettingsOpen.current)
        if (!keepSettingsOpen.current) root.current?.focus()
      }
    }
    return simulate
      ? startStandSimulation(root.current, observe, report, () => readMirror(), setSimulation)
      : startStandCamera(video.current, observe, report, cameraId)
  }, [attempt, director, cameraId, simulate])

  const fullscreen = () => {
    setFullscreenUnavailable(false)
    if (!document.documentElement.requestFullscreen) {
      setFullscreenUnavailable(true)
      return
    }
    void document.documentElement.requestFullscreen().catch(() => setFullscreenUnavailable(true))
  }
  const restart = () => {
    setActiveResource(null)
    setCalibrationResult(null)
    setCoach(noCoaching)
    setDirector(createStandDirector())
    setJourney(createStandJourney())
    crowd.reset()
  }
  const start = (enterFullscreen = true) => {
    keepSettingsOpen.current = false
    restart()
    setStatus('loading')
    setAttempt(current => current + 1)
    if (enterFullscreen) fullscreen()
  }
  const startAutomatically = useEffectEvent(() => start(false))

  useEffect(() => {
    if (!booting) return
    let cancelled = false
    // The camera starts by itself only if this browser already allowed it.
    if (simulate) startAutomatically()
    else if (!navigator.permissions?.query) setBooting(false)
    else
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then(permission => {
          if (cancelled) return
          if (permission.state === 'granted') startAutomatically()
          else setBooting(false)
        })
        .catch(() => {
          if (!cancelled) setBooting(false)
        })
    return () => {
      cancelled = true
    }
    // Decided once, when the stand page opens.
  }, [])

  const togglePanel = () => {
    setPanelOpen(current => !current)
  }
  const openResource = (id: StandResourceId) => {
    setActiveResource(id)
    setCoach({ raised: true, aimed: true, opened: true })
  }
  const handAction = (action: string) => {
    if (action === 'close' || action === 'reset') setActiveResource(null)
    else if (action === 'up' || action === 'down') {
      const scroller = root.current?.querySelector<HTMLElement>('[data-stand-scroll]')
      if (scroller) scroller.scrollTop += scroller.clientHeight * 0.7 * (action === 'up' ? -1 : 1)
    } else {
      const resource = standResources.find(resource => `open:${resource.id}` === action)
      if (resource) openResource(resource.id)
    }
  }
  const handStatus = (next: HandStatus) => {
    setHand(next)
    if (!exploring || next.mode === 'hidden') return
    setCoach(current =>
      current.raised && (current.aimed || !next.hover?.startsWith('open:'))
        ? current
        : {
            ...current,
            raised: true,
            aimed: current.aimed || Boolean(next.hover?.startsWith('open:')),
          }
    )
  }

  return (
    <main
      className={`stand-mode${showPanel ? ' stand-configuring' : ''}`}
      data-stage={live ? stage : 'setup'}
      data-reading={reading}
      data-group={live && companions && companionCount > 0 && !reading}
      data-reduced-motion={reducedMotion}
      style={{ '--stand-glow': avatar.colors.body } as CSSProperties}
      ref={root}
      tabIndex={-1}
      aria-label={t('Mode stand')}
    >
      <div className="stand-backdrop" aria-hidden="true" />
      {live && companions && companionAvatars.length > 0 && (
        <StandCompanions
          crowd={crowd}
          avatars={companionAvatars}
          exploring={stage === 'explore'}
          hidden={reading}
          mirror={mirror}
          reducedMotion={reducedMotion}
          root={root}
          onCount={count => {
            setCompanionCount(count)
            const now = performance.now()
            if (count === 0 || now - introducedAt.current < 30000) return
            introducedAt.current = now
            setIntroducing(true)
            setTimeout(() => setIntroducing(false), 3600)
          }}
        />
      )}
      <div className="stand-scene">
        <div className="stand-character">
          {live && invitations && (
            <StandBubble
              line={bubbleCopy(cue, stage, hand.mode, reading, attractLine, introducing)}
              immediate={isReplyCue(cue)}
            />
          )}
          <StandAvatar
            avatar={avatar}
            director={director}
            settings={{ mirror, proximity, reducedMotion }}
            onFrame={presentFrame}
          />
        </div>
      </div>
      {live && <StandBrand />}
      <AnimatePresence>
        {exploring && (
          <motion.div
            key="resources"
            className="stand-resources-layer"
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4 }}
          >
            <StandResources
              active={activeResource}
              onOpen={openResource}
              onClose={() => setActiveResource(null)}
              hand={hand}
              root={root}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {live && !reading && (
        <footer className="stand-dock">
          <div className="stand-dock-start">
            {stage === 'attract' ? (
              <p className="stand-dock-privacy">
                <ShieldCheck aria-hidden="true" />
                <span>{t('Rien n’est enregistré : l’image est analysée sur place.')}</span>
              </p>
            ) : (
              invitations && <StandBadges discovered={discovered} />
            )}
          </div>
          <div className="stand-dock-center">
            {exploring ? (
              <StandCoach progress={coach} />
            ) : (
              invitations && (
                <StandInstruction cue={cue} progress={gestureProgress} discovered={discovered} />
              )
            )}
          </div>
          <div className="stand-dock-end">
            <StandQr />
          </div>
        </footer>
      )}
      {live && <StandEffects field={particles} reducedMotion={reducedMotion} />}
      {running && resources && (
        <StandHands
          root={root}
          observation={observation}
          director={director}
          mirror={mirror}
          reader={activeResource}
          enabled={exploring}
          onAction={handAction}
          onStatus={handStatus}
          particles={particles}
          reducedMotion={reducedMotion}
          sign={handSign}
        />
      )}
      {booting && (
        <p className="stand-boot" role="status">
          <span aria-hidden="true" />
          {t('Préparation du stand…')}
        </p>
      )}
      {simulate && live && <StandSimulatorPanel state={simulation} />}
      {debug && live && (
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
          handSign={handSign}
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
            restart()
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
          handSign={handSign}
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
          <div className="stand-setting-row">
            <label htmlFor="stand-companions">{t('Faire venir d’autres personnages')}</label>
            <Switch
              id="stand-companions"
              checked={companions}
              onCheckedChange={value => updateSetting('companions', value)}
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
          {companions && otherAvatars.length > 0 && (
            <div className="stand-companion-picker">
              <span id="stand-companion-label">{t('Personnages invités (3 au maximum)')}</span>
              <div role="group" aria-labelledby="stand-companion-label">
                {otherAvatars.map(other => {
                  const chosen = companionAvatars.some(companion => companion.id === other.id)
                  return (
                    <Button
                      key={other.id}
                      size="sm"
                      variant={chosen ? 'default' : 'outline'}
                      aria-pressed={chosen}
                      disabled={!chosen && companionAvatars.length >= 3}
                      onClick={() =>
                        updateSetting(
                          'companionIds',
                          chosen
                            ? companionAvatars.filter(c => c.id !== other.id).map(c => c.id)
                            : [...companionAvatars.map(c => c.id), other.id]
                        )
                      }
                    >
                      <span
                        className="stand-companion-swatch"
                        style={{ background: other.colors.body }}
                      />
                      {other.name}
                    </Button>
                  )
                })}
              </div>
              <p className="stand-note">
                {t(
                  'Un personnage rejoint chaque visiteur supplémentaire, dans cet ordre. Il le regarde et le suit tant qu’il reste.'
                )}
              </p>
            </div>
          )}
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
          <Button className="stand-start" onClick={() => start()} disabled={status === 'loading'}>
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
