import { useMotionValueEvent, type MotionValue } from 'motion/react'
import { useEffect, useState } from 'react'

import type { RenderedScene } from './renderedScene'

export const avatarBodyOutlineWidth = () => 12

const colorsMatch = (left: string, right: string) =>
  left.trim().toLowerCase() === right.trim().toLowerCase()

export const useAvatarBodyColorOverride = (
  renderedBodyColor: MotionValue<string>,
  baseBodyColor: string
) => {
  const [overridden, setOverridden] = useState(
    () => !colorsMatch(renderedBodyColor.get(), baseBodyColor)
  )

  useEffect(() => {
    setOverridden(!colorsMatch(renderedBodyColor.get(), baseBodyColor))
  }, [baseBodyColor, renderedBodyColor])

  useMotionValueEvent(renderedBodyColor, 'change', latest => {
    const next = !colorsMatch(latest, baseBodyColor)
    setOverridden(current => (current === next ? current : next))
  })

  return overridden
}

export const useRenderedSceneNodeOrder = (scene: RenderedScene) => {
  const [, setVersion] = useState(0)

  useMotionValueEvent(scene.nodeOrderVersion, 'change', () => {
    setVersion(version => version + 1)
  })
}

export const resolveAvatarNodeColor = ({
  nodeColor,
  bodyColor,
  expressionBodyColor,
}: {
  nodeColor?: string
  bodyColor: string
  expressionBodyColor?: string
}) => expressionBodyColor ?? nodeColor ?? bodyColor
