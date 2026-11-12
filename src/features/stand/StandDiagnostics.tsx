import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import { Camera } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useStudioLanguage } from '@/i18n'
import { cameraContentRect, freshObservation } from './diagnosticProjection'
import type {
  createStandDirector,
  Landmark,
  LandmarkConnection,
  StandObservation,
} from './standDirector'
import type { CameraStatus } from './standCamera'
import { collectionActions, type StandCue } from './standEncounter'
import { invitationCopy } from './standCopy'
import type { HandFrame, HandMode } from './standHandNavigation'

type Props = {
  video: RefObject<HTMLVideoElement | null>
  observation: RefObject<StandObservation | null>
  director: ReturnType<typeof createStandDirector>
  visible: boolean
  mirror: boolean
  status: CameraStatus | 'idle'
  mood: string
  cue: StandCue
  overlay?: boolean
  onOverlayChange?: (value: boolean) => void
  compact?: boolean
  sourceVideo?: RefObject<HTMLVideoElement | null>
  handMode: HandMode
  handSign?: RefObject<HandFrame['sign']>
}
const signals = [
  ['eyeBlinkLeft', 'Œil gauche fermé'],
  ['eyeBlinkRight', 'Œil droit fermé'],
  ['jawOpen', 'Bouche ouverte'],
  ['mouthSmileLeft', 'Sourire gauche'],
  ['mouthSmileRight', 'Sourire droit'],
  ['browInnerUp', 'Sourcils relevés'],
] as const
const gestures: Record<string, string> = {
  Open_Palm: 'Paume ouverte',
  Closed_Fist: 'Poing fermé',
  Pointing_Up: 'Index levé',
  Thumb_Up: 'Pouce levé',
  Thumb_Down: 'Pouce baissé',
  Victory: 'Signe de victoire',
  ILoveYou: 'Signe I love you',
  None: 'Geste non reconnu',
}

export function StandDiagnostics(props: Props) {
  const { t } = useStudioLanguage()
  const { video, mirror, visible, status, mood } = props
  const canvas = useRef<HTMLCanvasElement>(null)
  const overlay = props.overlay ?? true
  const [snapshot, setSnapshot] = useState<{
    observation: StandObservation | null
    attention: ReturnType<ReturnType<typeof createStandDirector>['inspect']>
    fps: number | null
    camera: string
    sign: HandFrame['sign']
  } | null>(null)
  const read = useEffectEvent(() => ({ ...props, overlay }))

  useEffect(() => {
    if (!visible) return
    let frame = 0,
      lastUpdate = -Infinity,
      lastDraw = -Infinity,
      previousTimestamp = -Infinity
    let fps: number | null = null
    const tick = (at: number) => {
      frame = requestAnimationFrame(tick)
      const current = read()
      if (current.sourceVideo && current.video.current) {
        const stream = current.sourceVideo.current?.srcObject ?? null
        if (current.video.current.srcObject !== stream) {
          current.video.current.srcObject = stream
          if (stream) void current.video.current.play().catch(() => {})
        }
      }
      const observation = freshObservation(
        current.observation.current,
        at,
        current.status === 'running'
      )
      const attention = current.director.inspect(at, current.mirror)
      if (observation && observation.timestamp !== previousTimestamp) {
        const interval = observation.timestamp - previousTimestamp
        if (Number.isFinite(interval) && interval > 0)
          fps = fps === null ? 1000 / interval : fps * 0.7 + 300 / interval
        previousTimestamp = observation.timestamp
      }
      const element = canvas.current
      const context = element?.getContext('2d')
      if (element && context && at - lastDraw >= 100) {
        lastDraw = at
        const width = element.clientWidth,
          height = element.clientHeight
        const dpr = window.devicePixelRatio || 1
        if (
          element.width !== Math.round(width * dpr) ||
          element.height !== Math.round(height * dpr)
        ) {
          element.width = Math.round(width * dpr)
          element.height = Math.round(height * dpr)
        }
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        context.clearRect(0, 0, width, height)
        if (observation && current.overlay) {
          const rect = cameraContentRect(
            width,
            height,
            observation.frameWidth ?? 640,
            observation.frameHeight ?? 480
          )
          const point = (p: Landmark) => ({
            x: rect.x + (current.mirror ? 1 - p.x : p.x) * rect.width,
            y: rect.y + p.y * rect.height,
          })
          const mesh = (points: Landmark[], connections: LandmarkConnection[], color: string) => {
            context.strokeStyle = color
            context.fillStyle = color
            context.lineWidth = 1
            context.beginPath()
            for (const edge of connections) {
              if (!points[edge.start] || !points[edge.end]) continue
              const a = point(points[edge.start]),
                b = point(points[edge.end])
              context.moveTo(a.x, a.y)
              context.lineTo(b.x, b.y)
            }
            context.stroke()
            for (const p of points) {
              const q = point(p)
              context.fillRect(q.x - 0.7, q.y - 0.7, 1.4, 1.4)
            }
          }
          observation.faces.forEach((face, index) => {
            const selected = face === attention.target
            const color = selected ? '#b9f87a' : '#78cfff'
            mesh(face.landmarks ?? [], observation.faceConnections ?? [], color)
            const corner = point({
              x: current.mirror ? face.x + face.width / 2 : face.x - face.width / 2,
              y: face.y - face.height / 2,
            })
            context.strokeStyle = color
            context.lineWidth = selected ? 2.5 : 1
            context.strokeRect(
              corner.x,
              corner.y,
              face.width * rect.width,
              face.height * rect.height
            )
            context.font = '12px monospace'
            context.fillStyle = color
            context.fillText(
              `${selected ? '● ' : ''}${index + 1}`,
              Math.max(4, corner.x + 4),
              Math.max(14, corner.y - 6)
            )
          })
          observation.hands.forEach(hand =>
            mesh(
              hand.landmarks ?? [],
              observation.handConnections ?? [],
              hand.open ? '#ffcd78' : '#e9b6f7'
            )
          )
        }
      }
      if (at - lastUpdate >= 250) {
        lastUpdate = at
        const camera = current.video.current?.srcObject as MediaStream | null
        setSnapshot({
          observation,
          attention,
          fps: observation ? fps : null,
          camera: camera?.getVideoTracks()[0]?.label ?? '',
          sign: current.handSign?.current ?? null,
        })
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visible])

  const data = status === 'running' ? snapshot?.observation : null
  const attention = snapshot?.attention
  const target =
    data && attention?.visible && attention.target && data.faces.includes(attention.target)
      ? attention.target
      : null
  const gaze = target ? attention?.gaze : null
  const targetIndex = target ? data!.faces.indexOf(target) : -1
  const number = (value: number | null | undefined, digits = 1) =>
    value == null ? '—' : value.toFixed(digits)
  return (
    <section
      className={`stand-diagnostics${props.compact ? ' stand-debug-preview' : ''}`}
      aria-label={t('Diagnostic caméra')}
    >
      <div className="stand-diagnostics-heading">
        <h2>{t('Ce que voit la caméra')}</h2>
        <span className="stand-status-dot" data-live={Boolean(data)}>
          {t(
            data ? 'Suivi actif' : status === 'running' ? 'En attente d’images' : 'Caméra inactive'
          )}
        </span>
      </div>
      <div className="stand-encounter-diagnostics">
        <div>
          <span>{t('Invitation en cours')}</span>
          <strong>{t(invitationCopy[props.cue][0])}</strong>
        </div>
        <div>
          <span>{t('Interactions découvertes')}</span>
          <strong>
            {target ? attention?.discoveries : '—'} / {collectionActions.length}
          </strong>
        </div>
        <div>
          <span>{t('Inclinaison du visage')}</span>
          <strong>{number(target ? attention?.signals?.tilt : null)}°</strong>
        </div>
        <div>
          <span>{t('Main virtuelle')}</span>
          <strong>
            {t(
              {
                hidden: 'Main non suivie',
                moving: 'Main en déplacement',
                closed: 'Poing fermé',
                selecting: 'Sélection en cours',
                grabbing: 'Défilement à la main',
                rotating: 'Rotation de l’avatar',
                petting: 'Caresse détectée',
              }[props.handMode]
            )}
          </strong>
          {snapshot?.sign && props.handMode !== 'hidden' && (
            <small>
              {t(gestures[snapshot.sign.gesture] ?? 'Geste non reconnu')} ·{' '}
              {Math.round(snapshot.sign.confidence * 100)} %
            </small>
          )}
        </div>
        <div>
          <span>{t('Geste en cours de validation')}</span>
          <progress
            max={1}
            value={target ? (attention?.progress ?? 0) : 0}
            aria-label={t('Geste en cours de validation')}
          />
        </div>
      </div>
      <div className="stand-diagnostics-layout">
        <div className="stand-camera-column">
          <div className="stand-camera-preview">
            <video
              ref={video}
              muted
              playsInline
              style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
              aria-label={t('Aperçu de la caméra')}
            />
            <canvas ref={canvas} className="stand-camera-overlay" aria-hidden="true" />
            {status !== 'running' && (
              <div className="stand-camera-placeholder">
                <Camera />
                <span>
                  {t(
                    status === 'loading'
                      ? 'Préparation de la caméra et du suivi…'
                      : 'La caméra démarrera avec le mode stand.'
                  )}
                </span>
              </div>
            )}
            {status === 'running' && <span className="stand-live-badge">{t(mood)}</span>}
          </div>
          <div className="stand-overlay-options">
            <label htmlFor={props.compact ? 'stand-debug-landmarks' : 'stand-landmarks'}>
              {t('Afficher les repères')}
            </label>
            <Switch
              id={props.compact ? 'stand-debug-landmarks' : 'stand-landmarks'}
              checked={overlay}
              onCheckedChange={props.onOverlayChange}
            />
          </div>
          <div className="stand-legend">
            <span>{t('Vert : visiteur suivi')}</span>
            <span>{t('Bleu : autres visages')}</span>
            <span>{t('Orange : paume ouverte')}</span>
          </div>
          <p className="stand-camera-device">
            {snapshot?.camera || t('Aucune caméra active')} ·{' '}
            {data ? `${data.frameWidth} × ${data.frameHeight}` : '—'}
          </p>
        </div>
        <div className="stand-measurements">
          <div className="stand-distance">
            <span>{t('Distance estimée')}</span>
            <strong>
              {gaze ? `≈ ${number(gaze.distance, 2)}` : '—'} <small>{gaze ? 'm' : ''}</small>
            </strong>
            <p>{t('Estimation depuis la taille du visage, pas une mesure précise.')}</p>
          </div>
          <dl className="stand-metrics">
            <div>
              <dt>{t('Visages détectés')}</dt>
              <dd>{data ? data.faces.length : '—'}</dd>
            </div>
            <div>
              <dt>{t('Visiteur suivi')}</dt>
              <dd>{targetIndex >= 0 ? `#${targetIndex + 1}` : t('Aucun')}</dd>
            </div>
            <div>
              <dt>{t('Mains détectées')}</dt>
              <dd>{data ? data.hands.length : '—'}</dd>
            </div>
            <div>
              <dt>{t('Fréquence du suivi')}</dt>
              <dd>{number(data ? snapshot?.fps : null)} Hz</dd>
            </div>
            <div>
              <dt>{t('Temps d’analyse')}</dt>
              <dd>{number(data?.inferenceMs, 0)} ms</dd>
            </div>
            <div>
              <dt>{t('Rotation visée H / V')}</dt>
              <dd>
                {number(gaze?.headY)}° / {number(gaze?.headX)}°
              </dd>
            </div>
            <div>
              <dt>{t('Décalage des yeux H / V')}</dt>
              <dd>
                {number(gaze?.eyeX)} / {number(gaze?.eyeY)}
              </dd>
            </div>
            <div>
              <dt>{t('Largeur du visage')}</dt>
              <dd>{target ? number(target.width * 100) + ' %' : '—'}</dd>
            </div>
            <div>
              <dt>{t('Calibrage du regard')}</dt>
              <dd>{t(attention?.calibrated ? 'Calibré' : 'Par défaut')}</dd>
            </div>
            <div>
              <dt>{t('Prochain coucou')}</dt>
              <dd>
                {attention && attention.greetingCooldownMs > 0
                  ? `${number(attention.greetingCooldownMs / 1000)} s`
                  : t('Disponible')}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="stand-detection-details">
        <section>
          <h3>{t('Signaux du visage suivi')}</h3>
          <p>{t('Coefficients visuels, sans interprétation des émotions.')}</p>
          <div className="stand-signal-grid">
            {signals.map(([key, label]) => (
              <div className="stand-signal" key={key}>
                <span>{t(label)}</span>
                <meter min={0} max={1} value={target?.signals?.[key] ?? 0} aria-label={t(label)} />
                <output>
                  {target?.signals ? `${Math.round((target.signals[key] ?? 0) * 100)} %` : '—'}
                </output>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3>{t('Gestes observés')}</h3>
          {data?.hands.length ? (
            data.hands.map((hand, index) => (
              <div className="stand-hand" key={index}>
                <span>
                  #{index + 1} · {t(hand.side === 'Left' ? 'Main gauche' : 'Main droite')}
                </span>
                <strong>{t(gestures[hand.gesture ?? 'None'] ?? 'Geste non reconnu')}</strong>
                <small>
                  {t('Score du geste')} : {number((hand.confidence ?? 0) * 100, 0)} %
                </small>
              </div>
            ))
          ) : (
            <p>{t('Aucune main détectée')}</p>
          )}
          <p>
            {t('Le coucou nécessite une paume ouverte qui oscille, pas seulement une main levée.')}
          </p>
        </section>
      </div>
    </section>
  )
}
