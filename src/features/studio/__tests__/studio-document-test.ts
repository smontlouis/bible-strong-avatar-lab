import { createAvatar, defaultAvatarEyes } from '@/features/avatar/avatars'
import { createInitialSequences } from '@/features/animation/sequences'
import { initialExpressions } from '@/features/avatar/presets'
import { createAvatarDefinition } from '@/features/avatar/avatarDefinition'
import {
  clearPersistedStudioDocument,
  createStudioDocumentStore,
  loadStudioDocument,
  parseStudioDocument,
  parseImportedStudioDocument,
  serializeStudioDocument,
  type StudioDocument,
} from '@/features/studio/studioDocument'

const documentFixture = (): StudioDocument => {
  const avatar = createAvatar('Strobi')
  return {
    version: 2,
    library: {
      activeAvatarId: avatar.id,
      avatars: [avatar],
    },
    expressions: initialExpressions,
    sequences: createInitialSequences(),
    playback: { stateId: 'idle', playing: true },
  }
}

describe('Studio document', () => {
  const storage = (value: string | null = null) => ({ getItem: () => value })

  it('loads the bundled Studio snapshot when no local project exists', () => {
    const document = loadStudioDocument(storage())

    expect(document.library.avatars).toHaveLength(12)
    expect(document.library.activeAvatarId).toBe(document.library.avatars[0].id)
    expect(document.library.avatars.map(avatar => avatar.name)).toEqual([
      'Onee',
      'Cubee',
      'Nova',
      'Citrus',
      'Sphere',
      'Cube',
      'Capsule',
      'Cylinder',
      'Cone',
      'Diamond',
      'Memento',
      'Willy',
    ])
    expect(
      document.library.avatars.every(avatar => avatar.colors.body === avatar.colors.eyes)
    ).toBe(true)
    expect(document.library.avatars.slice(4).map(avatar => avatar.body.primary.type)).toEqual([
      'sphere',
      'cube',
      'capsule',
      'cylinder',
      'cone',
      'diamond',
      'ghost',
      'capsule',
    ])
    expect(document.library.avatars.at(-1)?.body.nodes).toHaveLength(3)
    const memento = document.library.avatars.find(avatar => avatar.id === 'primitive-ghost')
    expect(memento?.colors).toEqual({ body: '#ff9d45', eyes: '#ff9d45' })
    expect(
      document.library.avatars
        .filter(avatar => avatar.id !== 'primitive-ghost')
        .every(avatar => avatar.colors.body !== '#ff9d45')
    ).toBe(true)
    expect(memento?.eyes.positionYLeft).toBe(defaultAvatarEyes.positionYLeft - 20)
    expect(memento?.eyes.positionYRight).toBe(defaultAvatarEyes.positionYRight - 20)
    expect(
      memento?.behavior?.expressions.every(
        expression => !expression.bodyColor && !expression.eyeColor
      )
    ).toBe(true)
    expect(document.expressions).toHaveLength(27)
    expect(document.sequences).toHaveLength(23)
    expect(document.sequences.find(sequence => sequence.id === 'angry')?.steps).toHaveLength(2)
    expect(
      document.sequences
        .find(sequence => sequence.id === 'angry')
        ?.steps.map(step => step.expressionId)
    ).toEqual(['expression-07', 'expression-3d2bed26-f97c-477d-922f-77600cb10e92'])
    expect(document.sequences.find(sequence => sequence.id === 'scared')?.steps).toHaveLength(2)
    expect(
      document.sequences
        .find(sequence => sequence.id === 'scared')
        ?.steps.map(step => step.expressionId)
    ).toEqual(['expression-03', 'expression-5220eaee-32fe-4bd8-ad31-432189534cc8'])
    expect(document.expressions.every(expression => expression.semanticKey)).toBe(true)
    expect(document.sequences.every(sequence => sequence.semanticKey)).toBe(true)
    expect(document.playback).toEqual({ stateId: 'proud', playing: true })
  })

  it('clears only the persisted Studio project', () => {
    const removeItem = vi.fn()

    expect(clearPersistedStudioDocument({ removeItem })).toBe(true)
    expect(removeItem).toHaveBeenCalledExactlyOnceWith('bible-strong-avatar-studio-v2')
  })

  it('keeps a locally saved project authoritative over the bundled snapshot', () => {
    const localDocument = documentFixture()

    expect(loadStudioDocument(storage(JSON.stringify(localDocument)))).toEqual(localDocument)
  })

  it('restores standalone built-in animations from the temporary idle pairs', () => {
    const fallback = loadStudioDocument(storage())
    const pairedDocument: StudioDocument = {
      ...fallback,
      sequences: fallback.sequences.map(sequence =>
        sequence.id === 'idle'
          ? sequence
          : {
              ...sequence,
              id: `idle-${sequence.id}`,
              semanticKey: `idle-${sequence.id}`,
              name: `idle + ${sequence.name}`,
            }
      ),
      playback: { stateId: 'idle-proud', playing: true },
    }

    const restored = loadStudioDocument(storage(JSON.stringify(pairedDocument)))

    expect(restored.sequences.map(sequence => sequence.id)).toEqual(
      fallback.sequences.map(sequence => sequence.id)
    )
    expect(restored.playback).toEqual({ stateId: 'proud', playing: true })
  })

  it('removes retired bundled avatars from a locally saved project', () => {
    const fallback = loadStudioDocument(storage())
    const retired = createAvatar('Freddy')
    retired.id = 'avatar-4fe2d1bd-cf46-4e5e-a62d-d6b60be519ed'
    const localDocument: StudioDocument = {
      ...fallback,
      library: {
        activeAvatarId: retired.id,
        avatars: [retired, ...fallback.library.avatars],
      },
    }

    const document = loadStudioDocument(storage(JSON.stringify(localDocument)))

    expect(document.library.avatars.map(avatar => avatar.name)).toEqual([
      'Onee',
      'Cubee',
      'Nova',
      'Citrus',
      'Sphere',
      'Cube',
      'Capsule',
      'Cylinder',
      'Cone',
      'Diamond',
      'Memento',
      'Willy',
    ])
    expect(document.library.activeAvatarId).toBe(document.library.avatars[0].id)
  })

  it('renames the bundled ghost character in an existing local project', () => {
    const fallback = loadStudioDocument(storage())
    const legacy = structuredClone(fallback)
    const character = legacy.library.avatars.find(avatar => avatar.id === 'primitive-ghost')
    if (!character) throw new Error('Bundled ghost character not found')
    character.name = 'Ghost'
    character.eyes.positionYLeft = defaultAvatarEyes.positionYLeft
    character.eyes.positionYRight = defaultAvatarEyes.positionYRight

    const document = loadStudioDocument(storage(JSON.stringify(legacy)))

    expect(document.library.avatars.find(avatar => avatar.id === 'primitive-ghost')?.name).toBe(
      'Memento'
    )
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-ghost')?.eyes.positionYLeft
    ).toBe(defaultAvatarEyes.positionYLeft - 20)
  })

  it('restores bundled semantic keys in a legacy local project', () => {
    const fallback = loadStudioDocument(storage())
    const legacy = structuredClone(fallback)
    legacy.expressions.forEach(expression => delete expression.semanticKey)
    legacy.sequences.forEach(sequence => delete sequence.semanticKey)

    const document = parseStudioDocument(legacy, fallback)

    expect(document.expressions.map(expression => expression.semanticKey)).toEqual(
      fallback.expressions.map(expression => expression.semanticKey)
    )
    expect(document.sequences.map(sequence => sequence.semanticKey)).toEqual(
      fallback.sequences.map(sequence => sequence.semanticKey)
    )
    expect(
      createAvatarDefinition({
        avatar: document.library.avatars[0],
        behavior: { expressions: document.expressions, sequences: document.sequences },
      }).ok
    ).toBe(true)
  })

  it('restores bundled keys in legacy avatar-owned behavior without naming custom items', () => {
    const fallback = loadStudioDocument(storage())
    const legacy = structuredClone(fallback)
    const avatar = legacy.library.avatars[0]
    avatar.behavior = {
      expressions: legacy.expressions.map(expression => ({
        ...expression,
        semanticKey: undefined,
      })),
      sequences: legacy.sequences.map(sequence => ({ ...sequence, semanticKey: undefined })),
    }
    avatar.behavior.expressions.push({
      ...avatar.behavior.expressions[0],
      id: 'expression-custom',
      semanticKey: undefined,
    })

    const document = parseStudioDocument(legacy, fallback)
    const behavior = document.library.avatars[0].behavior!

    expect(behavior.expressions[0].semanticKey).toBe(fallback.expressions[0].semanticKey)
    expect(behavior.sequences[0].semanticKey).toBe(fallback.sequences[0].semanticKey)
    expect(behavior.expressions.at(-1)?.semanticKey).toBeUndefined()
  })

  it('persists one coherent document after a mutation', () => {
    const persisted: StudioDocument[] = []
    const store = createStudioDocumentStore(documentFixture(), value => persisted.push(value))

    store.update({ playback: { stateId: 'idle', playing: false } })

    expect(persisted).toHaveLength(1)
    expect(persisted[0].playback).toEqual({ stateId: 'idle', playing: false })
    expect(persisted[0].expressions).toHaveLength(initialExpressions.length)
  })

  it('repairs sequence references in the same transaction as expression deletion', () => {
    const store = createStudioDocumentStore(documentFixture(), () => undefined)
    const remainingExpressions = initialExpressions.slice(1)

    const next = store.update({ expressions: remainingExpressions })

    expect(
      next.sequences.every(sequence =>
        sequence.steps.every(step =>
          remainingExpressions.some(item => item.id === step.expressionId)
        )
      )
    ).toBe(true)
  })

  it('round-trips a complete project document as portable JSON', () => {
    const document = documentFixture()
    const expression = { ...initialExpressions[0], semanticKey: 'happy-smile', widthLeft: 42 }
    const sequence = {
      ...createInitialSequences()[0],
      semanticKey: 'happy',
      steps: createInitialSequences()[0].steps.map(step => ({
        ...step,
        expressionId: expression.id,
      })),
    }
    document.library.avatars[0].behavior = {
      expressions: [expression],
      sequences: [sequence],
    }

    const imported = parseImportedStudioDocument(serializeStudioDocument(document), document)

    expect(imported).toEqual(document)
    expect(imported.library.avatars[0].behavior?.expressions[0].widthLeft).toBe(42)
    expect(imported.expressions[0].semanticKey).toBe(initialExpressions[0].semanticKey)
    expect(imported.library.avatars[0].behavior?.expressions[0].semanticKey).toBe('happy-smile')
    expect(imported.library.avatars[0].behavior?.sequences[0].semanticKey).toBe('happy')
  })

  it('preserves semantic keys in the base behavior parser', () => {
    const document = documentFixture()
    document.expressions = document.expressions.map((expression, index) => ({
      ...expression,
      ...(index === 0 ? { semanticKey: 'attentive' } : {}),
    }))
    document.sequences = document.sequences.map((sequence, index) => ({
      ...sequence,
      ...(index === 0 ? { semanticKey: 'sleeping' } : {}),
    }))

    const imported = parseImportedStudioDocument(serializeStudioDocument(document), document)

    expect(imported.expressions[0].semanticKey).toBe('attentive')
    expect(imported.sequences[0].semanticKey).toBe('sleeping')
  })

  it('keeps the base library unchanged when an avatar owns customized behavior', () => {
    const document = documentFixture()
    const avatar = document.library.avatars[0]
    const customized = {
      ...avatar,
      behavior: {
        expressions: [{ ...initialExpressions[0], widthLeft: 47 }],
        sequences: createInitialSequences().slice(0, 1),
      },
    }
    const store = createStudioDocumentStore(document, () => undefined)

    const next = store.update({
      library: { activeAvatarId: avatar.id, avatars: [customized] },
    })

    expect(next.expressions[0].widthLeft).toBe(initialExpressions[0].widthLeft)
    expect(next.library.avatars[0].behavior?.expressions[0].widthLeft).toBe(47)
  })

  it('rejects files that are not versioned Studio projects', () => {
    const fallback = documentFixture()

    expect(() => parseImportedStudioDocument('{"version":1}', fallback)).toThrow(
      'Unsupported Avatar Studio project'
    )
    expect(() => parseImportedStudioDocument('{broken', fallback)).toThrow(
      'Invalid Avatar Studio project'
    )
  })

  it('repairs an imported active avatar and missing expression references', () => {
    const fallback = documentFixture()
    const avatar = createAvatar('Portable')
    const imported = parseImportedStudioDocument(
      JSON.stringify({
        ...fallback,
        library: { activeAvatarId: 'missing', avatars: [avatar] },
        sequences: [
          {
            ...createInitialSequences()[0],
            steps: [{ ...createInitialSequences()[0].steps[0], expressionId: 'missing' }],
          },
        ],
      }),
      fallback
    )

    expect(imported.library.activeAvatarId).toBe(avatar.id)
    expect(imported.sequences[0].steps[0].expressionId).toBe(imported.expressions[0].id)
  })

  it('sanitizes imported animation timing and playback values', () => {
    const fallback = documentFixture()
    const imported = parseImportedStudioDocument(
      JSON.stringify({
        ...fallback,
        sequences: [
          {
            ...fallback.sequences[0],
            playbackMode: 'unsupported',
            steps: [
              {
                ...fallback.sequences[0].steps[0],
                holdMs: -500,
                transitionMs: Number.POSITIVE_INFINITY,
              },
            ],
          },
        ],
      }),
      fallback
    )

    expect(imported.sequences[0].playbackMode).toBe('loop')
    expect(imported.sequences[0].steps[0].holdMs).toBeGreaterThanOrEqual(100)
    expect(Number.isFinite(imported.sequences[0].steps[0].transitionMs)).toBe(true)
  })
})
