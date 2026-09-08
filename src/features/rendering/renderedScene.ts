import { motionValue, type MotionValue } from 'motion'

import type { AvatarColors } from '../avatar/avatars'
import { MAX_BODY_NODES } from '../avatar/body'
import type { AvatarGeometry } from '../avatar/geometry'

export type RenderedScene = {
  headPath: MotionValue<string>
  backPaths: MotionValue<string>[]
  frontPaths: MotionValue<string>[]
  backNodeIds: { current: (string | null)[] }
  frontNodeIds: { current: (string | null)[] }
  backNodeFills: MotionValue<string>[]
  frontNodeFills: MotionValue<string>[]
  leftPath: MotionValue<string>
  rightPath: MotionValue<string>
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
const DEFAULT_BODY_COLOR = '#5b7fe5'

export const createRenderedScene = (
  geometry: AvatarGeometry,
  initialBodyColor = DEFAULT_BODY_COLOR
): RenderedScene => ({
  headPath: motionValue(geometry.headPath),
  backPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.backPaths[index] ?? '')
  ),
  frontPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.frontPaths[index] ?? '')
  ),
  backNodeIds: { current: geometry.backNodeIds },
  frontNodeIds: { current: geometry.frontNodeIds },
  backNodeFills: Array.from({ length: bodyPathSlots }, () => motionValue(initialBodyColor)),
  frontNodeFills: Array.from({ length: bodyPathSlots }, () => motionValue(initialBodyColor)),
  leftPath: motionValue(geometry.leftPath),
  rightPath: motionValue(geometry.rightPath),
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

export const paintRenderedScene = (scene: RenderedScene, geometry: AvatarGeometry) => {
  scene.headPath.set(geometry.headPath)
  scene.backNodeIds.current = geometry.backNodeIds
  scene.frontNodeIds.current = geometry.frontNodeIds
  scene.backPaths.forEach((path, index) => path.set(geometry.backPaths[index] ?? ''))
  scene.frontPaths.forEach((path, index) => path.set(geometry.frontPaths[index] ?? ''))
  scene.leftPath.set(geometry.leftPath)
  scene.rightPath.set(geometry.rightPath)
  scene.leftOpacity.set(geometry.leftVisible ? 1 : 0)
  scene.rightOpacity.set(geometry.rightVisible ? 1 : 0)
  scene.wirePaths.forEach((path, index) => path.set(geometry.wirePaths[index] ?? ''))
}

type NodeColorMap = Record<string, string>

/**
 * Paints the fill of each secondary primitive slot from its current node id.
 * Reads `scene.backNodeIds`/`frontNodeIds` (kept in sync by `paintRenderedScene`)
 * so the fills stay aligned with the geometry even when nodes reorder or move
 * between the back and front layers while the camera rotates.
 */
export const paintRenderedNodeColors = (
  scene: RenderedScene,
  bodyColor: string,
  nodeColors: NodeColorMap = {}
) => {
  scene.backNodeFills.forEach((fill, index) => {
    const nodeId = scene.backNodeIds.current[index]
    fill.set(nodeId ? (nodeColors[nodeId] ?? bodyColor) : bodyColor)
  })
  scene.frontNodeFills.forEach((fill, index) => {
    const nodeId = scene.frontNodeIds.current[index]
    fill.set(nodeId ? (nodeColors[nodeId] ?? bodyColor) : bodyColor)
  })
}

export const nodeColorMap = (nodes: { id: string; color?: string }[]): NodeColorMap =>
  Object.fromEntries(nodes.filter(node => node.color).map(node => [node.id, node.color!]))

export const findBodyNodePath = (scene: RenderedScene, selectedBodyNodeId: 'primary' | string) => {
  if (selectedBodyNodeId === 'primary') return scene.headPath
  const backIndex = scene.backNodeIds.current.indexOf(selectedBodyNodeId)
  if (backIndex >= 0) return scene.backPaths[backIndex]
  const frontIndex = scene.frontNodeIds.current.indexOf(selectedBodyNodeId)
  return frontIndex >= 0 ? scene.frontPaths[frontIndex] : null
}
