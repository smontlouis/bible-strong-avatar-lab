import { parseAvatarBody, type AvatarBody } from './body'
import { defaultExpression, initialExpressions } from './presets'
import { surfacePresets } from './surfaces'
import type { Expression } from './geometry'
import { isBodyMotion, isEyeMotion } from './ambientMotion'
import {
  createInitialSequences,
  normalizeSequencesForExpressions,
  parseSequences,
  type AvatarSequence,
} from '../animation/sequences'

export type AvatarBehaviorLibrary = {
  expressions: Expression[]
  sequences: AvatarSequence[]
}

export type StudioAvatar = {
  id: string
  name: string
  body: AvatarBody
  colors: AvatarColors
  eyes: AvatarEyeDefaults
  renderStyle: AvatarRenderStyle
  behavior?: AvatarBehaviorLibrary
}

export type AvatarColors = { body: string; eyes: string }
export const PIXEL_RENDERING_ENABLED = false
export type PixelRenderStyle = {
  type: 'pixel'
  resolution: number
}
export type VectorRenderStyle = { type: 'vector'; filled?: boolean }
export type AvatarRenderStyle = VectorRenderStyle | PixelRenderStyle
export type AvatarEyeDefaults = Pick<
  Expression,
  | 'widthLeft'
  | 'widthRight'
  | 'heightLeft'
  | 'heightRight'
  | 'spacing'
  | 'positionXLeft'
  | 'positionXRight'
  | 'positionYLeft'
  | 'positionYRight'
  | 'leftAngle'
  | 'rightAngle'
>
export const deslopAccentColors = {
  red: '#ff5558',
  orange: '#ff9d45',
  yellow: '#ffda1a',
  green: '#59e075',
  mint: '#1adec9',
  teal: '#1ad7e3',
  cyan: '#50d7fe',
  blue: '#1a9cff',
  indigo: '#7c89ff',
  purple: '#df48f3',
  pink: '#ff4b6f',
  brown: '#be9675',
} as const

export const defaultAvatarColors: AvatarColors = {
  body: deslopAccentColors.indigo,
  eyes: deslopAccentColors.indigo,
}
export const defaultAvatarRenderStyle: AvatarRenderStyle = { type: 'vector' }
export const filledAvatarRenderStyle: VectorRenderStyle = { type: 'vector', filled: true }
const filledAvatarEyeColor = '#111316'
export const defaultPixelRenderStyle: PixelRenderStyle = {
  type: 'pixel',
  resolution: 64,
}
export const defaultAvatarEyes: AvatarEyeDefaults = {
  widthLeft: defaultExpression.widthLeft,
  widthRight: defaultExpression.widthRight,
  heightLeft: defaultExpression.heightLeft,
  heightRight: defaultExpression.heightRight,
  spacing: defaultExpression.spacing,
  positionXLeft: defaultExpression.positionXLeft,
  positionXRight: defaultExpression.positionXRight,
  positionYLeft: defaultExpression.positionYLeft,
  positionYRight: defaultExpression.positionYRight,
  leftAngle: defaultExpression.leftAngle,
  rightAngle: defaultExpression.rightAngle,
}
const hexColor = /^#[0-9a-f]{6}$/i
const parseColors = (value: unknown): AvatarColors => {
  const candidate = value as Partial<AvatarColors> | null
  return {
    body:
      typeof candidate?.body === 'string' && hexColor.test(candidate.body)
        ? candidate.body
        : defaultAvatarColors.body,
    eyes:
      typeof candidate?.eyes === 'string' && hexColor.test(candidate.eyes)
        ? candidate.eyes
        : defaultAvatarColors.eyes,
  }
}

const bundledAvatarColorMigrations: Record<string, { from: AvatarColors; to: AvatarColors }> = {
  'primitive-cube': {
    from: { body: deslopAccentColors.orange, eyes: deslopAccentColors.orange },
    to: { body: deslopAccentColors.brown, eyes: deslopAccentColors.brown },
  },
  'primitive-ghost': {
    from: { body: deslopAccentColors.blue, eyes: deslopAccentColors.blue },
    to: { body: deslopAccentColors.orange, eyes: deslopAccentColors.orange },
  },
  strobi: {
    from: { body: '#5b7fe5', eyes: '#111316' },
    to: { body: deslopAccentColors.indigo, eyes: deslopAccentColors.cyan },
  },
  'avatar-4fe2d1bd-cf46-4e5e-a62d-d6b60be519ed': {
    from: { body: '#e6855c', eyes: '#ffffff' },
    to: { body: deslopAccentColors.orange, eyes: deslopAccentColors.yellow },
  },
  'avatar-295e74a7-5d70-4d61-83d4-7beebb22bdd8': {
    from: { body: '#ffcf24', eyes: '#000000' },
    to: { body: deslopAccentColors.yellow, eyes: deslopAccentColors.orange },
  },
  'avatar-1786600724626': {
    from: { body: '#55b6c3', eyes: '#111316' },
    to: { body: deslopAccentColors.teal, eyes: deslopAccentColors.mint },
  },
  'avatar-7874f78a-93ec-4536-a3b6-bb53ed744efd': {
    from: { body: '#000000', eyes: '#ffffff' },
    to: { body: deslopAccentColors.purple, eyes: deslopAccentColors.pink },
  },
  'avatar-1b2ee9c6-a6c5-4054-87e7-fec24f285269': {
    from: { body: '#e69a5c', eyes: '#111316' },
    to: { body: deslopAccentColors.brown, eyes: deslopAccentColors.orange },
  },
  'avatar-b6362e59-81a3-4334-a399-a721b23cf553': {
    from: { body: '#ffc2e9', eyes: '#3e4e65' },
    to: { body: deslopAccentColors.pink, eyes: deslopAccentColors.purple },
  },
  'avatar-fafdaf4d-2071-41d6-9d42-7d34670956f0': {
    from: { body: '#c9cbcf', eyes: '#111316' },
    to: { body: deslopAccentColors.cyan, eyes: deslopAccentColors.blue },
  },
  'avatar-2739f2c2-a5b4-45d9-8915-c9d6101d4d3b': {
    from: { body: '#e65c5c', eyes: '#111316' },
    to: { body: deslopAccentColors.red, eyes: deslopAccentColors.orange },
  },
  'avatar-4b9ea0c1-286f-4aa1-b053-61fcc416ba7e': {
    from: { body: '#dbe2f5', eyes: '#111316' },
    to: { body: deslopAccentColors.blue, eyes: deslopAccentColors.indigo },
  },
}

export const simpleBundledAvatarIds = [
  'primitive-ghost',
  'primitive-apple-bite',
  'oneworks-cat',
  'oneworks-cat-siamese',
  'oneworks-cat-british-shorthair',
  'oneworks-cat-russian-blue',
  'oneworks-cat-orange-tabby',
  'oneworks-cat-black',
  'oneworks-dog',
  'oneworks-dog-brown',
  'oneworks-bear',
  'oneworks-rabbit',
  'oneworks-bun',
  'avatar-4b9ea0c1-286f-4aa1-b053-61fcc416ba7e',
  'avatar-2739f2c2-a5b4-45d9-8915-c9d6101d4d3b',
  'avatar-1786600724626',
  'avatar-295e74a7-5d70-4d61-83d4-7beebb22bdd8',
  'primitive-sphere',
  'primitive-cube',
  'primitive-capsule',
  'primitive-cylinder',
  'primitive-cone',
  'primitive-diamond',
  'primitive-willy',
  'oneworks-sphere',
  'oneworks-ellipse',
  'oneworks-square',
  'oneworks-rounded',
  'oneworks-capsule',
  'oneworks-teardrop',
  'oneworks-diamond',
  'oneworks-trapezoid',
  'oneworks-cone',
  'oneworks-frustum',
  'oneworks-half-cone',
  'oneworks-cloud',
  'oneworks-sun',
] as const

const simpleBundledAvatarOrder = new Map(simpleBundledAvatarIds.map((id, index) => [id, index]))

// Remove hidden bundled characters from both fresh and previously persisted local libraries.
const hiddenBundledAvatarIds = new Set(['memento-piglet', 'oneworks-cat', 'oneworks-cat-cow'])

const retiredBundledAvatarIds = new Set([
  'memento-arctic-fox',
  'strobi',
  'avatar-4fe2d1bd-cf46-4e5e-a62d-d6b60be519ed',
  'avatar-7874f78a-93ec-4536-a3b6-bb53ed744efd',
  'avatar-1b2ee9c6-a6c5-4054-87e7-fec24f285269',
  'avatar-b6362e59-81a3-4334-a399-a721b23cf553',
  'avatar-fafdaf4d-2071-41d6-9d42-7d34670956f0',
])

const legacyBundledAvatarNames: Record<string, string> = {
  'oneworks-cat': 'OneWorks Cat',
  'oneworks-dog': 'OneWorks Dog',
  'oneworks-bear': 'OneWorks Bear',
  'oneworks-rabbit': 'OneWorks Rabbit',
  'oneworks-bun': 'OneWorks Bun',
}

const primitiveBundledAvatarSpecs = [
  ['primitive-sphere', 'Sphere', 'sphere', deslopAccentColors.indigo, 1],
  ['primitive-cube', 'Cube', 'cube', deslopAccentColors.brown, 0.78],
  ['primitive-capsule', 'Capsule', 'capsule', deslopAccentColors.green, 1],
  ['primitive-cylinder', 'Cylinder', 'cylinder', deslopAccentColors.mint, 0.82],
  ['primitive-cone', 'Cone', 'cone', deslopAccentColors.purple, 0.82],
  ['primitive-diamond', 'Diamond', 'diamond', deslopAccentColors.pink, 1],
  ['primitive-apple-bite', 'Apple Bite', 'apple-bite', deslopAccentColors.red, 0.9],
  ['primitive-ghost', 'Memento', 'ghost', deslopAccentColors.orange, 0.9],
] as const

const fixedSkinColorBehavior = (behavior?: AvatarBehaviorLibrary): AvatarBehaviorLibrary => {
  const storedExpressions = behavior?.expressions ?? initialExpressions
  const baseExpressions = storedExpressions.filter(
    expression => !expression.semanticKey?.startsWith('scared-state-')
  )
  const expressions = baseExpressions.map((expression, index) => {
    const fixedColorExpression = { ...expression }
    const bundledExpression =
      initialExpressions.find(candidate => candidate.semanticKey === expression.semanticKey) ??
      initialExpressions[index]
    if (expression.semanticKey === 'angry-brows' || expression.semanticKey === 'uneasy-left') {
      if (bundledExpression?.bodyColor) {
        fixedColorExpression.bodyColor = bundledExpression.bodyColor
      } else {
        delete fixedColorExpression.bodyColor
      }
      if (bundledExpression?.eyeColor) {
        fixedColorExpression.eyeColor = bundledExpression.eyeColor
      } else {
        delete fixedColorExpression.eyeColor
      }
    } else {
      delete fixedColorExpression.bodyColor
      delete fixedColorExpression.eyeColor
    }
    return fixedColorExpression
  })
  const expressionById = new Map(expressions.map(expression => [expression.id, expression]))
  const sourceSequences = behavior?.sequences ?? createInitialSequences()
  const scaredSequence = sourceSequences.find(sequence => sequence.semanticKey === 'scared')
  const scaredBodyColor =
    initialExpressions.find(expression => expression.semanticKey === 'uneasy-left')?.bodyColor ??
    '#adc3ff'
  const scaredExpressions = (scaredSequence?.steps ?? []).flatMap(step => {
    const baseId = step.expressionId.replace(/-scared-state$/, '')
    const source = expressionById.get(baseId)
    if (!source) return []
    return [
      {
        ...source,
        id: `${baseId}-scared-state`,
        semanticKey: `scared-state-${(source.semanticKey ?? source.id).replace(/^scared-state-/, '')}`,
        bodyColor: scaredBodyColor,
      },
    ]
  })
  const sequences = sourceSequences.map(sequence => ({
    ...sequence,
    steps: sequence.steps.map(step => ({
      ...step,
      expressionId:
        sequence.semanticKey === 'scared'
          ? `${step.expressionId.replace(/-scared-state$/, '')}-scared-state`
          : step.expressionId,
    })),
    blink: { ...sequence.blink },
  }))

  return { expressions: [...expressions, ...scaredExpressions], sequences }
}

const mementoBehavior = (behavior?: AvatarBehaviorLibrary): AvatarBehaviorLibrary => {
  const sourceExpressions = (behavior?.expressions ?? initialExpressions).filter(
    expression =>
      expression.semanticKey !== 'onboarding-listening' &&
      expression.semanticKey !== 'onboarding-curious'
  )
  const expressions = sourceExpressions.map(expression => {
    const fixedColorExpression = { ...expression }
    const bundledExpression = initialExpressions.find(
      candidate => candidate.semanticKey === expression.semanticKey
    )
    if (expression.semanticKey === 'angry-brows') {
      fixedColorExpression.bodyColor = bundledExpression?.bodyColor
      fixedColorExpression.eyeColor = bundledExpression?.eyeColor
    } else {
      delete fixedColorExpression.bodyColor
      delete fixedColorExpression.eyeColor
    }
    return fixedColorExpression
  })
  const listeningSource = expressions.find(expression => expression.semanticKey === 'downward-gaze')
  const curiousSource = expressions.find(expression => expression.semanticKey === 'small-attentive')
  const onboardingExpressions: Expression[] =
    listeningSource && curiousSource
      ? [
          {
            ...listeningSource,
            id: 'memento-onboarding-listening',
            semanticKey: 'onboarding-listening',
            headX: -22,
            positionYLeft: -50,
            positionYRight: -50,
          },
          {
            ...curiousSource,
            id: 'memento-onboarding-curious',
            semanticKey: 'onboarding-curious',
            headX: -12,
            positionYLeft: -22,
            positionYRight: -22,
          },
        ]
      : []
  const sequences = (behavior?.sequences ?? createInitialSequences()).map(sequence => ({
    ...sequence,
    steps: sequence.steps.map(step => ({ ...step })),
    blink: { ...sequence.blink },
  }))
  return {
    expressions: [...expressions, ...onboardingExpressions],
    sequences: [
      ...sequences.filter(sequence => sequence.semanticKey !== 'onboarding'),
      ...(onboardingExpressions.length === 2
        ? [
            {
              id: 'memento-onboarding',
              semanticKey: 'onboarding',
              name: 'onboarding',
              group: 'Memento',
              description: 'Alternates attentive listening with curiosity.',
              builtIn: true,
              playbackMode: 'loop' as const,
              steps: [
                {
                  id: 'memento-onboarding-listening-step',
                  expressionId: 'memento-onboarding-listening',
                  holdMs: 1200,
                  transitionMs: 350,
                  transition: 'smooth' as const,
                },
                {
                  id: 'memento-onboarding-curious-step',
                  expressionId: 'memento-onboarding-curious',
                  holdMs: 1200,
                  transitionMs: 350,
                  transition: 'smooth' as const,
                },
              ],
              blink: {
                enabled: true,
                initialDelayMs: 2600,
                minIntervalMs: 3400,
                maxIntervalMs: 6200,
                durationMs: 280,
              },
            },
          ]
        : []),
    ],
  }
}

type OneWorksShape =
  | 'sphere'
  | 'ellipse'
  | 'square'
  | 'rounded'
  | 'capsule'
  | 'teardrop'
  | 'diamond'
  | 'trapezoid'
  | 'cone'
  | 'frustum'
  | 'half-cone'

// Adapted from OneWorks Avatar's MIT-licensed parametric shape catalog.
// See avatar-lab/THIRD_PARTY_NOTICES.md for attribution and source details.
const oneWorksShapeDimensions: Record<
  OneWorksShape,
  { width: number; height: number; depth: number }
> = {
  sphere: { width: 278, height: 278, depth: 278 },
  ellipse: { width: 306, height: 236, depth: 244 },
  square: { width: 264, height: 264, depth: 216 },
  rounded: { width: 264, height: 264, depth: 232 },
  capsule: { width: 300, height: 218, depth: 218 },
  teardrop: { width: 264, height: 296, depth: 224 },
  diamond: { width: 278, height: 278, depth: 212 },
  trapezoid: { width: 284, height: 264, depth: 232 },
  cone: { width: 278, height: 278, depth: 248 },
  frustum: { width: 278, height: 278, depth: 248 },
  'half-cone': { width: 278, height: 278, depth: 248 },
}

const oneWorksSurfaceType: Record<OneWorksShape, keyof typeof surfacePresets> = {
  sphere: 'sphere',
  ellipse: 'ellipse',
  square: 'square',
  rounded: 'rounded',
  // OneWorks' capsule is a wide superellipsoid, not a vertical stadium.
  capsule: 'rounded',
  teardrop: 'teardrop',
  diamond: 'diamond',
  trapezoid: 'trapezoid',
  cone: 'cone',
  frustum: 'frustum',
  'half-cone': 'half-cone',
}

const oneWorksSurface = (
  shape: OneWorksShape,
  scaleX = 1,
  scaleY = scaleX,
  scaleZ = Math.min(scaleX, scaleY),
  options: Partial<(typeof surfacePresets)[keyof typeof surfacePresets]> = {}
) => {
  const type = oneWorksSurfaceType[shape]
  const dimensions = oneWorksShapeDimensions[shape]
  return {
    ...surfacePresets[type],
    width: dimensions.width * scaleX,
    height: dimensions.height * scaleY,
    depth: dimensions.depth * scaleZ,
    ...(shape === 'diamond' ? { roundness: 1.3 } : {}),
    ...(shape === 'trapezoid' ? { roundness: 1.44, topScale: 0.82 } : {}),
    ...(shape === 'cone'
      ? { roundness: 0.48, morphRoundness: 0, tipRoundness: 1, baseRoundness: 0.35 }
      : {}),
    ...options,
    type,
  }
}

const oneWorksNode = (
  id: string,
  name: string,
  shape: OneWorksShape,
  position: readonly [number, number, number],
  scaleX: number,
  scaleY: number,
  options: {
    scaleZ?: number
    rotation?: readonly [number, number, number]
    surface?: Partial<(typeof surfacePresets)[keyof typeof surfacePresets]>
    layer?: 'auto' | 'front' | 'back'
    color?: string
  } = {}
) => ({
  id,
  name,
  layer: options.layer ?? ('back' as const),
  ...(options.color ? { color: options.color } : {}),
  surface: oneWorksSurface(shape, scaleX, scaleY, options.scaleZ, options.surface),
  position: [...position] as [number, number, number],
  rotation: [...(options.rotation ?? [0, 0, 0])] as [number, number, number],
})

const oneWorksAvatar = (
  id: string,
  name: string,
  shape: OneWorksShape,
  color: string
): StudioAvatar => ({
  id,
  name,
  body: { primary: oneWorksSurface(shape, 0.84), nodes: [] },
  colors: { body: color, eyes: color },
  eyes: { ...defaultAvatarEyes },
  renderStyle: { ...defaultAvatarRenderStyle },
})

const oneWorksOriginalAnimalColors: Record<string, AvatarColors> = {
  'oneworks-cat': { body: '#f7f7f4', eyes: '#050608' },
  'oneworks-cat-siamese': { body: '#ead7b8', eyes: '#281913' },
  'oneworks-cat-british-shorthair': { body: '#b89a6b', eyes: '#35291f' },
  'oneworks-cat-russian-blue': { body: '#718493', eyes: '#17232c' },
  'oneworks-cat-orange-tabby': { body: '#d98a35', eyes: '#3b2416' },
  'oneworks-cat-black': { body: '#111419', eyes: '#eef2f5' },
  'oneworks-dog': { body: '#d4d0c8', eyes: '#211f1d' },
  'oneworks-bear': { body: '#a95f47', eyes: '#2b1d18' },
  'oneworks-rabbit': { body: '#eee9df', eyes: '#292724' },
  'oneworks-bun': { body: '#fff3d9', eyes: '#241915' },
}

const oneWorksBrownDogColors: AvatarColors = {
  body: '#e3b17f',
  eyes: '#2b1d18',
}

const oneWorksBundledAnimalColors: Record<string, AvatarColors> = {
  ...oneWorksOriginalAnimalColors,
  'oneworks-dog-brown': oneWorksBrownDogColors,
}

const mementoAnimalColors: Record<string, AvatarColors> = {
  'memento-piglet': { body: deslopAccentColors.pink, eyes: filledAvatarEyeColor },
}

const oneWorksCatAvatar = (
  id: string,
  name: string,
  colors: AvatarColors,
  earWidth: number,
  earHeight: number,
  earColor = colors.body
): StudioAvatar => {
  const earScaleX = 0.24 * (earWidth / 104)
  const earScaleY = 0.29 * (earHeight / 114)
  return {
    id,
    name,
    body: {
      primary: oneWorksSurface('ellipse', 0.73, 0.68),
      nodes: [
        oneWorksNode('cat-ear-left', 'Left ear', 'cone', [-56, -78, -8], earScaleX, earScaleY, {
          rotation: [-7, -13, -9],
          surface: { roundness: 0.96 },
          color: earColor,
        }),
        oneWorksNode(
          'cat-ear-right',
          'Right ear',
          'cone',
          [56, -78, -10],
          earScaleX * 0.96,
          earScaleY * 0.97,
          {
            rotation: [-6, 13, 9],
            surface: { roundness: 1.04 },
            color: earColor,
          }
        ),
      ],
    },
    colors: { ...colors },
    eyes: { ...defaultAvatarEyes },
    renderStyle: { ...filledAvatarRenderStyle },
    behavior: fixedSkinColorBehavior(),
  }
}

const oneWorksDogAvatar = (
  id: string,
  name: string,
  colors: AvatarColors,
  earColor: string
): StudioAvatar => ({
  id,
  name,
  body: {
    primary: oneWorksSurface('trapezoid', 0.72, 0.8, 0.72, {
      roundness: 1.68,
      topScale: 0.68,
    }),
    nodes: [
      oneWorksNode('dog-ear-left', 'Left ear', 'teardrop', [-82, -65, 0], 0.18, 0.34, {
        scaleZ: 0.18,
        rotation: [-4, -10, 22],
        layer: 'auto',
        color: earColor,
      }),
      oneWorksNode('dog-ear-right', 'Right ear', 'teardrop', [82, -65, 0], 0.18, 0.34, {
        scaleZ: 0.18,
        rotation: [-4, 10, -22],
        layer: 'auto',
        color: earColor,
      }),
    ],
  },
  colors: { ...colors },
  eyes: { ...defaultAvatarEyes },
  renderStyle: { ...filledAvatarRenderStyle },
  behavior: fixedSkinColorBehavior(),
})

const oneWorksBundledAvatars: StudioAvatar[] = [
  oneWorksAvatar('oneworks-sphere', 'OneWorks Sphere', 'sphere', deslopAccentColors.cyan),
  oneWorksAvatar('oneworks-ellipse', 'OneWorks Ellipse', 'ellipse', deslopAccentColors.teal),
  oneWorksAvatar('oneworks-square', 'OneWorks Square', 'square', deslopAccentColors.brown),
  oneWorksAvatar('oneworks-rounded', 'OneWorks Rounded', 'rounded', deslopAccentColors.blue),
  oneWorksAvatar('oneworks-capsule', 'OneWorks Capsule', 'capsule', deslopAccentColors.green),
  oneWorksAvatar('oneworks-teardrop', 'OneWorks Teardrop', 'teardrop', deslopAccentColors.pink),
  oneWorksAvatar('oneworks-diamond', 'OneWorks Diamond', 'diamond', deslopAccentColors.purple),
  oneWorksAvatar('oneworks-trapezoid', 'OneWorks Trapezoid', 'trapezoid', deslopAccentColors.mint),
  oneWorksAvatar('oneworks-cone', 'OneWorks Cone', 'cone', deslopAccentColors.red),
  oneWorksAvatar('oneworks-frustum', 'OneWorks Frustum', 'frustum', deslopAccentColors.yellow),
  oneWorksAvatar(
    'oneworks-half-cone',
    'OneWorks Half Cone',
    'half-cone',
    deslopAccentColors.indigo
  ),
  {
    id: 'oneworks-cloud',
    name: 'OneWorks Cloud',
    body: {
      primary: oneWorksSurface('ellipse', 0.83, 0.66),
      nodes: [
        oneWorksNode('cloud-crown-left', 'Crown left', 'sphere', [-91, -48, -42], 0.38, 0.38),
        oneWorksNode('cloud-crown-center', 'Crown center', 'rounded', [-20, -79, -34], 0.48, 0.46),
        oneWorksNode('cloud-crown-right', 'Crown right', 'sphere', [65, -55, -47], 0.34, 0.37),
        oneWorksNode('cloud-edge-left', 'Left edge', 'rounded', [-122, 13, -26], 0.41, 0.36),
        oneWorksNode('cloud-edge-right', 'Right edge', 'sphere', [119, 20, -29], 0.37, 0.34),
        oneWorksNode('cloud-base-left', 'Base left', 'capsule', [-65, 72, -38], 0.47, 0.27),
        oneWorksNode('cloud-base-right', 'Base right', 'capsule', [52, 70, -36], 0.52, 0.29),
      ],
    },
    colors: { body: deslopAccentColors.cyan, eyes: deslopAccentColors.cyan },
    eyes: { ...defaultAvatarEyes },
    renderStyle: { ...defaultAvatarRenderStyle },
  },
  {
    id: 'oneworks-sun',
    name: 'OneWorks Sun',
    body: {
      primary: oneWorksSurface('sphere', 0.72),
      nodes: Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4
        return oneWorksNode(
          `sun-ray-${index + 1}`,
          `Ray ${index + 1}`,
          index % 2 === 0 ? 'diamond' : 'sphere',
          [Math.cos(angle) * 125, Math.sin(angle) * 125, -18],
          0.14,
          0.14
        )
      }),
    },
    colors: { body: deslopAccentColors.yellow, eyes: deslopAccentColors.yellow },
    eyes: { ...defaultAvatarEyes },
    renderStyle: { ...defaultAvatarRenderStyle },
  },
  oneWorksCatAvatar('oneworks-cat', 'Cat', oneWorksOriginalAnimalColors['oneworks-cat'], 104, 114),
  oneWorksCatAvatar(
    'oneworks-cat-siamese',
    'Siamese',
    oneWorksOriginalAnimalColors['oneworks-cat-siamese'],
    104,
    114,
    '#3c2118'
  ),
  oneWorksCatAvatar(
    'oneworks-cat-british-shorthair',
    'British Shorthair',
    oneWorksOriginalAnimalColors['oneworks-cat-british-shorthair'],
    90,
    86
  ),
  oneWorksCatAvatar(
    'oneworks-cat-russian-blue',
    'Russian Blue',
    oneWorksOriginalAnimalColors['oneworks-cat-russian-blue'],
    104,
    116
  ),
  oneWorksCatAvatar(
    'oneworks-cat-orange-tabby',
    'Orange Tabby',
    oneWorksOriginalAnimalColors['oneworks-cat-orange-tabby'],
    100,
    100
  ),
  oneWorksCatAvatar(
    'oneworks-cat-black',
    'Black Cat',
    oneWorksOriginalAnimalColors['oneworks-cat-black'],
    102,
    106
  ),
  oneWorksDogAvatar(
    'oneworks-dog',
    'Dog',
    oneWorksOriginalAnimalColors['oneworks-dog'],
    deslopAccentColors.brown
  ),
  oneWorksDogAvatar('oneworks-dog-brown', 'Brown Dog', oneWorksBrownDogColors, '#a95f47'),
  {
    id: 'oneworks-bear',
    name: 'Bear',
    body: {
      primary: oneWorksSurface('trapezoid', 0.74, 0.72, 0.72, { roundness: 1.56 }),
      nodes: [
        oneWorksNode('bear-ear-left', 'Left ear', 'ellipse', [-64, -80, -18], 0.2, 0.34, {
          rotation: [-4, -7, 8],
          color: '#a95f47',
        }),
        oneWorksNode('bear-ear-right', 'Right ear', 'ellipse', [64, -78, -20], 0.19, 0.33, {
          rotation: [-3, 8, -7],
          color: '#a95f47',
        }),
      ],
    },
    colors: { ...oneWorksOriginalAnimalColors['oneworks-bear'] },
    eyes: { ...defaultAvatarEyes },
    renderStyle: { ...filledAvatarRenderStyle },
    behavior: fixedSkinColorBehavior(),
  },
  {
    id: 'oneworks-rabbit',
    name: 'Rabbit',
    body: {
      primary: oneWorksSurface('trapezoid', 0.72, 0.74, 0.72, {
        roundness: 2,
        topScale: 0.94,
      }),
      nodes: [
        oneWorksNode('rabbit-ear-left', 'Left ear', 'trapezoid', [-50, -76, -22], 0.18, 0.6, {
          rotation: [-3, -5, -8],
          surface: { roundness: 2, topScale: 0.9 },
        }),
        oneWorksNode('rabbit-ear-right', 'Right ear', 'trapezoid', [48, -79, -24], 0.17, 0.62, {
          rotation: [-4, 7, 11],
          surface: { roundness: 2, topScale: 0.9 },
        }),
      ],
    },
    colors: { ...oneWorksOriginalAnimalColors['oneworks-rabbit'] },
    eyes: { ...defaultAvatarEyes },
    renderStyle: { ...filledAvatarRenderStyle },
    behavior: fixedSkinColorBehavior(),
  },
  {
    id: 'oneworks-bun',
    name: 'Bun',
    body: {
      primary: oneWorksSurface('sphere', 0.7, 0.5, 0.7),
      nodes: [
        oneWorksNode('bun-crown', 'Rounded bun crown', 'cone', [0, -46, -14], 0.5, 0.23, {
          scaleZ: 0.5,
          layer: 'back',
          surface: { roundness: 0.92, topScale: 0.82 },
        }),
      ],
    },
    colors: { ...oneWorksOriginalAnimalColors['oneworks-bun'] },
    eyes: { ...defaultAvatarEyes },
    renderStyle: { ...filledAvatarRenderStyle },
    behavior: fixedSkinColorBehavior(),
  },
]

const mementoPigletAvatar: StudioAvatar = {
  id: 'memento-piglet',
  name: 'Порося',
  body: {
    primary: oneWorksSurface('trapezoid', 0.72, 0.8, 0.72, {
      roundness: 1.68,
      topScale: 0.68,
    }),
    nodes: [
      oneWorksNode('piglet-ear-left', 'Left ear', 'ellipse', [-57, -76, -18], 0.18, 0.29, {
        rotation: [-4, -7, 8],
        color: deslopAccentColors.red,
      }),
      oneWorksNode('piglet-ear-right', 'Right ear', 'ellipse', [57, -75, -20], 0.18, 0.29, {
        rotation: [-3, 8, -7],
        color: deslopAccentColors.red,
      }),
      oneWorksNode('piglet-snout', 'Snout', 'ellipse', [0, 44, 76], 0.25, 0.16, {
        scaleZ: 0.1,
        layer: 'front',
        color: deslopAccentColors.red,
      }),
      oneWorksNode('piglet-nostril-left', 'Left nostril', 'ellipse', [-14, 44, 90], 0.035, 0.048, {
        scaleZ: 0.025,
        rotation: [0, 0, -5],
        layer: 'front',
        color: filledAvatarEyeColor,
      }),
      oneWorksNode('piglet-nostril-right', 'Right nostril', 'ellipse', [14, 44, 90], 0.035, 0.048, {
        scaleZ: 0.025,
        rotation: [0, 0, 5],
        layer: 'front',
        color: filledAvatarEyeColor,
      }),
    ],
  },
  colors: { ...mementoAnimalColors['memento-piglet'] },
  eyes: { ...defaultAvatarEyes },
  renderStyle: { ...filledAvatarRenderStyle },
  behavior: fixedSkinColorBehavior(),
}

const primitiveBundledAvatars: StudioAvatar[] = [
  ...primitiveBundledAvatarSpecs.map(([id, name, surface, color, scale]) => ({
    id,
    name,
    body: {
      primary: {
        ...surfacePresets[surface],
        width: surfacePresets[surface].width * scale,
        height: surfacePresets[surface].height * scale,
        depth: surfacePresets[surface].depth * scale,
      },
      nodes: [],
    },
    colors: {
      body: color,
      eyes: surface === 'ghost' || surface === 'apple-bite' ? filledAvatarEyeColor : color,
    },
    eyes:
      surface === 'ghost'
        ? {
            ...defaultAvatarEyes,
            positionYLeft: defaultAvatarEyes.positionYLeft - 20,
            positionYRight: defaultAvatarEyes.positionYRight - 20,
          }
        : surface === 'apple-bite'
          ? {
              ...defaultAvatarEyes,
              positionXLeft: defaultAvatarEyes.positionXLeft - 18,
              positionXRight: defaultAvatarEyes.positionXRight - 18,
            }
          : { ...defaultAvatarEyes },
    renderStyle:
      surface === 'ghost' || surface === 'apple-bite'
        ? { ...filledAvatarRenderStyle }
        : { ...defaultAvatarRenderStyle },
    ...(surface === 'ghost'
      ? { behavior: mementoBehavior() }
      : surface === 'apple-bite'
        ? { behavior: fixedSkinColorBehavior() }
        : {}),
  })),
  mementoPigletAvatar,
  {
    id: 'primitive-willy',
    name: 'Willy',
    body: {
      primary: {
        ...surfacePresets.capsule,
        width: 122,
        height: 190,
        depth: 115,
      },
      nodes: [
        {
          id: 'willy-left-sphere',
          name: 'Left cap',
          surface: {
            ...surfacePresets.cone,
            width: 112,
            height: 58,
            depth: 100,
            morphRoundness: 1.2,
            tipRoundness: 2,
            baseRoundness: 2,
          },
          position: [-47, 95, -22],
          rotation: [0, 0, 0],
        },
        {
          id: 'willy-right-sphere',
          name: 'Right cap',
          surface: {
            ...surfacePresets.cone,
            width: 112,
            height: 58,
            depth: 100,
            morphRoundness: 1.2,
            tipRoundness: 2,
            baseRoundness: 2,
          },
          position: [47, 95, -22],
          rotation: [0, 0, 0],
        },
        {
          id: 'willy-cap',
          name: 'Rounded cap',
          layer: 'front',
          surface: {
            ...surfacePresets.cone,
            width: 178,
            height: 86,
            depth: 156,
            morphRoundness: 1.2,
            tipRoundness: 2,
            baseRoundness: 2,
          },
          position: [0, -94, 0],
          rotation: [0, 0, 0],
        },
      ],
    },
    colors: { body: deslopAccentColors.red, eyes: deslopAccentColors.red },
    eyes: { ...defaultAvatarEyes },
    renderStyle: { ...defaultAvatarRenderStyle },
  },
  ...oneWorksBundledAvatars,
]

const originalSimpleBundledAvatarIds = new Set<string>([
  'avatar-4b9ea0c1-286f-4aa1-b053-61fcc416ba7e',
  'avatar-2739f2c2-a5b4-45d9-8915-c9d6101d4d3b',
  'avatar-1786600724626',
  'avatar-295e74a7-5d70-4d61-83d4-7beebb22bdd8',
])
const filledBundledAvatarIds = new Set([
  ...Object.keys(oneWorksBundledAnimalColors),
  ...Object.keys(mementoAnimalColors),
  'primitive-ghost',
  'primitive-apple-bite',
])
const oneWorksOriginalAnimalIds = new Set(Object.keys(oneWorksBundledAnimalColors))
const filledPrimitiveAvatarColors: Record<string, AvatarColors> = {
  'primitive-ghost': { body: deslopAccentColors.orange, eyes: filledAvatarEyeColor },
  'primitive-apple-bite': { body: deslopAccentColors.red, eyes: filledAvatarEyeColor },
}

const clonePrimitiveBundledAvatar = (avatar: StudioAvatar): StudioAvatar => ({
  ...avatar,
  body: {
    primary: { ...avatar.body.primary },
    nodes: avatar.body.nodes.map(node => ({
      ...node,
      surface: { ...node.surface },
      position: [...node.position],
      rotation: [...node.rotation],
    })),
  },
  colors: { ...avatar.colors },
  eyes: { ...avatar.eyes },
  renderStyle: { ...avatar.renderStyle },
  ...(avatar.behavior
    ? {
        behavior: {
          expressions: avatar.behavior.expressions.map(expression => ({ ...expression })),
          sequences: avatar.behavior.sequences.map(sequence => ({
            ...sequence,
            steps: sequence.steps.map(step => ({ ...step })),
            blink: { ...sequence.blink },
          })),
        },
      }
    : {}),
})

export const ensurePrimitiveBundledAvatars = (library: AvatarLibrary): AvatarLibrary => {
  const visibleLibraryAvatars = library.avatars.filter(
    avatar => !hiddenBundledAvatarIds.has(avatar.id)
  )
  if (!visibleLibraryAvatars.some(avatar => originalSimpleBundledAvatarIds.has(avatar.id))) {
    const avatarsWithCurrentColorBehavior = visibleLibraryAvatars.map(avatar => {
      if (avatar.id === 'primitive-ghost') {
        return { ...avatar, behavior: mementoBehavior(avatar.behavior) }
      }
      if (filledBundledAvatarIds.has(avatar.id)) {
        return { ...avatar, behavior: fixedSkinColorBehavior(avatar.behavior) }
      }
      return avatar
    })
    return {
      ...library,
      activeAvatarId: avatarsWithCurrentColorBehavior.some(
        avatar => avatar.id === library.activeAvatarId
      )
        ? library.activeAvatarId
        : (avatarsWithCurrentColorBehavior[0]?.id ?? library.activeAvatarId),
      avatars: avatarsWithCurrentColorBehavior,
    }
  }
  const resizedAvatars = visibleLibraryAvatars.map(avatar => {
    const bundled = primitiveBundledAvatars.find(candidate => candidate.id === avatar.id)
    if (!bundled) return avatar
    const migratedNodes = avatar.body.nodes.map(node => {
      const bundledNode = bundled.body.nodes.find(candidate => candidate.id === node.id)
      if (!bundledNode) return node
      const nodeWithOriginalColor = bundledNode.color ? { ...node, color: bundledNode.color } : node
      const nodeWithOriginalLayer = oneWorksOriginalAnimalIds.has(avatar.id)
        ? { ...nodeWithOriginalColor, layer: bundledNode.layer }
        : nodeWithOriginalColor
      const isDogEar =
        ['oneworks-dog', 'oneworks-dog-brown'].includes(avatar.id) &&
        (node.id === 'dog-ear-left' || node.id === 'dog-ear-right')
      const hasLegacyDogEarPosition =
        node.position[1] === -52 ||
        (node.position[1] === -65 &&
          ((node.id === 'dog-ear-left' && node.position[0] === -92) ||
            (node.id === 'dog-ear-right' && node.position[0] === 92))) ||
        (node.position[1] === -78 && [72, 88].includes(Math.abs(node.position[0]))) ||
        (node.position[1] === -62 &&
          ((node.id === 'dog-ear-left' && node.position[0] === -88) ||
            (node.id === 'dog-ear-right' && [88, 132, 142, 146].includes(node.position[0])))) ||
        (node.position[1] === -42 &&
          ((node.id === 'dog-ear-left' && node.position[0] === -100) ||
            (node.id === 'dog-ear-right' && node.position[0] === 146))) ||
        (node.position[1] === -30 &&
          ((node.id === 'dog-ear-left' && node.position[0] === -100) ||
            (node.id === 'dog-ear-right' && [140, 152].includes(node.position[0]))))
      const hasLegacyDogEarGeometry = isDogEar && hasLegacyDogEarPosition
      const isBearEar =
        avatar.id === 'oneworks-bear' &&
        (node.id === 'bear-ear-left' || node.id === 'bear-ear-right')
      const hasLegacyBearEarPosition =
        (node.id === 'bear-ear-left' &&
          node.position[0] === -58 &&
          node.position[1] === -72 &&
          node.position[2] === -18) ||
        (node.id === 'bear-ear-right' &&
          node.position[0] === 58 &&
          node.position[1] === -70 &&
          node.position[2] === -20)
      const hasLegacyBearEarGeometry = isBearEar && hasLegacyBearEarPosition
      const isPigletFaceFeature =
        avatar.id === 'memento-piglet' &&
        ['piglet-snout', 'piglet-nostril-left', 'piglet-nostril-right'].includes(node.id)
      const hasLegacyPigletFaceGeometry =
        isPigletFaceFeature &&
        ((node.id === 'piglet-snout' &&
          ([8, 154].includes(node.position[2]) ||
            (node.position[1] === 57 && node.position[2] === 76))) ||
          ((node.id === 'piglet-nostril-left' || node.id === 'piglet-nostril-right') &&
            ([20, 176].includes(node.position[2]) ||
              (node.position[1] === 57 && node.position[2] === 90))))
      const nodeWithCurrentAnimalGeometry =
        hasLegacyDogEarGeometry || hasLegacyBearEarGeometry || hasLegacyPigletFaceGeometry
          ? {
              ...nodeWithOriginalLayer,
              surface: { ...bundledNode.surface },
              position: [...bundledNode.position] as typeof bundledNode.position,
              rotation: [...bundledNode.rotation] as typeof bundledNode.rotation,
            }
          : nodeWithOriginalLayer
      if (avatar.id !== 'primitive-willy') return nodeWithCurrentAnimalGeometry
      const isLegacyLowerSphere =
        (node.id === 'willy-left-sphere' || node.id === 'willy-right-sphere') &&
        node.surface.type === 'sphere' &&
        node.surface.width === 108 &&
        node.surface.height === 96 &&
        node.surface.depth === 100
      const isLegacyTopCap =
        node.id === 'willy-cap' &&
        ((node.surface.width === 150 &&
          node.surface.height === 72 &&
          node.surface.depth === 135 &&
          node.position[2] === 12) ||
          (node.surface.width === 166 && node.surface.height === 80 && node.surface.depth === 148))
      if (!isLegacyLowerSphere && !isLegacyTopCap) return nodeWithCurrentAnimalGeometry
      return {
        ...bundledNode,
        surface: { ...bundledNode.surface },
        position: [...bundledNode.position] as typeof bundledNode.position,
        rotation: [...bundledNode.rotation] as typeof bundledNode.rotation,
      }
    })
    const existingNodeIds = new Set(migratedNodes.map(node => node.id))
    const missingBundledNodes = bundled.body.nodes.filter(node => !existingNodeIds.has(node.id))
    const avatarWithCurrentNodes = missingBundledNodes.length
      ? {
          ...avatar,
          body: {
            ...avatar.body,
            nodes: [
              ...migratedNodes,
              ...missingBundledNodes.map(node => ({
                ...node,
                surface: { ...node.surface },
                position: [...node.position] as typeof node.position,
                rotation: [...node.rotation] as typeof node.rotation,
              })),
            ],
          },
        }
      : migratedNodes.some((node, index) => node !== avatar.body.nodes[index])
        ? { ...avatar, body: { ...avatar.body, nodes: migratedNodes } }
        : avatar
    const legacyBundledName = legacyBundledAvatarNames[avatarWithCurrentNodes.id]
    const avatarWithCurrentName =
      (avatarWithCurrentNodes.id === 'primitive-ghost' &&
        avatarWithCurrentNodes.name === 'Ghost') ||
      avatarWithCurrentNodes.name === legacyBundledName
        ? { ...avatarWithCurrentNodes, name: bundled.name }
        : avatarWithCurrentNodes
    const avatarWithCurrentEyes =
      avatarWithCurrentName.id === 'primitive-ghost' &&
      [defaultAvatarEyes.positionYLeft, defaultAvatarEyes.positionYLeft - 12].includes(
        avatarWithCurrentName.eyes.positionYLeft
      ) &&
      [defaultAvatarEyes.positionYRight, defaultAvatarEyes.positionYRight - 12].includes(
        avatarWithCurrentName.eyes.positionYRight
      )
        ? { ...avatarWithCurrentName, eyes: { ...bundled.eyes } }
        : avatarWithCurrentName
    const avatarWithAppleBiteEyes =
      avatarWithCurrentEyes.id === 'primitive-apple-bite' &&
      avatarWithCurrentEyes.eyes.positionXLeft === defaultAvatarEyes.positionXLeft &&
      avatarWithCurrentEyes.eyes.positionXRight === defaultAvatarEyes.positionXRight
        ? { ...avatarWithCurrentEyes, eyes: { ...bundled.eyes } }
        : avatarWithCurrentEyes
    const avatarWithFixedColorBehavior =
      avatarWithAppleBiteEyes.id === 'primitive-ghost'
        ? {
            ...avatarWithAppleBiteEyes,
            behavior: mementoBehavior(avatarWithAppleBiteEyes.behavior),
          }
        : filledBundledAvatarIds.has(avatarWithAppleBiteEyes.id)
          ? {
              ...avatarWithAppleBiteEyes,
              behavior: fixedSkinColorBehavior(avatarWithAppleBiteEyes.behavior),
            }
          : avatarWithAppleBiteEyes
    const avatarWithCurrentRenderStyle = filledBundledAvatarIds.has(avatarWithFixedColorBehavior.id)
      ? { ...avatarWithFixedColorBehavior, renderStyle: { ...filledAvatarRenderStyle } }
      : avatarWithFixedColorBehavior
    const bundledFilledColors =
      mementoAnimalColors[avatarWithCurrentRenderStyle.id] ??
      oneWorksBundledAnimalColors[avatarWithCurrentRenderStyle.id] ??
      filledPrimitiveAvatarColors[avatarWithCurrentRenderStyle.id]
    const avatarWithOriginalColors = bundledFilledColors
      ? { ...avatarWithCurrentRenderStyle, colors: { ...bundledFilledColors } }
      : avatarWithCurrentRenderStyle
    const original = surfacePresets[bundled.body.primary.type]
    const primary = avatarWithOriginalColors.body.primary
    const stillUsesOriginalSize =
      primary.type === original.type &&
      primary.width === original.width &&
      primary.height === original.height &&
      primary.depth === original.depth
    const stillUsesPreviousWillyBody =
      avatar.id === 'primitive-willy' &&
      primary.type === 'capsule' &&
      primary.width === 122 &&
      primary.height === 210 &&
      primary.depth === 115
    const stillUsesPreviousPigletBody =
      avatar.id === 'memento-piglet' &&
      primary.type === 'sphere' &&
      primary.width === 194.6 &&
      primary.height === 194.6 &&
      primary.depth === 200.16
    if (!stillUsesOriginalSize && !stillUsesPreviousWillyBody && !stillUsesPreviousPigletBody) {
      return avatarWithOriginalColors
    }
    return {
      ...avatarWithOriginalColors,
      body: { ...avatarWithOriginalColors.body, primary: { ...bundled.body.primary } },
    }
  })
  const existingIds = new Set(resizedAvatars.map(avatar => avatar.id))
  const avatars = [
    ...resizedAvatars,
    ...primitiveBundledAvatars
      .filter(avatar => !hiddenBundledAvatarIds.has(avatar.id) && !existingIds.has(avatar.id))
      .map(clonePrimitiveBundledAvatar),
  ].sort((left, right) => {
    const leftOrder = simpleBundledAvatarOrder.get(
      left.id as (typeof simpleBundledAvatarIds)[number]
    )
    const rightOrder = simpleBundledAvatarOrder.get(
      right.id as (typeof simpleBundledAvatarIds)[number]
    )
    if (leftOrder === undefined && rightOrder === undefined) return 0
    if (leftOrder === undefined) return 1
    if (rightOrder === undefined) return -1
    return leftOrder - rightOrder
  })
  return {
    ...library,
    activeAvatarId: avatars.some(avatar => avatar.id === library.activeAvatarId)
      ? library.activeAvatarId
      : (avatars[0]?.id ?? library.activeAvatarId),
    avatars,
  }
}

export const migrateBundledAvatarColors = (id: string, colors: AvatarColors): AvatarColors => {
  const migration = bundledAvatarColorMigrations[id]
  if (
    !migration ||
    colors.body.toLowerCase() !== migration.from.body.toLowerCase() ||
    colors.eyes.toLowerCase() !== migration.from.eyes.toLowerCase()
  ) {
    return colors
  }
  return { ...migration.to }
}

const finiteBounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

export const parseAvatarRenderStyle = (value: unknown): AvatarRenderStyle => {
  const candidate = value as { type?: unknown; filled?: unknown; resolution?: unknown } | null
  if (candidate?.type === 'vector') {
    return candidate.filled === true ? { type: 'vector', filled: true } : { type: 'vector' }
  }
  if (!PIXEL_RENDERING_ENABLED || candidate?.type !== 'pixel') {
    return { ...defaultAvatarRenderStyle }
  }
  return {
    type: 'pixel',
    resolution: Math.round(
      finiteBounded(candidate.resolution, defaultPixelRenderStyle.resolution, 8, 192)
    ),
  }
}

const eyeDefaultFields = Object.keys(defaultAvatarEyes) as (keyof AvatarEyeDefaults)[]
export const parseAvatarEyeDefaults = (value: unknown): AvatarEyeDefaults => {
  const candidate = value as Partial<AvatarEyeDefaults> | null
  const parsed = { ...defaultAvatarEyes }
  eyeDefaultFields.forEach(field => {
    const stored = candidate?.[field]
    if (typeof stored === 'number' && Number.isFinite(stored)) parsed[field] = stored
  })
  return parsed
}

export const applyAvatarEyeDefaults = (
  expression: Expression,
  eyes: AvatarEyeDefaults = defaultAvatarEyes
): Expression => {
  const result = { ...expression }
  eyeDefaultFields.forEach(field => {
    result[field] = expression[field] + eyes[field] - defaultAvatarEyes[field]
  })
  result.widthLeft = Math.max(10, result.widthLeft)
  result.widthRight = Math.max(10, result.widthRight)
  result.heightLeft = Math.max(10, result.heightLeft)
  result.heightRight = Math.max(10, result.heightRight)
  return result
}

export const createUnkeyedExpressionCopy = (source: Expression, id: string): Expression => ({
  ...source,
  id,
  semanticKey: undefined,
})

export type AvatarLibrary = {
  activeAvatarId: string
  avatars: StudioAvatar[]
}

const cloneExpressions = (expressions: Expression[]) => expressions.map(item => ({ ...item }))
export const parseExpressions = (value: unknown): Expression[] => {
  if (!Array.isArray(value) || !value.length) return cloneExpressions(initialExpressions)
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return { ...defaultExpression, id: `expression-${String(index).padStart(2, '0')}` }
    }
    const candidate = item as Partial<Expression>
    const storedEyeMotion = (item as { eyeMotion?: unknown }).eyeMotion
    const storedBodyMotion = (item as { bodyMotion?: unknown }).bodyMotion
    const parsed = Object.fromEntries(
      Object.entries(defaultExpression).map(([field, fallback]) => {
        if (field === 'id') {
          return [
            field,
            typeof candidate.id === 'string' && candidate.id
              ? candidate.id
              : `expression-${String(index).padStart(2, '0')}`,
          ]
        }
        const stored = candidate[field as keyof Expression]
        return [field, typeof stored === 'number' && Number.isFinite(stored) ? stored : fallback]
      })
    ) as Expression
    if (typeof candidate.bodyColor === 'string' && hexColor.test(candidate.bodyColor))
      parsed.bodyColor = candidate.bodyColor
    if (typeof candidate.eyeColor === 'string' && hexColor.test(candidate.eyeColor))
      parsed.eyeColor = candidate.eyeColor
    if (typeof candidate.semanticKey === 'string') parsed.semanticKey = candidate.semanticKey
    parsed.eyeMotion = isEyeMotion(storedEyeMotion) ? storedEyeMotion : defaultExpression.eyeMotion
    parsed.bodyMotion = isBodyMotion(storedBodyMotion)
      ? storedBodyMotion
      : defaultExpression.bodyMotion
    return parsed
  })
}

const cloneSequences = (sequences: AvatarSequence[]) =>
  sequences.map(sequence => ({
    ...sequence,
    steps: sequence.steps.map(step => ({ ...step })),
    blink: { ...sequence.blink },
  }))

export const cloneAvatarBehavior = (behavior: AvatarBehaviorLibrary): AvatarBehaviorLibrary => ({
  expressions: cloneExpressions(behavior.expressions),
  sequences: cloneSequences(behavior.sequences),
})

export const restoreLegacyBehaviorSemanticKeys = (
  behavior: AvatarBehaviorLibrary,
  reference: AvatarBehaviorLibrary
): AvatarBehaviorLibrary => {
  const expressionKeys = new Map(
    reference.expressions.flatMap(expression =>
      expression.semanticKey ? [[expression.id, expression.semanticKey] as const] : []
    )
  )
  const sequenceKeys = new Map(
    reference.sequences.flatMap(sequence =>
      sequence.semanticKey ? [[sequence.id, sequence.semanticKey] as const] : []
    )
  )
  const restoreExpressions = behavior.expressions.every(
    expression => expression.semanticKey === undefined
  )
  const restoreSequences = behavior.sequences.every(sequence => sequence.semanticKey === undefined)

  return {
    expressions: restoreExpressions
      ? behavior.expressions.map(expression => {
          const semanticKey = expressionKeys.get(expression.id)
          return semanticKey ? { ...expression, semanticKey } : expression
        })
      : behavior.expressions,
    sequences: restoreSequences
      ? behavior.sequences.map(sequence => {
          const semanticKey = sequenceKeys.get(sequence.id)
          return semanticKey ? { ...sequence, semanticKey } : sequence
        })
      : behavior.sequences,
  }
}

export const resolveAvatarBehavior = (
  avatar: StudioAvatar,
  base: AvatarBehaviorLibrary
): AvatarBehaviorLibrary => avatar.behavior ?? base

const parseAvatarBehavior = (
  value: unknown,
  base: AvatarBehaviorLibrary
): AvatarBehaviorLibrary | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<AvatarBehaviorLibrary>
  if (!Array.isArray(candidate.expressions) || !candidate.expressions.length) return undefined
  const expressions = parseExpressions(candidate.expressions)
  return restoreLegacyBehaviorSemanticKeys(
    {
      expressions,
      sequences: normalizeSequencesForExpressions(
        Array.isArray(candidate.sequences)
          ? parseSequences(candidate.sequences)
          : cloneSequences(base.sequences),
        expressions
      ),
    },
    base
  )
}

export const createAvatar = (name: string): StudioAvatar => ({
  id: `avatar-${crypto.randomUUID()}`,
  name: name.trim() || 'Nouvel avatar',
  body: { primary: { ...surfacePresets.sphere }, nodes: [] },
  colors: { ...defaultAvatarColors },
  eyes: { ...defaultAvatarEyes },
  renderStyle: { ...defaultAvatarRenderStyle },
})

export const parseAvatarLibrary = (
  value: unknown,
  fallback: AvatarLibrary,
  baseBehavior: AvatarBehaviorLibrary
): AvatarLibrary => {
  try {
    const parsed = value as Partial<AvatarLibrary> | null
    if (!parsed || !Array.isArray(parsed.avatars) || !parsed.avatars.length) return fallback
    const seenIds = new Set<string>()
    const parsedAvatars = parsed.avatars
      .filter(avatar => {
        if (!avatar || typeof avatar.id !== 'string' || typeof avatar.name !== 'string')
          return false
        if (retiredBundledAvatarIds.has(avatar.id) || hiddenBundledAvatarIds.has(avatar.id)) {
          return false
        }
        if (seenIds.has(avatar.id)) return false
        seenIds.add(avatar.id)
        return true
      })
      .map(avatar => {
        const behavior = parseAvatarBehavior(avatar.behavior, baseBehavior)
        const migratedColors = migrateBundledAvatarColors(avatar.id, parseColors(avatar.colors))
        const colors = simpleBundledAvatarOrder.has(
          avatar.id as (typeof simpleBundledAvatarIds)[number]
        )
          ? { body: migratedColors.body, eyes: migratedColors.body }
          : migratedColors
        return {
          id: avatar.id,
          name: avatar.name,
          body: parseAvatarBody(avatar.body, surfacePresets.sphere),
          colors,
          eyes: parseAvatarEyeDefaults(avatar.eyes),
          renderStyle: parseAvatarRenderStyle(avatar.renderStyle),
          ...(behavior ? { behavior } : {}),
        }
      })
    const avatars = parsedAvatars.sort((left, right) => {
      const leftOrder = simpleBundledAvatarOrder.get(
        left.id as (typeof simpleBundledAvatarIds)[number]
      )
      const rightOrder = simpleBundledAvatarOrder.get(
        right.id as (typeof simpleBundledAvatarIds)[number]
      )
      if (leftOrder === undefined && rightOrder === undefined) return 0
      if (leftOrder === undefined) return 1
      if (rightOrder === undefined) return -1
      return leftOrder - rightOrder
    })
    if (!avatars.length) return fallback
    const activeAvatarId = avatars.some(avatar => avatar.id === parsed.activeAvatarId)
      ? parsed.activeAvatarId!
      : avatars[0].id
    return { activeAvatarId, avatars }
  } catch {
    return fallback
  }
}
