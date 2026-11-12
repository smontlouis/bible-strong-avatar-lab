import { motionValue, type MotionValue } from 'motion'

import type { AvatarColors } from '../avatar/avatars'
import { MAX_BODY_NODES, type BodyNode } from '../avatar/body'
import type { AvatarGeometry } from '../avatar/geometry'

export type RenderedScene = {
  headPath: MotionValue<string>
  backPaths: MotionValue<string>[]
  frontPaths: MotionValue<string>[]
  /** The clip of each front path, and the CSS value that applies it or not. */
  frontClipPaths: MotionValue<string>[]
  frontClips: MotionValue<string>[]
  backColors: MotionValue<string>[]
  frontColors: MotionValue<string>[]
  backNodeIds: { current: (string | null)[] }
  frontNodeIds: { current: (string | null)[] }
  leftPath: MotionValue<string>
  rightPath: MotionValue<string>
  nosePath: MotionValue<string>
  mouthPath: MotionValue<string>
  mouthStrokeWidth: MotionValue<number>
  mouthFillOpacity: MotionValue<number>
  leftOpacity: MotionValue<number>
  rightOpacity: MotionValue<number>
  offsetX: MotionValue<number>
  offsetY: MotionValue<number>
  wirePaths: MotionValue<string>[]
}

export type RenderedColors = {
  body: MotionValue<string>
  eyes: MotionValue<string>
}

const bodyPathSlots = MAX_BODY_NODES + 2

export const frontClipId = (index: number) => `avatar-front-clip-${index}`

const frontClipValue = (clip: string | undefined, index: number) =>
  clip ? `url(#${frontClipId(index)})` : 'none'

const bodyNodeColor = (nodeId: string | null | undefined, nodes: BodyNode[], bodyColor: string) =>
  nodes.find(node => node.id === nodeId)?.color ?? bodyColor

export const createRenderedScene = (
  geometry: AvatarGeometry,
  bodyNodes: BodyNode[] = [],
  bodyColor = '#5b7fe5'
): RenderedScene => ({
  headPath: motionValue(geometry.headPath),
  backPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.backPaths[index] ?? '')
  ),
  frontPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.frontPaths[index] ?? '')
  ),
  frontClipPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.frontClipPaths[index] ?? '')
  ),
  frontClips: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(frontClipValue(geometry.frontClipPaths[index], index))
  ),
  backColors: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(bodyNodeColor(geometry.backNodeIds[index], bodyNodes, bodyColor))
  ),
  frontColors: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(bodyNodeColor(geometry.frontNodeIds[index], bodyNodes, bodyColor))
  ),
  backNodeIds: { current: geometry.backNodeIds },
  frontNodeIds: { current: geometry.frontNodeIds },
  leftPath: motionValue(geometry.leftPath),
  rightPath: motionValue(geometry.rightPath),
  nosePath: motionValue(geometry.nosePath),
  mouthPath: motionValue(geometry.mouthPath),
  mouthStrokeWidth: motionValue(geometry.mouthStrokeWidth),
  mouthFillOpacity: motionValue(geometry.mouthStrokeWidth > 0 ? 0 : 1),
  leftOpacity: motionValue(geometry.leftVisible ? 1 : 0),
  rightOpacity: motionValue(geometry.rightVisible ? 1 : 0),
  offsetX: motionValue(0),
  offsetY: motionValue(0),
  wirePaths: geometry.wirePaths.map(path => motionValue(path)),
})

export const createRenderedColors = (colors: AvatarColors): RenderedColors => ({
  body: motionValue(colors.body),
  eyes: motionValue(colors.eyes),
})

export const paintRenderedColors = (rendered: RenderedColors, colors: AvatarColors) => {
  rendered.body.set(colors.body)
  rendered.eyes.set(colors.eyes)
}

export const paintRenderedOffset = (scene: RenderedScene, offset: { x: number; y: number }) => {
  scene.offsetX.set(offset.x)
  scene.offsetY.set(offset.y)
}

export const paintRenderedScene = (
  scene: RenderedScene,
  geometry: AvatarGeometry,
  bodyNodes: BodyNode[] = [],
  bodyColor = '#5b7fe5'
) => {
  scene.headPath.set(geometry.headPath)
  scene.backNodeIds.current = geometry.backNodeIds
  scene.frontNodeIds.current = geometry.frontNodeIds
  paintRenderedBodyColors(scene, bodyNodes, bodyColor)
  scene.backPaths.forEach((path, index) => path.set(geometry.backPaths[index] ?? ''))
  scene.frontPaths.forEach((path, index) => path.set(geometry.frontPaths[index] ?? ''))
  scene.frontClipPaths.forEach((path, index) => path.set(geometry.frontClipPaths[index] ?? ''))
  scene.frontClips.forEach((clip, index) =>
    clip.set(frontClipValue(geometry.frontClipPaths[index], index))
  )
  scene.leftPath.set(geometry.leftPath)
  scene.rightPath.set(geometry.rightPath)
  scene.nosePath.set(geometry.nosePath)
  scene.mouthPath.set(geometry.mouthPath)
  scene.mouthStrokeWidth.set(geometry.mouthStrokeWidth)
  scene.mouthFillOpacity.set(geometry.mouthStrokeWidth > 0 ? 0 : 1)
  scene.leftOpacity.set(geometry.leftVisible ? 1 : 0)
  scene.rightOpacity.set(geometry.rightVisible ? 1 : 0)
  scene.wirePaths.forEach((path, index) => path.set(geometry.wirePaths[index] ?? ''))
}

export const paintRenderedBodyColors = (
  scene: RenderedScene,
  bodyNodes: BodyNode[],
  bodyColor: string
) => {
  scene.backColors.forEach((color, index) =>
    color.set(bodyNodeColor(scene.backNodeIds.current[index], bodyNodes, bodyColor))
  )
  scene.frontColors.forEach((color, index) =>
    color.set(bodyNodeColor(scene.frontNodeIds.current[index], bodyNodes, bodyColor))
  )
}

export const findBodyNodePath = (scene: RenderedScene, selectedBodyNodeId: 'primary' | string) => {
  if (selectedBodyNodeId === 'primary') return scene.headPath
  const backIndex = scene.backNodeIds.current.indexOf(selectedBodyNodeId)
  if (backIndex >= 0) return scene.backPaths[backIndex]
  const frontIndex = scene.frontNodeIds.current.indexOf(selectedBodyNodeId)
  return frontIndex >= 0 ? scene.frontPaths[frontIndex] : null
}
