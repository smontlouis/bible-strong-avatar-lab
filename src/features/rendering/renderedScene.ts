import { motionValue, type MotionValue } from 'motion'

import type { AvatarColors } from '../avatar/avatars'
import { MAX_BODY_NODES } from '../avatar/body'
import { identityTransform, type StudioAvatarGeometry } from './avatarAccessories'

export type RenderedScene = {
  headPath: MotionValue<string>
  headTransform: MotionValue<string>
  backPaths: MotionValue<string>[]
  backTransforms: MotionValue<string>[]
  frontPaths: MotionValue<string>[]
  frontTransforms: MotionValue<string>[]
  headsetFrontIndex: { current: number | null }
  backNodeIds: { current: (string | null)[] }
  frontNodeIds: { current: (string | null)[] }
  nodeOrderVersion: MotionValue<number>
  leftPath: MotionValue<string>
  rightPath: MotionValue<string>
  leftTransform: MotionValue<string>
  rightTransform: MotionValue<string>
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

const bodyPathSlots = MAX_BODY_NODES + 3

export const createRenderedScene = (geometry: StudioAvatarGeometry): RenderedScene => ({
  headPath: motionValue(geometry.headPath),
  headTransform: motionValue(geometry.pathTransforms?.head ?? identityTransform),
  backPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.backPaths[index] ?? '')
  ),
  backTransforms: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.pathTransforms?.back[index] ?? identityTransform)
  ),
  frontPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.frontPaths[index] ?? '')
  ),
  frontTransforms: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.pathTransforms?.front[index] ?? identityTransform)
  ),
  headsetFrontIndex: { current: geometry.headsetFrontIndex ?? null },
  backNodeIds: { current: geometry.backNodeIds },
  frontNodeIds: { current: geometry.frontNodeIds },
  nodeOrderVersion: motionValue(0),
  leftPath: motionValue(geometry.leftPath),
  rightPath: motionValue(geometry.rightPath),
  leftTransform: motionValue(geometry.pathTransforms?.left ?? identityTransform),
  rightTransform: motionValue(geometry.pathTransforms?.right ?? identityTransform),
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

export const paintRenderedScene = (scene: RenderedScene, geometry: StudioAvatarGeometry) => {
  scene.headPath.set(geometry.headPath)
  scene.headTransform.set(geometry.pathTransforms?.head ?? identityTransform)
  const nodeOrderChanged =
    scene.backNodeIds.current.length !== geometry.backNodeIds.length ||
    scene.frontNodeIds.current.length !== geometry.frontNodeIds.length ||
    scene.backNodeIds.current.some((id, index) => id !== geometry.backNodeIds[index]) ||
    scene.frontNodeIds.current.some((id, index) => id !== geometry.frontNodeIds[index])
  scene.backNodeIds.current = geometry.backNodeIds
  scene.frontNodeIds.current = geometry.frontNodeIds
  scene.headsetFrontIndex.current = geometry.headsetFrontIndex ?? null
  if (nodeOrderChanged) scene.nodeOrderVersion.set(scene.nodeOrderVersion.get() + 1)
  scene.backPaths.forEach((path, index) => path.set(geometry.backPaths[index] ?? ''))
  scene.backTransforms.forEach((transform, index) =>
    transform.set(geometry.pathTransforms?.back[index] ?? identityTransform)
  )
  scene.frontPaths.forEach((path, index) => path.set(geometry.frontPaths[index] ?? ''))
  scene.frontTransforms.forEach((transform, index) =>
    transform.set(geometry.pathTransforms?.front[index] ?? identityTransform)
  )
  scene.leftPath.set(geometry.leftPath)
  scene.rightPath.set(geometry.rightPath)
  scene.leftTransform.set(geometry.pathTransforms?.left ?? identityTransform)
  scene.rightTransform.set(geometry.pathTransforms?.right ?? identityTransform)
  scene.leftOpacity.set(geometry.leftVisible ? 1 : 0)
  scene.rightOpacity.set(geometry.rightVisible ? 1 : 0)
  scene.wirePaths.forEach((path, index) => path.set(geometry.wirePaths[index] ?? ''))
}

export const findBodyNodePath = (scene: RenderedScene, selectedBodyNodeId: 'primary' | string) => {
  if (selectedBodyNodeId === 'primary') return scene.headPath
  const backIndex = scene.backNodeIds.current.indexOf(selectedBodyNodeId)
  if (backIndex >= 0) return scene.backPaths[backIndex]
  const frontIndex = scene.frontNodeIds.current.indexOf(selectedBodyNodeId)
  return frontIndex >= 0 ? scene.frontPaths[frontIndex] : null
}
