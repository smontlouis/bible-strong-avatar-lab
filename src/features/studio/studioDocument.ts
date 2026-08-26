import {
  ensurePrimitiveBundledAvatars,
  parseAvatarLibrary,
  parseExpressions,
  restoreLegacyBehaviorSemanticKeys,
  type AvatarBehaviorLibrary,
  type AvatarLibrary,
} from '../avatar/avatars'
import type { Expression } from '../avatar/geometry'
import {
  normalizeSequencesForExpressions,
  parseSequences,
  type AvatarSequence,
} from '../animation/sequences'
import defaultStudioDocument from './defaultStudioDocument.json'

export type StatePlaybackSelection = { stateId: string | null; playing: boolean }

export type StudioDocument = {
  version: 2
  library: AvatarLibrary
  expressions: Expression[]
  sequences: AvatarSequence[]
  playback: StatePlaybackSelection
}

export type StudioDocumentPatch = Partial<Omit<StudioDocument, 'version'>>

const DOCUMENT_STORAGE_KEY = 'bible-strong-avatar-studio-v2'

const defaultPlayback: StatePlaybackSelection = { stateId: 'idle', playing: true }

const parsePlayback = (
  value: unknown,
  fallback: StatePlaybackSelection = defaultPlayback
): StatePlaybackSelection => {
  const candidate = value as Partial<StatePlaybackSelection> | null
  if (!candidate || (typeof candidate.stateId !== 'string' && candidate.stateId !== null)) {
    return { ...fallback }
  }
  return { stateId: candidate.stateId, playing: candidate.playing === true }
}

export const parseStudioDocument = (value: unknown, fallback: StudioDocument): StudioDocument => {
  const candidate = value as Partial<StudioDocument> | null
  if (!candidate || candidate.version !== 2) return fallback
  const expressions =
    Array.isArray(candidate.expressions) && candidate.expressions.length
      ? parseExpressions(candidate.expressions)
      : fallback.expressions
  const sequences = Array.isArray(candidate.sequences)
    ? normalizeSequencesForExpressions(parseSequences(candidate.sequences), expressions)
    : fallback.sequences
  const baseBehavior = restoreLegacyBehaviorSemanticKeys(
    { expressions, sequences },
    { expressions: fallback.expressions, sequences: fallback.sequences }
  )
  const library = parseAvatarLibrary(candidate.library, fallback.library, baseBehavior)
  return {
    version: 2,
    library,
    expressions: baseBehavior.expressions,
    sequences: baseBehavior.sequences,
    playback: parsePlayback(candidate.playback, fallback.playback),
  }
}

export const serializeStudioDocument = (document: StudioDocument) =>
  JSON.stringify(document, null, 2)

export const parseImportedStudioDocument = (
  source: string,
  fallback: StudioDocument
): StudioDocument => {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error('Invalid Avatar Studio project')
  }
  const candidate = value as Partial<StudioDocument> | null
  if (!candidate || candidate.version !== 2) {
    throw new Error('Unsupported Avatar Studio project')
  }
  if (
    !candidate.library ||
    !Array.isArray(candidate.library.avatars) ||
    !candidate.library.avatars.length ||
    !Array.isArray(candidate.expressions) ||
    !candidate.expressions.length ||
    !Array.isArray(candidate.sequences)
  ) {
    throw new Error('Invalid Avatar Studio project')
  }
  return parseStudioDocument(candidate, fallback)
}

const createBundledStudioDocument = () => {
  const snapshot = JSON.parse(JSON.stringify(defaultStudioDocument)) as StudioDocument
  return parseStudioDocument(snapshot, snapshot)
}

const restoreStandaloneBundledAnimations = (
  document: StudioDocument,
  fallback: StudioDocument
): Pick<StudioDocument, 'sequences' | 'playback'> => {
  const bundledIds = new Set(fallback.sequences.map(sequence => sequence.id))
  const targetByPairId = new Map(
    fallback.sequences
      .filter(sequence => sequence.id !== 'idle')
      .map(sequence => [`idle-${sequence.id}`, sequence.id])
  )
  if (!document.sequences.some(sequence => targetByPairId.has(sequence.id))) {
    return { sequences: document.sequences, playback: document.playback }
  }
  const custom = document.sequences.filter(
    sequence => !bundledIds.has(sequence.id) && !targetByPairId.has(sequence.id)
  )
  const stateId =
    document.playback.stateId === null
      ? null
      : (targetByPairId.get(document.playback.stateId) ?? document.playback.stateId)
  return {
    sequences: [...fallback.sequences, ...custom],
    playback: { ...document.playback, stateId },
  }
}

const restoreSignatureAnimationSteps = (
  sequences: AvatarSequence[],
  fallback: AvatarSequence[],
  signatureIds = new Set(['angry', 'scared', 'joyful'])
) => {
  const fallbackById = new Map(fallback.map(sequence => [sequence.id, sequence]))
  const restored = sequences.map(sequence => {
    if (!signatureIds.has(sequence.id)) return sequence
    const canonical = fallbackById.get(sequence.id)
    if (!canonical) return sequence
    if (sequence.id === 'joyful') {
      return {
        ...canonical,
        steps: canonical.steps.map(step => ({ ...step })),
        blink: { ...canonical.blink },
      }
    }
    const steps = canonical.steps.map((canonicalStep, index) => ({
      ...(sequence.steps[index] ?? canonicalStep),
      id: canonicalStep.id,
      expressionId: canonicalStep.expressionId,
    }))
    const unchanged =
      steps.length === sequence.steps.length &&
      steps.every(
        (step, index) =>
          step.id === sequence.steps[index].id &&
          step.expressionId === sequence.steps[index].expressionId
      )
    return unchanged ? sequence : { ...sequence, steps }
  })
  const joyful = fallbackById.get('joyful')
  if (!joyful || restored.some(sequence => sequence.id === joyful.id)) return restored
  return [
    ...restored,
    {
      ...joyful,
      steps: joyful.steps.map(step => ({ ...step })),
      blink: { ...joyful.blink },
    },
  ]
}

const restoreSignatureExpressions = (
  expressions: Expression[],
  fallback: Expression[],
  addMissing = true
) => {
  const signatureKeys = new Set(['joyful-arc'])
  const additiveKeys = new Set(['joyful-arc', 'front-facing'])
  const fallbackByKey = new Map(
    fallback
      .filter(expression => expression.semanticKey && signatureKeys.has(expression.semanticKey))
      .map(expression => [expression.semanticKey!, expression])
  )
  let changed = false
  const restored = expressions.map(expression => {
    const canonical = expression.semanticKey ? fallbackByKey.get(expression.semanticKey) : undefined
    if (
      !canonical ||
      (expression.curvatureLeft === canonical.curvatureLeft &&
        expression.curvatureRight === canonical.curvatureRight &&
        expression.heightLeft === canonical.heightLeft &&
        expression.heightRight === canonical.heightRight)
    ) {
      return expression
    }
    changed = true
    return {
      ...expression,
      curvatureLeft: canonical.curvatureLeft,
      curvatureRight: canonical.curvatureRight,
      heightLeft: canonical.heightLeft,
      heightRight: canonical.heightRight,
    }
  })
  const existingKeys = new Set(restored.map(expression => expression.semanticKey))
  const missing = addMissing
    ? fallback.filter(
        expression =>
          expression.semanticKey &&
          additiveKeys.has(expression.semanticKey) &&
          !existingKeys.has(expression.semanticKey)
      )
    : []
  if (missing.length) return [...restored, ...missing.map(expression => ({ ...expression }))]
  return changed ? restored : expressions
}

const restoreFrontFacingExpression = (expressions: Expression[], fallback: Expression[]) => {
  if (expressions.some(expression => expression.semanticKey === 'front-facing')) {
    return expressions
  }
  const frontFacing = fallback.find(expression => expression.semanticKey === 'front-facing')
  return frontFacing ? [...expressions, { ...frontFacing }] : expressions
}

const restoreAvatarSignatureBehavior = (
  library: AvatarLibrary,
  fallbackExpressions: Expression[],
  fallbackSequences: AvatarSequence[]
) => {
  let changed = false
  const avatars = library.avatars.map(avatar => {
    if (!avatar.behavior) return avatar
    const expressions = restoreFrontFacingExpression(
      restoreSignatureExpressions(avatar.behavior.expressions, fallbackExpressions, false),
      fallbackExpressions
    )
    const availableExpressionIds = new Set(expressions.map(expression => expression.id))
    const joyful = fallbackSequences.find(sequence => sequence.id === 'joyful')
    const sequences =
      joyful && joyful.steps.every(step => availableExpressionIds.has(step.expressionId))
        ? restoreSignatureAnimationSteps(
            avatar.behavior.sequences,
            fallbackSequences,
            new Set(['angry', 'joyful'])
          )
        : avatar.behavior.sequences
    if (expressions === avatar.behavior.expressions && sequences === avatar.behavior.sequences) {
      return avatar
    }
    changed = true
    return { ...avatar, behavior: { expressions, sequences } }
  })
  return changed ? { ...library, avatars } : library
}

export const loadStudioDocument = (
  storage: Pick<Storage, 'getItem'> = window.localStorage
): StudioDocument => {
  const fallback = createBundledStudioDocument()
  try {
    const document = parseStudioDocument(
      JSON.parse(storage.getItem(DOCUMENT_STORAGE_KEY) ?? 'null'),
      fallback
    )
    const expressions = restoreSignatureExpressions(document.expressions, fallback.expressions)
    const hydrated = expressions === document.expressions ? document : { ...document, expressions }
    const restored = restoreStandaloneBundledAnimations(hydrated, fallback)
    const sequences = restoreSignatureAnimationSteps(restored.sequences, fallback.sequences)
    const library = restoreAvatarSignatureBehavior(
      ensurePrimitiveBundledAvatars(hydrated.library),
      fallback.expressions,
      fallback.sequences
    )
    return {
      ...hydrated,
      library,
      ...restored,
      sequences,
    }
  } catch {
    return {
      ...fallback,
      library: ensurePrimitiveBundledAvatars(fallback.library),
    }
  }
}

export const persistStudioDocument = (document: StudioDocument) => {
  try {
    window.localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(document))
    return true
  } catch {
    // The in-memory document remains authoritative when storage is unavailable.
    return false
  }
}

export const clearPersistedStudioDocument = (
  storage: Pick<Storage, 'removeItem'> = window.localStorage
) => {
  try {
    storage.removeItem(DOCUMENT_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export const createStudioDocumentStore = (
  initial: StudioDocument,
  persist: (document: StudioDocument) => void = persistStudioDocument
) => {
  let current = initial
  return {
    update: (patch: StudioDocumentPatch) => {
      const expressions = patch.expressions ?? current.expressions
      current = {
        ...current,
        ...patch,
        version: 2,
        expressions,
        sequences: normalizeSequencesForExpressions(
          patch.sequences ?? current.sequences,
          expressions
        ),
      }
      persist(current)
      return current
    },
  }
}
