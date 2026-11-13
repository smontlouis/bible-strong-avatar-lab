import { motionValue, type MotionValue } from 'motion'

import {
  poseFromExpression,
  rotationRing,
  type Expression,
  type Point3,
} from '@bible-strong/avatar-core'

export type RenderedRotationGizmo = {
  xPath: MotionValue<string>
  yPath: MotionValue<string>
  zPath: MotionValue<string>
}

export const rotationRingPath = (points: Point3[]) =>
  `M${points[0][0]} ${points[0][1]}${points
    .slice(1)
    .map(point => `L${point[0]} ${point[1]}`)
    .join('')}Z`

const rotationPaths = (expression: Expression) => {
  const pose = poseFromExpression(expression)
  return {
    x: rotationRingPath(rotationRing(pose, 'x')),
    y: rotationRingPath(rotationRing(pose, 'y')),
    z: rotationRingPath(rotationRing(pose, 'z')),
  }
}

export const createRenderedRotationGizmo = (expression: Expression): RenderedRotationGizmo => {
  const paths = rotationPaths(expression)
  return {
    xPath: motionValue(paths.x),
    yPath: motionValue(paths.y),
    zPath: motionValue(paths.z),
  }
}

export const paintRenderedRotationGizmo = (
  gizmo: RenderedRotationGizmo,
  expression: Expression
) => {
  const paths = rotationPaths(expression)
  gizmo.xPath.jump(paths.x)
  gizmo.yPath.jump(paths.y)
  gizmo.zPath.jump(paths.z)
}
