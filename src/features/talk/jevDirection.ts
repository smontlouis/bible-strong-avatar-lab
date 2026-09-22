import type { TalkScriptDocument, TalkScriptNode, TalkTransform } from '@/features/talk/talkScript'

export const JEV_NEUTRAL_EXPRESSION_ID = 'expression-neutral'

export type JevDirectionBeat = {
  id: string
  startOffset: number
  endOffset: number
  text: string
  previousText?: string
  nextText?: string
}

export type JevExpressionOption = {
  id: string
  label: string
}

export type JevMovementOption = {
  id: string
  label: string
  description: string
}

export type JevTransformPreset = JevMovementOption & {
  transform: TalkTransform
}

export const jevTransformPresets: JevTransformPreset[] = [
  {
    id: 'look-up',
    label: 'look up',
    description: 'Rotate the avatar upward to look above or signal curiosity and aspiration.',
    transform: { rx: 20 },
  },
  {
    id: 'look-down',
    label: 'look down',
    description:
      'Rotate the avatar downward for reflection, hesitation, sadness, or attention below.',
    transform: { rx: -18 },
  },
  {
    id: 'look-left',
    label: 'look left',
    description: 'Turn the avatar toward the left side of the stage.',
    transform: { ry: -24 },
  },
  {
    id: 'look-right',
    label: 'look right',
    description: 'Turn the avatar toward the right side of the stage.',
    transform: { ry: 24 },
  },
  {
    id: 'move-closer',
    label: 'move closer',
    description: 'Move toward the viewer for emphasis, confidence, intimacy, or a reveal.',
    transform: { tz: 110 },
  },
  {
    id: 'move-away',
    label: 'move away',
    description:
      'Move away from the viewer for caution, withdrawal, embarrassment, or perspective.',
    transform: { tz: -90 },
  },
  {
    id: 'slide-left',
    label: 'move left',
    description: 'Shift the whole avatar toward the left side of the stage.',
    transform: { tx: -50 },
  },
  {
    id: 'slide-right',
    label: 'move right',
    description: 'Shift the whole avatar toward the right side of the stage.',
    transform: { tx: 50 },
  },
]

export type JevDirectionDecision = {
  beatId: string
  expressionId: string | null
  confidence: number
  movementId: string | null
  movementConfidence: number
  intensity: number
}

export type JevDirectionRequest = {
  text: string
  beats: JevDirectionBeat[]
  expressions: JevExpressionOption[]
  movements: JevMovementOption[]
}

const scaleTransform = (transform: TalkTransform, intensity: number): TalkTransform =>
  Object.fromEntries(
    Object.entries(transform).map(([axis, value]) => [
      axis,
      Math.round(value * intensity * 100) / 100,
    ])
  )

const resetTransform: TalkTransform = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 }

const transitionDuration = (intensity: number) =>
  Math.round((260 + Math.min(Math.max(intensity, 0), 1) * 540) / 50) * 50

export const resolveJevMovementDecision = (
  decision: Pick<JevDirectionDecision, 'movementId' | 'intensity'>,
  transformPresets: JevTransformPreset[] = jevTransformPresets
) => {
  if (!decision.movementId) return null
  const preset = transformPresets.find(item => item.id === decision.movementId)
  if (!preset) return null
  const intensity = Math.min(Math.max(decision.intensity, 0.2), 1)
  return {
    id: preset.id,
    label: preset.label,
    transform: scaleTransform(preset.transform, intensity),
    durationMs: transitionDuration(intensity),
  }
}

export type JevDirectionResponse = {
  decisions: JevDirectionDecision[]
}

const endsBeat = (token: string, wordCount: number) =>
  /[.!?…;:]$/u.test(token) || wordCount >= 8 || (wordCount >= 4 && /,$/u.test(token))

export const segmentTalkDirectionBeats = (text: string): JevDirectionBeat[] => {
  const tokens = [...text.matchAll(/\S+/gu)]
  const beats: JevDirectionBeat[] = []
  let firstTokenIndex = 0
  tokens.forEach((token, tokenIndex) => {
    const wordCount = tokenIndex - firstTokenIndex + 1
    if (!endsBeat(token[0], wordCount) && tokenIndex < tokens.length - 1) return
    const first = tokens[firstTokenIndex]
    const startOffset = first.index ?? 0
    const endOffset = (token.index ?? startOffset) + token[0].length
    beats.push({
      id: `beat-${beats.length}`,
      startOffset,
      endOffset,
      text: text.slice(startOffset, endOffset),
    })
    firstTokenIndex = tokenIndex + 1
  })
  return beats
}

const appendText = (content: TalkScriptNode[], text: string) => {
  text.split('\n').forEach((part, index, parts) => {
    if (part) content.push({ type: 'text', text: part })
    if (index < parts.length - 1) content.push({ type: 'hardBreak' })
  })
}

export const createJevDirectedTalkDocument = (
  text: string,
  beats: JevDirectionBeat[],
  decisions: JevDirectionDecision[],
  expressions: JevExpressionOption[],
  transformPresets: JevTransformPreset[] = jevTransformPresets
): TalkScriptDocument => {
  const expressionById = new Map(expressions.map(expression => [expression.id, expression]))
  const decisionByBeatId = new Map(decisions.map(decision => [decision.beatId, decision]))
  const content: TalkScriptNode[] = []
  let offset = 0
  let previousExpressionId = JEV_NEUTRAL_EXPRESSION_ID
  let previousMovement: { id: string; intensity: number } | null = null
  const transformById = new Map(transformPresets.map(preset => [preset.id, preset]))

  beats.forEach(beat => {
    appendText(content, text.slice(offset, beat.startOffset))
    const decision = decisionByBeatId.get(beat.id)
    const expression = decision?.expressionId
      ? expressionById.get(decision.expressionId)
      : undefined
    let expressionInserted = false
    if (expression && expression.id !== previousExpressionId) {
      content.push({
        type: 'avatarCue',
        attrs: {
          kind: 'expression',
          targetId: expression.id,
          label: expression.label,
        },
      })
      previousExpressionId = expression.id
      expressionInserted = true
      previousMovement = null
    }
    const movement = decision?.movementId ? transformById.get(decision.movementId) : undefined
    if (movement) {
      const intensity = Math.min(Math.max(decision?.intensity ?? 0.6, 0.2), 1)
      const movementChanged =
        expressionInserted ||
        previousMovement?.id !== movement.id ||
        Math.abs((previousMovement?.intensity ?? 0) - intensity) >= 0.05
      if (movementChanged) {
        content.push({
          type: 'avatarCue',
          attrs: {
            kind: 'transform',
            targetId: '',
            label: movement.label,
            durationMs: transitionDuration(intensity),
            ...scaleTransform(movement.transform, intensity),
          },
        })
      }
      previousMovement = { id: movement.id, intensity }
    } else if (previousMovement) {
      if (!expressionInserted) {
        content.push({
          type: 'avatarCue',
          attrs: {
            kind: 'transform',
            targetId: '',
            label: 'reset position',
            durationMs: 400,
            ...resetTransform,
          },
        })
      }
      previousMovement = null
    }
    appendText(content, text.slice(beat.startOffset, beat.endOffset))
    offset = beat.endOffset
  })
  appendText(content, text.slice(offset))

  return { type: 'doc', content: [{ type: 'paragraph', content }] }
}
