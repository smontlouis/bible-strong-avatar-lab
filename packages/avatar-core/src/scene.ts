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
  positionX: expression.position?.x ?? 0,
  positionY: expression.position?.y ?? 0,
  positionZ: expression.position?.z ?? 0,
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
  eyeShape: expression.eyes.shape ?? 'rounded',
  eyeRoundness: expression.eyes.roundness ?? 100,
  mouthEnabled: expression.mouth?.enabled ?? false,
  mouthShape: expression.mouth?.shape ?? 'curve',
  mouthCurve: expression.mouth?.curve ?? 45,
  mouthWidth: expression.mouth?.width ?? 20,
  mouthHeight: expression.mouth?.height ?? 6,
  mouthX: expression.mouth?.x ?? 0,
  mouthY: expression.mouth?.y ?? 35,
  mouthAngle: expression.mouth?.angle ?? 0,
  noseEnabled: expression.nose?.enabled ?? false,
  noseShape: expression.nose?.shape ?? 'inverted-triangle',
  noseRoundness: expression.nose?.roundness ?? 50,
  noseWidth: expression.nose?.width ?? 14,
  noseHeight: expression.nose?.height ?? 11,
  noseX: expression.nose?.x ?? 0,
  noseY: expression.nose?.y ?? 22,
  noseAngle: expression.nose?.angle ?? 0,
  perspective: expression.perspective,
  blinking: expression.blinking ?? false,
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
    ...(node.color ? { color: node.color } : {}),
    surface: { ...node.surface },
    position: [...node.position],
    rotation: [...node.rotation],
  })),
})

export type AvatarScene = {
  geometry: AvatarGeometry
  colors: { body: string; eyes: string }
  bodyColors: { back: string[]; front: string[] }
}

export const renderAvatarExpression = (
  definition: Readonly<AvatarDefinition>,
  expression: Expression,
  colors: { body?: string; eyes?: string } = {},
  blink = 1
): AvatarScene => {
  const body = bodyFromDefinition(definition.body)
  const bodyColor = colors.body ?? expression.bodyColor ?? definition.colors.body
  // A node of another colour than the body sinks into the head where the head is nearer. A
  // node of the body's colour is not measured: it costs what it always did.
  const geometry = renderAvatar(poseFromExpression(expression), body.primary, blink, {
    bodyNodes: body.nodes,
    nodeOcclusion: 'mask',
    bodyColor,
  })
  const nodeColors = new Map(body.nodes.map(node => [node.id, node.color ?? bodyColor]))
  return {
    geometry,
    colors: {
      body: bodyColor,
      eyes: colors.eyes ?? expression.eyeColor ?? definition.colors.eyes,
    },
    bodyColors: {
      back: geometry.backNodeIds.map(id => (id ? (nodeColors.get(id) ?? bodyColor) : bodyColor)),
      front: geometry.frontNodeIds.map(id => (id ? (nodeColors.get(id) ?? bodyColor) : bodyColor)),
    },
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
