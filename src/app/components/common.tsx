import { Pause, Play, Square } from 'lucide-react'
import { motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import { useEffect, useEffectEvent, useId, useRef } from 'react'

import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useStudioLanguage } from '@/i18n'

import { type PlaybackStatus } from '@/app/studio-utils'
import type { AvatarRenderStyle } from '@/features/avatar/avatars'
import { type SnapshotBackground } from '@/features/export/snapshotExporter'
import {
  normalizeSnapshotComposition,
  snapshotCornerRadius,
  type SnapshotComposition,
} from '@/features/export/snapshotComposition'
import { LivePixelAvatarCanvas } from '@/features/rendering/components/PixelAvatarCanvas'
import { type RenderedColors, type RenderedScene } from '@/features/rendering/renderedScene'
export function ControlSection({
  title,
  subtitle,
  compact = false,
  children,
}: {
  title: string
  subtitle: string
  compact?: boolean
  children: React.ReactNode
}) {
  const { t } = useStudioLanguage()
  return (
    <section className={`control-section${compact ? ' control-section-compact' : ''}`}>
      <header className="control-section-header">
        <h2>{t(title)}</h2>
        <p>{t(subtitle)}</p>
      </header>
      <Separator className="control-section-separator" />
      <div className="control-section-content">{children}</div>
    </section>
  )
}

export function SnapshotPreview({
  scene,
  colors,
  background,
  colorFrom,
  colorTo,
  renderStyle,
  composition,
  onCompositionChange,
}: {
  scene: RenderedScene
  colors: RenderedColors
  background: SnapshotBackground
  colorFrom: string
  colorTo: string
  renderStyle: AvatarRenderStyle
  composition: SnapshotComposition
  onCompositionChange: (composition: SnapshotComposition) => void
}) {
  const { t } = useStudioLanguage()
  const id = useId().replace(/:/g, '')
  const clipId = `${id}-clip`
  const frameClipId = `${id}-frame-clip`
  const linearId = `${id}-linear`
  const radialId = `${id}-radial`
  const positionX = useMotionValue(composition.x)
  const positionY = useMotionValue(composition.y)
  const scale = useMotionValue(composition.scale)
  const pixelPositionX = useTransform(positionX, value => `${value / 3}%`)
  const pixelPositionY = useTransform(positionY, value => `${value / 3}%`)
  const frameRef = useRef<HTMLDivElement>(null)
  const compositionGroupRef = useRef<SVGGElement>(null)
  const dragRef = useRef<{
    clientX: number
    clientY: number
    x: number
    y: number
  } | null>(null)
  const wheelCommitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backgroundFill =
    background === 'solid'
      ? colorFrom
      : background === 'linear'
        ? `url(#${linearId})`
        : `url(#${radialId})`
  const pixelBackground =
    background === 'solid'
      ? colorFrom
      : background === 'linear'
        ? `linear-gradient(135deg, ${colorFrom}, ${colorTo})`
        : background === 'radial'
          ? `radial-gradient(circle at 50% 42%, ${colorFrom}, ${colorTo})`
          : undefined

  const paintVectorTransform = () => {
    compositionGroupRef.current?.setAttribute(
      'transform',
      `translate(${positionX.get()} ${positionY.get()}) scale(${scale.get()})`
    )
  }

  useMotionValueEvent(positionX, 'change', paintVectorTransform)
  useMotionValueEvent(positionY, 'change', paintVectorTransform)
  useMotionValueEvent(scale, 'change', paintVectorTransform)

  useEffect(() => {
    positionX.set(composition.x)
    positionY.set(composition.y)
    scale.set(composition.scale)
    compositionGroupRef.current?.setAttribute(
      'transform',
      `translate(${composition.x} ${composition.y}) scale(${composition.scale})`
    )
  }, [composition.x, composition.y, composition.scale, positionX, positionY, scale])

  const commitComposition = () =>
    onCompositionChange(
      normalizeSnapshotComposition({
        ...composition,
        x: positionX.get(),
        y: positionY.get(),
        scale: scale.get(),
      })
    )

  const zoomFrame = useEffectEvent((event: WheelEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (dragRef.current) return
    scale.set(
      normalizeSnapshotComposition({
        ...composition,
        scale: scale.get() * Math.exp(-event.deltaY * 0.0015),
      }).scale
    )
    if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current)
    wheelCommitRef.current = setTimeout(commitComposition, 120)
  })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    frame.addEventListener('wheel', zoomFrame, { passive: false })
    return () => {
      frame.removeEventListener('wheel', zoomFrame)
      if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current)
    }
  }, [])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current)
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: positionX.get(),
      y: positionY.get(),
    }
    event.currentTarget.dataset.dragging = 'true'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const viewBoxPerPixel = 300 / Math.max(bounds.width, 1)
    positionX.set(
      normalizeSnapshotComposition({
        ...composition,
        x: dragRef.current.x + (event.clientX - dragRef.current.clientX) * viewBoxPerPixel,
      }).x
    )
    positionY.set(
      normalizeSnapshotComposition({
        ...composition,
        y: dragRef.current.y + (event.clientY - dragRef.current.clientY) * viewBoxPerPixel,
      }).y
    )
  }

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    delete event.currentTarget.dataset.dragging
    commitComposition()
  }
  const outline =
    renderStyle.type === 'vector' && renderStyle.outline?.enabled ? renderStyle.outline : null
  const outlineProps = outline
    ? {
        fill: 'none',
        stroke: outline.color,
        strokeWidth: outline.width,
        strokeOpacity: outline.opacity,
        strokeLinejoin: 'round' as const,
      }
    : {}

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const distance = event.shiftKey ? 10 : 2
    if (event.key === 'ArrowLeft') positionX.set(positionX.get() - distance)
    else if (event.key === 'ArrowRight') positionX.set(positionX.get() + distance)
    else if (event.key === 'ArrowUp') positionY.set(positionY.get() - distance)
    else if (event.key === 'ArrowDown') positionY.set(positionY.get() + distance)
    else if (event.key === '+' || event.key === '=') scale.set(scale.get() + 0.05)
    else if (event.key === '-') scale.set(scale.get() - 0.05)
    else return
    event.preventDefault()
    commitComposition()
  }

  return (
    <div
      ref={frameRef}
      className={`snapshot-preview ${background === 'transparent' ? 'is-transparent' : ''}`}
      style={
        {
          '--snapshot-corner-radius': `${composition.cornerRadius}%`,
          ...(renderStyle.type === 'pixel' ? { background: pixelBackground } : {}),
        } as React.CSSProperties
      }
      role="application"
      tabIndex={0}
      aria-label={t(
        'Cadre du logo. Glisse pour déplacer l’avatar et utilise la molette pour zoomer.'
      )}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onKeyDown={nudge}
    >
      {renderStyle.type === 'pixel' ? (
        <motion.div
          className="snapshot-pixel-transform"
          style={{ x: pixelPositionX, y: pixelPositionY, scale }}
        >
          <LivePixelAvatarCanvas
            scene={scene}
            colors={colors}
            style={renderStyle}
            className="avatar-preview"
          />
        </motion.div>
      ) : (
        <svg className="avatar-preview" viewBox="-150 -150 300 300" aria-hidden="true">
          <defs>
            <clipPath id={frameClipId}>
              <rect
                x="-150"
                y="-150"
                width="300"
                height="300"
                rx={snapshotCornerRadius(composition.cornerRadius)}
              />
            </clipPath>
            <clipPath id={clipId}>
              <motion.path d={scene.headPath} />
            </clipPath>
            <linearGradient id={linearId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={colorFrom} />
              <stop offset="1" stopColor={colorTo} />
            </linearGradient>
            <radialGradient id={radialId} cx="50%" cy="42%" r="70%">
              <stop offset="0" stopColor={colorFrom} />
              <stop offset="1" stopColor={colorTo} />
            </radialGradient>
          </defs>
          <g clipPath={`url(#${frameClipId})`}>
            {background !== 'transparent' && (
              <rect x="-150" y="-150" width="300" height="300" fill={backgroundFill} />
            )}
            <g ref={compositionGroupRef}>
              <motion.g style={{ x: scene.offsetX, y: scene.offsetY }}>
                {outline && (
                  <g aria-hidden="true" pointerEvents="none">
                    {scene.backPaths.map((pathValue, index) => (
                      <motion.path {...outlineProps} d={pathValue} key={`outline-back-${index}`} />
                    ))}
                    <motion.path {...outlineProps} d={scene.headPath} />
                    {scene.frontPaths.map((pathValue, index) => (
                      <motion.path {...outlineProps} d={pathValue} key={`outline-front-${index}`} />
                    ))}
                  </g>
                )}
                {scene.backPaths.map((pathValue, index) => (
                  <motion.path d={pathValue} fill={scene.backColors[index]} key={`back-${index}`} />
                ))}
                <motion.path d={scene.headPath} fill={colors.body} />
                <g clipPath={`url(#${clipId})`}>
                  <motion.path d={scene.leftPath} fill={colors.eyes} opacity={scene.leftOpacity} />
                  <motion.path
                    d={scene.rightPath}
                    fill={colors.eyes}
                    opacity={scene.rightOpacity}
                  />
                  <motion.path d={scene.nosePath} fill={colors.eyes} />
                  <motion.path
                    d={scene.mouthPath}
                    fill={colors.eyes}
                    fillOpacity={scene.mouthFillOpacity}
                    stroke={colors.eyes}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={scene.mouthStrokeWidth}
                  />
                </g>
                {scene.frontPaths.map((pathValue, index) => (
                  <motion.path
                    d={pathValue}
                    fill={scene.frontColors[index]}
                    key={`front-${index}`}
                  />
                ))}
              </motion.g>
            </g>
          </g>
        </svg>
      )}
    </div>
  )
}

export function ExportSection({
  value,
  title,
  subtitle,
  badge,
  children,
}: {
  value: string
  title: string
  subtitle: string
  badge?: string
  children: React.ReactNode
}) {
  const { t } = useStudioLanguage()
  return (
    <AccordionItem value={value} className={`export-accordion-item export-accordion-${value}`}>
      <AccordionTrigger className="export-accordion-trigger">
        <span>
          <span className="export-accordion-title">
            <strong>{t(title)}</strong>
            {badge && <b className="export-menu-badge">{t(badge)}</b>}
          </span>
          <small>{t(subtitle)}</small>
        </span>
      </AccordionTrigger>
      <AccordionContent className="export-accordion-content">
        <div className="export-accordion-inner">{children}</div>
      </AccordionContent>
    </AccordionItem>
  )
}

export function InspectorCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={`panel${className ? ` ${className}` : ''}`} {...props} />
}

export function StatePlayer({
  name,
  status,
  onToggle,
  onStop,
}: {
  name: string | null
  status: PlaybackStatus
  onToggle: () => void
  onStop: () => void
}) {
  const { t } = useStudioLanguage()
  if (!name) return null
  const statusLabel =
    status === 'playing' ? 'En lecture' : status === 'paused' ? 'En pause' : 'Arrêté'
  return (
    <div className="state-player" aria-label={`${t(statusLabel)} : ${name}`}>
      <PlaybackIdentity name={name} status={status} />
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label={t(status === 'playing' ? `Mettre ${name} en pause` : `Reprendre ${name}`)}
        onClick={onToggle}
      >
        {status === 'playing' ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t(`Arrêter ${name}`)} onClick={onStop}>
        <Square fill="currentColor" />
      </Button>
    </div>
  )
}

export function PlaybackIdentity({ name, status }: { name: string; status: PlaybackStatus }) {
  const { t } = useStudioLanguage()
  const statusLabel =
    status === 'playing' ? 'En lecture' : status === 'paused' ? 'En pause' : 'Arrêté'
  return (
    <span className={`playback-identity is-${status}`}>
      <i />
      <span>
        <small>{t(statusLabel)}</small>
        <strong>{name}</strong>
      </span>
    </span>
  )
}

export function PanelTitle({
  title,
  subtitle,
  level = 2,
}: {
  title: string
  subtitle: string
  level?: 2 | 3
}) {
  const { t } = useStudioLanguage()
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <CardHeader className="panel-title">
      <CardTitle as={Heading}>{t(title)}</CardTitle>
      <CardDescription>{t(subtitle)}</CardDescription>
    </CardHeader>
  )
}
