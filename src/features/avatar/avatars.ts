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
export type AvatarRenderStyle = { type: 'vector' } | PixelRenderStyle
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
  'primitive-ghost',
  'primitive-willy',
] as const

const simpleBundledAvatarOrder = new Map(simpleBundledAvatarIds.map((id, index) => [id, index]))

const retiredBundledAvatarIds = new Set([
  'strobi',
  'avatar-4fe2d1bd-cf46-4e5e-a62d-d6b60be519ed',
  'avatar-7874f78a-93ec-4536-a3b6-bb53ed744efd',
  'avatar-1b2ee9c6-a6c5-4054-87e7-fec24f285269',
  'avatar-b6362e59-81a3-4334-a399-a721b23cf553',
  'avatar-fafdaf4d-2071-41d6-9d42-7d34670956f0',
])

const primitiveBundledAvatarSpecs = [
  ['primitive-sphere', 'Sphere', 'sphere', deslopAccentColors.indigo, 1],
  ['primitive-cube', 'Cube', 'cube', deslopAccentColors.brown, 0.78],
  ['primitive-capsule', 'Capsule', 'capsule', deslopAccentColors.green, 1],
  ['primitive-cylinder', 'Cylinder', 'cylinder', deslopAccentColors.mint, 0.82],
  ['primitive-cone', 'Cone', 'cone', deslopAccentColors.purple, 0.82],
  ['primitive-diamond', 'Diamond', 'diamond', deslopAccentColors.pink, 1],
  ['primitive-ghost', 'Memento', 'ghost', deslopAccentColors.orange, 1],
] as const

const mementoBehavior = (behavior?: AvatarBehaviorLibrary): AvatarBehaviorLibrary => ({
  expressions: (behavior?.expressions ?? initialExpressions).map(expression => {
    const fixedColorExpression = { ...expression }
    delete fixedColorExpression.bodyColor
    delete fixedColorExpression.eyeColor
    return fixedColorExpression
  }),
  sequences: (behavior?.sequences ?? createInitialSequences()).map(sequence => ({
    ...sequence,
    steps: sequence.steps.map(step => ({ ...step })),
    blink: { ...sequence.blink },
  })),
})

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
    colors: { body: color, eyes: color },
    eyes:
      surface === 'ghost'
        ? {
            ...defaultAvatarEyes,
            positionYLeft: defaultAvatarEyes.positionYLeft - 20,
            positionYRight: defaultAvatarEyes.positionYRight - 20,
          }
        : { ...defaultAvatarEyes },
    renderStyle: { ...defaultAvatarRenderStyle },
    ...(surface === 'ghost' ? { behavior: mementoBehavior() } : {}),
  })),
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
]

const originalSimpleBundledAvatarIds = new Set<string>(simpleBundledAvatarIds.slice(0, 4))

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
  ...(avatar.behavior ? { behavior: mementoBehavior(avatar.behavior) } : {}),
})

export const ensurePrimitiveBundledAvatars = (library: AvatarLibrary): AvatarLibrary => {
  if (!library.avatars.some(avatar => originalSimpleBundledAvatarIds.has(avatar.id))) return library
  const resizedAvatars = library.avatars.map(avatar => {
    const bundled = primitiveBundledAvatars.find(candidate => candidate.id === avatar.id)
    if (!bundled) return avatar
    const migratedNodes = avatar.body.nodes.map(node => {
      const bundledNode = bundled.body.nodes.find(candidate => candidate.id === node.id)
      if (!bundledNode || avatar.id !== 'primitive-willy') return node
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
      if (!isLegacyLowerSphere && !isLegacyTopCap) return node
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
    const avatarWithCurrentName =
      avatarWithCurrentNodes.id === 'primitive-ghost' && avatarWithCurrentNodes.name === 'Ghost'
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
    const avatarWithFixedColorBehavior =
      avatarWithCurrentEyes.id === 'primitive-ghost'
        ? { ...avatarWithCurrentEyes, behavior: mementoBehavior(avatarWithCurrentEyes.behavior) }
        : avatarWithCurrentEyes
    const original = surfacePresets[bundled.body.primary.type]
    const primary = avatarWithFixedColorBehavior.body.primary
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
    if (!stillUsesOriginalSize && !stillUsesPreviousWillyBody) return avatarWithFixedColorBehavior
    return {
      ...avatarWithFixedColorBehavior,
      body: { ...avatarWithFixedColorBehavior.body, primary: { ...bundled.body.primary } },
    }
  })
  const existingIds = new Set(resizedAvatars.map(avatar => avatar.id))
  const avatars = [
    ...resizedAvatars,
    ...primitiveBundledAvatars
      .filter(avatar => !existingIds.has(avatar.id))
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
  return { ...library, avatars }
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
  const candidate = value as Partial<PixelRenderStyle> | null
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
        if (retiredBundledAvatarIds.has(avatar.id)) return false
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
