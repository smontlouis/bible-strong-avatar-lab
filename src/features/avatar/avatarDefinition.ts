import {
  getSemanticKeyIssue,
  validateAvatarDefinition,
  type AvatarAnimationDefinition,
  type AvatarBodyNodeDefinition,
  type AvatarDefinition,
  type AvatarDefinitionError,
  type AvatarExpressionDefinition,
  type BodyNodeSurfaceType,
  type HexColor,
  type SurfaceDefinition,
  type ValidationResult,
} from '@bible-strong/avatar-core'
import type { SurfaceType } from '@bible-strong/avatar-core'

import { applyAvatarEyeDefaults, type AvatarBehaviorLibrary, type StudioAvatar } from './avatars'
import { defaultExpression } from './presets'
import type { Expression } from './geometry'

export * from '@bible-strong/avatar-core'

const mapSurface = <TType extends SurfaceType>(
  surface: SurfaceDefinition<TType>
): SurfaceDefinition<TType> => ({
  type: surface.type,
  width: surface.width,
  height: surface.height,
  depth: surface.depth,
  roundness: surface.roundness,
  ...(surface.morphRoundness === undefined ? {} : { morphRoundness: surface.morphRoundness }),
  ...(surface.tipRoundness === undefined ? {} : { tipRoundness: surface.tipRoundness }),
  ...(surface.baseRoundness === undefined ? {} : { baseRoundness: surface.baseRoundness }),
  ...(surface.topScale === undefined ? {} : { topScale: surface.topScale }),
  ...(surface.cutAngle === undefined ? {} : { cutAngle: surface.cutAngle }),
})

const mapExpression = (expression: Expression): AvatarExpressionDefinition => ({
  head: { x: expression.headX, y: expression.headY, z: expression.headZ },
  eyes: {
    left: {
      width: expression.widthLeft,
      height: expression.heightLeft,
      curvature: expression.curvatureLeft,
      x: expression.positionXLeft,
      y: expression.positionYLeft,
      angle: expression.leftAngle,
    },
    right: {
      width: expression.widthRight,
      height: expression.heightRight,
      curvature: expression.curvatureRight,
      x: expression.positionXRight,
      y: expression.positionYRight,
      angle: expression.rightAngle,
    },
    spacing: expression.spacing,
  },
  perspective: expression.perspective,
  motion: { eyes: expression.eyeMotion, body: expression.bodyMotion },
  ...(expression.bodyColor || expression.eyeColor
    ? {
        colors: {
          ...(expression.bodyColor ? { body: expression.bodyColor as HexColor } : {}),
          ...(expression.eyeColor ? { eyes: expression.eyeColor as HexColor } : {}),
        },
      }
    : {}),
})

const semanticKeyError = (
  path: string,
  kind: 'expression' | 'animation',
  semanticKey: string | undefined,
  seen: Set<string>
): AvatarDefinitionError | undefined => {
  const issue = getSemanticKeyIssue(semanticKey, kind)
  if (issue === 'missing_semantic_key') {
    return { path, code: 'missing_semantic_key', message: `${kind} semantic key is required` }
  }
  if (issue === 'invalid_semantic_key') {
    return { path, code: 'invalid_semantic_key', message: `Invalid semantic key '${semanticKey}'` }
  }
  if (issue === 'reserved_semantic_key') {
    return { path, code: 'reserved_semantic_key', message: "'neutral' is reserved" }
  }
  if (semanticKey === undefined) {
    return { path, code: 'missing_semantic_key', message: `${kind} semantic key is required` }
  }
  if (seen.has(semanticKey)) {
    return {
      path,
      code: 'duplicate_semantic_key',
      message: `Duplicate semantic key '${semanticKey}'`,
    }
  }
  seen.add(semanticKey)
  return undefined
}

export const createAvatarDefinition = ({
  avatar,
  behavior,
}: {
  avatar: StudioAvatar
  behavior: AvatarBehaviorLibrary
}): ValidationResult<AvatarDefinition> => {
  const errors: AvatarDefinitionError[] = []
  const expressionKeys = new Set<string>()
  const animationKeys = new Set<string>()
  const expressionKeyById = new Map<string, string>()

  behavior.expressions.forEach((expression, index) => {
    const error = semanticKeyError(
      `/studio/expressions/${index}/semanticKey`,
      'expression',
      expression.semanticKey,
      expressionKeys
    )
    if (error) errors.push(error)
    else expressionKeyById.set(expression.id, expression.semanticKey!)
  })
  behavior.sequences.forEach((sequence, index) => {
    const error = semanticKeyError(
      `/studio/animations/${index}/semanticKey`,
      'animation',
      sequence.semanticKey,
      animationKeys
    )
    if (error) errors.push(error)
    sequence.steps.forEach((step, stepIndex) => {
      if (!expressionKeyById.has(step.expressionId)) {
        errors.push({
          path: `/studio/animations/${index}/steps/${stepIndex}/expressionId`,
          code: 'unresolved_expression_reference',
          message: `Animation step references unexportable expression '${step.expressionId}'`,
        })
      }
    })
  })
  if (errors.length) return { ok: false, errors }

  const expressions: Record<string, AvatarExpressionDefinition> = {
    neutral: mapExpression(applyAvatarEyeDefaults(defaultExpression, avatar.eyes)),
  }
  behavior.expressions.forEach(expression => {
    expressions[expression.semanticKey!] = mapExpression(
      applyAvatarEyeDefaults(expression, avatar.eyes)
    )
  })
  const animations: Record<string, AvatarAnimationDefinition> = Object.fromEntries(
    behavior.sequences.map(sequence => [
      sequence.semanticKey!,
      {
        playbackMode: sequence.playbackMode,
        steps: sequence.steps.map(step => ({
          expression: expressionKeyById.get(step.expressionId)!,
          holdMs: step.holdMs,
          transitionMs: step.transitionMs,
          transition: step.transition,
        })),
        blink: { ...sequence.blink },
        metadata: {
          label: sequence.name,
          description: sequence.description,
          group: sequence.group,
        },
      },
    ])
  )
  const definition: AvatarDefinition = {
    schema: 'bible-strong/avatar-definition',
    schemaVersion: 1,
    ...(avatar.name ? { name: avatar.name } : {}),
    body: {
      primary: mapSurface(avatar.body.primary),
      nodes: avatar.body.nodes.map((node): AvatarBodyNodeDefinition => ({
        ...(node.layer ? { layer: node.layer } : {}),
        ...(node.color ? { color: node.color as HexColor } : {}),
        surface: mapSurface(node.surface as SurfaceDefinition<BodyNodeSurfaceType>),
        position: [...node.position],
        rotation: [...node.rotation],
      })),
    },
    colors: {
      body: avatar.colors.body as HexColor,
      eyes: avatar.colors.eyes as HexColor,
    },
    expressions,
    expressionOrder: [
      'neutral',
      ...behavior.expressions.map(expression => expression.semanticKey!),
    ],
    animations,
    animationOrder: behavior.sequences.map(sequence => sequence.semanticKey!),
  }
  return validateAvatarDefinition(definition)
}
