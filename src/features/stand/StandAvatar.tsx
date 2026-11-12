import { motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'

import type { StudioAvatar } from '@/features/avatar/avatars'
import {
  poseFromExpression,
  rotateExpressionWithArcball,
  renderAvatar,
  type Expression,
} from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import { createRenderedScene, paintRenderedScene } from '@/features/rendering/renderedScene'
import type { createStandDirector, StandMood, StandSettings } from './standDirector'

export type StandFrame = ReturnType<ReturnType<typeof createStandDirector>['sample']>
export type FigurePose = {
  expression: Expression
  blink: number
  x: number
  y: number
  scale: number
  glow: number
}

// Warmer, brighter light as the character warms up to the visitor.
const moodGlow: Record<StandMood, number> = {
  idle: 0.34,
  wary: 0.42,
  curious: 0.58,
  playful: 0.82,
  greeting: 1,
}

/**
 * Draws one stand character. `pose` runs once per rendered frame (capped by `fps`)
 * and returns target values, which are eased here into Motion values.
 */
export function StandFigure({
  avatar,
  pose,
  fps = 30,
  petTarget = false,
  grounded = false,
}: {
  avatar: StudioAvatar
  pose: (at: number, current: Expression) => FigurePose | null
  fps?: number
  petTarget?: boolean
  // Shift the drawing so its contact shadow sits near the bottom of the box:
  // characters of different heights then share the same floor line.
  grounded?: boolean
}) {
  const clipId = useId()
  const haloId = useId()
  const figure = useRef<SVGGElement>(null)
  const [scene] = useState(() =>
    createRenderedScene(
      renderAvatar(
        poseFromExpression({ ...defaultExpression, ...avatar.eyes }),
        avatar.body.primary,
        1,
        {
          bodyNodes: avatar.body.nodes,
          includeWire: false,
        }
      ),
      avatar.body.nodes,
      avatar.colors.body
    )
  )
  const [floor, setFloor] = useState(150)
  const x = useMotionValue(0),
    y = useMotionValue(0),
    scale = useMotionValue(1),
    glow = useMotionValue(moodGlow.idle)
  // The contact shadow tightens and fades as the character leaves the ground.
  const shadowScale = useTransform(y, value => Math.min(1.08, Math.max(0.55, 1 + value / 90)))
  const shadowOpacity = useTransform(y, value => Math.min(0.55, Math.max(0.16, 0.48 + value / 110)))
  const readPose = useEffectEvent(pose)
  useEffect(() => {
    // Measured once in local coordinates: secondary shapes can extend the silhouette.
    const box = figure.current?.getBBox()
    if (box && Number.isFinite(box.y + box.height)) setFloor(Math.min(182, box.y + box.height + 12))
  }, [avatar])
  useEffect(() => {
    let frame = 0
    let previousAt = 0
    let current: Expression = { ...defaultExpression, ...avatar.eyes }
    const interval = 1000 / fps - 1
    const tick = (at: number) => {
      frame = requestAnimationFrame(tick)
      if (document.hidden || at - previousAt < interval) return
      const dt = Math.min(100, at - previousAt)
      previousAt = at
      const next = readPose(at, current)
      if (!next) return
      const amount = 1 - Math.exp(-dt / 160)
      current = Object.fromEntries(
        Object.entries(next.expression).map(([key, value]) => {
          const before = current[key as keyof Expression]
          return [
            key,
            typeof value === 'number' && typeof before === 'number'
              ? before + (value - before) * amount
              : value,
          ]
        })
      ) as Expression
      paintRenderedScene(
        scene,
        renderAvatar(poseFromExpression(current), avatar.body.primary, next.blink, {
          bodyNodes: avatar.body.nodes,
          includeWire: false,
        }),
        avatar.body.nodes,
        avatar.colors.body
      )
      x.set(x.get() + (next.x - x.get()) * amount)
      y.set(y.get() + (next.y - y.get()) * amount)
      scale.set(scale.get() + (next.scale - scale.get()) * amount)
      glow.set(glow.get() + (next.glow - glow.get()) * (1 - Math.exp(-dt / 600)))
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [avatar, scene, fps, x, y, scale, glow])
  const outline =
    avatar.renderStyle.type === 'vector' && avatar.renderStyle.outline?.enabled
      ? avatar.renderStyle.outline
      : null
  return (
    <svg
      className="stand-avatar"
      viewBox="-190 -190 380 380"
      role="img"
      aria-label={avatar.name}
      style={grounded ? { translate: `0 ${(0.93 - (floor + 190) / 380) * 100}%` } : undefined}
    >
      <defs>
        <clipPath id={clipId}>
          <motion.path d={scene.headPath} />
        </clipPath>
        <radialGradient id={haloId}>
          <stop offset="0%" stopColor={avatar.colors.body} stopOpacity="0.55" />
          <stop offset="45%" stopColor={avatar.colors.body} stopOpacity="0.2" />
          <stop offset="100%" stopColor={avatar.colors.body} stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle r="250" fill={`url(#${haloId})`} style={{ opacity: glow }} />
      <motion.ellipse
        className="stand-avatar-shadow"
        cy={floor}
        rx="96"
        ry="13"
        style={{ scale: shadowScale, opacity: shadowOpacity, x }}
      />
      <motion.g style={{ x, y, scale }}>
        <g ref={figure}>
          {outline && (
            <g
              fill="none"
              stroke={outline.color}
              strokeWidth={outline.width * 2}
              opacity={outline.opacity}
              strokeLinejoin="round"
            >
              {[...scene.backPaths, scene.headPath, ...scene.frontPaths].map((path, index) => (
                <motion.path d={path} key={index} />
              ))}
            </g>
          )}
          {scene.backPaths.map((path, index) => (
            <motion.path d={path} fill={scene.backColors[index]} key={index} />
          ))}
          <motion.path
            d={scene.headPath}
            fill={avatar.colors.body}
            data-stand-pet-target={petTarget || undefined}
          />
          <g clipPath={`url(#${clipId})`} fill={avatar.colors.eyes}>
            <motion.path d={scene.leftPath} opacity={scene.leftOpacity} />
            <motion.path d={scene.rightPath} opacity={scene.rightOpacity} />
            <motion.path d={scene.nosePath} />
            <motion.path
              d={scene.mouthPath}
              fillOpacity={scene.mouthFillOpacity}
              stroke={avatar.colors.eyes}
              strokeWidth={scene.mouthStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          {scene.frontPaths.map((path, index) => (
            <motion.path d={path} fill={scene.frontColors[index]} key={index} />
          ))}
        </g>
      </motion.g>
    </svg>
  )
}

/** The main character, driven by the stand director and the visitor's hand. */
export function StandAvatar({
  avatar,
  director,
  settings,
  onFrame,
}: {
  avatar: StudioAvatar
  director: ReturnType<typeof createStandDirector>
  settings: StandSettings
  onFrame: (frame: StandFrame, at: number) => void
}) {
  const drag = useRef<{ at: number; initial: Expression } | null>(null)
  const neutral = { ...defaultExpression, ...avatar.eyes }
  const pose = (at: number, current: Expression): FigurePose => {
    const next = director.sample(at, neutral, settings)
    const rotation = director.handRotation()
    if (rotation) {
      if (drag.current?.at !== rotation.at)
        drag.current = { at: rotation.at, initial: { ...current } }
      const rotated = rotateExpressionWithArcball(
        drag.current.initial,
        rotation.start,
        rotation.point
      )
      next.expression = {
        ...next.expression,
        headX: rotated.headX,
        headY: rotated.headY,
        headZ: rotated.headZ,
      }
    } else drag.current = null
    onFrame(next, at)
    return { ...next, glow: moodGlow[next.mood] + next.near * 0.12 }
  }
  return <StandFigure avatar={avatar} pose={pose} petTarget />
}
