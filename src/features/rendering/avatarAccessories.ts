import headsetSvg from '@/assets/headset-filled.svg?raw'
import frame172ColoredSvg from '@/assets/frame-172-colored.svg?raw'
import frame172StrokeSvg from '@/assets/frame-172-stroke.svg?raw'

import type { AvatarRenderStyle } from '@/features/avatar/avatars'
import {
  renderAvatar,
  type AvatarGeometry,
  type AvatarPose,
  type RenderAvatarOptions,
} from '@/features/avatar/geometry'
import type { SurfaceConfig } from '@/features/avatar/surfaces'

type Matrix = readonly [number, number, number, number, number, number]

export type AvatarPathTransforms = {
  back: string[]
  head: string
  left: string
  right: string
  front: string[]
}

export type StudioAvatarGeometry = AvatarGeometry & {
  pathTransforms?: AvatarPathTransforms
  headsetFrontIndex?: number
  headsetOcclusion?: {
    side: 'left'
    strokeWidth: number
    width: number
    height: number
    splitX: number
  }
}

const pathValues = [...headsetSvg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1])

if (pathValues.length !== 1) {
  throw new Error(`Expected one path in headset-filled.svg, received ${pathValues.length}`)
}

const [headsetPath] = pathValues
const svgPathValues = (svg: string) =>
  [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1])
const frame172ColoredPathValues = svgPathValues(frame172ColoredSvg)
const frame172StrokePathValues = svgPathValues(frame172StrokeSvg)

if (frame172ColoredPathValues.length !== 4 || frame172StrokePathValues.length !== 4) {
  throw new Error(
    `Expected four paths in each Frame 172 SVG, received ${frame172ColoredPathValues.length} and ${frame172StrokePathValues.length}`
  )
}

const [frame172ColoredBodyPath, , , frame172ColoredHeadsetPath] = frame172ColoredPathValues
const [frame172StrokeBodyPath, , , frame172StrokeHeadsetPath] = frame172StrokePathValues
export const identityTransform = 'matrix(1 0 0 1 0 0)'

const identity: Matrix = [1, 0, 0, 1, 0, 0]
const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y]
const scale = (x: number, y: number): Matrix => [x, 0, 0, y, 0, 0]
const rotate = (degrees: number): Matrix => {
  const angle = (degrees * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return [cosine, sine, -sine, cosine, 0, 0]
}
const skewX = (degrees: number): Matrix => [1, 0, Math.tan((degrees * Math.PI) / 180), 1, 0, 0]
const skewY = (degrees: number): Matrix => [1, Math.tan((degrees * Math.PI) / 180), 0, 1, 0, 0]

const multiply = (left: Matrix, right: Matrix): Matrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
]

const compose = (...matrices: Matrix[]) => matrices.reduce(multiply, identity)
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))
const matrixValue = (matrix: Matrix) =>
  `matrix(${matrix.map(value => Number(value.toFixed(5))).join(' ')})`

const headsetTransform = (pose: AvatarPose, surface: SurfaceConfig) => {
  const expression = pose.expression
  const horizontalTurn = clamp(expression.headY / 25, -1, 1)
  const verticalTurn = clamp(expression.headX / 25, -1, 1)
  const perspective = clamp(expression.perspective, 0.6, 1.4)
  const horizontalScale = Math.max(0.38, Math.cos((expression.headY * Math.PI) / 180))
  const verticalScale = Math.max(0.46, Math.cos((expression.headX * Math.PI) / 180))

  return matrixValue(
    compose(
      rotate(expression.headZ),
      skewY(verticalTurn * 3.2),
      skewX(-horizontalTurn * 4.2),
      scale(horizontalScale * perspective, verticalScale * perspective),
      scale((surface.width * 1.42) / 24, (surface.height * 1.28) / 24),
      translate(-12, -13.25)
    )
  )
}

const frame172Transform = (pose: AvatarPose, artwork: 'frame-172-colored' | 'frame-172-stroke') => {
  const expression = pose.expression
  const horizontalTurn = clamp(expression.headY / 25, -1, 1)
  const verticalTurn = clamp(expression.headX / 25, -1, 1)
  const perspective = clamp(expression.perspective, 0.6, 1.4)
  const horizontalScale = Math.max(0.38, Math.cos((expression.headY * Math.PI) / 180))
  const verticalScale = Math.max(0.46, Math.cos((expression.headX * Math.PI) / 180))
  const normalize =
    artwork === 'frame-172-colored'
      ? compose(scale(0.2, 0.2), translate(-573.13, -468))
      : compose(scale(0.2, 0.2), translate(-572.13, -539.5))
  const poseTransform = compose(
    rotate(expression.headZ),
    skewY(verticalTurn * 3.2),
    skewX(-horizontalTurn * 4.2),
    scale(horizontalScale * perspective, verticalScale * perspective)
  )
  return matrixValue(compose(poseTransform, normalize))
}

export const renderAvatarByStyle = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  blink: number,
  renderStyle: AvatarRenderStyle,
  options: RenderAvatarOptions = {}
): StudioAvatarGeometry => {
  const geometry = renderAvatar(pose, surface, blink, options)
  if (renderStyle.type === 'vector' && renderStyle.artwork) {
    const colored = renderStyle.artwork === 'frame-172-colored'
    const artworkTransform = frame172Transform(pose, renderStyle.artwork)
    return {
      ...geometry,
      backPaths: [],
      frontPaths: [colored ? frame172ColoredHeadsetPath : frame172StrokeHeadsetPath],
      backNodeIds: [],
      frontNodeIds: [null],
      headPath: colored ? frame172ColoredBodyPath : frame172StrokeBodyPath,
      wirePaths: [],
      headsetFrontIndex: 0,
      headsetOcclusion: {
        side: 'left',
        strokeWidth: colored ? 2.4 : 1,
        width: 1145,
        height: colored ? 936 : 1079,
        splitX: colored ? 573.13 : 572.13,
      },
      pathTransforms: {
        back: [],
        head: artworkTransform,
        left: identityTransform,
        right: identityTransform,
        front: [artworkTransform],
      },
    }
  }
  if (renderStyle.type !== 'vector' || renderStyle.accessory !== 'headset') return geometry

  return {
    ...geometry,
    frontPaths: [...geometry.frontPaths, headsetPath],
    frontNodeIds: [...geometry.frontNodeIds, null],
    headsetFrontIndex: geometry.frontPaths.length,
    pathTransforms: {
      back: geometry.backPaths.map(() => identityTransform),
      head: identityTransform,
      left: identityTransform,
      right: identityTransform,
      front: [...geometry.frontPaths.map(() => identityTransform), headsetTransform(pose, surface)],
    },
  }
}
