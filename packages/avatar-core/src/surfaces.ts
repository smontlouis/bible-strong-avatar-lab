import type { Point3 } from './geometry'

export type SurfaceType =
  | 'sphere'
  | 'mickey'
  | 'cursor'
  | 'cube'
  | 'ellipse'
  | 'square'
  | 'rounded'
  | 'capsule'
  | 'cylinder'
  | 'cone'
  | 'teardrop'
  | 'trapezoid'
  | 'frustum'
  | 'half-cone'
  | 'diamond'
  | 'ghost'
  | 'apple-bite'
  | 'lock'

export type SurfaceConfig = {
  type: SurfaceType
  width: number
  height: number
  depth: number
  roundness: number
  morphRoundness?: number
  tipRoundness?: number
  baseRoundness?: number
  topScale?: number
  cutAngle?: number
}

export type SurfaceSample = {
  point: Point3
  normal: Point3
}

export const surfacePresets: Record<SurfaceType, SurfaceConfig> = {
  sphere: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
  mickey: { type: 'mickey', width: 220, height: 210, depth: 145, roundness: 1 },
  cursor: { type: 'cursor', width: 175, height: 260, depth: 145, roundness: 0 },
  cube: { type: 'cube', width: 245, height: 245, depth: 220, roundness: 0 },
  ellipse: { type: 'ellipse', width: 245, height: 189, depth: 195, roundness: 1 },
  square: { type: 'square', width: 240, height: 240, depth: 196, roundness: 0.6 },
  rounded: { type: 'rounded', width: 240, height: 240, depth: 211, roundness: 1 },
  capsule: { type: 'capsule', width: 205, height: 270, depth: 205, roundness: 1 },
  cylinder: {
    type: 'cylinder',
    width: 235,
    height: 250,
    depth: 215,
    roundness: 0.45,
    morphRoundness: 0,
  },
  cone: {
    type: 'cone',
    width: 250,
    height: 265,
    depth: 225,
    roundness: 0,
    morphRoundness: 0,
    tipRoundness: 0.55,
    baseRoundness: 0.45,
  },
  teardrop: { type: 'teardrop', width: 230, height: 258, depth: 195, roundness: 0.78 },
  trapezoid: {
    type: 'trapezoid',
    width: 250,
    height: 232,
    depth: 204,
    roundness: 1.44,
    topScale: 0.82,
  },
  frustum: {
    type: 'frustum',
    width: 250,
    height: 250,
    depth: 223,
    roundness: 0.48,
  },
  'half-cone': {
    type: 'half-cone',
    width: 250,
    height: 250,
    depth: 223,
    roundness: 0.48,
    cutAngle: 0,
  },
  diamond: { type: 'diamond', width: 235, height: 260, depth: 215, roundness: 0 },
  ghost: { type: 'ghost', width: 250, height: 245, depth: 190, roundness: 1 },
  'apple-bite': { type: 'apple-bite', width: 240, height: 250, depth: 190, roundness: 1 },
  lock: { type: 'lock', width: 250, height: 250, depth: 190, roundness: 1 },
}

export const surfaceLabels: Record<SurfaceType, string> = {
  sphere: 'Sphère',
  mickey: 'Mickey',
  cursor: 'Curseur',
  cube: 'Cube',
  ellipse: 'Ellipse',
  square: 'Carré',
  rounded: 'Arrondi',
  capsule: 'Capsule',
  cylinder: 'Cylindre',
  cone: 'Cône',
  teardrop: 'Goutte',
  trapezoid: 'Trapèze',
  frustum: 'Tronc de cône',
  'half-cone': 'Demi-cône',
  diamond: 'Diamant',
  ghost: 'Ghost',
  'apple-bite': 'Apple Bite',
  lock: 'Lock',
}

const signedPower = (value: number, exponent: number) =>
  Math.sign(value) * Math.abs(value) ** exponent

const interpolate = (from: number, to: number, progress: number) => from + (to - from) * progress

const ONEWORKS_SHAPE_EXPONENTS = {
  rounded: 0.5,
  square: 0.3,
  teardrop: 0.78,
} as const

const oneworksSuperellipsoid = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number,
  exponent: number
): Point3 => {
  const latitudeFactor = Math.max(Math.cos(latitude), 0) ** exponent
  return [
    (config.width / 2) * latitudeFactor * signedPower(Math.sin(longitude), exponent),
    (config.height / 2) * signedPower(Math.sin(latitude), exponent),
    (config.depth / 2) * latitudeFactor * signedPower(Math.cos(longitude), exponent),
  ]
}

const oneworksTeardrop = (config: SurfaceConfig, longitude: number, latitude: number): Point3 => {
  const exponent = ONEWORKS_SHAPE_EXPONENTS.teardrop
  const vertical = signedPower(Math.sin(latitude), exponent)
  const progress = Math.max(0, Math.min(1, (vertical + 1) / 2))
  const latitudeFactor = Math.max(Math.cos(latitude), 0) ** exponent
  const widthTaper = interpolate(0.46, 1.24, progress)
  const depthTaper = interpolate(0.7, 1.12, progress)
  return [
    (config.width / 2) * widthTaper * latitudeFactor * signedPower(Math.sin(longitude), exponent),
    (config.height / 2) * vertical,
    (config.depth / 2) * depthTaper * latitudeFactor * signedPower(Math.cos(longitude), exponent),
  ]
}

const trapezoidExponent = (config: SurfaceConfig) =>
  interpolate(0.34, 0.76, clampRoundness(config.roundness) / 2)

const oneworksTrapezoid = (config: SurfaceConfig, longitude: number, latitude: number): Point3 => {
  const exponent = trapezoidExponent(config)
  const vertical = signedPower(Math.sin(latitude), exponent)
  const progress = Math.max(0, Math.min(1, (vertical + 1) / 2))
  const latitudeFactor = Math.max(Math.cos(latitude), 0) ** exponent
  const horizontalTaper = interpolate(config.topScale ?? 0.82, 1.08, progress)
  const depthTaper = interpolate(0.92, 1.04, progress)
  return [
    (config.width / 2) *
      horizontalTaper *
      latitudeFactor *
      signedPower(Math.sin(longitude), exponent),
    (config.height / 2) * vertical,
    (config.depth / 2) * depthTaper * latitudeFactor * signedPower(Math.cos(longitude), exponent),
  ]
}

const superellipsoid = (
  longitude: number,
  latitude: number,
  width: number,
  height: number,
  depth: number,
  verticalExponent: number,
  horizontalExponent: number
): Point3 => {
  const latitudeCosine = signedPower(Math.cos(latitude), verticalExponent)
  return [
    (width / 2) * latitudeCosine * signedPower(Math.sin(longitude), horizontalExponent),
    (height / 2) * signedPower(Math.sin(latitude), verticalExponent),
    (depth / 2) * latitudeCosine * signedPower(Math.cos(longitude), horizontalExponent),
  ]
}

const capsule = (config: SurfaceConfig, longitude: number, latitude: number): Point3 => {
  const radiusX = config.width / 2
  const radiusZ = config.depth / 2
  const capRadius = Math.min(radiusX, config.height / 2)
  const straightHalf = Math.max(0, (config.height - capRadius * 2) / 2)
  const meridianLength = straightHalf * 2 + Math.PI * capRadius
  const distance = ((latitude + Math.PI / 2) / Math.PI) * meridianLength
  let radial = radiusX
  let y = 0

  if (distance < (Math.PI * capRadius) / 2) {
    const angle = -Math.PI / 2 + distance / capRadius
    radial = radiusX * Math.cos(angle)
    y = -straightHalf + capRadius * Math.sin(angle)
  } else if (distance <= (Math.PI * capRadius) / 2 + straightHalf * 2) {
    y = -straightHalf + distance - (Math.PI * capRadius) / 2
  } else {
    const angle = (distance - (Math.PI * capRadius) / 2 - straightHalf * 2) / capRadius
    radial = radiusX * Math.cos(angle)
    y = straightHalf + capRadius * Math.sin(angle)
  }

  const depthScale = radiusX ? radiusZ / radiusX : 1
  return [radial * Math.sin(longitude), y, radial * depthScale * Math.cos(longitude)]
}

const clampRoundness = (roundness: number | undefined) => Math.max(0, Math.min(2, roundness ?? 0))

const diamondExponent = (config: SurfaceConfig) => 1 + clampRoundness(config.roundness) / 2

const MIN_CUBE_SURFACE_POWER = 0.04

const cubeExponent = (config: SurfaceConfig) => {
  if (config.roundness <= 0) return Infinity
  // The implicit superellipsoid power moves from an almost-flat cube to an ellipsoid.
  const surfacePower =
    MIN_CUBE_SURFACE_POWER + (clampRoundness(config.roundness) / 2) * (1 - MIN_CUBE_SURFACE_POWER)
  return 2 / surfacePower
}

const lpSurface = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number,
  exponent: number
): Point3 => {
  const sphereX = Math.cos(latitude) * Math.sin(longitude)
  const sphereY = Math.sin(latitude)
  const sphereZ = Math.cos(latitude) * Math.cos(longitude)
  const length = Number.isFinite(exponent)
    ? (Math.abs(sphereX) ** exponent +
        Math.abs(sphereY) ** exponent +
        Math.abs(sphereZ) ** exponent) **
        (1 / exponent) || 1
    : Math.max(Math.abs(sphereX), Math.abs(sphereY), Math.abs(sphereZ)) || 1
  return [
    (config.width / 2) * (sphereX / length),
    (config.height / 2) * (sphereY / length),
    (config.depth / 2) * (sphereZ / length),
  ]
}

const diamond = (config: SurfaceConfig, longitude: number, latitude: number): Point3 => {
  return lpSurface(config, longitude, latitude, diamondExponent(config))
}

const cube = (config: SurfaceConfig, longitude: number, latitude: number): Point3 =>
  lpSurface(config, longitude, latitude, cubeExponent(config))

const MAX_CONE_TIP_FRACTION = 0.24
const MAX_CONE_BASE_FRACTION = 0.2
const MAX_CYLINDER_EDGE_FRACTION = 0.22

type RadialProfile = {
  radiusScale: number
  verticalProgress: number
}

const morphProgress = (config: SurfaceConfig) => clampRoundness(config.morphRoundness) / 2

const morphProfileToEllipsoid = (
  config: SurfaceConfig,
  progress: number,
  profile: RadialProfile
): RadialProfile => {
  const amount = morphProgress(config)
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const ellipsoidRadius = Math.sin(clampedProgress * Math.PI)
  const ellipsoidVerticalProgress = (1 - Math.cos(clampedProgress * Math.PI)) / 2
  return {
    radiusScale: profile.radiusScale + (ellipsoidRadius - profile.radiusScale) * amount,
    verticalProgress:
      profile.verticalProgress + (ellipsoidVerticalProgress - profile.verticalProgress) * amount,
  }
}

const cubic = (
  start: number,
  firstControl: number,
  secondControl: number,
  end: number,
  progress: number
) => {
  const inverse = 1 - progress
  return (
    inverse ** 3 * start +
    3 * inverse * inverse * progress * firstControl +
    3 * inverse * progress * progress * secondControl +
    progress ** 3 * end
  )
}

const coneRounding = (config: SurfaceConfig) => ({
  tipFraction: (config.tipRoundness ?? 0) * MAX_CONE_TIP_FRACTION,
  baseFraction: (config.baseRoundness ?? 0) * MAX_CONE_BASE_FRACTION,
})

/** Cylinder half-profile with a quarter-round transition at both caps. */
const cylinderProfileAt = (config: SurfaceConfig, progress: number): RadialProfile => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const edgeFraction = config.roundness * MAX_CYLINDER_EDGE_FRACTION
  if (edgeFraction <= 0) {
    return {
      radiusScale: 1,
      verticalProgress: (Math.sin((clampedProgress - 0.5) * Math.PI) + 1) / 2,
    }
  }

  if (clampedProgress < edgeFraction) {
    const angle = -Math.PI / 2 + (clampedProgress / edgeFraction) * (Math.PI / 2)
    return {
      radiusScale: 1 - edgeFraction + edgeFraction * Math.cos(angle),
      verticalProgress: (edgeFraction + edgeFraction * Math.sin(angle)) / 2,
    }
  }

  if (clampedProgress > 1 - edgeFraction) {
    const angle = ((clampedProgress - (1 - edgeFraction)) / edgeFraction) * (Math.PI / 2)
    return {
      radiusScale: 1 - edgeFraction + edgeFraction * Math.cos(angle),
      verticalProgress: 1 - edgeFraction / 2 + (edgeFraction * Math.sin(angle)) / 2,
    }
  }

  const middleProgress = (clampedProgress - edgeFraction) / (1 - edgeFraction * 2)
  return {
    radiusScale: 1,
    verticalProgress: edgeFraction / 2 + middleProgress * (1 - edgeFraction),
  }
}

const morphedCylinderProfileAt = (config: SurfaceConfig, progress: number) =>
  morphProfileToEllipsoid(config, progress, cylinderProfileAt(config, progress))

const radiusScaleAtVerticalProgress = (
  config: SurfaceConfig,
  verticalProgress: number,
  profileAt: (config: SurfaceConfig, progress: number) => RadialProfile
) => {
  const progress = Math.max(0, Math.min(1, verticalProgress))
  let lower = 0
  let upper = 1
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const candidate = (lower + upper) / 2
    if (profileAt(config, candidate).verticalProgress < progress) lower = candidate
    else upper = candidate
  }
  return profileAt(config, (lower + upper) / 2).radiusScale
}

/** Rounded half-profile revolved around the cone's vertical axis. */
const coneProfileAt = (config: SurfaceConfig, progress: number): RadialProfile => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const { tipFraction, baseFraction } = coneRounding(config)

  if (baseFraction > 0 && clampedProgress < baseFraction) {
    const curveProgress = clampedProgress / baseFraction
    return {
      radiusScale: cubic(
        1 - baseFraction,
        1,
        1 - baseFraction / 2,
        1 - baseFraction,
        curveProgress
      ),
      verticalProgress: cubic(0, 0, baseFraction / 2, baseFraction, curveProgress),
    }
  }

  if (tipFraction > 0 && clampedProgress > 1 - tipFraction) {
    const curveProgress = (clampedProgress - (1 - tipFraction)) / tipFraction
    return {
      radiusScale: cubic(tipFraction, tipFraction / 2, tipFraction / 4, 0, curveProgress),
      verticalProgress: cubic(1 - tipFraction, 1 - tipFraction / 2, 1, 1, curveProgress),
    }
  }

  return {
    radiusScale: 1 - clampedProgress,
    verticalProgress: clampedProgress,
  }
}

const morphedConeProfileAt = (config: SurfaceConfig, progress: number) =>
  morphProfileToEllipsoid(config, progress, coneProfileAt(config, progress))

const oneworksFrustumProfileAt = (config: SurfaceConfig, progress: number): RadialProfile => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const easedProgress = clampedProgress * clampedProgress * (3 - 2 * clampedProgress)
  const roundedProgress = interpolate(
    clampedProgress,
    easedProgress,
    (clampRoundness(config.roundness) / 2) * 0.55
  )
  return {
    radiusScale: interpolate(0.46, 1, roundedProgress),
    verticalProgress: clampedProgress,
  }
}

const oneworksHalfConeProfileAt = (config: SurfaceConfig, progress: number): RadialProfile => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  return {
    radiusScale: clampedProgress ** interpolate(1, 0.56, clampRoundness(config.roundness) / 2),
    verticalProgress: clampedProgress,
  }
}

export const cursorLayout = (config: SurfaceConfig) => {
  const coneHeight = config.height * 0.36
  const bodyHeight = config.height - coneHeight
  return {
    coneApexY: -config.height / 2,
    coneBaseY: -config.height / 2 + coneHeight,
    bodyHeight,
    bodyCenterY: config.height / 2 - bodyHeight / 2,
    bodyWidth: config.width * 0.54,
    bodyDepth: config.depth * 0.62,
  }
}

export const surfacePointAt = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number
): Point3 => {
  const { width, height, depth } = config
  switch (config.type) {
    case 'sphere':
    case 'mickey':
      return superellipsoid(longitude, latitude, width, height, depth, 1, 1)
    case 'ellipse':
      return oneworksSuperellipsoid(config, longitude, latitude, 1)
    case 'square':
      return oneworksSuperellipsoid(config, longitude, latitude, ONEWORKS_SHAPE_EXPONENTS.square)
    case 'rounded':
      return oneworksSuperellipsoid(config, longitude, latitude, ONEWORKS_SHAPE_EXPONENTS.rounded)
    case 'cube':
      return cube(config, longitude, latitude)
    case 'cylinder': {
      const progress = (latitude + Math.PI / 2) / Math.PI
      const profile = morphedCylinderProfileAt(config, progress)
      return [
        (width / 2) * profile.radiusScale * Math.sin(longitude),
        -height / 2 + height * profile.verticalProgress,
        (depth / 2) * profile.radiusScale * Math.cos(longitude),
      ]
    }
    case 'cursor': {
      const layout = cursorLayout(config)
      const progress = (latitude + Math.PI / 2) / Math.PI
      const bodyConfig = {
        ...config,
        width: layout.bodyWidth,
        height: layout.bodyHeight,
        depth: layout.bodyDepth,
      }
      const profile = cylinderProfileAt(bodyConfig, progress)
      return [
        (layout.bodyWidth / 2) * profile.radiusScale * Math.sin(longitude),
        layout.bodyCenterY - layout.bodyHeight / 2 + layout.bodyHeight * profile.verticalProgress,
        (layout.bodyDepth / 2) * profile.radiusScale * Math.cos(longitude),
      ]
    }
    case 'diamond':
      return diamond(config, longitude, latitude)
    case 'teardrop':
      return oneworksTeardrop(config, longitude, latitude)
    case 'trapezoid':
      return oneworksTrapezoid(config, longitude, latitude)
    case 'capsule':
    case 'ghost':
    case 'apple-bite':
    case 'lock':
      return capsule(config, longitude, latitude)
    case 'cone': {
      const progress = (latitude + Math.PI / 2) / Math.PI
      const profile = morphedConeProfileAt(config, progress)
      return [
        (width / 2) * profile.radiusScale * Math.sin(longitude),
        height / 2 - height * profile.verticalProgress,
        (depth / 2) * profile.radiusScale * Math.cos(longitude),
      ]
    }
    case 'frustum': {
      const progress = (latitude + Math.PI / 2) / Math.PI
      const profile = oneworksFrustumProfileAt(config, progress)
      return [
        (width / 2) * profile.radiusScale * Math.sin(longitude),
        -height / 2 + height * profile.verticalProgress,
        (depth / 2) * profile.radiusScale * Math.cos(longitude),
      ]
    }
    case 'half-cone': {
      const progress = (latitude + Math.PI / 2) / Math.PI
      const profile = oneworksHalfConeProfileAt(config, progress)
      const sampledLongitude = ((config.cutAngle ?? 0) * Math.PI) / 180 + longitude / 2
      return [
        (width / 2) * profile.radiusScale * Math.sin(sampledLongitude),
        -height / 2 + height * profile.verticalProgress,
        (depth / 2) * profile.radiusScale * Math.cos(sampledLongitude),
      ]
    }
  }
}

const subtract = (left: Point3, right: Point3): Point3 => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
]

const normalize = ([x, y, z]: Point3): Point3 => {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

const normalFromTangents = (
  config: SurfaceConfig,
  longitudeTangent: Point3,
  latitudeTangent: Point3
) => {
  const orientation = config.type === 'cone' ? -1 : 1
  return normalize([
    orientation *
      (longitudeTangent[1] * latitudeTangent[2] - longitudeTangent[2] * latitudeTangent[1]),
    orientation *
      (longitudeTangent[2] * latitudeTangent[0] - longitudeTangent[0] * latitudeTangent[2]),
    orientation *
      (longitudeTangent[0] * latitudeTangent[1] - longitudeTangent[1] * latitudeTangent[0]),
  ])
}

const tangentNormalAt = (config: SurfaceConfig, longitude: number, latitude: number) => {
  const epsilon = 0.0005
  if (config.type === 'cone' && latitude >= Math.PI / 2 - epsilon) return [0, -1, 0] as Point3
  const longitudeBefore = surfacePointAt(config, longitude - epsilon, latitude)
  const longitudeAfter = surfacePointAt(config, longitude + epsilon, latitude)
  const latitudeBefore = surfacePointAt(
    config,
    longitude,
    Math.max(-Math.PI / 2, latitude - epsilon)
  )
  const latitudeAfter = surfacePointAt(config, longitude, Math.min(Math.PI / 2, latitude + epsilon))
  return normalFromTangents(
    config,
    subtract(longitudeAfter, longitudeBefore),
    subtract(latitudeAfter, latitudeBefore)
  )
}

const signedMagnitude = (value: number, exponent: number) =>
  Math.sign(value) * Math.abs(value) ** exponent

const lpNormal = (config: SurfaceConfig, point: Point3, exponent: number): Point3 => {
  const radiusX = config.width / 2 || 1
  const radiusY = config.height / 2 || 1
  const radiusZ = config.depth / 2 || 1
  return normalize([
    signedMagnitude(point[0] / radiusX, exponent - 1) / radiusX,
    signedMagnitude(point[1] / radiusY, exponent - 1) / radiusY,
    signedMagnitude(point[2] / radiusZ, exponent - 1) / radiusZ,
  ])
}

const diamondNormal = (config: SurfaceConfig, point: Point3): Point3 =>
  lpNormal(config, point, diamondExponent(config))

const cubeNormal = (config: SurfaceConfig, point: Point3): Point3 => {
  const exponent = cubeExponent(config)
  if (Number.isFinite(exponent)) return lpNormal(config, point, exponent)

  const normalized = [
    point[0] / (config.width / 2 || 1),
    point[1] / (config.height / 2 || 1),
    point[2] / (config.depth / 2 || 1),
  ] as Point3
  const dominantAxis = normalized.reduce(
    (largest, value, index) => (Math.abs(value) > Math.abs(normalized[largest]) ? index : largest),
    0
  )
  const normal: Point3 = [
    dominantAxis === 0 ? Math.sign(normalized[0]) : 0,
    dominantAxis === 1 ? Math.sign(normalized[1]) : 0,
    dominantAxis === 2 ? Math.sign(normalized[2]) : 0,
  ]
  return normal
}

const oneworksSuperellipsoidNormal = (
  config: SurfaceConfig,
  point: Point3,
  parameterExponent: number
) => lpNormal(config, point, 2 / parameterExponent)

const lpFrontSample = (
  config: SurfaceConfig,
  x: number,
  y: number,
  exponent: number,
  normalAt: (config: SurfaceConfig, point: Point3) => Point3
): SurfaceSample => {
  const radiusX = config.width / 2 || 1
  const radiusY = config.height / 2 || 1
  const radiusZ = config.depth / 2 || 1
  if (!Number.isFinite(exponent)) {
    const point: Point3 = [
      Math.max(-radiusX, Math.min(radiusX, x)),
      Math.max(-radiusY, Math.min(radiusY, y)),
      radiusZ,
    ]
    return { point, normal: normalAt(config, point) }
  }

  const normalizedY = Math.max(-1, Math.min(1, y / radiusY))
  const availableX = Math.max(0, 1 - Math.abs(normalizedY) ** exponent) ** (1 / exponent)
  const surfaceX = Math.max(-radiusX * availableX, Math.min(radiusX * availableX, x))
  const normalizedX = surfaceX / radiusX
  const normalizedZ =
    Math.max(0, 1 - Math.abs(normalizedX) ** exponent - Math.abs(normalizedY) ** exponent) **
    (1 / exponent)
  const point: Point3 = [surfaceX, normalizedY * radiusY, radiusZ * normalizedZ]
  return { point, normal: normalAt(config, point) }
}

const ellipsoidFrontSample = (
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  centerY = 0
): SurfaceSample => {
  const localY = y - centerY
  const remaining = Math.max(0, 1 - (x / (radiusX || 1)) ** 2 - (localY / (radiusY || 1)) ** 2)
  const z = radiusZ * Math.sqrt(remaining)
  return {
    point: [x, y, z],
    normal: normalize([
      x / (radiusX * radiusX || 1),
      localY / (radiusY * radiusY || 1),
      z / (radiusZ * radiusZ || 1),
    ]),
  }
}

const oneworksProfileFrontSample = (
  config: SurfaceConfig,
  x: number,
  y: number,
  profile: 'teardrop' | 'trapezoid'
): SurfaceSample => {
  const radiusX = config.width / 2 || 1
  const radiusY = config.height / 2 || 1
  const radiusZ = config.depth / 2 || 1
  const exponent =
    profile === 'teardrop' ? ONEWORKS_SHAPE_EXPONENTS.teardrop : trapezoidExponent(config)
  const vertical = Math.max(-1, Math.min(1, y / radiusY))
  const sineLatitude = signedPower(vertical, 1 / exponent)
  const latitude = Math.asin(Math.max(-1, Math.min(1, sineLatitude)))
  const progress = Math.max(0, Math.min(1, (vertical + 1) / 2))
  const latitudeFactor = Math.max(Math.cos(latitude), 0) ** exponent
  const widthTaper =
    profile === 'teardrop'
      ? interpolate(0.46, 1.24, progress)
      : interpolate(config.topScale ?? 0.82, 1.08, progress)
  const depthTaper =
    profile === 'teardrop' ? interpolate(0.7, 1.12, progress) : interpolate(0.92, 1.04, progress)
  const sectionRadiusX = radiusX * widthTaper * latitudeFactor
  const sectionRadiusZ = radiusZ * depthTaper * latitudeFactor
  const surfaceX = Math.max(-sectionRadiusX, Math.min(sectionRadiusX, x))
  const normalizedX = sectionRadiusX > 0 ? surfaceX / sectionRadiusX : 0
  const sineLongitude = signedPower(Math.max(-1, Math.min(1, normalizedX)), 1 / exponent)
  const longitude = Math.asin(Math.max(-1, Math.min(1, sineLongitude)))
  const z = sectionRadiusZ * signedPower(Math.max(Math.cos(longitude), 0), exponent)
  const point: Point3 = [surfaceX, vertical * radiusY, z]
  return { point, normal: tangentNormalAt(config, longitude, latitude) }
}

const radialProfileFrontSample = (
  config: SurfaceConfig,
  x: number,
  y: number,
  profileAt: (config: SurfaceConfig, progress: number) => RadialProfile,
  verticalDirection: -1 | 1
): SurfaceSample => {
  const radiusX = config.width / 2 || 1
  const radiusZ = config.depth / 2 || 1
  const verticalProgress = Math.max(0, Math.min(1, 0.5 + verticalDirection * (y / config.height)))
  const radialScale = radiusScaleAtVerticalProgress(config, verticalProgress, profileAt)
  const sectionRadiusX = radiusX * radialScale
  const sectionRadiusZ = radiusZ * radialScale
  const surfaceX = Math.max(-sectionRadiusX, Math.min(sectionRadiusX, x))
  const remaining = sectionRadiusX > 0 ? Math.max(0, 1 - (surfaceX / sectionRadiusX) ** 2) : 0
  const z = sectionRadiusZ * Math.sqrt(remaining)
  const derivativeStep = 0.0001
  const previousProgress = Math.max(0, verticalProgress - derivativeStep)
  const nextProgress = Math.min(1, verticalProgress + derivativeStep)
  const previousScale = radiusScaleAtVerticalProgress(config, previousProgress, profileAt)
  const nextScale = radiusScaleAtVerticalProgress(config, nextProgress, profileAt)
  const scaleDerivative = (nextScale - previousScale) / (nextProgress - previousProgress || 1)
  const radialRemainder = Math.max(Math.sqrt(remaining), 0.0001)
  const depthRatio = radiusZ / radiusX
  const depthXDerivative = (-depthRatio * surfaceX) / (sectionRadiusX * radialRemainder || 1)
  const depthYDerivative =
    (verticalDirection * radiusZ * scaleDerivative) / (config.height * radialRemainder || 1)
  return {
    point: [surfaceX, y, z],
    normal: normalize([-depthXDerivative, -depthYDerivative, 1]),
  }
}

/** Project canonical face coordinates onto a primitive's front-facing sheet. */
export const surfaceFrontSampleAt = (
  config: SurfaceConfig,
  x: number,
  y: number
): SurfaceSample => {
  const radiusX = config.width / 2 || 1
  const radiusY = config.height / 2 || 1
  const radiusZ = config.depth / 2 || 1

  switch (config.type) {
    case 'sphere':
    case 'mickey':
    case 'ellipse':
      return ellipsoidFrontSample(x, y, radiusX, radiusY, radiusZ)

    case 'square':
      return lpFrontSample(config, x, y, 2 / ONEWORKS_SHAPE_EXPONENTS.square, (surface, point) =>
        oneworksSuperellipsoidNormal(surface, point, ONEWORKS_SHAPE_EXPONENTS.square)
      )

    case 'rounded':
      return lpFrontSample(config, x, y, 2 / ONEWORKS_SHAPE_EXPONENTS.rounded, (surface, point) =>
        oneworksSuperellipsoidNormal(surface, point, ONEWORKS_SHAPE_EXPONENTS.rounded)
      )

    case 'cube':
      return lpFrontSample(config, x, y, cubeExponent(config), cubeNormal)

    case 'capsule':
    case 'ghost':
    case 'apple-bite':
    case 'lock': {
      const capRadiusY = Math.min(radiusX, radiusY)
      const straightHalf = Math.max(0, radiusY - capRadiusY)
      const capCenterY = y < -straightHalf ? -straightHalf : y > straightHalf ? straightHalf : y
      return ellipsoidFrontSample(x, y, radiusX, capRadiusY, radiusZ, capCenterY)
    }

    case 'cylinder':
      return radialProfileFrontSample(config, x, y, morphedCylinderProfileAt, 1)

    case 'cursor': {
      const layout = cursorLayout(config)
      const bodyConfig = {
        ...config,
        width: layout.bodyWidth,
        height: layout.bodyHeight,
        depth: layout.bodyDepth,
      }
      const sample = radialProfileFrontSample(
        bodyConfig,
        x,
        y - layout.bodyCenterY,
        cylinderProfileAt,
        1
      )
      return {
        point: [sample.point[0], sample.point[1] + layout.bodyCenterY, sample.point[2]],
        normal: sample.normal,
      }
    }

    case 'cone':
      return radialProfileFrontSample(config, x, y, morphedConeProfileAt, -1)

    case 'frustum':
      return radialProfileFrontSample(config, x, y, oneworksFrustumProfileAt, 1)

    case 'half-cone':
      return radialProfileFrontSample(config, x, y, oneworksHalfConeProfileAt, 1)

    case 'teardrop':
      return oneworksProfileFrontSample(config, x, y, 'teardrop')

    case 'trapezoid':
      return oneworksProfileFrontSample(config, x, y, 'trapezoid')

    case 'diamond':
      return lpFrontSample(config, x, y, diamondExponent(config), diamondNormal)
  }
}

export const surfaceNormalAt = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number
): Point3 => {
  const point = surfacePointAt(config, longitude, latitude)

  // An ellipsoid has a cheap exact normal. This is also the overwhelmingly
  // common path for the default spherical head.
  if (config.type === 'sphere' || config.type === 'mickey' || config.type === 'ellipse') {
    const halfWidth = config.width / 2 || 1
    const halfHeight = config.height / 2 || 1
    const halfDepth = config.depth / 2 || 1
    return normalize([
      point[0] / (halfWidth * halfWidth),
      point[1] / (halfHeight * halfHeight),
      point[2] / (halfDepth * halfDepth),
    ])
  }

  if (config.type === 'cylinder' && config.roundness <= 0 && (config.morphRoundness ?? 0) <= 0) {
    return normalize([
      Math.sin(longitude) / (config.width / 2 || 1),
      0,
      Math.cos(longitude) / (config.depth / 2 || 1),
    ])
  }

  if (config.type === 'diamond') {
    return diamondNormal(config, point)
  }

  if (config.type === 'cube') {
    return cubeNormal(config, point)
  }

  if (config.type === 'square') {
    return oneworksSuperellipsoidNormal(config, point, ONEWORKS_SHAPE_EXPONENTS.square)
  }

  if (config.type === 'rounded') {
    return oneworksSuperellipsoidNormal(config, point, ONEWORKS_SHAPE_EXPONENTS.rounded)
  }

  return tangentNormalAt(config, longitude, latitude)
}

export const surfaceSampleAt = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number
): SurfaceSample => {
  const point = surfacePointAt(config, longitude, latitude)

  if (config.type === 'sphere' || config.type === 'mickey' || config.type === 'ellipse') {
    const halfWidth = config.width / 2 || 1
    const halfHeight = config.height / 2 || 1
    const halfDepth = config.depth / 2 || 1
    return {
      point,
      normal: normalize([
        point[0] / (halfWidth * halfWidth),
        point[1] / (halfHeight * halfHeight),
        point[2] / (halfDepth * halfDepth),
      ]),
    }
  }

  if (config.type === 'cylinder' && config.roundness <= 0 && (config.morphRoundness ?? 0) <= 0) {
    return {
      point,
      normal: normalize([
        Math.sin(longitude) / (config.width / 2 || 1),
        0,
        Math.cos(longitude) / (config.depth / 2 || 1),
      ]),
    }
  }

  if (config.type === 'diamond') {
    return {
      point,
      normal: diamondNormal(config, point),
    }
  }

  if (config.type === 'cube') {
    return {
      point,
      normal: cubeNormal(config, point),
    }
  }

  if (config.type === 'square') {
    return {
      point,
      normal: oneworksSuperellipsoidNormal(config, point, ONEWORKS_SHAPE_EXPONENTS.square),
    }
  }

  if (config.type === 'rounded') {
    return {
      point,
      normal: oneworksSuperellipsoidNormal(config, point, ONEWORKS_SHAPE_EXPONENTS.rounded),
    }
  }

  return {
    point,
    normal: tangentNormalAt(config, longitude, latitude),
  }
}
