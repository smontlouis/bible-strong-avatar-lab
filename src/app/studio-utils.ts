import { useEffect, useEffectEvent } from 'react'

import { type StudioLanguage } from '@/i18n'

import {
  applyAvatarEyeDefaults,
  defaultAvatarEyes,
  type AvatarColors,
  type AvatarEyeDefaults,
  type AvatarRenderStyle,
} from '@/features/avatar/avatars'
import { type BodyNode } from '@/features/avatar/body'
import { poseFromExpression, type Expression } from '@/features/avatar/geometry'
import { renderAvatarByStyle } from '@/features/rendering/avatarAccessories'
import { type SurfaceConfig } from '@/features/avatar/surfaces'

export type Mode = 'avatars' | 'manual' | 'expressions' | 'states' | 'export' | 'photo'
export type PhotoTool = 'pose' | 'frame'
export type ExportFormat = 'react' | 'javascript'
export type SnapshotFormat = 'svg' | 'png'
export type PlaybackStatus = 'playing' | 'paused' | 'stopped'

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
export type Side = 'Left' | 'Right'
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
export type Highlight = 'head' | 'left' | 'right' | 'both' | null

export const RETARGET_BLEND_MS = 120
export const INSPECTOR_FRAME_MS = 1000 / 24
export const AMBIENT_FRAME_MS = 1000 / 30
export const COPY_FEEDBACK_DURATION_MS = 2000
export const createExpressionId = () => `expression-${crypto.randomUUID()}`
export const emptyBodyNodes: BodyNode[] = []
const previewGeometryCache = new WeakMap<
  Expression,
  WeakMap<
    SurfaceConfig,
    WeakMap<BodyNode[], { positionKey: string; geometry: ReturnType<typeof renderAvatarByStyle> }>
  >
>()

export const poseWithAvatarEyes = (expression: Expression, eyes: AvatarEyeDefaults) =>
  poseFromExpression(applyAvatarEyeDefaults(expression, eyes))

export const getPreviewGeometry = (
  expression: Expression,
  surface: SurfaceConfig,
  bodyNodes: BodyNode[],
  eyes: AvatarEyeDefaults = defaultAvatarEyes,
  renderStyle: AvatarRenderStyle = { type: 'vector' }
) => {
  let surfaceCache = previewGeometryCache.get(expression)
  if (!surfaceCache) {
    surfaceCache = new WeakMap()
    previewGeometryCache.set(expression, surfaceCache)
  }
  let bodyCache = surfaceCache.get(surface)
  if (!bodyCache) {
    bodyCache = new WeakMap()
    surfaceCache.set(surface, bodyCache)
  }
  const positionKey = JSON.stringify([eyes, renderStyle])
  const cached = bodyCache.get(bodyNodes)
  if (cached?.positionKey === positionKey) return cached.geometry
  const geometry = renderAvatarByStyle(
    poseWithAvatarEyes(expression, eyes),
    surface,
    1,
    renderStyle,
    {
      includeWire: false,
      bodyNodes,
    }
  )
  bodyCache.set(bodyNodes, { positionKey, geometry })
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

export const formatSeconds = (milliseconds: number, language: StudioLanguage) =>
  `${new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : language === 'zh-CN' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(milliseconds / 1000)} s`

export const parseHexColor = (color: string) => {
  const value = color.replace('#', '')
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16))
}

export const interpolateHexColor = (from: string, to: string, progress: number) => {
  const fromChannels = parseHexColor(from)
  const toChannels = parseHexColor(to)
  return `#${fromChannels
    .map((channel, index) =>
      Math.round(channel + (toChannels[index] - channel) * progress)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

export const resolveColors = (expression: Expression, colors: AvatarColors): AvatarColors => ({
  body: expression.bodyColor ?? colors.body,
  eyes: expression.eyeColor ?? colors.eyes,
})
