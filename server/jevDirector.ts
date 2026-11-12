import { experimental_evaluate as evaluate, type Experimental_EvaluationQuestion } from 'ai'

import type {
  JevDirectionRequest,
  JevDirectionResponse,
} from '../src/features/talk/jevDirection.ts'

const maximumTextLength = 12_000
const maximumBeats = 40
const maximumExpressions = 64
const maximumMovements = 24

const isString = (value: unknown): value is string => typeof value === 'string'

type JevAnswer =
  | { type: 'choice'; choice: string; probabilities?: Record<string, number> }
  | { type: 'score'; score: number; probabilities?: Record<string, number> }

type JevState = Parameters<typeof evaluate>[0]['state']

const evaluateWithRecovery = async (
  state: JevState,
  questions: Record<string, Experimental_EvaluationQuestion>
) => {
  try {
    const result = await evaluate({ model: 'typesafe-ai/jev', state, questions })
    return result.answers as Record<string, JevAnswer | undefined>
  } catch {
    const recovered: Record<string, JevAnswer | undefined> = {}
    await Promise.all(
      Object.entries(questions).map(async ([key, question]) => {
        try {
          const result = await evaluate({
            model: 'typesafe-ai/jev',
            state,
            questions: { [key]: question },
            maxRetries: 0,
          })
          recovered[key] = result.answers[key] as JevAnswer | undefined
        } catch {
          recovered[key] = undefined
        }
      })
    )
    return recovered
  }
}

const parseRequest = (value: unknown): JevDirectionRequest => {
  const candidate = value as Partial<JevDirectionRequest> | null
  if (!candidate || !isString(candidate.text) || !candidate.text.trim()) {
    throw new Error('A non-empty dialogue is required.')
  }
  if (candidate.text.length > maximumTextLength) throw new Error('The dialogue is too long.')
  if (!Array.isArray(candidate.beats) || candidate.beats.length > maximumBeats) {
    throw new Error('The dialogue contains too many beats.')
  }
  if (!Array.isArray(candidate.expressions) || candidate.expressions.length > maximumExpressions) {
    throw new Error('The expression library is invalid.')
  }
  if (!Array.isArray(candidate.movements) || candidate.movements.length > maximumMovements) {
    throw new Error('The movement library is invalid.')
  }
  const beats = candidate.beats.filter(
    beat =>
      beat &&
      isString(beat.id) &&
      isString(beat.text) &&
      Number.isInteger(beat.startOffset) &&
      Number.isInteger(beat.endOffset) &&
      beat.startOffset >= 0 &&
      beat.endOffset > beat.startOffset &&
      beat.endOffset <= candidate.text!.length
  )
  const expressions = candidate.expressions.filter(
    expression => expression && isString(expression.id) && isString(expression.label)
  )
  const movements = candidate.movements.filter(
    movement =>
      movement &&
      isString(movement.id) &&
      isString(movement.label) &&
      isString(movement.description)
  )
  if (!beats.length || !expressions.length || !movements.length) {
    throw new Error('No beats, expressions, or movements to direct.')
  }
  return { text: candidate.text, beats, expressions, movements }
}

export const directDialogueWithJev = async (input: unknown): Promise<JevDirectionResponse> => {
  const request = parseRequest(input)
  const expressionByKey = new Map<string, string | null>()
  const expressionCriteria: Record<string, string> = {}
  request.expressions.forEach((expression, index) => {
    const neutral = expression.id === 'expression-neutral'
    const key = neutral ? 'neutral' : `expression_${index}`
    expressionByKey.set(key, expression.id)
    expressionCriteria[key] = neutral
      ? 'No visible emotion. Use for connective, factual, or emotionally flat speech.'
      : expression.label.replaceAll('-', ' ')
  })
  const movementByKey = new Map<string, string | null>([['none', null]])
  const movementCriteria: Record<string, string> = {
    none: 'No spatial movement. Prefer this unless movement clearly improves the delivery.',
  }
  request.movements.forEach((movement, index) => {
    const key = `movement_${index}`
    movementByKey.set(key, movement.id)
    movementCriteria[key] = `${movement.label}: ${movement.description}`
  })
  const questions: Record<string, Experimental_EvaluationQuestion> = {}
  request.beats.forEach((beat, index) => {
    const previous = request.beats[index - 1]?.text ?? '(start of dialogue)'
    const previousContext = beat.previousText ?? previous
    const next = beat.nextText ?? request.beats[index + 1]?.text ?? '(end of dialogue)'
    const context = `Previous context: “${previousContext}”\nTARGET BEAT (${index + 1}/${request.beats.length}): “${beat.text}”\nNext context: “${next}”`
    questions[`${beat.id}:expression`] = {
      type: 'choice',
      instructions: `Considering the complete dialogue and this local context, choose only the best facial expression for the target beat. ${context}`,
      criteria: expressionCriteria,
    }
    questions[`${beat.id}:movement`] = {
      type: 'choice',
      instructions: `Considering the complete dialogue and this local context, choose only the best independent stage movement for the target beat. Expression and movement are separate. Prefer none when movement is not useful. ${context}`,
      criteria: movementCriteria,
    }
    questions[`${beat.id}:intensity`] = {
      type: 'score',
      instructions: `Rate how strong the selected stage movement should be for the target beat. Use the lowest value when no movement is appropriate. ${context}`,
      criteria: [
        'none or nearly imperceptible',
        'very subtle',
        'subtle',
        'clear',
        'strong and emphatic',
      ],
    }
  })
  const answers = await evaluateWithRecovery(
    {
      dialogue: request.text,
      beats: request.beats.map(beat => ({ id: beat.id, text: beat.text })),
    },
    questions
  )
  return {
    decisions: request.beats.map(beat => {
      const expressionAnswer = answers[`${beat.id}:expression`]
      const movementAnswer = answers[`${beat.id}:movement`]
      const intensityAnswer = answers[`${beat.id}:intensity`]
      const expressionChoice =
        expressionAnswer?.type === 'choice' ? expressionAnswer.choice : 'neutral'
      const movementChoice = movementAnswer?.type === 'choice' ? movementAnswer.choice : 'none'
      const rawIntensity = intensityAnswer?.type === 'score' ? intensityAnswer.score / 4 : 0
      return {
        beatId: beat.id,
        expressionId: expressionByKey.get(expressionChoice) ?? null,
        confidence:
          expressionAnswer?.type === 'choice'
            ? (expressionAnswer.probabilities?.[expressionChoice] ?? 0)
            : 0,
        movementId: movementByKey.get(movementChoice) ?? null,
        movementConfidence:
          movementAnswer?.type === 'choice'
            ? (movementAnswer.probabilities?.[movementChoice] ?? 0)
            : 0,
        intensity: Math.min(Math.max(0.2 + rawIntensity * 0.8, 0.2), 1),
      }
    }),
  }
}

export const jsonError = (error: unknown) => ({
  error: error instanceof Error ? error.message : 'Jev could not direct this dialogue.',
})
