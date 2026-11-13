import {
  expressionFromDefinition,
  poseFromExpression,
  renderAvatar,
  type BodyNode,
  type Expression,
  type SurfaceConfig,
} from '@bible-strong/avatar-core'
import { useEffect, useEffectEvent } from 'react'

export type PhotoTool = 'pose' | 'frame'
export type PlaybackStatus = 'playing' | 'paused' | 'stopped'
export type SnapshotBackground = 'transparent' | 'solid' | 'linear' | 'radial'
export type NumericProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  onActiveChange?: (active: boolean) => void
}

/** A head at rest, facing the viewer: what a body is built on and what a turn starts from. */
export const restExpression: Expression = expressionFromDefinition('neutral', {
  head: { x: 0, y: 0, z: 0 },
  eyes: {
    left: { width: 0, height: 0, x: 0, y: 0, angle: 0 },
    right: { width: 0, height: 0, x: 0, y: 0, angle: 0 },
    spacing: 0,
  },
  perspective: 1,
  motion: { eyes: 'none', body: 'none' },
})

const noNodes: BodyNode[] = []
const bodyPreviews = new WeakMap<
  SurfaceConfig,
  WeakMap<BodyNode[], ReturnType<typeof renderAvatar>>
>()

/** The outline of a body at rest, for a thumbnail. */
export const bodyPreview = (surface: SurfaceConfig, bodyNodes: BodyNode[] = noNodes) => {
  let ofSurface = bodyPreviews.get(surface)
  if (!ofSurface) {
    ofSurface = new WeakMap()
    bodyPreviews.set(surface, ofSurface)
  }
  let geometry = ofSurface.get(bodyNodes)
  if (!geometry) {
    geometry = renderAvatar(poseFromExpression(restExpression), surface, 1, {
      includeWire: false,
      bodyNodes,
    })
    ofSurface.set(bodyNodes, geometry)
  }
  return geometry
}

export const bounded = (value: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))

export const useEscapeToCancel = (cancel: () => void) => {
  const cancelEvent = useEffectEvent(cancel)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelEvent()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

export const scaleSurface = (
  surface: SurfaceConfig,
  size: number,
  minimums: Pick<SurfaceConfig, 'width' | 'height' | 'depth'>
) => {
  const currentSize = Math.max(surface.width, surface.height, surface.depth) || 1
  const factor = size / currentSize
  return {
    ...surface,
    width: bounded(surface.width * factor, minimums.width, 300),
    height: bounded(surface.height * factor, minimums.height, 300),
    depth: bounded(surface.depth * factor, minimums.depth, 300),
  }
}
