import {
  parseAvatarDefinition,
  validateAvatarDefinition,
  type AvatarAnimationDefinition,
  type AvatarDefinition,
  type AvatarExpressionDefinition,
} from '@bible-strong/avatar-core'

import {
  NEUTRAL_EXPRESSION_ID,
  type AvatarSequence,
  type SequenceStep,
} from '../animation/sequences'
import { defaultAvatarEyes, type StudioAvatar } from './avatars'
import type { Expression } from './geometry'

/**
 * Reads a `.avatar.json` runtime definition back into studio state.
 *
 * This is the inverse of `createAvatarDefinition`: the definition keys expressions
 * by semantic key with nested head/eyes objects, while the studio keeps a flat
 * `Expression` record carrying its own id. Keep this in sync with `mapExpression`
 * in ./avatarDefinition.ts — the two must round-trip.
 */

const AVATAR_DEFINITION_SCHEMA = 'bible-strong/avatar-definition'

export const isAvatarDefinitionSource = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as { schema?: unknown }).schema === AVATAR_DEFINITION_SCHEMA

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'avatar'

const createImportId = (slug: string) =>
  `${slug}-${
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`

const relativeEyeValue = (value: number, neutral: number, fallback: number) =>
  value - neutral + fallback

const toExpression = (
  importId: string,
  semanticKey: string,
  expression: AvatarExpressionDefinition,
  neutral: AvatarExpressionDefinition
): Expression => ({
  id: `expression-${importId}-${semanticKey}`,
  semanticKey,
  headX: expression.head.x,
  headY: expression.head.y,
  headZ: expression.head.z,
  widthLeft: relativeEyeValue(
    expression.eyes.left.width,
    neutral.eyes.left.width,
    defaultAvatarEyes.widthLeft
  ),
  widthRight: relativeEyeValue(
    expression.eyes.right.width,
    neutral.eyes.right.width,
    defaultAvatarEyes.widthRight
  ),
  heightLeft: relativeEyeValue(
    expression.eyes.left.height,
    neutral.eyes.left.height,
    defaultAvatarEyes.heightLeft
  ),
  heightRight: relativeEyeValue(
    expression.eyes.right.height,
    neutral.eyes.right.height,
    defaultAvatarEyes.heightRight
  ),
  spacing: relativeEyeValue(
    expression.eyes.spacing,
    neutral.eyes.spacing,
    defaultAvatarEyes.spacing
  ),
  positionXLeft: relativeEyeValue(
    expression.eyes.left.x,
    neutral.eyes.left.x,
    defaultAvatarEyes.positionXLeft
  ),
  positionXRight: relativeEyeValue(
    expression.eyes.right.x,
    neutral.eyes.right.x,
    defaultAvatarEyes.positionXRight
  ),
  positionYLeft: relativeEyeValue(
    expression.eyes.left.y,
    neutral.eyes.left.y,
    defaultAvatarEyes.positionYLeft
  ),
  positionYRight: relativeEyeValue(
    expression.eyes.right.y,
    neutral.eyes.right.y,
    defaultAvatarEyes.positionYRight
  ),
  leftAngle: relativeEyeValue(
    expression.eyes.left.angle,
    neutral.eyes.left.angle,
    defaultAvatarEyes.leftAngle
  ),
  rightAngle: relativeEyeValue(
    expression.eyes.right.angle,
    neutral.eyes.right.angle,
    defaultAvatarEyes.rightAngle
  ),
  perspective: expression.perspective,
  eyeMotion: expression.motion.eyes,
  bodyMotion: expression.motion.body,
  ...(expression.colors?.body ? { bodyColor: expression.colors.body } : {}),
  ...(expression.colors?.eyes ? { eyeColor: expression.colors.eyes } : {}),
})

const toSequence = (
  importId: string,
  semanticKey: string,
  animation: AvatarAnimationDefinition,
  expressionIdByKey: Map<string, string>
): AvatarSequence => {
  const steps: SequenceStep[] = []
  animation.steps.forEach((step, index) => {
    const expressionId =
      step.expression === 'neutral' ? NEUTRAL_EXPRESSION_ID : expressionIdByKey.get(step.expression)
    // Validation guarantees that non-neutral references resolve.
    if (!expressionId) throw new Error(`Unknown expression '${step.expression}'`)
    steps.push({
      id: `step-${importId}-${semanticKey}-${index}`,
      expressionId,
      holdMs: step.holdMs,
      transitionMs: step.transitionMs,
      transition: step.transition,
    })
  })
  return {
    id: `sequence-${importId}-${semanticKey}`,
    semanticKey,
    name: animation.metadata?.label ?? semanticKey,
    group: animation.metadata?.group ?? 'Importé',
    description: animation.metadata?.description ?? '',
    builtIn: false,
    playbackMode: animation.playbackMode,
    steps,
    blink: animation.blink,
  }
}

export type ImportedAvatarDefinition = {
  avatar: StudioAvatar
  expressions: Expression[]
  sequences: AvatarSequence[]
}

const assertRepresentableNeutral = (neutral: AvatarExpressionDefinition) => {
  const canonical =
    neutral.head.x === 0 &&
    neutral.head.y === 0 &&
    neutral.head.z === 0 &&
    neutral.perspective === 1 &&
    neutral.motion.eyes === 'none' &&
    neutral.motion.body === 'none' &&
    neutral.colors === undefined
  if (!canonical) {
    throw new Error(
      'The neutral expression must use zero head rotation, perspective 1, no ambient motion and no color overrides.'
    )
  }
}

const assertRepresentableEyeDimensions = (definition: AvatarDefinition) => {
  Object.entries(definition.expressions).forEach(([key, expression]) => {
    const dimensions = [
      expression.eyes.left.width,
      expression.eyes.right.width,
      expression.eyes.left.height,
      expression.eyes.right.height,
    ]
    if (dimensions.some(value => value < 10)) {
      throw new Error(`Expression '${key}' uses an eye dimension below the Studio minimum of 10.`)
    }
  })
}

const formatValidationError = (errors: readonly { path: string; message: string }[]) => {
  const first = errors[0]
  return first ? `${first.path}: ${first.message}` : 'Invalid avatar definition'
}

/** Throws when the file is not a valid v1 avatar definition. */
export const studioAvatarFromDefinition = (value: unknown): ImportedAvatarDefinition => {
  const result = validateAvatarDefinition(value)
  if (!result.ok) {
    throw new Error(formatValidationError(result.errors))
  }
  const definition: AvatarDefinition = result.value
  const slug = slugify(definition.name ?? 'avatar')
  const importId = createImportId(slug)
  const neutral = definition.expressions.neutral
  assertRepresentableNeutral(neutral)
  assertRepresentableEyeDimensions(definition)

  // `neutral` is reserved: the studio does not keep it as an editable expression,
  // it lives on the avatar as eye defaults and is re-emitted on export.
  const keys = definition.expressionOrder.filter(
    key => key !== 'neutral' && definition.expressions[key]
  )
  const expressions = keys.map(key =>
    toExpression(importId, key, definition.expressions[key]!, neutral)
  )
  const expressionIdByKey = new Map(keys.map((key, i) => [key, expressions[i]!.id]))

  const sequences = definition.animationOrder
    .filter(key => definition.animations[key])
    .map(key => toSequence(importId, key, definition.animations[key]!, expressionIdByKey))

  // The studio stores one flat set of eye defaults per avatar; `neutral` is the
  // resting pose, so it is the expression those defaults come from.
  const avatar: StudioAvatar = {
    id: `avatar-${importId}`,
    name: definition.name ?? slug,
    body: {
      primary: definition.body.primary,
      // Definition nodes are anonymous; the studio addresses them by id in the editor.
      nodes: definition.body.nodes.map((node, index) => ({
        id: `shape-${importId}-${index}`,
        name: `${node.surface.type} ${index + 1}`,
        surface: node.surface,
        position: node.position,
        rotation: node.rotation,
        ...(node.color ? { color: node.color } : {}),
      })),
    },
    colors: definition.colors,
    eyes: {
      widthLeft: neutral.eyes.left.width,
      widthRight: neutral.eyes.right.width,
      heightLeft: neutral.eyes.left.height,
      heightRight: neutral.eyes.right.height,
      spacing: neutral.eyes.spacing,
      positionXLeft: neutral.eyes.left.x,
      positionXRight: neutral.eyes.right.x,
      positionYLeft: neutral.eyes.left.y,
      positionYRight: neutral.eyes.right.y,
      leftAngle: neutral.eyes.left.angle,
      rightAngle: neutral.eyes.right.angle,
    },
    renderStyle: { type: 'vector' },
    behavior: { expressions, sequences },
  }

  return { avatar, expressions, sequences }
}

/** Parses untrusted `.avatar.json` text with the core size, depth and duplicate-key limits. */
export const studioAvatarFromDefinitionSource = (source: string): ImportedAvatarDefinition => {
  const result = parseAvatarDefinition(source)
  if (!result.ok) throw new Error(formatValidationError(result.errors))
  return studioAvatarFromDefinition(result.value)
}
