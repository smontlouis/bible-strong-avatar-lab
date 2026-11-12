import { parseAvatarBody, type AvatarBody } from './body'
import { defaultExpression, initialExpressions } from './presets'
import { surfacePresets } from './surfaces'
import type { Expression } from './geometry'
import { isBodyMotion, isEyeMotion } from './ambientMotion'
import {
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
export type AvatarOutlineStyle = {
  enabled: boolean
  color: string
  width: number
  opacity: number
}
export type VectorRenderStyle = { type: 'vector'; outline?: AvatarOutlineStyle }
export type AvatarRenderStyle = VectorRenderStyle | PixelRenderStyle
export type AvatarEyeDefaults = Required<
  Pick<
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
    | 'eyeShape'
    | 'eyeRoundness'
    | 'mouthEnabled'
    | 'mouthShape'
    | 'mouthCurve'
    | 'mouthWidth'
    | 'mouthHeight'
    | 'mouthX'
    | 'mouthY'
    | 'mouthAngle'
    | 'noseEnabled'
    | 'noseShape'
    | 'noseRoundness'
    | 'noseWidth'
    | 'noseHeight'
    | 'noseX'
    | 'noseY'
    | 'noseAngle'
    | 'positionX'
    | 'positionY'
    | 'positionZ'
  >
>
export const defaultAvatarColors: AvatarColors = { body: '#5b7fe5', eyes: '#111316' }
export const defaultAvatarRenderStyle: AvatarRenderStyle = { type: 'vector' }
export const defaultAvatarOutlineStyle: AvatarOutlineStyle = {
  enabled: false,
  color: '#111316',
  width: 6,
  opacity: 1,
}
export const defaultPixelRenderStyle: PixelRenderStyle = {
  type: 'pixel',
  resolution: 64,
}
export const defaultAvatarEyes: AvatarEyeDefaults = {
  positionX: defaultExpression.positionX,
  positionY: defaultExpression.positionY,
  positionZ: defaultExpression.positionZ,
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
  eyeShape: 'rounded',
  eyeRoundness: defaultExpression.eyeRoundness,
  mouthEnabled: false,
  mouthShape: 'curve',
  mouthCurve: defaultExpression.mouthCurve,
  mouthWidth: defaultExpression.mouthWidth,
  mouthHeight: defaultExpression.mouthHeight,
  mouthX: defaultExpression.mouthX,
  mouthY: defaultExpression.mouthY,
  mouthAngle: defaultExpression.mouthAngle,
  noseEnabled: defaultExpression.noseEnabled,
  noseShape: defaultExpression.noseShape,
  noseRoundness: defaultExpression.noseRoundness,
  noseWidth: defaultExpression.noseWidth,
  noseHeight: defaultExpression.noseHeight,
  noseX: defaultExpression.noseX,
  noseY: defaultExpression.noseY,
  noseAngle: defaultExpression.noseAngle,
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

const finiteBounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

export const parseAvatarRenderStyle = (value: unknown): AvatarRenderStyle => {
  const candidate = value as Partial<PixelRenderStyle> | null
  if (!PIXEL_RENDERING_ENABLED || candidate?.type !== 'pixel') {
    const vector = value as Partial<VectorRenderStyle> | null
    const outline = vector?.outline
    if (!outline || typeof outline !== 'object') return { ...defaultAvatarRenderStyle }
    return {
      type: 'vector',
      outline: {
        enabled: typeof outline.enabled === 'boolean' ? outline.enabled : false,
        color:
          typeof outline.color === 'string' && hexColor.test(outline.color)
            ? outline.color
            : defaultAvatarOutlineStyle.color,
        width: finiteBounded(outline.width, defaultAvatarOutlineStyle.width, 0, 24),
        opacity: finiteBounded(outline.opacity, defaultAvatarOutlineStyle.opacity, 0, 1),
      },
    }
  }
  return {
    type: 'pixel',
    resolution: Math.round(
      finiteBounded(candidate.resolution, defaultPixelRenderStyle.resolution, 8, 192)
    ),
  }
}

const eyeNumericDefaultFields = [
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
  'noseWidth',
  'noseRoundness',
  'noseHeight',
  'noseX',
  'noseY',
  'noseAngle',
] as const
export const mouthNumericDefaultFields = [
  'mouthCurve',
  'mouthWidth',
  'mouthHeight',
  'mouthX',
  'mouthY',
  'mouthAngle',
] as const
export const parseAvatarEyeDefaults = (value: unknown): AvatarEyeDefaults => {
  const candidate = value as Partial<AvatarEyeDefaults> | null
  const parsed = { ...defaultAvatarEyes }
  eyeNumericDefaultFields.forEach(field => {
    const stored = candidate?.[field]
    if (typeof stored === 'number' && Number.isFinite(stored)) parsed[field] = stored
  })
  mouthNumericDefaultFields.forEach(field => {
    const stored = candidate?.[field]
    if (typeof stored === 'number' && Number.isFinite(stored)) parsed[field] = stored
  })
  if (candidate?.eyeShape === 'rounded' || candidate?.eyeShape === 'ellipse') {
    parsed.eyeShape = candidate.eyeShape
  }
  if (
    candidate?.noseShape === 'ellipse' ||
    candidate?.noseShape === 'inverted-triangle' ||
    candidate?.noseShape === 'rounded'
  ) {
    parsed.noseShape = candidate.noseShape
  }
  if (
    candidate?.mouthShape === 'curve' ||
    candidate?.mouthShape === 'ellipse' ||
    candidate?.mouthShape === 'rounded' ||
    candidate?.mouthShape === 'rounded-triangle'
  ) {
    parsed.mouthShape = candidate.mouthShape
  }
  if (typeof candidate?.mouthEnabled === 'boolean') parsed.mouthEnabled = candidate.mouthEnabled
  if (typeof candidate?.noseEnabled === 'boolean') parsed.noseEnabled = candidate.noseEnabled
  return parsed
}

export const applyAvatarEyeDefaults = (
  expression: Expression,
  eyes: AvatarEyeDefaults = defaultAvatarEyes
): Expression => {
  const result = { ...expression }
  eyeNumericDefaultFields.forEach(field => {
    result[field] = expression[field] + eyes[field] - defaultAvatarEyes[field]
  })
  mouthNumericDefaultFields.forEach(field => {
    result[field] =
      expression.mouthShape === undefined
        ? eyes[field]
        : expression[field] + eyes[field] - defaultAvatarEyes[field]
  })
  if (expression.eyeShape !== undefined || eyes.eyeShape !== defaultAvatarEyes.eyeShape) {
    result.eyeShape = expression.eyeShape ?? eyes.eyeShape
  }
  if (
    expression.mouthEnabled !== undefined ||
    eyes.mouthEnabled !== defaultAvatarEyes.mouthEnabled
  ) {
    result.mouthEnabled = expression.mouthEnabled ?? eyes.mouthEnabled
  }
  if (expression.mouthShape !== undefined || eyes.mouthShape !== defaultAvatarEyes.mouthShape) {
    result.mouthShape = expression.mouthShape ?? eyes.mouthShape
  }
  result.noseEnabled = eyes.noseEnabled
  result.noseShape = eyes.noseShape
  result.widthLeft = Math.max(10, result.widthLeft)
  result.widthRight = Math.max(10, result.widthRight)
  result.heightLeft = Math.max(10, result.heightLeft)
  result.heightRight = Math.max(10, result.heightRight)
  return result
}

const materializeInheritedMouth = (expression: Expression, eyes: AvatarEyeDefaults): Expression => {
  if (expression.mouthShape !== undefined) return expression
  const result = { ...expression, mouthShape: eyes.mouthShape }
  mouthNumericDefaultFields.forEach(field => {
    result[field] = defaultAvatarEyes[field]
  })
  return result
}

export const prepareMouthTransition = (
  from: Expression,
  to: Expression,
  eyes: AvatarEyeDefaults = defaultAvatarEyes
): { from: Expression; to: Expression; changesShape: boolean } => {
  const fromShape = from.mouthShape ?? eyes.mouthShape
  const toShape = to.mouthShape ?? eyes.mouthShape
  return {
    from: materializeInheritedMouth(from, eyes),
    to: materializeInheritedMouth(to, eyes),
    changesShape: fromShape !== toShape,
  }
}

export const overrideExpressionMouthNumeric = (
  expression: Expression,
  eyes: AvatarEyeDefaults,
  field: (typeof mouthNumericDefaultFields)[number],
  value: number
): Expression => {
  const result = materializeInheritedMouth(expression, eyes)
  return {
    ...result,
    [field]: value - eyes[field] + defaultAvatarEyes[field],
  }
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
    if (typeof candidate.blinking === 'boolean') parsed.blinking = candidate.blinking
    if (candidate.eyeShape === 'rounded' || candidate.eyeShape === 'ellipse') {
      parsed.eyeShape = candidate.eyeShape
    }
    if (typeof candidate.mouthEnabled === 'boolean') parsed.mouthEnabled = candidate.mouthEnabled
    if (
      candidate.mouthShape === 'curve' ||
      candidate.mouthShape === 'ellipse' ||
      candidate.mouthShape === 'rounded' ||
      candidate.mouthShape === 'rounded-triangle'
    ) {
      parsed.mouthShape = candidate.mouthShape
    }
    if (typeof candidate.noseEnabled === 'boolean') parsed.noseEnabled = candidate.noseEnabled
    if (
      candidate.noseShape === 'ellipse' ||
      candidate.noseShape === 'inverted-triangle' ||
      candidate.noseShape === 'rounded'
    ) {
      parsed.noseShape = candidate.noseShape
    }
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
  if (!Array.isArray(candidate.expressions)) return undefined
  const expressions = candidate.expressions.length ? parseExpressions(candidate.expressions) : []
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
    const avatars = parsed.avatars
      .filter(avatar => {
        if (!avatar || typeof avatar.id !== 'string' || typeof avatar.name !== 'string')
          return false
        if (seenIds.has(avatar.id)) return false
        seenIds.add(avatar.id)
        return true
      })
      .map(avatar => {
        const behavior = parseAvatarBehavior(avatar.behavior, baseBehavior)
        return {
          id: avatar.id,
          name: avatar.name,
          body: parseAvatarBody(avatar.body, surfacePresets.sphere),
          colors: parseColors(avatar.colors),
          eyes: parseAvatarEyeDefaults(avatar.eyes),
          renderStyle: parseAvatarRenderStyle(avatar.renderStyle),
          ...(behavior ? { behavior } : {}),
        }
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
