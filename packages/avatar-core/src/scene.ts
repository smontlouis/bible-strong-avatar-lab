import type {
  AvatarBodyDefinition,
  AvatarDefinition,
  AvatarExpressionDefinition,
  ExpressionKey,
} from './avatarDefinition'
import type { AvatarBody } from './body'
import { poseFromExpression, renderAvatar, type AvatarGeometry, type Expression } from './geometry'

export const expressionFromDefinition = (
  key: ExpressionKey,
  expression: AvatarExpressionDefinition
): Expression => ({
  id: key,
  semanticKey: key,
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

export const bodyFromDefinition = (body: AvatarBodyDefinition): AvatarBody => ({
  primary: { ...body.primary },
  nodes: body.nodes.map((node, index) => ({
    id: `runtime-node-${index}`,
    name: `Runtime node ${index + 1}`,
    surface: { ...node.surface },
    position: [...node.position],
    rotation: [...node.rotation],
    ...(node.color ? { color: node.color } : {}),
  })),
})

export type AvatarScene = {
  geometry: AvatarGeometry
  colors: { body: string; eyes: string }
  /** Custom colors keyed by runtime node id; absent nodes inherit the body color. */
  nodeColors: Record<string, string>
}

export const renderAvatarExpression = (
  definition: Readonly<AvatarDefinition>,
  expression: Expression,
  colors: { body?: string; eyes?: string } = {},
  blink = 1
): AvatarScene => {
  const body = bodyFromDefinition(definition.body)
  const nodeColors: Record<string, string> = {}
  body.nodes.forEach(node => {
    if (node.color) nodeColors[node.id] = node.color
  })
  return {
    geometry: renderAvatar(poseFromExpression(expression), body.primary, blink, {
      bodyNodes: body.nodes,
    }),
    colors: {
      body: colors.body ?? expression.bodyColor ?? definition.colors.body,
      eyes: colors.eyes ?? expression.eyeColor ?? definition.colors.eyes,
    },
    nodeColors,
  }
}

export const renderAvatarDefinition = (
  definition: Readonly<AvatarDefinition>,
  expressionKey: ExpressionKey = 'neutral'
): AvatarScene => {
  const publicExpression = definition.expressions[expressionKey]
  if (!publicExpression) throw new Error(`Unknown expression '${expressionKey}'`)
  const expression = expressionFromDefinition(expressionKey, publicExpression)
  return renderAvatarExpression(definition, expression, publicExpression.colors)
}
