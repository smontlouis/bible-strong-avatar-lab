import {
  validateAvatarDefinition,
  type AvatarAnimationDefinition,
  type AvatarDefinition,
  type AvatarExpressionDefinition,
} from '@bible-strong/avatar-core'

import type { AvatarSequence, SequenceStep } from '../animation/sequences'
import type { StudioAvatar } from './avatars'
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

const toExpression = (
  slug: string,
  semanticKey: string,
  expression: AvatarExpressionDefinition
): Expression => ({
  id: `expression-${slug}-${semanticKey}`,
  semanticKey,
  headX: expression.head.x,
  headY: expression.head.y,
  headZ: expression.head.z,
  widthLeft: expression.eyes.left.width,
  widthRight: expression.eyes.right.width,
  heightLeft: expression.eyes.left.height,
  heightRight: expression.eyes.right.height,
  spacing: expression.eyes.spacing,
  positionXLeft: expression.eyes.left.x,
  positionXRight: expression.eyes.right.x,
  positionYLeft: expression.eyes.left.y,
  positionYRight: expression.eyes.right.y,
  leftAngle: expression.eyes.left.angle,
  rightAngle: expression.eyes.right.angle,
  perspective: expression.perspective,
  eyeMotion: expression.motion.eyes,
  bodyMotion: expression.motion.body,
  ...(expression.colors?.body ? { bodyColor: expression.colors.body } : {}),
  ...(expression.colors?.eyes ? { eyeColor: expression.colors.eyes } : {}),
})

const toSequence = (
  slug: string,
  semanticKey: string,
  animation: AvatarAnimationDefinition,
  expressionIdByKey: Map<string, string>
): AvatarSequence => {
  const steps: SequenceStep[] = []
  animation.steps.forEach((step, index) => {
    const expressionId = expressionIdByKey.get(step.expression)
    // A step pointing at an expression the definition never declared cannot be
    // represented; dropping it keeps the sequence playable.
    if (!expressionId) return
    steps.push({
      id: `step-${slug}-${semanticKey}-${index}`,
      expressionId,
      holdMs: step.holdMs,
      transitionMs: step.transitionMs,
      transition: step.transition,
    })
  })
  return {
    id: `sequence-${slug}-${semanticKey}`,
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

/** Throws when the file is not a valid v1 avatar definition. */
export const studioAvatarFromDefinition = (value: unknown): ImportedAvatarDefinition => {
  const result = validateAvatarDefinition(value)
  if (!result.ok) {
    const first = result.errors[0]
    throw new Error(first ? `${first.path}: ${first.message}` : 'Invalid avatar definition')
  }
  const definition: AvatarDefinition = result.value
  const slug = slugify(definition.name ?? 'avatar')

  // `neutral` is reserved: the studio does not keep it as an editable expression,
  // it lives on the avatar as eye defaults and is re-emitted on export.
  const keys = definition.expressionOrder.filter(
    key => key !== 'neutral' && definition.expressions[key]
  )
  const expressions = keys.map(key => toExpression(slug, key, definition.expressions[key]!))
  const expressionIdByKey = new Map(keys.map((key, i) => [key, expressions[i]!.id]))

  const sequences = definition.animationOrder
    .filter(key => definition.animations[key])
    .map(key => toSequence(slug, key, definition.animations[key]!, expressionIdByKey))

  // The studio stores one flat set of eye defaults per avatar; `neutral` is the
  // resting pose, so it is the expression those defaults come from.
  const neutral = definition.expressions.neutral
  const avatar: StudioAvatar = {
    id: `avatar-${slug}-${definition.body.nodes.length}-${expressions.length}`,
    name: definition.name ?? slug,
    body: {
      primary: definition.body.primary,
      // Definition nodes are anonymous; the studio addresses them by id in the editor.
      nodes: definition.body.nodes.map((node, index) => ({
        id: `shape-${slug}-${index}`,
        name: `${node.surface.type} ${index + 1}`,
        surface: node.surface,
        position: node.position,
        rotation: node.rotation,
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
