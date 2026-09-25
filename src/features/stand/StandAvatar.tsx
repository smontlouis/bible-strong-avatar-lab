import { motion, useMotionValue } from 'motion/react'
import { useEffect, useEffectEvent, useId, useState } from 'react'

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
import type { StandCue } from './standEncounter'

export function StandAvatar({
  avatar,
  director,
  settings,
  onPresentation,
}: {
  avatar: StudioAvatar
  director: ReturnType<typeof createStandDirector>
  settings: StandSettings
  onPresentation: (presentation: { mood: StandMood; cue: StandCue }) => void
}) {
  const clipId = useId()
  const base = { ...defaultExpression, ...avatar.eyes }
  const [scene] = useState(() =>
    createRenderedScene(
      renderAvatar(poseFromExpression(base), avatar.body.primary, 1, {
        bodyNodes: avatar.body.nodes,
        includeWire: false,
      }),
      avatar.body.nodes,
      avatar.colors.body
    )
  )
  const x = useMotionValue(0),
    y = useMotionValue(0),
    scale = useMotionValue(1)
  const readSettings = useEffectEvent(() => settings)
  const reportPresentation = useEffectEvent(onPresentation)
  useEffect(() => {
    let frame = 0
    let previousAt = 0
    let current: Expression = { ...defaultExpression, ...avatar.eyes }
    let drag: { at: number; initial: Expression } | null = null
    let previousMood: StandMood | undefined
    let previousCue: StandCue | undefined
    const neutral = { ...current }
    const tick = (at: number) => {
      frame = requestAnimationFrame(tick)
      if (document.hidden || at - previousAt < 32) return
      const dt = Math.min(100, at - previousAt)
      previousAt = at
      const next = director.sample(at, neutral, readSettings())
      const rotation = director.handRotation()
      if (rotation) {
        if (drag?.at !== rotation.at) drag = { at: rotation.at, initial: { ...current } }
        const rotated = rotateExpressionWithArcball(drag.initial, rotation.start, rotation.point)
        next.expression = {
          ...next.expression,
          headX: rotated.headX,
          headY: rotated.headY,
          headZ: rotated.headZ,
        }
      } else drag = null
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
      if (next.mood !== previousMood || next.cue !== previousCue) {
        previousMood = next.mood
        previousCue = next.cue
        reportPresentation({ mood: next.mood, cue: next.cue })
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [avatar, director, scene, x, y, scale])
  const outline =
    avatar.renderStyle.type === 'vector' && avatar.renderStyle.outline?.enabled
      ? avatar.renderStyle.outline
      : null
  return (
    <svg className="stand-avatar" viewBox="-190 -190 380 380" role="img" aria-label={avatar.name}>
      <defs>
        <clipPath id={clipId}>
          <motion.path d={scene.headPath} />
        </clipPath>
      </defs>
      <motion.g style={{ x, y, scale }}>
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
        <motion.path d={scene.headPath} fill={avatar.colors.body} data-stand-pet-target />
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
      </motion.g>
    </svg>
  )
}
