import {
  cursorLayout,
  surfaceField,
  surfaceFrontSampleAt,
  surfacePointAt,
  surfaceSampleAt,
  surfaceTracePointAt,
  type SurfaceConfig,
} from './surfaces'
import type { BodyNode } from './body'

export type Quaternion = readonly [number, number, number, number]
export type Point3 = readonly [number, number, number]
export type EyeMotion = 'none' | 'microSaccades' | 'shake'
export type BodyMotion = 'none' | 'slowDrift' | 'shake'
export type EyeShape = 'rounded' | 'ellipse'
export type NoseShape = 'ellipse' | 'inverted-triangle' | 'rounded'
export type MouthShape = 'curve' | 'ellipse' | 'rounded' | 'rounded-triangle'

export type Expression = {
  id: string
  semanticKey?: string
  headX: number
  headY: number
  headZ: number
  positionX: number
  positionY: number
  positionZ: number
  widthLeft: number
  widthRight: number
  heightLeft: number
  heightRight: number
  spacing: number
  positionXLeft: number
  positionXRight: number
  positionYLeft: number
  positionYRight: number
  leftAngle: number
  rightAngle: number
  eyeShape?: EyeShape
  eyeRoundness: number
  mouthEnabled?: boolean
  mouthShape?: MouthShape
  mouthCurve: number
  mouthWidth: number
  mouthHeight: number
  mouthX: number
  mouthY: number
  mouthAngle: number
  noseEnabled: boolean
  noseShape: NoseShape
  noseRoundness: number
  noseWidth: number
  noseHeight: number
  noseX: number
  noseY: number
  noseAngle: number
  perspective: number
  blinking?: boolean
  eyeMotion: EyeMotion
  bodyMotion: BodyMotion
  bodyColor?: string
  eyeColor?: string
}

export type ExpressionNumericField = Exclude<
  keyof Expression,
  | 'id'
  | 'semanticKey'
  | 'bodyColor'
  | 'eyeColor'
  | 'eyeMotion'
  | 'bodyMotion'
  | 'eyeShape'
  | 'mouthEnabled'
  | 'mouthShape'
  | 'noseEnabled'
  | 'noseShape'
  | 'blinking'
>

export type AvatarPose = {
  expression: Expression
  orientation: Quaternion
}

export type AvatarGeometry = {
  backPaths: string[]
  frontPaths: string[]
  backNodeIds: (string | null)[]
  frontNodeIds: (string | null)[]
  /** One clip per front path, in the same order. Empty when the path is drawn whole. */
  frontClipPaths: string[]
  headPath: string
  leftPath: string
  rightPath: string
  nosePath: string
  mouthPath: string
  mouthStrokeWidth: number
  leftVisible: boolean
  rightVisible: boolean
  wirePaths: string[]
}

export type RenderAvatarOptions = {
  includeWire?: boolean
  bodyNodes?: BodyNode[]
  /**
   * How a body node meets the head. `layer`, the default, draws each node wholly behind or wholly
   * in front of it. `mask` draws every node behind the head, and draws again in front the part
   * of a node that is nearer than the head's surface. A renderer clips a front path that has a
   * `frontClipPaths` entry by that entry.
   */
  nodeOcclusion?: 'layer' | 'mask'
  /** The body's colour, for `mask`: a node of that colour, or of none, is not measured. */
  bodyColor?: string
  eyeOffset?: Readonly<{ x: number; y: number }>
}

export type EyeEditorGeometry = {
  visible: boolean
  selectionPath: string
  widthGuide: string
  heightGuide: string
  rotationGuide: string
  spacingGuide: string
  center: Point3
  widthHandle: Point3
  heightHandle: Point3
  rotateHandle: Point3
  sizeHandle: Point3
  spacingHandle: Point3
}

export type BodyNodeEditorGeometry = {
  center: Point3
  axes: Record<'x' | 'y' | 'z', Point3>
  rings: Record<'x' | 'y' | 'z', Point3[]>
}

export const RADIUS = 120
const FOCAL_LENGTH = 620
const QUARTER_ARC_SAMPLES = 14

export const expressionFields: ExpressionNumericField[] = [
  'headX',
  'headY',
  'headZ',
  'positionX',
  'positionY',
  'positionZ',
  'widthLeft',
  'widthRight',
  'heightLeft',
  'heightRight',
  'spacing',
  'positionXLeft',
  'positionXRight',
  'positionYLeft',
  'positionYRight',
  'leftAngle',
  'rightAngle',
  'eyeRoundness',
  'mouthCurve',
  'mouthWidth',
  'mouthHeight',
  'mouthX',
  'mouthY',
  'mouthAngle',
  'noseWidth',
  'noseRoundness',
  'noseHeight',
  'noseX',
  'noseY',
  'noseAngle',
  'perspective',
]

const mouthShapeGeometryFields = new Set<ExpressionNumericField>([
  'mouthCurve',
  'mouthWidth',
  'mouthHeight',
])

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const radians = (degrees: number) => (degrees * Math.PI) / 180

export const normalizeQuaternion = ([w, x, y, z]: Quaternion): Quaternion => {
  const length = Math.hypot(w, x, y, z) || 1
  return [w / length, x / length, y / length, z / length]
}

export const multiplyQuaternions = (
  [aw, ax, ay, az]: Quaternion,
  [bw, bx, by, bz]: Quaternion
): Quaternion =>
  normalizeQuaternion([
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ])

export const quaternionFromAxisAngle = ([x, y, z]: Point3, angle: number): Quaternion => {
  const halfAngle = angle / 2
  const sine = Math.sin(halfAngle)
  return normalizeQuaternion([Math.cos(halfAngle), x * sine, y * sine, z * sine])
}

export const quaternionFromEuler = (x: number, y: number, z: number): Quaternion => {
  const xRotation = quaternionFromAxisAngle([1, 0, 0], x)
  const yRotation = quaternionFromAxisAngle([0, 1, 0], y)
  const zRotation = quaternionFromAxisAngle([0, 0, 1], z)
  return multiplyQuaternions(multiplyQuaternions(zRotation, xRotation), yRotation)
}

export const quaternionFromVectors = (from: Point3, to: Point3): Quaternion => {
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2]
  const cross: Point3 = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ]
  return normalizeQuaternion([1 + dot, cross[0], cross[1], cross[2]])
}

export const quaternionToEuler = ([w, x, y, z]: Quaternion): Point3 => {
  const matrix00 = 1 - 2 * (y * y + z * z)
  const matrix01 = 2 * (x * y - z * w)
  const matrix10 = 2 * (x * y + z * w)
  const matrix11 = 1 - 2 * (x * x + z * z)
  const matrix20 = 2 * (x * z - y * w)
  const matrix21 = 2 * (y * z + x * w)
  const matrix22 = 1 - 2 * (x * x + y * y)
  const headX = Math.asin(clamp(matrix21, -1, 1))
  if (Math.abs(Math.cos(headX)) < 0.00001) return [headX, 0, Math.atan2(matrix10, matrix00)]
  return [headX, Math.atan2(-matrix20, matrix22), Math.atan2(-matrix01, matrix11)]
}

const nearestEquivalentAngle = (angle: number, current: number) => {
  let result = angle
  while (result - current > 180) result -= 360
  while (result - current < -180) result += 360
  return clamp(result, -365, 365)
}

export const expressionWithOrientation = (
  expression: Expression,
  orientation: Quaternion
): Expression => {
  const [radiansX, radiansY, radiansZ] = quaternionToEuler(orientation)
  const x = (radiansX * 180) / Math.PI
  const y = (radiansY * 180) / Math.PI
  const z = (radiansZ * 180) / Math.PI
  return {
    ...expression,
    headX: nearestEquivalentAngle(x, expression.headX),
    headY: nearestEquivalentAngle(y, expression.headY),
    headZ: nearestEquivalentAngle(z, expression.headZ),
  }
}

export const slerpQuaternion = (
  start: Quaternion,
  end: Quaternion,
  progress: number
): Quaternion => {
  let target = end
  let dot = start.reduce((total, value, index) => total + value * target[index], 0)
  if (dot < 0) {
    target = target.map(value => -value) as unknown as Quaternion
    dot = -dot
  }
  if (dot > 0.9995) {
    return normalizeQuaternion(
      start.map(
        (value, index) => value + (target[index] - value) * progress
      ) as unknown as Quaternion
    )
  }
  const angle = Math.acos(clamp(dot, -1, 1))
  const sine = Math.sin(angle)
  const startWeight = Math.sin((1 - progress) * angle) / sine
  const targetWeight = Math.sin(progress * angle) / sine
  return normalizeQuaternion(
    start.map(
      (value, index) => value * startWeight + target[index] * targetWeight
    ) as unknown as Quaternion
  )
}

export const rotateWithQuaternion = ([w, x, y, z]: Quaternion, [px, py, pz]: Point3): Point3 => {
  const tx = 2 * (y * pz - z * py)
  const ty = 2 * (z * px - x * pz)
  const tz = 2 * (x * py - y * px)
  return [
    px + w * tx + (y * tz - z * ty),
    py + w * ty + (z * tx - x * tz),
    pz + w * tz + (x * ty - y * tx),
  ]
}

const roundedRectangle = (
  width: number,
  height: number,
  roundness = 1
): (readonly [number, number])[] => {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const cornerRadius = Math.min(halfHeight, halfWidth) * clamp(roundness, 0, 1)
  const points: (readonly [number, number])[] = []
  const addLine = (start: readonly [number, number], end: readonly [number, number]) => {
    const samples = Math.max(2, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 1.5))
    for (let index = 0; index < samples; index += 1) {
      const progress = index / samples
      points.push([
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress,
      ])
    }
  }
  const addArc = (centerX: number, centerY: number, startAngle: number) => {
    for (let index = 0; index < QUARTER_ARC_SAMPLES; index += 1) {
      const angle = startAngle + (index / QUARTER_ARC_SAMPLES) * (Math.PI / 2)
      points.push([
        centerX + Math.cos(angle) * cornerRadius,
        centerY + Math.sin(angle) * cornerRadius,
      ])
    }
  }
  addLine([-halfWidth + cornerRadius, -halfHeight], [halfWidth - cornerRadius, -halfHeight])
  addArc(halfWidth - cornerRadius, -halfHeight + cornerRadius, -Math.PI / 2)
  addLine([halfWidth, -halfHeight + cornerRadius], [halfWidth, halfHeight - cornerRadius])
  addArc(halfWidth - cornerRadius, halfHeight - cornerRadius, 0)
  addLine([halfWidth - cornerRadius, halfHeight], [-halfWidth + cornerRadius, halfHeight])
  addArc(-halfWidth + cornerRadius, halfHeight - cornerRadius, Math.PI / 2)
  addLine([-halfWidth, halfHeight - cornerRadius], [-halfWidth, -halfHeight + cornerRadius])
  addArc(-halfWidth + cornerRadius, -halfHeight + cornerRadius, Math.PI)
  return points
}

const project = (point: Point3, perspective: number): Point3 => {
  const denominator = FOCAL_LENGTH - point[2] * perspective
  const scale = Math.abs(denominator) < 0.0001 ? FOCAL_LENGTH / 0.0001 : FOCAL_LENGTH / denominator
  return [point[0] * scale, point[1] * scale, point[2]]
}

const transformPosePoint = (pose: AvatarPose, point: Point3): Point3 => {
  const rotated = rotateWithQuaternion(pose.orientation, point)
  return [
    rotated[0] + pose.expression.positionX,
    rotated[1] + pose.expression.positionY,
    rotated[2] + pose.expression.positionZ,
  ]
}

const projectPosePoint = (pose: AvatarPose, point: Point3) =>
  project(transformPosePoint(pose, point), pose.expression.perspective)

export const axisVector = (axis: 'x' | 'y' | 'z'): Point3 =>
  axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]

export const rotateExpressionAroundAxis = (
  expression: Expression,
  axis: 'x' | 'y' | 'z',
  deltaDegrees: number
) => {
  const startOrientation = poseFromExpression(expression).orientation
  const worldAxis = rotateWithQuaternion(startOrientation, axisVector(axis))
  const orientation = multiplyQuaternions(
    quaternionFromAxisAngle(worldAxis, radians(deltaDegrees)),
    startOrientation
  )
  return expressionWithOrientation(expression, orientation)
}

export const rotateExpressionAroundCamera = (expression: Expression, deltaRadians: number) => {
  const startOrientation = poseFromExpression(expression).orientation
  return expressionWithOrientation(
    expression,
    multiplyQuaternions(quaternionFromAxisAngle([0, 0, 1], deltaRadians), startOrientation)
  )
}

const arcballVector = ([xValue, yValue]: readonly [number, number]): Point3 => {
  const x = xValue / RADIUS
  const y = yValue / RADIUS
  const squaredLength = x * x + y * y
  if (squaredLength <= 1) return [x, y, Math.sqrt(1 - squaredLength)]
  const length = Math.sqrt(squaredLength)
  return [x / length, y / length, 0]
}

export const rotateExpressionWithArcball = (
  expression: Expression,
  startPoint: readonly [number, number],
  currentPoint: readonly [number, number]
) => {
  const startOrientation = poseFromExpression(expression).orientation
  const delta = quaternionFromVectors(arcballVector(startPoint), arcballVector(currentPoint))
  return expressionWithOrientation(expression, multiplyQuaternions(delta, startOrientation))
}

export const rotationRing = (pose: AvatarPose, axis: 'x' | 'y' | 'z', radius = 30): Point3[] =>
  Array.from({ length: 97 }, (_, index) => {
    const angle = (index / 96) * Math.PI * 2
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const point: Point3 =
      axis === 'x' ? [0, cosine, sine] : axis === 'y' ? [cosine, 0, sine] : [cosine, sine, 0]
    const rotated = rotateWithQuaternion(pose.orientation, point)
    return [rotated[0] * radius, rotated[1] * radius, rotated[2]]
  })

export const renderBodyNodeEditor = (
  headPose: AvatarPose,
  node: BodyNode,
  axisLength = 34,
  ringRadius = 26
): BodyNodeEditorGeometry => {
  const pose = bodyNodeFrame(headPose, node)
  const projectInHeadSpace = (point: Point3) => projectPosePoint(pose, point)
  const center = projectInHeadSpace(node.position)
  const localOrientation = quaternionFromEuler(
    radians(node.rotation[0]),
    radians(node.rotation[1]),
    radians(node.rotation[2])
  )
  const axes = Object.fromEntries(
    (['x', 'y', 'z'] as const).map(axis => {
      const vector = rotateWithQuaternion(localOrientation, axisVector(axis))
      return [
        axis,
        projectInHeadSpace([
          node.position[0] + vector[0] * axisLength,
          node.position[1] + vector[1] * axisLength,
          node.position[2] + vector[2] * axisLength,
        ]),
      ]
    })
  ) as BodyNodeEditorGeometry['axes']
  ;(['x', 'y', 'z'] as const).forEach(axis => {
    const endpoint = axes[axis]
    if (Math.hypot(endpoint[0] - center[0], endpoint[1] - center[1]) >= 12) return
    const fallback: Point3 =
      axis === 'x'
        ? [center[0] + 18, center[1], endpoint[2]]
        : axis === 'y'
          ? [center[0], center[1] + 18, endpoint[2]]
          : [center[0] + 14, center[1] + 14, endpoint[2]]
    axes[axis] = fallback
  })
  const rings = Object.fromEntries(
    (['x', 'y', 'z'] as const).map(axis => [
      axis,
      Array.from({ length: 65 }, (_, index) => {
        const angle = (index / 64) * Math.PI * 2
        const cosine = Math.cos(angle) * ringRadius
        const sine = Math.sin(angle) * ringRadius
        const localPoint: Point3 =
          axis === 'x' ? [0, cosine, sine] : axis === 'y' ? [cosine, 0, sine] : [cosine, sine, 0]
        const rotated = rotateWithQuaternion(localOrientation, localPoint)
        return projectInHeadSpace([
          node.position[0] + rotated[0],
          node.position[1] + rotated[1],
          node.position[2] + rotated[2],
        ])
      }),
    ])
  ) as BodyNodeEditorGeometry['rings']
  return { center, axes, rings }
}

export const translateBodyNodeAlongLocalAxis = (
  node: BodyNode,
  axis: 'x' | 'y' | 'z',
  distance: number
): BodyNode => {
  const orientation = quaternionFromEuler(
    radians(node.rotation[0]),
    radians(node.rotation[1]),
    radians(node.rotation[2])
  )
  const direction = rotateWithQuaternion(orientation, axisVector(axis))
  return {
    ...node,
    position: [
      node.position[0] + direction[0] * distance,
      node.position[1] + direction[1] * distance,
      node.position[2] + direction[2] * distance,
    ],
  }
}

const NO_ROTATION: Quaternion = [1, 0, 0, 0]

/**
 * The pose a node is placed in. A node that follows the head is placed in the head's pose. A
 * static node is placed where the head is, but without the head's rotation.
 */
export const bodyNodeFrame = (pose: AvatarPose, node: BodyNode): AvatarPose =>
  node.followsHead === false ? { expression: pose.expression, orientation: NO_ROTATION } : pose

export const translateBodyNodeInCameraPlane = (
  node: BodyNode,
  headPose: AvatarPose,
  screenDeltaX: number,
  screenDeltaY: number
): BodyNode => {
  const pose = bodyNodeFrame(headPose, node)
  const cameraPosition = rotateWithQuaternion(pose.orientation, node.position)
  const denominator =
    FOCAL_LENGTH - (cameraPosition[2] + pose.expression.positionZ) * pose.expression.perspective
  const perspectiveScale =
    Math.abs(denominator) < 0.0001 ? FOCAL_LENGTH / 0.0001 : FOCAL_LENGTH / denominator
  const [w, x, y, z] = pose.orientation
  const headDelta = rotateWithQuaternion(
    [w, -x, -y, -z],
    [screenDeltaX / perspectiveScale, screenDeltaY / perspectiveScale, 0]
  )
  return {
    ...node,
    position: [
      node.position[0] + headDelta[0],
      node.position[1] + headDelta[1],
      node.position[2] + headDelta[2],
    ],
  }
}

export const rotateBodyNodeAroundLocalAxis = (
  node: BodyNode,
  axis: 'x' | 'y' | 'z',
  deltaDegrees: number
): BodyNode => {
  const orientation = quaternionFromEuler(
    radians(node.rotation[0]),
    radians(node.rotation[1]),
    radians(node.rotation[2])
  )
  const rotated = multiplyQuaternions(
    orientation,
    quaternionFromAxisAngle(axisVector(axis), radians(deltaDegrees))
  )
  const next = quaternionToEuler(rotated).map(value => (value * 180) / Math.PI) as [
    number,
    number,
    number,
  ]
  return {
    ...node,
    rotation: next.map((value, index) => nearestEquivalentAngle(value, node.rotation[index])) as [
      number,
      number,
      number,
    ],
  }
}

const path = (points: Point3[], close = true) => {
  if (!points.length) return ''
  return `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}${points
    .slice(1)
    .map(point => `L${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
    .join('')}${close ? 'Z' : ''}`
}

export const poseFromExpression = (expression: Expression): AvatarPose => ({
  expression,
  orientation: quaternionFromEuler(
    radians(expression.headX),
    radians(expression.headY),
    radians(expression.headZ)
  ),
})

export const interpolatePose = (from: AvatarPose, to: AvatarPose, progress: number): AvatarPose => {
  const expression: Expression = { ...from.expression }
  const mouthShapeChanges =
    (from.expression.mouthShape ?? 'curve') !== (to.expression.mouthShape ?? 'curve')
  expressionFields.forEach(field => {
    let target = to.expression[field]
    if (
      field === 'headX' ||
      field === 'headY' ||
      field === 'headZ' ||
      field === 'leftAngle' ||
      field === 'rightAngle'
    ) {
      target = nearestEquivalentAngle(target, from.expression[field])
    }
    expression[field] =
      mouthShapeChanges && mouthShapeGeometryFields.has(field) && progress > 0
        ? target
        : from.expression[field] + (target - from.expression[field]) * progress
  })
  if (mouthShapeChanges && progress > 0) expression.mouthShape = to.expression.mouthShape
  if (progress >= 0.5) {
    expression.eyeShape = to.expression.eyeShape
    expression.mouthEnabled = to.expression.mouthEnabled
    if (!mouthShapeChanges) expression.mouthShape = to.expression.mouthShape
    expression.noseEnabled = to.expression.noseEnabled
    expression.noseShape = to.expression.noseShape
  }
  return {
    expression,
    orientation: poseFromExpression(expression).orientation,
  }
}

type ProjectedSurfacePoint = { point: Point3; normal: Point3 }
type LocalSurfacePoint = ProjectedSurfacePoint

const MAX_SURFACE_CACHE_ENTRIES = 24
const HEAD_LATITUDE_SAMPLES = 25
const HEAD_LONGITUDE_SAMPLES = 73
const PRIMITIVE_RING_SAMPLES = 144
const ROUNDED_PRIMITIVE_LATITUDE_SAMPLES = 33
const ROUNDED_PRIMITIVE_LONGITUDE_SAMPLES = 73
const headSamplesCache = new Map<string, Point3[]>()
const accessorySamplesCache = new Map<string, Point3[]>()
const wireSamplesCache = new Map<string, LocalSurfacePoint[][]>()

const surfaceCacheKey = (surface: SurfaceConfig) =>
  JSON.stringify([
    surface.type,
    surface.width,
    surface.height,
    surface.depth,
    surface.roundness,
    surface.morphRoundness,
    surface.tipRoundness,
    surface.baseRoundness,
    surface.topScale,
    surface.bottomScale,
  ])

const cacheSurfaceValue = <Value>(cache: Map<string, Value>, key: string, value: Value) => {
  if (cache.size >= MAX_SURFACE_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
  cache.set(key, value)
  return value
}

const localSurfacePoint = (
  surface: SurfaceConfig,
  longitude: number,
  latitude: number
): LocalSurfacePoint => surfaceSampleAt(surface, longitude, latitude)

const projectLocalSurfacePoint = (
  pose: AvatarPose,
  sample: LocalSurfacePoint
): ProjectedSurfacePoint => ({
  point: projectPosePoint(pose, sample.point),
  normal: rotateWithQuaternion(pose.orientation, sample.normal),
})

const canonicalFaceCoordinates = (x: number, y: number): readonly [number, number] => {
  const longitude = x / RADIUS
  const latitude = y / RADIUS
  return [RADIUS * Math.cos(latitude) * Math.sin(longitude), RADIUS * Math.sin(latitude)]
}

const projectFacePoint = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  x: number,
  y: number
): ProjectedSurfacePoint => {
  const [faceX, faceY] = canonicalFaceCoordinates(x, y)
  return projectLocalSurfacePoint(pose, surfaceFrontSampleAt(surface, faceX, faceY))
}

const eyePoints = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  side: -1 | 1,
  blink: number,
  offset: Readonly<{ x: number; y: number }> = { x: 0, y: 0 }
): ProjectedSurfacePoint[] => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const width = expression[`width${suffix}`]
  const restingHeight = expression[`height${suffix}`]
  const height = 5 + (restingHeight - 5) * blink
  const centerX = (side * expression.spacing) / 2 + expression[`positionX${suffix}`] + offset.x
  const centerY = expression[`positionY${suffix}`] + offset.y
  const angle = radians(side < 0 ? expression.leftAngle : expression.rightAngle)
  const localPoints =
    (expression.eyeShape ?? 'rounded') === 'ellipse'
      ? Array.from({ length: 56 }, (_, index) => {
          const angle = (index / 56) * Math.PI * 2
          return [Math.cos(angle) * width * 0.5, Math.sin(angle) * height * 0.5] as const
        })
      : roundedRectangle(width, height, expression.eyeRoundness / 100)
  return localPoints.map(([localX, localY]) => {
    const rotatedX = localX * Math.cos(angle) - localY * Math.sin(angle)
    const rotatedY = localX * Math.sin(angle) + localY * Math.cos(angle)
    return projectFacePoint(pose, surface, centerX + rotatedX, centerY + rotatedY)
  })
}

const densify2d = (points: readonly (readonly [number, number])[], samples = 14) =>
  points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length]
    return Array.from({ length: samples }, (_, sample) => {
      const progress = sample / samples
      return [
        point[0] + (next[0] - point[0]) * progress,
        point[1] + (next[1] - point[1]) * progress,
      ] as const
    })
  })

const faceMarkPoints = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  x: number,
  y: number,
  angleDegrees: number,
  localPoints: readonly (readonly [number, number])[]
) => {
  const angle = radians(angleDegrees)
  return localPoints.map(([localX, localY]) => {
    const rotatedX = localX * Math.cos(angle) - localY * Math.sin(angle)
    const rotatedY = localX * Math.sin(angle) + localY * Math.cos(angle)
    return projectFacePoint(pose, surface, x + rotatedX, y + rotatedY)
  })
}

const ellipseMark = (width: number, height: number) =>
  Array.from({ length: 56 }, (_, index) => {
    const angle = (index / 56) * Math.PI * 2
    return [Math.cos(angle) * width * 0.5, Math.sin(angle) * height * 0.5] as const
  })

const triangleMark = (width: number, height: number, inverted = false) => {
  const sign = inverted ? -1 : 1
  return densify2d([
    [0, (-height / 2) * sign],
    [width / 2, (height / 2) * sign],
    [-width / 2, (height / 2) * sign],
  ])
}

const roundedTriangleMark = (
  width: number,
  height: number,
  roundness: number,
  inverted = false
) => {
  const sign = inverted ? -1 : 1
  const corners = [
    [0, (-height / 2) * sign],
    [width / 2, (height / 2) * sign],
    [-width / 2, (height / 2) * sign],
  ] as const
  const cornerCut = clamp(roundness / 100, 0, 1) * 0.5
  if (cornerCut === 0) return densify2d(corners)
  return corners.flatMap((corner, index) => {
    const previous = corners[(index + corners.length - 1) % corners.length]
    const next = corners[(index + 1) % corners.length]
    const entry = [
      corner[0] + (previous[0] - corner[0]) * cornerCut,
      corner[1] + (previous[1] - corner[1]) * cornerCut,
    ] as const
    const exit = [
      corner[0] + (next[0] - corner[0]) * cornerCut,
      corner[1] + (next[1] - corner[1]) * cornerCut,
    ] as const
    return Array.from({ length: 14 }, (_, sample) => {
      const progress = sample / 13
      const inverse = 1 - progress
      return [
        inverse * inverse * entry[0] +
          2 * inverse * progress * corner[0] +
          progress * progress * exit[0],
        inverse * inverse * entry[1] +
          2 * inverse * progress * corner[1] +
          progress * progress * exit[1],
      ] as const
    })
  })
}

const nosePoints = (pose: AvatarPose, surface: SurfaceConfig) => {
  const expression = pose.expression
  if (!expression.noseEnabled) return []
  const localPoints =
    expression.noseShape === 'ellipse'
      ? ellipseMark(expression.noseWidth, expression.noseHeight)
      : expression.noseShape === 'rounded'
        ? roundedRectangle(expression.noseWidth, expression.noseHeight, 1)
        : roundedTriangleMark(
            expression.noseWidth,
            expression.noseHeight,
            expression.noseRoundness,
            true
          )
  return faceMarkPoints(
    pose,
    surface,
    expression.noseX,
    expression.noseY,
    expression.noseAngle,
    localPoints
  )
}

const mouthPoints = (pose: AvatarPose, surface: SurfaceConfig) => {
  const expression = pose.expression
  if (!expression.mouthEnabled) return []
  let localPoints: readonly (readonly [number, number])[]
  if (expression.mouthShape === 'ellipse') {
    localPoints = ellipseMark(expression.mouthWidth, expression.mouthHeight)
  } else if (expression.mouthShape === 'rounded-triangle') {
    localPoints = triangleMark(expression.mouthWidth, expression.mouthHeight)
  } else if (expression.mouthShape === 'rounded') {
    localPoints = roundedRectangle(expression.mouthWidth, expression.mouthHeight, 1)
  } else {
    const halfWidth = Math.max(1, expression.mouthWidth / 2)
    const halfHeight = Math.max(0.5, expression.mouthHeight / 2)
    const curve = Math.max(-1, Math.min(1, expression.mouthCurve / 100))
    const curveDepth = curve * expression.mouthWidth * 0.28
    const curveSteps = 28
    const capSteps = 32
    const centerline = Array.from({ length: curveSteps + 1 }, (_, index) => {
      const progress = index / curveSteps
      const x = -halfWidth + expression.mouthWidth * progress
      const normalizedX = x / halfWidth
      const y = curveDepth * (1 - normalizedX ** 2)
      const slope = (-2 * curveDepth * x) / halfWidth ** 2
      const tangentLength = Math.hypot(1, slope)
      return {
        center: [x, y] as const,
        normal: [-slope / tangentLength, 1 / tangentLength] as const,
        tangent: [1 / tangentLength, slope / tangentLength] as const,
      }
    })
    const top = centerline.map(
      ({ center, normal }) =>
        [center[0] - normal[0] * halfHeight, center[1] - normal[1] * halfHeight] as const
    )
    const right = centerline.at(-1)!
    const rightCap = Array.from({ length: capSteps + 1 }, (_, index) => {
      const angle = -Math.PI / 2 + (index / capSteps) * Math.PI
      return [
        right.center[0] +
          (Math.cos(angle) * right.tangent[0] + Math.sin(angle) * right.normal[0]) * halfHeight,
        right.center[1] +
          (Math.cos(angle) * right.tangent[1] + Math.sin(angle) * right.normal[1]) * halfHeight,
      ] as const
    })
    const bottom = [...centerline]
      .reverse()
      .map(
        ({ center, normal }) =>
          [center[0] + normal[0] * halfHeight, center[1] + normal[1] * halfHeight] as const
      )
    const left = centerline[0]!
    const leftCap = Array.from({ length: capSteps + 1 }, (_, index) => {
      const angle = Math.PI / 2 + (index / capSteps) * Math.PI
      return [
        left.center[0] +
          (Math.cos(angle) * left.tangent[0] + Math.sin(angle) * left.normal[0]) * halfHeight,
        left.center[1] +
          (Math.cos(angle) * left.tangent[1] + Math.sin(angle) * left.normal[1]) * halfHeight,
      ] as const
    })
    localPoints = [...top, ...rightCap.slice(1), ...bottom.slice(1), ...leftCap.slice(1)]
  }
  return faceMarkPoints(
    pose,
    surface,
    expression.mouthX,
    expression.mouthY,
    expression.mouthAngle,
    localPoints
  )
}

const visiblePath = (points: ProjectedSurfacePoint[]) => {
  const segments: Point3[][] = []
  let segment: Point3[] = []
  points.forEach(({ point, normal }) => {
    if (normal[2] > 0) segment.push(point)
    else if (segment.length) {
      segments.push(segment)
      segment = []
    }
  })
  if (segment.length) segments.push(segment)
  return segments
    .filter(item => item.length > 1)
    .map(item => path(item, false))
    .join('')
}

const wirePaths = (pose: AvatarPose, surface: SurfaceConfig): string[] => {
  const key = surfaceCacheKey(surface)
  let samples = wireSamplesCache.get(key)
  if (!samples) {
    const parallels = [-60, -30, 0, 30, 60].map(latitude =>
      Array.from({ length: 73 }, (_, index) =>
        localSurfacePoint(surface, radians(-180 + index * 5), radians(latitude))
      )
    )
    const meridians = Array.from(
      { length: 12 },
      (_, longitudeIndex) => -150 + longitudeIndex * 30
    ).map(longitude =>
      Array.from({ length: 37 }, (_, index) =>
        localSurfacePoint(surface, radians(longitude), radians(-90 + index * 5))
      )
    )
    samples = cacheSurfaceValue(wireSamplesCache, key, [...parallels, ...meridians])
  }
  return samples.map(curve =>
    visiblePath(curve.map(sample => projectLocalSurfacePoint(pose, sample)))
  )
}

const projectEyePoint = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  side: -1 | 1,
  localX: number,
  localY: number
): Point3 => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const angle = radians(side < 0 ? expression.leftAngle : expression.rightAngle)
  const rotatedX = localX * Math.cos(angle) - localY * Math.sin(angle)
  const rotatedY = localX * Math.sin(angle) + localY * Math.cos(angle)
  return projectFacePoint(
    pose,
    surface,
    (side * expression.spacing) / 2 + expression[`positionX${suffix}`] + rotatedX,
    expression[`positionY${suffix}`] + rotatedY
  ).point
}

export const renderEyeEditor = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  side: -1 | 1
): EyeEditorGeometry => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const width = expression[`width${suffix}`]
  const height = expression[`height${suffix}`]
  const selectedSamples = eyePoints(pose, surface, side, 1)
  const selectedPoints = selectedSamples.map(sample => sample.point)
  const center = projectEyePoint(pose, surface, side, 0, 0)
  const widthHandle = projectEyePoint(pose, surface, side, width / 2 + 9, 0)
  const heightHandle = projectEyePoint(pose, surface, side, 0, -height / 2 - 9)
  const rotateHandle = projectEyePoint(pose, surface, side, 0, -height / 2 - 30)
  const sizeHandle = projectEyePoint(pose, surface, side, width / 2 + 11, height / 2 + 11)
  const leftCenter = projectEyePoint(pose, surface, -1, 0, 0)
  const rightCenter = projectEyePoint(pose, surface, 1, 0, 0)
  const spacingCenterX = (expression.positionXLeft + expression.positionXRight) / 2
  const spacingCenterY = (expression.positionYLeft + expression.positionYRight) / 2
  const spacingHandle = projectFacePoint(
    pose,
    surface,
    spacingCenterX,
    spacingCenterY + height / 2 + 34
  ).point
  const spacingMiddle: Point3 = [
    (leftCenter[0] + rightCenter[0]) / 2,
    (leftCenter[1] + rightCenter[1]) / 2,
    (leftCenter[2] + rightCenter[2]) / 2,
  ]
  const line = (from: Point3, to: Point3) => path([from, to], false)
  return {
    visible: selectedSamples.reduce((total, sample) => total + sample.normal[2], 0) > 0,
    selectionPath: path(selectedPoints),
    widthGuide: line(center, widthHandle),
    heightGuide: line(center, heightHandle),
    rotationGuide: line(heightHandle, rotateHandle),
    spacingGuide: `${line(leftCenter, rightCenter)}${line(spacingMiddle, spacingHandle)}`,
    center,
    widthHandle,
    heightHandle,
    rotateHandle,
    sizeHandle,
    spacingHandle,
  }
}

const convexHull = (points: Point3[]): Point3[] => {
  const sorted = [...points].sort((left, right) => left[0] - right[0] || left[1] - right[1])
  const cross = (origin: Point3, first: Point3, second: Point3) =>
    (first[0] - origin[0]) * (second[1] - origin[1]) -
    (first[1] - origin[1]) * (second[0] - origin[0])
  const half = (source: Point3[]) => {
    const result: Point3[] = []
    source.forEach(point => {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop()
      result.push(point)
    })
    return result
  }
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)]
}

const smoothClosedPath = (points: Point3[]) => {
  if (points.length < 3) return path(points)
  const pointAt = (index: number) => points[(index + points.length) % points.length]
  return `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}${points
    .map((point, index) => {
      const previous = pointAt(index - 1)
      const next = pointAt(index + 1)
      const afterNext = pointAt(index + 2)
      const firstControl: Point3 = [
        point[0] + (next[0] - previous[0]) / 6,
        point[1] + (next[1] - previous[1]) / 6,
        point[2],
      ]
      const secondControl: Point3 = [
        next[0] - (afterNext[0] - point[0]) / 6,
        next[1] - (afterNext[1] - point[1]) / 6,
        next[2],
      ]
      return `C${firstControl[0].toFixed(2)} ${firstControl[1].toFixed(2)} ${secondControl[0].toFixed(2)} ${secondControl[1].toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`
    })
    .join('')}Z`
}

const densifyClosedPoints = (points: Point3[], maximumDistance = 7) =>
  points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length]
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(next[0] - point[0], next[1] - point[1]) / maximumDistance)
    )
    return Array.from({ length: steps }, (_, step) => {
      const progress = step / steps
      return [
        point[0] + (next[0] - point[0]) * progress,
        point[1] + (next[1] - point[1]) * progress,
        point[2] + (next[2] - point[2]) * progress,
      ] as Point3
    })
  })

const smoothOpenPath = (points: Point3[]) => {
  if (!points.length) return ''
  if (points.length === 1) return `${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`
  return points
    .slice(0, -1)
    .map((point, index) => {
      const previous = points[Math.max(0, index - 1)]
      const next = points[index + 1]
      const afterNext = points[Math.min(points.length - 1, index + 2)]
      const firstControlX = point[0] + (next[0] - previous[0]) / 6
      const firstControlY = point[1] + (next[1] - previous[1]) / 6
      const secondControlX = next[0] - (afterNext[0] - point[0]) / 6
      const secondControlY = next[1] - (afterNext[1] - point[1]) / 6
      return `C${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)} ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`
    })
    .join('')
}

const projectLocalPoint = (pose: AvatarPose, point: Point3) => projectPosePoint(pose, point)

const ringPoints = (width: number, depth: number, y: number) =>
  Array.from({ length: PRIMITIVE_RING_SAMPLES + 1 }, (_, index) => {
    const angle = (index / PRIMITIVE_RING_SAMPLES) * Math.PI * 2
    return [(width / 2) * Math.sin(angle), y, (depth / 2) * Math.cos(angle)] as Point3
  })

const projectedRoundedPrimitivePath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const key = surfaceCacheKey(surface)
  let localSamples = headSamplesCache.get(key)
  if (!localSamples) {
    localSamples = Array.from(
      { length: ROUNDED_PRIMITIVE_LATITUDE_SAMPLES },
      (_, latitudeIndex) => {
        const latitude =
          -Math.PI / 2 + (latitudeIndex / (ROUNDED_PRIMITIVE_LATITUDE_SAMPLES - 1)) * Math.PI
        return Array.from({ length: ROUNDED_PRIMITIVE_LONGITUDE_SAMPLES }, (_, longitudeIndex) => {
          const longitude =
            -Math.PI + (longitudeIndex / (ROUNDED_PRIMITIVE_LONGITUDE_SAMPLES - 1)) * Math.PI * 2
          return surfacePointAt(surface, longitude, latitude)
        })
      }
    ).flat()
    cacheSurfaceValue(headSamplesCache, key, localSamples)
  }
  const projected = localSamples.map(point => projectLocalPoint(pose, point))
  return smoothClosedPath(densifyClosedPoints(convexHull(projected)))
}

const projectedCylinderPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (surface.roundness > 0 || (surface.morphRoundness ?? 0) > 0) {
    return projectedRoundedPrimitivePath(pose, surface)
  }

  const halfHeight = surface.height / 2
  const projected = [
    ...ringPoints(surface.width, surface.depth, -halfHeight),
    ...ringPoints(surface.width, surface.depth, halfHeight),
  ].map(point => projectLocalPoint(pose, point))
  return smoothClosedPath(densifyClosedPoints(convexHull(projected)))
}

const projectedCursorBodyPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const layout = cursorLayout(surface)
  const halfHeight = layout.bodyHeight / 2
  const projected = [
    ...ringPoints(layout.bodyWidth, layout.bodyDepth, layout.bodyCenterY - halfHeight),
    ...ringPoints(layout.bodyWidth, layout.bodyDepth, layout.bodyCenterY + halfHeight),
  ].map(point => projectLocalPoint(pose, point))
  return smoothClosedPath(densifyClosedPoints(convexHull(projected)))
}

const projectedCursorConePath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const layout = cursorLayout(surface)
  const apex = projectLocalPoint(pose, [0, layout.coneApexY, 0])
  const base = ringPoints(surface.width, surface.depth, layout.coneBaseY).map(point =>
    projectLocalPoint(pose, point)
  )
  return smoothClosedPath(densifyClosedPoints(convexHull([...base, apex])))
}

const projectedConePath = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (
    (surface.morphRoundness ?? 0) > 0 ||
    (surface.tipRoundness ?? 0) > 0 ||
    (surface.baseRoundness ?? 0) > 0
  ) {
    return projectedRoundedPrimitivePath(pose, surface)
  }

  const apex = projectLocalPoint(pose, [0, -surface.height / 2, 0])
  const base = ringPoints(surface.width, surface.depth, surface.height / 2).map(point =>
    projectLocalPoint(pose, point)
  )
  const hull = convexHull([...base, apex])
  const apexIndex = hull.findIndex(
    point => Math.hypot(point[0] - apex[0], point[1] - apex[1]) < 0.01
  )
  if (apexIndex < 0) return smoothClosedPath(hull)

  const ordered = [...hull.slice(apexIndex), ...hull.slice(0, apexIndex)]
  const baseArc = ordered.slice(1)
  if (baseArc.length < 2) return path(hull)
  return `M${apex[0].toFixed(2)} ${apex[1].toFixed(2)}L${baseArc[0][0].toFixed(2)} ${baseArc[0][1].toFixed(2)}${smoothOpenPath(baseArc)}L${apex[0].toFixed(2)} ${apex[1].toFixed(2)}Z`
}

const projectedCubePath = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (surface.roundness > 0) return projectedRoundedPrimitivePath(pose, surface)

  const halfWidth = surface.width / 2
  const halfHeight = surface.height / 2
  const halfDepth = surface.depth / 2
  const vertices = [-1, 1].flatMap(x =>
    [-1, 1].flatMap(y => [-1, 1].map(z => [x * halfWidth, y * halfHeight, z * halfDepth] as Point3))
  )
  return path(convexHull(vertices.map(point => projectLocalPoint(pose, point))))
}

const projectedDiamondPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (surface.roundness > 0) return projectedRoundedPrimitivePath(pose, surface)

  const halfWidth = surface.width / 2
  const halfHeight = surface.height / 2
  const halfDepth = surface.depth / 2
  const vertices: Point3[] = [
    [-halfWidth, 0, 0],
    [halfWidth, 0, 0],
    [0, -halfHeight, 0],
    [0, halfHeight, 0],
    [0, 0, -halfDepth],
    [0, 0, halfDepth],
  ]
  return path(convexHull(vertices.map(point => projectLocalPoint(pose, point))))
}

type ProjectedEllipse = {
  centerX: number
  centerY: number
  majorRadius: number
  minorRadius: number
  rotation: number
}

const ellipseProjection = (
  centerX: number,
  centerY: number,
  covarianceXX: number,
  covarianceXY: number,
  covarianceYY: number
): ProjectedEllipse | null => {
  const trace = covarianceXX + covarianceYY
  const difference = Math.hypot(covarianceXX - covarianceYY, covarianceXY * 2)
  const majorSquared = (trace + difference) / 2
  const minorSquared = (trace - difference) / 2
  if (majorSquared <= 0 || minorSquared <= 0) return null

  return {
    centerX,
    centerY,
    majorRadius: Math.sqrt(majorSquared),
    minorRadius: Math.sqrt(minorSquared),
    rotation: Math.atan2(covarianceXY * 2, covarianceXX - covarianceYY) / 2,
  }
}

const ellipsePath = ({
  centerX,
  centerY,
  majorRadius,
  minorRadius,
  rotation,
}: ProjectedEllipse) => {
  const rotationDegrees = (rotation * 180) / Math.PI
  const offsetX = Math.cos(rotation) * majorRadius
  const offsetY = Math.sin(rotation) * majorRadius
  const startX = centerX + offsetX
  const startY = centerY + offsetY
  const endX = centerX - offsetX
  const endY = centerY - offsetY

  return `M${startX.toFixed(2)} ${startY.toFixed(2)}A${majorRadius.toFixed(2)} ${minorRadius.toFixed(2)} ${rotationDegrees.toFixed(2)} 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}A${majorRadius.toFixed(2)} ${minorRadius.toFixed(2)} ${rotationDegrees.toFixed(2)} 0 1 ${startX.toFixed(2)} ${startY.toFixed(2)}Z`
}

const projectedEllipsoid = (
  pose: AvatarPose,
  axes: Point3,
  localCenter: Point3 = [0, 0, 0]
): ProjectedEllipse | null => {
  const rotatedAxes = [
    rotateWithQuaternion(pose.orientation, [1, 0, 0]),
    rotateWithQuaternion(pose.orientation, [0, 1, 0]),
    rotateWithQuaternion(pose.orientation, [0, 0, 1]),
  ]
  const center = transformPosePoint(pose, localCenter)

  if (Math.abs(pose.expression.perspective) < 0.0001) {
    const covarianceXX = rotatedAxes.reduce(
      (total, axis, index) => total + axis[0] * axis[0] * axes[index] * axes[index],
      0
    )
    const covarianceXY = rotatedAxes.reduce(
      (total, axis, index) => total + axis[0] * axis[1] * axes[index] * axes[index],
      0
    )
    const covarianceYY = rotatedAxes.reduce(
      (total, axis, index) => total + axis[1] * axis[1] * axes[index] * axes[index],
      0
    )
    return ellipseProjection(center[0], center[1], covarianceXX, covarianceXY, covarianceYY)
  }

  const inverseAxesSquared = axes.map(axis => 1 / (axis * axis))
  const quadratic = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, column) =>
      rotatedAxes.reduce(
        (total, axis, index) => total + axis[row] * inverseAxesSquared[index] * axis[column],
        0
      )
    )
  )
  const focalLength = FOCAL_LENGTH / pose.expression.perspective
  const cameraOffset: Point3 = [-center[0], -center[1], focalLength - center[2]]
  const cameraNormal: Point3 = [
    quadratic[0][0] * cameraOffset[0] +
      quadratic[0][1] * cameraOffset[1] +
      quadratic[0][2] * cameraOffset[2],
    quadratic[1][0] * cameraOffset[0] +
      quadratic[1][1] * cameraOffset[1] +
      quadratic[1][2] * cameraOffset[2],
    quadratic[2][0] * cameraOffset[0] +
      quadratic[2][1] * cameraOffset[1] +
      quadratic[2][2] * cameraOffset[2],
  ]
  const cameraTerm =
    cameraOffset[0] * cameraNormal[0] +
    cameraOffset[1] * cameraNormal[1] +
    cameraOffset[2] * cameraNormal[2] -
    1
  const tangentLinear = [cameraNormal[0], cameraNormal[1], -focalLength * cameraNormal[2]]
  const rayQuadratic = [
    [quadratic[0][0], quadratic[0][1], -focalLength * quadratic[0][2]],
    [quadratic[1][0], quadratic[1][1], -focalLength * quadratic[1][2]],
    [
      -focalLength * quadratic[2][0],
      -focalLength * quadratic[2][1],
      focalLength * focalLength * quadratic[2][2],
    ],
  ]
  const conic = Array.from({ length: 3 }, (_, row) =>
    Array.from(
      { length: 3 },
      (_, column) =>
        tangentLinear[row] * tangentLinear[column] - cameraTerm * rayQuadratic[row][column]
    )
  )
  const determinant = conic[0][0] * conic[1][1] - conic[0][1] * conic[0][1]
  if (Math.abs(determinant) < 1e-12) return null

  const centerX = -(conic[1][1] * conic[0][2] - conic[0][1] * conic[1][2]) / determinant
  const centerY = (conic[0][1] * conic[0][2] - conic[0][0] * conic[1][2]) / determinant
  const centeredConstant = conic[2][2] + conic[0][2] * centerX + conic[1][2] * centerY
  const scale = -centeredConstant
  if (Math.abs(scale) < 1e-12) return null

  const shapeXX = conic[0][0] / scale
  const shapeXY = conic[0][1] / scale
  const shapeYY = conic[1][1] / scale
  const shapeDeterminant = shapeXX * shapeYY - shapeXY * shapeXY
  if (shapeDeterminant <= 0) return null

  return ellipseProjection(
    centerX,
    centerY,
    shapeYY / shapeDeterminant,
    -shapeXY / shapeDeterminant,
    shapeXX / shapeDeterminant
  )
}

const projectedEllipsoidPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const ellipse = projectedEllipsoid(pose, [
    surface.width / 2,
    surface.height / 2,
    surface.depth / 2,
  ])
  const isSphere = surface.width === surface.height && surface.height === surface.depth
  if (ellipse && isSphere) {
    const radius = (ellipse.majorRadius + ellipse.minorRadius) / 2
    return ellipsePath({
      centerX: Math.abs(ellipse.centerX) < 0.0001 ? 0 : ellipse.centerX,
      centerY: Math.abs(ellipse.centerY) < 0.0001 ? 0 : ellipse.centerY,
      majorRadius: radius,
      minorRadius: radius,
      rotation: 0,
    })
  }
  return ellipse ? ellipsePath(ellipse) : null
}

const mickeyEarPaths = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (surface.type !== 'mickey') return []

  const radius = Math.min(surface.width, surface.height) * 0.23
  const depthRadius = Math.min(radius, surface.depth * 0.29)
  const centerX = surface.width * 0.37
  const centerY = -surface.height * 0.39
  const centerZ = -surface.depth * 0.12
  const axes: Point3 = [radius, radius, depthRadius]
  return [-1, 1]
    .map(side => projectedEllipsoid(pose, axes, [side * centerX, centerY, centerZ]))
    .filter((ear): ear is ProjectedEllipse => ear !== null)
    .map(ellipsePath)
}

const compositeBackPaths = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (surface.type === 'mickey') return mickeyEarPaths(pose, surface)
  if (surface.type === 'cursor') return [projectedCursorConePath(pose, surface)]
  return []
}

const ellipsePoints = (ellipse: ProjectedEllipse) =>
  Array.from({ length: PRIMITIVE_RING_SAMPLES }, (_, index) => {
    const angle = (index / PRIMITIVE_RING_SAMPLES) * Math.PI * 2
    const major = Math.cos(angle) * ellipse.majorRadius
    const minor = Math.sin(angle) * ellipse.minorRadius
    return [
      ellipse.centerX + major * Math.cos(ellipse.rotation) - minor * Math.sin(ellipse.rotation),
      ellipse.centerY + major * Math.sin(ellipse.rotation) + minor * Math.cos(ellipse.rotation),
      0,
    ] as Point3
  })

const smoothHullPath = (points: Point3[]) => {
  if (points.length < 3) return path(points)
  const distances = points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    return Math.hypot(next[0] - point[0], next[1] - point[1])
  })
  const sortedDistances = [...distances].sort((left, right) => left - right)
  const medianDistance = sortedDistances[Math.floor(sortedDistances.length / 2)] || 1
  const straightThreshold = Math.max(8, medianDistance * 3.5)
  const straightEdges = distances.map(distance => distance > straightThreshold)

  return `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}${points
    .map((point, index) => {
      const nextIndex = (index + 1) % points.length
      const next = points[nextIndex]
      if (straightEdges[index]) return `L${next[0].toFixed(2)} ${next[1].toFixed(2)}`
      const previous = straightEdges[(index - 1 + points.length) % points.length]
        ? point
        : points[(index - 1 + points.length) % points.length]
      const afterNext = straightEdges[nextIndex] ? next : points[(index + 2) % points.length]
      const firstControlX = point[0] + (next[0] - previous[0]) / 6
      const firstControlY = point[1] + (next[1] - previous[1]) / 6
      const secondControlX = next[0] - (afterNext[0] - point[0]) / 6
      const secondControlY = next[1] - (afterNext[1] - point[1]) / 6
      return `C${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)} ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`
    })
    .join('')}Z`
}

const projectedCapsulePath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const radiusX = surface.width / 2
  const radiusY = Math.min(radiusX, surface.height / 2)
  const radiusZ = surface.depth / 2
  const straightHalf = Math.max(0, (surface.height - radiusY * 2) / 2)
  const axes: Point3 = [radiusX, radiusY, radiusZ]
  const top = projectedEllipsoid(pose, axes, [0, straightHalf, 0])
  const bottom = projectedEllipsoid(pose, axes, [0, -straightHalf, 0])
  if (!top || !bottom) return null
  return smoothHullPath(convexHull([...ellipsePoints(top), ...ellipsePoints(bottom)]))
}

const headPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (surface.type === 'sphere' || surface.type === 'mickey') {
    const exactPath = projectedEllipsoidPath(pose, surface)
    if (exactPath) return exactPath
  }

  if (surface.type === 'capsule') {
    const exactPath = projectedCapsulePath(pose, surface)
    if (exactPath) return exactPath
  }

  if (surface.type === 'cylinder') return projectedCylinderPath(pose, surface)
  if (surface.type === 'cursor') return projectedCursorBodyPath(pose, surface)
  if (surface.type === 'cone') return projectedConePath(pose, surface)
  if (surface.type === 'cube') return projectedCubePath(pose, surface)
  if (surface.type === 'diamond') return projectedDiamondPath(pose, surface)

  const key = surfaceCacheKey(surface)
  let localSamples = headSamplesCache.get(key)
  if (!localSamples) {
    localSamples = Array.from({ length: HEAD_LATITUDE_SAMPLES }, (_, latitudeIndex) => {
      const latitude = -Math.PI / 2 + (latitudeIndex / (HEAD_LATITUDE_SAMPLES - 1)) * Math.PI
      return Array.from({ length: HEAD_LONGITUDE_SAMPLES }, (_, longitudeIndex) => {
        const longitude = -Math.PI + (longitudeIndex / (HEAD_LONGITUDE_SAMPLES - 1)) * Math.PI * 2
        return surfacePointAt(surface, longitude, latitude)
      })
    }).flat()
    cacheSurfaceValue(headSamplesCache, key, localSamples)
  }
  const projectedSamples = localSamples.map(sample => projectPosePoint(pose, sample))
  const hull = convexHull(projectedSamples)
  if (surface.type === 'trapezoid' && surface.roundness <= 0) return path(hull)
  return surface.type === 'trapezoid' ? smoothClosedPath(densifyClosedPoints(hull)) : path(hull)
}

/** The pose of a node's own surface: the avatar's pose carried to the node's place and turn. */
const nodePose = (headPose: AvatarPose, node: BodyNode): AvatarPose => {
  const pose = bodyNodeFrame(headPose, node)
  const center = transformPosePoint(pose, node.position)
  return {
    orientation: multiplyQuaternions(
      pose.orientation,
      quaternionFromEuler(
        radians(node.rotation[0]),
        radians(node.rotation[1]),
        radians(node.rotation[2])
      )
    ),
    expression: {
      ...pose.expression,
      positionX: center[0],
      positionY: center[1],
      positionZ: center[2],
    },
  }
}

// A node is a surface like the head, elsewhere: its outline is the head's exact outline in the
// node's own pose. Only the trapezoid has no exact outline; it keeps the sampled one, which
// projects several hundred points of the surface and wraps them.
const accessoryPath = (pose: AvatarPose, node: BodyNode) =>
  node.surface.type === 'trapezoid'
    ? sampledAccessoryPath(pose, node)
    : headPath(nodePose(pose, node), node.surface)

const sampledAccessoryPath = (headPose: AvatarPose, node: BodyNode) => {
  const pose = bodyNodeFrame(headPose, node)
  const key = surfaceCacheKey(node.surface)
  let localSamples = accessorySamplesCache.get(key)
  if (!localSamples) {
    localSamples = Array.from({ length: 17 }, (_, latitudeIndex) => {
      const latitude = -Math.PI / 2 + (latitudeIndex / 16) * Math.PI
      return Array.from({ length: 49 }, (_, longitudeIndex) => {
        const longitude = -Math.PI + (longitudeIndex / 48) * Math.PI * 2
        return surfacePointAt(node.surface, longitude, latitude)
      })
    }).flat()
    cacheSurfaceValue(accessorySamplesCache, key, localSamples)
  }

  const localOrientation = quaternionFromEuler(
    radians(node.rotation[0]),
    radians(node.rotation[1]),
    radians(node.rotation[2])
  )
  const projected = localSamples.map(point => {
    const locallyRotated = rotateWithQuaternion(localOrientation, point)
    const positioned: Point3 = [
      locallyRotated[0] + node.position[0],
      locallyRotated[1] + node.position[1],
      locallyRotated[2] + node.position[2],
    ]
    return projectPosePoint(pose, positioned)
  })
  const hull = convexHull(projected)
  if (
    (node.surface.type === 'cube' ||
      node.surface.type === 'diamond' ||
      node.surface.type === 'trapezoid') &&
    node.surface.roundness <= 0
  ) {
    return path(hull)
  }
  return smoothClosedPath(densifyClosedPoints(hull))
}

const ACCESSORY_FRONT_CROSSING_RATIO = 0.1

const accessoryCameraDepthRadius = (headPose: AvatarPose, node: BodyNode) => {
  const pose = bodyNodeFrame(headPose, node)
  const localOrientation = quaternionFromEuler(
    radians(node.rotation[0]),
    radians(node.rotation[1]),
    radians(node.rotation[2])
  )
  const cameraDepthByAxis = (
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as Point3[]
  ).map(
    axis => rotateWithQuaternion(pose.orientation, rotateWithQuaternion(localOrientation, axis))[2]
  )
  return Math.hypot(
    cameraDepthByAxis[0] * (node.surface.width / 2),
    cameraDepthByAxis[1] * (node.surface.height / 2),
    cameraDepthByAxis[2] * (node.surface.depth / 2)
  )
}

const accessoryLayers = (pose: AvatarPose, nodes: BodyNode[]) => {
  const layers = nodes
    .map(node => {
      const depth = rotateWithQuaternion(bodyNodeFrame(pose, node).orientation, node.position)[2]
      return {
        id: node.id,
        path: accessoryPath(pose, node),
        depth,
        front: depth > accessoryCameraDepthRadius(pose, node) * ACCESSORY_FRONT_CROSSING_RATIO,
      }
    })
    .sort((left, right) => left.depth - right.depth)
  return {
    backPaths: layers.filter(layer => !layer.front).map(layer => layer.path),
    frontPaths: layers.filter(layer => layer.front).map(layer => layer.path),
    backNodeIds: layers.filter(layer => !layer.front).map(layer => layer.id),
    frontNodeIds: layers.filter(layer => layer.front).map(layer => layer.id),
    frontClipPaths: layers.filter(layer => layer.front).map(() => ''),
  }
}

// Occlusion masks. Where a node of another colour sinks into the head, the two surfaces meet
// along a line. That line is found on the node's own surface: a point of it is turned to the
// viewer or not, inside the head or not, behind the head or not, and each of the three is read
// from the field of one of the two surfaces. The part of the node that shows in front is traced
// on a grid of the node's surface, each crossing placed by bisection, then projected. The line
// where the two solids meet is therefore a true curve, whatever the two shapes are.

const MASK_ROWS = 14
const MASK_COLUMNS = 28
const MASK_BISECTIONS = 12
// The node's own outline is drawn exactly, by its path. Where the region ends on it, it only
// has to reach it: it is pushed a little past.
const PAST_NODE_OUTLINE = 3
// How far a point is moved towards the viewer to read which way a field changes.
const FIELD_STEP = 0.25
// A turn of the meeting line sharper than this, about forty degrees, is drawn as a corner.
const MASK_CORNER_COSINE = 0.77

type Matrix3 = [Point3, Point3, Point3]

/** The columns of the rotation: where each local axis points. */
const rotationAxes = (orientation: Quaternion): Matrix3 => [
  rotateWithQuaternion(orientation, [1, 0, 0]),
  rotateWithQuaternion(orientation, [0, 1, 0]),
  rotateWithQuaternion(orientation, [0, 0, 1]),
]

/** Why a point of the node does not show in front: its own back, inside the head, or behind it. */
type MaskEdge = 'rim' | 'cut' | 'behind'

/**
 * Where a coloured node is nearer than the head, as a clip for the copy drawn in front. `whole`
 * when all of the node that faces the viewer is, `none` when none of it is.
 */
const nodeFrontClip = (
  pose: AvatarPose,
  head: SurfaceConfig,
  node: BodyNode
): { kind: 'none' } | { kind: 'whole' } | { kind: 'clip'; path: string } => {
  const perspective = pose.expression.perspective
  const orthographic = Math.abs(perspective) < 0.0001
  const eyeZ = orthographic ? 0 : FOCAL_LENGTH / perspective
  const headAxes = rotationAxes(pose.orientation)
  const headCenter = transformPosePoint(pose, [0, 0, 0])
  const headField = surfaceField(head)
  const local = nodePose(pose, node)
  const nodeAxes = rotationAxes(local.orientation)
  const nodeCenter: Point3 = [
    local.expression.positionX,
    local.expression.positionY,
    local.expression.positionZ,
  ]
  const nodeField = surfaceField(node.surface)

  // The grid has one row more at each end than the surface has latitudes. A surface that ends
  // on a flat face, as a cylinder does, has no point of its own there: the added row is the
  // centre of that face, and the rows between span it. On a surface that closes on a point the
  // added row is that point again.
  const latitudeAt = (row: number) => -Math.PI / 2 + (row / MASK_ROWS) * Math.PI
  const longitudeAt = (column: number) => -Math.PI + (column / MASK_COLUMNS) * Math.PI * 2

  // A point of the node's surface, in the camera's space, with what decides whether it shows
  // in front.
  let x = 0
  let y = 0
  let z = 0
  let edge: MaskEdge = 'rim'
  const shows = (row: number, longitude: number) => {
    const onSurface = row < 0 ? 0 : row > MASK_ROWS ? MASK_ROWS : row
    const towardsAxis = row < 0 ? -row : row > MASK_ROWS ? row - MASK_ROWS : 0
    const point = surfaceTracePointAt(node.surface, longitude, latitudeAt(onSurface))
    const localX = point[0] * (1 - towardsAxis)
    const localY = point[1]
    const localZ = point[2] * (1 - towardsAxis)
    x = nodeCenter[0] + nodeAxes[0][0] * localX + nodeAxes[1][0] * localY + nodeAxes[2][0] * localZ
    y = nodeCenter[1] + nodeAxes[0][1] * localX + nodeAxes[1][1] * localY + nodeAxes[2][1] * localZ
    z = nodeCenter[2] + nodeAxes[0][2] * localX + nodeAxes[1][2] * localY + nodeAxes[2][2] * localZ
    // A short step towards the viewer from this point.
    let stepX = orthographic ? 0 : -x
    let stepY = orthographic ? 0 : -y
    let stepZ = orthographic ? 1 : eyeZ - z
    const scale = FIELD_STEP / (Math.sqrt(stepX * stepX + stepY * stepY + stepZ * stepZ) || 1)
    stepX *= scale
    stepY *= scale
    stepZ *= scale
    // The node hides its own back: there, the step goes into the node.
    if (
      nodeField(
        localX + nodeAxes[0][0] * stepX + nodeAxes[0][1] * stepY + nodeAxes[0][2] * stepZ,
        localY + nodeAxes[1][0] * stepX + nodeAxes[1][1] * stepY + nodeAxes[1][2] * stepZ,
        localZ + nodeAxes[2][0] * stepX + nodeAxes[2][1] * stepY + nodeAxes[2][2] * stepZ
      ) <= nodeField(localX, localY, localZ)
    ) {
      edge = 'rim'
      return false
    }
    // The same point in the head's space.
    const offsetX = x - headCenter[0]
    const offsetY = y - headCenter[1]
    const offsetZ = z - headCenter[2]
    const headX = headAxes[0][0] * offsetX + headAxes[0][1] * offsetY + headAxes[0][2] * offsetZ
    const headY = headAxes[1][0] * offsetX + headAxes[1][1] * offsetY + headAxes[1][2] * offsetZ
    const headZ = headAxes[2][0] * offsetX + headAxes[2][1] * offsetY + headAxes[2][2] * offsetZ
    const outside = headField(headX, headY, headZ)
    if (outside <= 0) {
      edge = 'cut'
      return false
    }
    // Outside the head, a point is behind it when the way to the viewer leads towards it. Off
    // the head's outline this still splits the node in two, but there both copies show alike.
    if (
      headField(
        headX + headAxes[0][0] * stepX + headAxes[0][1] * stepY + headAxes[0][2] * stepZ,
        headY + headAxes[1][0] * stepX + headAxes[1][1] * stepY + headAxes[1][2] * stepZ,
        headZ + headAxes[2][0] * stepX + headAxes[2][1] * stepY + headAxes[2][2] * stepZ
      ) < outside
    ) {
      edge = 'behind'
      return false
    }
    return true
  }

  const GRID_ROWS = MASK_ROWS + 3
  const cell = (row: number, column: number) => (row + 1) * MASK_COLUMNS + column
  const visible = new Uint8Array(GRID_ROWS * MASK_COLUMNS)
  let shown = 0
  let facingViewer = 0
  for (let row = -1; row <= MASK_ROWS + 1; row += 1) {
    for (let column = 0; column < MASK_COLUMNS; column += 1) {
      const result = shows(row, longitudeAt(column))
      if (result) {
        visible[cell(row, column)] = 1
        shown += 1
        facingViewer += 1
      } else if (edge !== 'rim') {
        facingViewer += 1
      }
    }
  }
  // Nothing of the node is nearer than the head: the copy behind the head is all there is.
  if (shown === 0) return { kind: 'none' }
  if (shown === facingViewer) return { kind: 'whole' }

  const project = (px: number, py: number, pz: number): [number, number] => {
    if (orthographic) return [px, py]
    const denominator = FOCAL_LENGTH - pz * perspective
    const scale =
      Math.abs(denominator) < 0.0001 ? FOCAL_LENGTH / 0.0001 : FOCAL_LENGTH / denominator
    return [px * scale, py * scale]
  }
  const nodeOnScreen = project(nodeCenter[0], nodeCenter[1], nodeCenter[2])

  // Edges of the grid are numbered: along a row first, then along a column.
  const rowEdges = GRID_ROWS * MASK_COLUMNS
  const crossing = (edgeIndex: number): { point: [number, number]; edge: MaskEdge } => {
    let fromRow: number
    let fromColumn: number
    let toRow: number
    let toColumn: number
    if (edgeIndex < rowEdges) {
      fromRow = Math.floor(edgeIndex / MASK_COLUMNS) - 1
      fromColumn = edgeIndex % MASK_COLUMNS
      toRow = fromRow
      toColumn = fromColumn + 1
    } else {
      const index = edgeIndex - rowEdges
      fromRow = Math.floor(index / MASK_COLUMNS) - 1
      fromColumn = index % MASK_COLUMNS
      toRow = fromRow + 1
      toColumn = fromColumn
    }
    let rowIn = fromRow
    let longitudeIn = longitudeAt(fromColumn)
    let rowOut = toRow
    let longitudeOut = longitudeAt(toColumn)
    if (!visible[cell(fromRow, fromColumn)]) {
      ;[rowIn, rowOut] = [rowOut, rowIn]
      ;[longitudeIn, longitudeOut] = [longitudeOut, longitudeIn]
    }
    // The last point that does not show names the reason, the last that shows gives the place.
    shows(rowOut, longitudeOut)
    let reason = edge
    for (let step = 0; step < MASK_BISECTIONS; step += 1) {
      const row = (rowIn + rowOut) / 2
      const longitude = (longitudeIn + longitudeOut) / 2
      if (shows(row, longitude)) {
        rowIn = row
        longitudeIn = longitude
      } else {
        rowOut = row
        longitudeOut = longitude
        reason = edge
      }
    }
    shows(rowIn, longitudeIn)
    const point = project(x, y, z)
    if (reason === 'rim') {
      const awayX = point[0] - nodeOnScreen[0]
      const awayY = point[1] - nodeOnScreen[1]
      const distance = Math.hypot(awayX, awayY) || 1
      point[0] += (awayX / distance) * PAST_NODE_OUTLINE
      point[1] += (awayY / distance) * PAST_NODE_OUTLINE
    }
    return { point, edge: reason }
  }

  const next = new Map<number, number>()
  for (let row = -1; row <= MASK_ROWS; row += 1) {
    for (let column = 0; column < MASK_COLUMNS; column += 1) {
      const nextColumn = (column + 1) % MASK_COLUMNS
      const topLeft = visible[cell(row, column)]
      const topRight = visible[cell(row, nextColumn)]
      const bottomLeft = visible[cell(row + 1, column)]
      const bottomRight = visible[cell(row + 1, nextColumn)]
      const mask = topLeft | (topRight << 1) | (bottomRight << 2) | (bottomLeft << 3)
      if (mask === 0 || mask === 15) continue
      const top = cell(row, column)
      const bottom = cell(row + 1, column)
      const left = rowEdges + cell(row, column)
      const right = rowEdges + cell(row, nextColumn)
      // Segments run with the shown region on their left, so that loops chain end to end.
      const link = (from: number, to: number) => next.set(from, to)
      switch (mask) {
        case 1:
          link(top, left)
          break
        case 2:
          link(right, top)
          break
        case 3:
          link(right, left)
          break
        case 4:
          link(bottom, right)
          break
        case 5:
          link(top, left)
          link(bottom, right)
          break
        case 6:
          link(bottom, top)
          break
        case 7:
          link(bottom, left)
          break
        case 8:
          link(left, bottom)
          break
        case 9:
          link(top, bottom)
          break
        case 10:
          link(right, top)
          link(left, bottom)
          break
        case 11:
          link(right, bottom)
          break
        case 12:
          link(left, right)
          break
        case 13:
          link(top, right)
          break
        default:
          link(left, top)
      }
    }
  }

  const number = (value: number) => value.toFixed(2)
  let path = ''
  while (next.size > 0) {
    const start = next.keys().next().value as number
    const loop: { point: [number, number]; edge: MaskEdge }[] = []
    let edgeIndex: number | undefined = start
    while (edgeIndex !== undefined && next.has(edgeIndex)) {
      loop.push(crossing(edgeIndex))
      const following: number = next.get(edgeIndex)!
      next.delete(edgeIndex)
      edgeIndex = following
    }
    if (loop.length < 3) continue
    const at = (index: number) => loop[(index + loop.length) % loop.length]
    // Whether the line passes through a point of it without ending or turning sharply there.
    const smooth = (index: number) => {
      const previous = at(index - 1)
      const current = at(index)
      const following = at(index + 1)
      if (previous.edge !== 'cut' || current.edge !== 'cut' || following.edge !== 'cut') {
        return false
      }
      const inX = current.point[0] - previous.point[0]
      const inY = current.point[1] - previous.point[1]
      const outX = following.point[0] - current.point[0]
      const outY = following.point[1] - current.point[1]
      return (
        inX * outX + inY * outY > MASK_CORNER_COSINE * Math.hypot(inX, inY) * Math.hypot(outX, outY)
      )
    }
    path += `M${number(loop[0].point[0])} ${number(loop[0].point[1])}`
    for (let index = 0; index < loop.length; index += 1) {
      const from = at(index)
      const to = at(index + 1)
      if (from.edge !== 'cut' || to.edge !== 'cut') {
        path += `L${number(to.point[0])} ${number(to.point[1])}`
        continue
      }
      // Along the line where the solids meet, a curve through the exact points: each bend
      // follows its neighbours on that line. It stops short where the line ends, and where it
      // turns sharply, as it does over an edge of either solid: a corner stays a corner.
      const before = smooth(index) ? at(index - 1) : from
      const after = smooth(index + 1) ? at(index + 2) : to
      path +=
        `C${number(from.point[0] + (to.point[0] - before.point[0]) / 6)} ` +
        `${number(from.point[1] + (to.point[1] - before.point[1]) / 6)} ` +
        `${number(to.point[0] - (after.point[0] - from.point[0]) / 6)} ` +
        `${number(to.point[1] - (after.point[1] - from.point[1]) / 6)} ` +
        `${number(to.point[0])} ${number(to.point[1])}`
    }
    path += 'Z'
  }
  return path ? { kind: 'clip', path } : { kind: 'none' }
}

const maskedAccessoryLayers = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  nodes: BodyNode[],
  bodyColor: string | undefined
) => {
  // Two shapes of one colour merge into one flat area: which is in front cannot be seen. Only a
  // node of another colour than the body is measured against the head. Every other node keeps
  // the plain rule, wholly behind or wholly in front, which costs nothing.
  const layers = nodes
    .map(node => {
      const depth = rotateWithQuaternion(bodyNodeFrame(pose, node).orientation, node.position)[2]
      const path = accessoryPath(pose, node)
      const measured = node.color !== undefined && node.color !== bodyColor
      if (!measured) {
        const front =
          depth > accessoryCameraDepthRadius(pose, node) * ACCESSORY_FRONT_CROSSING_RATIO
        return { id: node.id, path, depth, back: !front, front, clip: '' }
      }
      const shown = nodeFrontClip(pose, surface, node)
      // A node that shows whole in front needs no clip, and no copy behind the head either.
      if (shown.kind === 'whole') {
        return { id: node.id, path, depth, back: false, front: true, clip: '' }
      }
      return {
        id: node.id,
        path,
        depth,
        back: true,
        front: shown.kind === 'clip',
        clip: shown.kind === 'clip' ? shown.path : '',
      }
    })
    .sort((left, right) => left.depth - right.depth)
  const back = layers.filter(layer => layer.back)
  const front = layers.filter(layer => layer.front)
  return {
    backPaths: back.map(layer => layer.path),
    frontPaths: front.map(layer => layer.path),
    backNodeIds: back.map(layer => layer.id),
    frontNodeIds: front.map(layer => layer.id),
    frontClipPaths: front.map(layer => layer.clip),
  }
}

export const renderAvatar = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  blink = 1,
  options: RenderAvatarOptions = {}
): AvatarGeometry => {
  const leftSamples = eyePoints(pose, surface, -1, blink, options.eyeOffset)
  const rightSamples = eyePoints(pose, surface, 1, blink, options.eyeOffset)
  const left = leftSamples.map(sample => sample.point)
  const right = rightSamples.map(sample => sample.point)
  const nose = nosePoints(pose, surface)
  const mouth = mouthPoints(pose, surface)
  const accessories =
    options.nodeOcclusion === 'mask'
      ? maskedAccessoryLayers(pose, surface, options.bodyNodes ?? [], options.bodyColor)
      : accessoryLayers(pose, options.bodyNodes ?? [])
  const compositePaths = compositeBackPaths(pose, surface)
  return {
    backPaths: [...compositePaths, ...accessories.backPaths],
    frontPaths: accessories.frontPaths,
    backNodeIds: [...compositePaths.map(() => null), ...accessories.backNodeIds],
    frontNodeIds: accessories.frontNodeIds,
    frontClipPaths: accessories.frontClipPaths,
    headPath: headPath(pose, surface),
    leftPath: path(left),
    rightPath: path(right),
    nosePath: path(nose.map(sample => sample.point)),
    mouthPath: path(
      mouth.map(sample => sample.point),
      true
    ),
    mouthStrokeWidth: 0,
    leftVisible: leftSamples.reduce((total, sample) => total + sample.normal[2], 0) > 0,
    rightVisible: rightSamples.reduce((total, sample) => total + sample.normal[2], 0) > 0,
    wirePaths: options.includeWire === false ? [] : wirePaths(pose, surface),
  }
}
