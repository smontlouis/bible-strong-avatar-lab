import {
  getStatePlaybackConfig,
  initialExpressions,
  stateGroups,
  stateNotes,
  statePools,
} from '../avatar/presets'
import type { Expression } from '../avatar/geometry'

export type SequencePlaybackMode = 'loop' | 'once' | 'pingPong'
export type SequenceTransition = 'spring' | 'gentleSpring' | 'smooth' | 'snappy'

export type SequenceStep = {
  id: string
  expressionId: string
  holdMs: number
  transitionMs: number
  transition: SequenceTransition
}

export type BlinkSettings = {
  enabled: boolean
  initialDelayMs: number
  minIntervalMs: number
  maxIntervalMs: number
  durationMs: number
}

export type AvatarSequence = {
  id: string
  semanticKey?: string
  name: string
  group: string
  description: string
  builtIn: boolean
  playbackMode: SequencePlaybackMode
  steps: SequenceStep[]
  blink: BlinkSettings
}

export type SequenceCursor = {
  index: number
  direction: 1 | -1
  complete: boolean
}

const playbackModes: SequencePlaybackMode[] = ['loop', 'once', 'pingPong']
const transitions: SequenceTransition[] = ['spring', 'gentleSpring', 'smooth', 'snappy']
const builtInSequenceIds = new Set<string>(Object.values(stateGroups).flat())

const finite = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : fallback

const createId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`

const cloneSequence = (sequence: AvatarSequence): AvatarSequence => ({
  ...sequence,
  steps: sequence.steps.map(step => ({ ...step })),
  blink: { ...sequence.blink },
})

export const createInitialSequences = (): AvatarSequence[] =>
  Object.entries(stateGroups).flatMap(([group, stateIds]) =>
    stateIds.map(id => {
      const playback = getStatePlaybackConfig(id)
      return {
        id,
        semanticKey: id,
        name: id,
        group,
        description:
          stateNotes[id] ?? 'Cette animation enchaîne un pool de presets et des clignements.',
        builtIn: true,
        playbackMode: 'loop',
        steps: (statePools[id] ?? [0]).map((expressionIndex, index) => ({
          id: `${id}-step-${index}`,
          expressionId: initialExpressions[expressionIndex]?.id ?? initialExpressions[0].id,
          holdMs: playback.expressionIntervalMs,
          transitionMs: id === 'joyful' ? 700 : 500,
          transition: id === 'joyful' ? 'gentleSpring' : 'smooth',
        })),
        blink: { enabled: id !== 'joyful', ...playback.blink },
      }
    })
  )

const parseStep = (value: unknown, fallback: SequenceStep): SequenceStep => {
  const candidate = value as Partial<SequenceStep> | null
  return {
    id: typeof candidate?.id === 'string' ? candidate.id : createId('step'),
    expressionId:
      typeof candidate?.expressionId === 'string' && candidate.expressionId
        ? candidate.expressionId
        : fallback.expressionId,
    holdMs: finite(candidate?.holdMs, fallback.holdMs, 100, 60000),
    transitionMs: finite(candidate?.transitionMs, fallback.transitionMs, 0, 5000),
    transition: transitions.includes(candidate?.transition as SequenceTransition)
      ? (candidate?.transition as SequenceTransition)
      : fallback.transition,
  }
}

const parseSequence = (value: unknown, fallback: AvatarSequence): AvatarSequence => {
  const candidate = value as Partial<AvatarSequence> | null
  const fallbackStep = fallback.steps[0] ?? {
    id: 'fallback-step',
    expressionId: initialExpressions[0].id,
    holdMs: 3000,
    transitionMs: 500,
    transition: 'smooth' as const,
  }
  const steps = Array.isArray(candidate?.steps)
    ? candidate.steps.map(step => parseStep(step, fallbackStep))
    : fallback.steps.map(step => ({ ...step }))
  const storedBlink = candidate?.blink as Partial<BlinkSettings> | undefined
  const minIntervalMs = finite(storedBlink?.minIntervalMs, fallback.blink.minIntervalMs, 100, 60000)
  return {
    id: typeof candidate?.id === 'string' ? candidate.id : fallback.id,
    ...(typeof candidate?.semanticKey === 'string' ? { semanticKey: candidate.semanticKey } : {}),
    name:
      typeof candidate?.name === 'string' && candidate.name.trim() ? candidate.name : fallback.name,
    group:
      typeof candidate?.group === 'string' && candidate.group.trim()
        ? candidate.group
        : fallback.group,
    description:
      typeof candidate?.description === 'string' ? candidate.description : fallback.description,
    builtIn:
      typeof candidate?.builtIn === 'boolean'
        ? candidate.builtIn
        : typeof candidate?.id === 'string' && builtInSequenceIds.has(candidate.id),
    playbackMode: playbackModes.includes(candidate?.playbackMode as SequencePlaybackMode)
      ? (candidate?.playbackMode as SequencePlaybackMode)
      : fallback.playbackMode,
    steps,
    blink: {
      enabled:
        typeof storedBlink?.enabled === 'boolean' ? storedBlink.enabled : fallback.blink.enabled,
      initialDelayMs: finite(storedBlink?.initialDelayMs, fallback.blink.initialDelayMs, 0, 60000),
      minIntervalMs,
      maxIntervalMs: Math.max(
        minIntervalMs,
        finite(storedBlink?.maxIntervalMs, fallback.blink.maxIntervalMs, 100, 60000)
      ),
      durationMs: finite(storedBlink?.durationMs, fallback.blink.durationMs, 40, 3000),
    },
  }
}

export const parseSequences = (value: unknown): AvatarSequence[] => {
  const defaults = createInitialSequences()
  if (!Array.isArray(value)) return defaults
  if (!value.length) return []
  const fallback = defaults.find(sequence => sequence.id === 'idle') ?? defaults[0]
  const seen = new Set<string>()
  return value
    .map(sequence => parseSequence(sequence, fallback))
    .filter(sequence => {
      if (seen.has(sequence.id)) return false
      seen.add(sequence.id)
      return true
    })
}

export const normalizeSequencesForExpressions = (
  sequences: AvatarSequence[],
  expressions: Expression[]
) => {
  const availableIds = new Set(expressions.map(expression => expression.id))
  const fallbackId = expressions[0]?.id ?? initialExpressions[0].id
  return sequences.map(sequence => ({
    ...sequence,
    steps: (sequence.steps.length ? sequence.steps : [createSequenceStep(fallbackId)]).map(
      step => ({
        ...step,
        expressionId: availableIds.has(step.expressionId) ? step.expressionId : fallbackId,
      })
    ),
  }))
}

export const findExpressionIndex = (expressions: Expression[], expressionId: string) =>
  expressions.findIndex(expression => expression.id === expressionId)

export const readSequenceClock = () => performance.now()

export const groupSequences = (sequences: AvatarSequence[]) => {
  const groups: { name: string; sequences: AvatarSequence[] }[] = []
  const indexes = new Map<string, number>()
  sequences.forEach(sequence => {
    const existingIndex = indexes.get(sequence.group)
    if (existingIndex !== undefined) {
      groups[existingIndex].sequences.push(sequence)
      return
    }
    indexes.set(sequence.group, groups.length)
    groups.push({ name: sequence.group, sequences: [sequence] })
  })
  return groups
}

export const createSequence = (expressionId = initialExpressions[0].id): AvatarSequence => ({
  id: createId('sequence'),
  name: 'Untitled animation',
  group: 'Custom',
  description: '',
  builtIn: false,
  playbackMode: 'loop',
  steps: [
    {
      id: createId('step'),
      expressionId,
      holdMs: 3000,
      transitionMs: 500,
      transition: 'smooth',
    },
  ],
  blink: {
    enabled: true,
    initialDelayMs: 2600,
    minIntervalMs: 3400,
    maxIntervalMs: 6200,
    durationMs: 280,
  },
})

export const duplicateSequence = (source: AvatarSequence): AvatarSequence => ({
  ...cloneSequence(source),
  id: createId('sequence'),
  semanticKey: undefined,
  name: `${source.name} copy`,
  builtIn: false,
  steps: source.steps.map(step => ({ ...step, id: createId('step') })),
})

export const createSequenceStep = (expressionId: string): SequenceStep => ({
  id: createId('step'),
  expressionId,
  holdMs: 3000,
  transitionMs: 500,
  transition: 'smooth',
})

export const advanceSequenceCursor = (
  sequence: AvatarSequence,
  index: number,
  direction: 1 | -1
): SequenceCursor => {
  const lastIndex = sequence.steps.length - 1
  if (lastIndex < 0) return { index: 0, direction: 1, complete: true }
  if (sequence.playbackMode === 'once') {
    if (index >= lastIndex) return { index: lastIndex, direction: 1, complete: true }
    return { index: index + 1, direction: 1, complete: false }
  }
  if (sequence.playbackMode === 'pingPong' && lastIndex > 0) {
    if (direction === 1 && index >= lastIndex)
      return { index: lastIndex - 1, direction: -1, complete: false }
    if (direction === -1 && index <= 0) return { index: 1, direction: 1, complete: false }
    return { index: index + direction, direction, complete: false }
  }
  return { index: index >= lastIndex ? 0 : index + 1, direction: 1, complete: false }
}

export const remapSequencesAfterExpressionDelete = (
  sequences: AvatarSequence[],
  deletedExpressionId: string,
  fallbackExpressionId: string
) =>
  sequences.map(sequence => {
    const steps = sequence.steps.filter(step => step.expressionId !== deletedExpressionId)
    return {
      ...sequence,
      steps: steps.length ? steps : [createSequenceStep(fallbackExpressionId)],
    }
  })

export const getSequenceSpring = (
  transition: SequenceTransition,
  durationMs: number,
  baseSpeed: number
) => {
  const durationFactor = Math.min(Math.max(500 / Math.max(durationMs, 100), 0.35), 3)
  const styleFactor =
    transition === 'smooth'
      ? 0.72
      : transition === 'snappy'
        ? 1.45
        : transition === 'gentleSpring'
          ? 0.9
          : 1
  const speed = Math.max(baseSpeed * durationFactor * styleFactor, 0.5)
  return {
    stiffness: 70 + speed * 24,
    damping:
      (17 + speed * 1.7) *
      (transition === 'smooth' ? 1.18 : transition === 'gentleSpring' ? 1.2 : 1),
  }
}

export const scaleSpringDynamics = (
  spring: Readonly<{ stiffness: number; damping: number }>,
  timeScale: number
) => {
  const boundedTimeScale = Math.max(timeScale, 0.01)
  return {
    stiffness: spring.stiffness * boundedTimeScale ** 2,
    damping: spring.damping * boundedTimeScale,
  }
}
