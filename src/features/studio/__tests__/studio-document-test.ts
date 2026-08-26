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
  const bundledAvatarNames = [
    'Memento',
    'Memento · Headset',
    'Memento · Stroke',
    'Apple Bite',
    'Lock',
    'Siamese',
    'British Shorthair',
    'Russian Blue',
    'Orange Tabby',
    'Black Cat',
    'Dog',
    'Brown Dog',
    'Bear',
    'Rabbit',
    'Bun',
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
    'Willy',
    'OneWorks Sphere',
    'OneWorks Ellipse',
    'OneWorks Square',
    'OneWorks Rounded',
    'OneWorks Capsule',
    'OneWorks Teardrop',
    'OneWorks Diamond',
    'OneWorks Trapezoid',
    'OneWorks Cone',
    'OneWorks Frustum',
    'OneWorks Half Cone',
    'OneWorks Cloud',
    'OneWorks Sun',
  ]

  it('loads the bundled Studio snapshot when no local project exists', () => {
    const document = loadStudioDocument(storage())

    expect(document.library.avatars).toHaveLength(bundledAvatarNames.length)
    expect(document.library.activeAvatarId).toBe('avatar-4b9ea0c1-286f-4aa1-b053-61fcc416ba7e')
    expect(document.library.avatars.map(avatar => avatar.name)).toEqual(bundledAvatarNames)
    expect(
      document.library.avatars
        .filter(avatar => avatar.renderStyle.type !== 'vector' || !avatar.renderStyle.filled)
        .every(avatar => avatar.colors.body === avatar.colors.eyes)
    ).toBe(true)
    expect(document.library.avatars.slice(0, 15).map(avatar => avatar.body.primary.type)).toEqual([
      'ghost',
      'ghost',
      'ghost',
      'apple-bite',
      'lock',
      'ellipse',
      'ellipse',
      'ellipse',
      'ellipse',
      'ellipse',
      'trapezoid',
      'trapezoid',
      'trapezoid',
      'trapezoid',
      'sphere',
    ])
    expect(document.library.avatars.some(avatar => avatar.id === 'memento-piglet')).toBe(false)
    expect(document.library.avatars.some(avatar => avatar.id === 'oneworks-cat')).toBe(false)
    expect(document.library.avatars.some(avatar => avatar.id === 'oneworks-cat-cow')).toBe(false)
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-willy')?.body.nodes
    ).toHaveLength(3)
    expect(
      document.library.avatars.find(avatar => avatar.id === 'oneworks-cloud')?.body.nodes
    ).toHaveLength(7)
    expect(
      document.library.avatars.find(avatar => avatar.id === 'oneworks-sun')?.body.nodes
    ).toHaveLength(8)
    expect(
      document.library.avatars
        .filter(avatar =>
          ['dog', 'dog-brown', 'bear', 'rabbit', 'bun'].some(id => avatar.id === `oneworks-${id}`)
        )
        .every(avatar => avatar.renderStyle.type === 'vector' && avatar.renderStyle.filled === true)
    ).toBe(true)
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-ghost')?.renderStyle
    ).toEqual({
      type: 'vector',
      filled: true,
    })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-ghost-headset')?.renderStyle
    ).toEqual({ type: 'vector', filled: true, artwork: 'frame-172-colored' })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-ghost-headset-stroke')
        ?.renderStyle
    ).toEqual({ type: 'vector', strokeOnly: true, artwork: 'frame-172-stroke' })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-apple-bite')?.renderStyle
    ).toEqual({ type: 'vector', filled: true })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-lock')?.renderStyle
    ).toEqual({ type: 'vector', filled: true })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-ghost')?.body.primary
    ).toMatchObject({ width: 225, height: 220.5, depth: 171 })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-apple-bite')?.body.primary
    ).toMatchObject({ width: 216, height: 225, depth: 171 })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-lock')?.body.primary
    ).toMatchObject({ type: 'lock', width: 225, height: 225, depth: 171 })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-apple-bite')?.eyes
        .positionXLeft
    ).toBe(defaultAvatarEyes.positionXLeft - 18)
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-apple-bite')?.eyes
        .positionXRight
    ).toBe(defaultAvatarEyes.positionXRight - 18)
    expect(
      document.library.avatars.find(avatar => avatar.id === 'oneworks-cat-siamese')?.colors
    ).toEqual({ body: '#ead7b8', eyes: '#281913' })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'oneworks-cat-black')?.colors
    ).toEqual({ body: '#111419', eyes: '#eef2f5' })
    expect(
      document.library.avatars
        .find(avatar => avatar.id === 'oneworks-cat-siamese')
        ?.body.nodes.map(node => node.color)
    ).toEqual(['#3c2118', '#3c2118'])
    expect(document.library.avatars.find(avatar => avatar.id === 'oneworks-dog')?.colors).toEqual({
      body: '#d4d0c8',
      eyes: '#211f1d',
    })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'oneworks-dog-brown')?.colors
    ).toEqual({
      body: '#e3b17f',
      eyes: '#2b1d18',
    })
    expect(document.library.avatars.find(avatar => avatar.id === 'oneworks-bear')?.colors).toEqual({
      body: '#a95f47',
      eyes: '#2b1d18',
    })
    expect(
      document.library.avatars
        .find(avatar => avatar.id === 'oneworks-dog')
        ?.body.nodes.map(node => node.color)
    ).toEqual(['#be9675', '#be9675'])
    expect(
      document.library.avatars
        .find(avatar => avatar.id === 'oneworks-dog-brown')
        ?.body.nodes.map(node => node.color)
    ).toEqual(['#a95f47', '#a95f47'])
    expect(
      document.library.avatars
        .filter(avatar =>
          ['oneworks-dog', 'oneworks-dog-brown', 'oneworks-bear'].includes(avatar.id)
        )
        .map(avatar => ({
          id: avatar.id,
          hasBehavior: Boolean(avatar.behavior),
          coloredExpressions:
            avatar.behavior?.expressions.filter(
              expression => expression.bodyColor || expression.eyeColor
            ).length ?? -1,
        }))
    ).toEqual([
      { id: 'oneworks-dog', hasBehavior: true, coloredExpressions: 4 },
      { id: 'oneworks-dog-brown', hasBehavior: true, coloredExpressions: 4 },
      { id: 'oneworks-bear', hasBehavior: true, coloredExpressions: 4 },
    ])
    expect(
      document.library.avatars
        .find(avatar => avatar.id === 'oneworks-bear')
        ?.body.nodes.map(node => node.color)
    ).toEqual(['#a95f47', '#a95f47'])
    const memento = document.library.avatars.find(avatar => avatar.id === 'primitive-ghost')
    const headsetMemento = document.library.avatars.find(
      avatar => avatar.id === 'primitive-ghost-headset'
    )
    const strokeMemento = document.library.avatars.find(
      avatar => avatar.id === 'primitive-ghost-headset-stroke'
    )
    expect(memento?.colors).toEqual({ body: '#ff9d45', eyes: '#111316' })
    expect(headsetMemento?.colors).toEqual({ body: '#ff9d45', eyes: '#222222' })
    expect(strokeMemento?.colors).toEqual({ body: '#ff9d45', eyes: '#ff9d45' })
    const headsetWorkingFirst = headsetMemento?.behavior?.sequences.find(
      sequence => sequence.semanticKey === 'working'
    )?.steps[0]
    const headsetJoyfulFirst = headsetMemento?.behavior?.sequences.find(
      sequence => sequence.semanticKey === 'joyful'
    )?.steps[0]
    const headsetShyFirst = headsetMemento?.behavior?.sequences.find(
      sequence => sequence.semanticKey === 'shy'
    )?.steps[0]
    const headsetShySecond = headsetMemento?.behavior?.sequences.find(
      sequence => sequence.semanticKey === 'shy'
    )?.steps[1]
    const headsetWorkingExpression = headsetMemento?.behavior?.expressions.find(
      expression => expression.id === headsetWorkingFirst?.expressionId
    )
    const headsetJoyfulExpression = headsetMemento?.behavior?.expressions.find(
      expression => expression.id === headsetJoyfulFirst?.expressionId
    )
    const headsetShyExpression = headsetMemento?.behavior?.expressions.find(
      expression => expression.id === headsetShyFirst?.expressionId
    )
    const headsetShyTiltExpression = headsetMemento?.behavior?.expressions.find(
      expression => expression.id === headsetShySecond?.expressionId
    )
    expect(headsetWorkingExpression).toMatchObject({
      widthLeft: headsetJoyfulExpression?.widthLeft,
      widthRight: headsetJoyfulExpression?.widthRight,
      heightLeft: headsetJoyfulExpression?.heightLeft,
      heightRight: headsetJoyfulExpression?.heightRight,
      spacing: headsetJoyfulExpression?.spacing,
      leftAngle: headsetJoyfulExpression?.leftAngle,
      rightAngle: headsetJoyfulExpression?.rightAngle,
    })
    expect(headsetWorkingExpression).toMatchObject({
      headX: initialExpressions[7].headX,
      headY: initialExpressions[7].headY,
      headZ: initialExpressions[7].headZ,
    })
    expect(headsetJoyfulFirst?.expressionId).toBe('expression-11')
    expect(headsetShyExpression).toMatchObject({
      headY: -Math.abs(initialExpressions[0].headY),
      spacing: initialExpressions[0].spacing - 10,
      positionYLeft: initialExpressions[0].positionYLeft + 10,
      positionYRight: initialExpressions[0].positionYRight + 10,
    })
    expect(headsetShyTiltExpression).toMatchObject({
      headX: initialExpressions[24].headX,
      headY: initialExpressions[24].headY,
      headZ: -Math.abs(initialExpressions[24].headZ),
    })
    expect(
      memento?.behavior?.sequences.find(sequence => sequence.semanticKey === 'joyful')?.steps[0]
        .expressionId
    ).toBe('expression-11')
    expect(
      strokeMemento?.behavior?.sequences.find(sequence => sequence.semanticKey === 'joyful')
        ?.steps[0].expressionId
    ).toBe('expression-11')
    expect(
      strokeMemento?.behavior?.sequences.some(sequence => sequence.semanticKey === 'onboarding')
    ).toBe(true)
    const onboarding = strokeMemento?.behavior?.sequences.find(
      sequence => sequence.semanticKey === 'onboarding'
    )
    expect(onboarding?.steps.map(step => step.holdMs)).toEqual([2000, 2000])
    expect(onboarding?.blink).toEqual({
      enabled: true,
      initialDelayMs: 350,
      minIntervalMs: 2070,
      maxIntervalMs: 2070,
      durationMs: 280,
    })
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-apple-bite')?.colors
    ).toEqual({ body: '#ff5558', eyes: '#111316' })
    expect(document.library.avatars.find(avatar => avatar.id === 'primitive-lock')?.colors).toEqual(
      { body: '#1a9cff', eyes: '#111316' }
    )
    expect(
      document.library.avatars.find(avatar => avatar.id === 'primitive-lock')?.eyes.positionYLeft
    ).toBe(defaultAvatarEyes.positionYLeft + 22)
    expect(
      document.library.avatars
        .find(avatar => avatar.id === 'primitive-apple-bite')
        ?.behavior?.expressions.filter(expression => expression.bodyColor || expression.eyeColor)
        .map(expression => [expression.semanticKey, expression.bodyColor, expression.eyeColor])
    ).toEqual([
      ['angry-brows', '#ba3636', '#610000'],
      ['uneasy-left', '#adc3ff', undefined],
      ['scared-state-surprised-left', '#adc3ff', undefined],
      ['scared-state-uneasy-left', '#adc3ff', undefined],
    ])
    expect(
      document.library.avatars
        .filter(
          avatar =>
            ![
              'primitive-ghost',
              'primitive-ghost-headset',
              'primitive-ghost-headset-stroke',
            ].includes(avatar.id)
        )
        .every(avatar => avatar.colors.body !== '#ff9d45')
    ).toBe(true)
    expect(memento?.eyes.positionYLeft).toBe(defaultAvatarEyes.positionYLeft - 20)
    expect(memento?.eyes.positionYRight).toBe(defaultAvatarEyes.positionYRight - 20)
    expect(
      memento?.behavior?.expressions.find(
        expression => expression.semanticKey === 'onboarding-curious'
      )?.positionYLeft
    ).toBe(-22)
    expect(
      memento?.behavior?.sequences.some(sequence => sequence.semanticKey === 'onboarding')
    ).toBe(true)
    expect(
      memento?.behavior?.expressions
        .filter(expression => expression.bodyColor || expression.eyeColor)
        .map(expression => [expression.semanticKey, expression.bodyColor, expression.eyeColor])
    ).toEqual([['angry-brows', '#ba3636', '#610000']])
    expect(document.expressions).toHaveLength(29)
    expect(document.sequences).toHaveLength(24)
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
    expect(
      document.sequences
        .find(sequence => sequence.id === 'joyful')
        ?.steps.map(step => [step.expressionId, step.transitionMs, step.transition])
    ).toEqual([
      ['expression-11', 700, 'gentleSpring'],
      ['expression-joyful-arc', 700, 'gentleSpring'],
    ])
    expect(document.expressions.every(expression => expression.semanticKey)).toBe(true)
    expect(document.sequences.every(sequence => sequence.semanticKey)).toBe(true)
    expect(document.playback).toEqual({ stateId: 'proud', playing: true })
  })

  it('exports every imported OneWorks skin as a valid avatar definition', () => {
    const document = loadStudioDocument(storage())
    const importedAvatars = document.library.avatars.filter(avatar =>
      avatar.id.startsWith('oneworks-')
    )

    expect(importedAvatars).toHaveLength(23)
    importedAvatars.forEach(avatar => {
      const result = createAvatarDefinition({
        avatar,
        behavior: avatar.behavior ?? {
          expressions: document.expressions,
          sequences: document.sequences,
        },
      })

      expect(result.ok, avatar.name).toBe(true)
      if (result.ok) expect(JSON.stringify(result.value)).not.toContain('NaN')
    })
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

  it('migrates previously saved bundled filled avatars to the filled treatment', () => {
    const fallback = loadStudioDocument(storage())
    const filledIds = new Set([
      'primitive-ghost',
      'primitive-apple-bite',
      'primitive-lock',
      ...fallback.library.avatars
        .filter(avatar => avatar.id.startsWith('oneworks-'))
        .map(avatar => avatar.id),
    ])
    const legacy = {
      ...fallback,
      library: {
        ...fallback.library,
        avatars: fallback.library.avatars.map(avatar =>
          filledIds.has(avatar.id)
            ? {
                ...avatar,
                renderStyle: { type: 'vector' },
                eyes:
                  avatar.id === 'primitive-apple-bite'
                    ? { ...avatar.eyes, positionXLeft: 0, positionXRight: 0 }
                    : avatar.eyes,
                body: {
                  ...avatar.body,
                  nodes: avatar.body.nodes.map(node => ({ ...node, color: undefined })),
                },
              }
            : avatar
        ),
      },
    } satisfies StudioDocument

    const restored = loadStudioDocument(storage(JSON.stringify(legacy)))
    const restoredById = new Map(restored.library.avatars.map(avatar => [avatar.id, avatar]))

    ;['dog', 'dog-brown', 'bear', 'rabbit', 'bun'].forEach(id => {
      expect(restoredById.get(`oneworks-${id}`)?.renderStyle).toEqual({
        type: 'vector',
        filled: true,
      })
    })
    expect(restoredById.get('primitive-ghost')?.renderStyle).toEqual({
      type: 'vector',
      filled: true,
    })
    expect(restoredById.get('primitive-apple-bite')?.renderStyle).toEqual({
      type: 'vector',
      filled: true,
    })
    expect(restoredById.get('primitive-lock')?.renderStyle).toEqual({
      type: 'vector',
      filled: true,
    })
    expect(restoredById.get('primitive-ghost')?.colors).toEqual({
      body: '#ff9d45',
      eyes: '#111316',
    })
    expect(restoredById.get('primitive-apple-bite')?.colors).toEqual({
      body: '#ff5558',
      eyes: '#111316',
    })
    expect(restoredById.get('primitive-lock')?.colors).toEqual({
      body: '#1a9cff',
      eyes: '#111316',
    })
    expect(restoredById.get('primitive-apple-bite')?.eyes.positionXLeft).toBe(-18)
    expect(restoredById.get('primitive-apple-bite')?.eyes.positionXRight).toBe(-18)
    expect(
      restoredById
        .get('primitive-apple-bite')
        ?.behavior?.expressions.filter(expression => expression.bodyColor || expression.eyeColor)
        .map(expression => [expression.semanticKey, expression.bodyColor, expression.eyeColor])
    ).toEqual([
      ['angry-brows', '#ba3636', '#610000'],
      ['uneasy-left', '#adc3ff', undefined],
      ['scared-state-surprised-left', '#adc3ff', undefined],
      ['scared-state-uneasy-left', '#adc3ff', undefined],
    ])
    expect(restoredById.get('oneworks-rabbit')?.colors).toEqual({
      body: '#eee9df',
      eyes: '#292724',
    })
    expect(restoredById.get('oneworks-bun')?.colors).toEqual({
      body: '#fff3d9',
      eyes: '#241915',
    })
    expect(restoredById.get('oneworks-dog')?.colors).toEqual({
      body: '#d4d0c8',
      eyes: '#211f1d',
    })
    expect(restoredById.get('oneworks-dog')?.body.nodes.map(node => node.color)).toEqual([
      '#be9675',
      '#be9675',
    ])
    expect(restoredById.get('oneworks-dog-brown')?.colors).toEqual({
      body: '#e3b17f',
      eyes: '#2b1d18',
    })
    expect(restoredById.get('oneworks-dog-brown')?.body.nodes.map(node => node.color)).toEqual([
      '#a95f47',
      '#a95f47',
    ])
    expect(restoredById.get('oneworks-bear')?.colors).toEqual({
      body: '#a95f47',
      eyes: '#2b1d18',
    })
    expect(
      restoredById
        .get('oneworks-dog-brown')
        ?.behavior?.expressions.filter(expression => expression.bodyColor || expression.eyeColor)
        .map(expression => [expression.semanticKey, expression.bodyColor, expression.eyeColor])
    ).toEqual([
      ['angry-brows', '#ba3636', '#610000'],
      ['uneasy-left', '#adc3ff', undefined],
      ['scared-state-surprised-left', '#adc3ff', undefined],
      ['scared-state-uneasy-left', '#adc3ff', undefined],
    ])
    expect(restoredById.get('oneworks-bear')?.body.nodes.map(node => node.color)).toEqual([
      '#a95f47',
      '#a95f47',
    ])
    expect(restoredById.get('oneworks-sun')?.renderStyle).toEqual({ type: 'vector' })
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

  it('adds the joyful arc expression to an existing local project', () => {
    const fallback = loadStudioDocument(storage())
    const localDocument = {
      ...fallback,
      expressions: fallback.expressions.filter(
        expression => expression.semanticKey !== 'joyful-arc'
      ),
    }

    const restored = loadStudioDocument(storage(JSON.stringify(localDocument)))

    expect(restored.expressions.at(-1)?.semanticKey).toBe('joyful-arc')
  })

  it('adds the front-facing expression to existing base and avatar libraries', () => {
    const fallback = loadStudioDocument(storage())
    const withoutFront = fallback.expressions.filter(
      expression => expression.semanticKey !== 'front-facing'
    )
    const localDocument = {
      ...fallback,
      expressions: withoutFront,
      library: {
        ...fallback.library,
        avatars: fallback.library.avatars.map(avatar =>
          avatar.behavior
            ? { ...avatar, behavior: { ...avatar.behavior, expressions: withoutFront } }
            : avatar
        ),
      },
    }

    const restored = loadStudioDocument(storage(JSON.stringify(localDocument)))
    const front = restored.expressions.find(expression => expression.semanticKey === 'front-facing')

    expect(front).toMatchObject({ headX: 0, headY: 0, headZ: 0 })
    expect(front?.widthLeft).toBe(front?.widthRight)
    expect(front?.heightLeft).toBe(front?.heightRight)
    expect(
      restored.library.avatars
        .filter(avatar => avatar.behavior)
        .every(avatar =>
          avatar.behavior?.expressions.some(expression => expression.semanticKey === 'front-facing')
        )
    ).toBe(true)
  })

  it('adds the joyful animation to an existing local project', () => {
    const fallback = loadStudioDocument(storage())
    const localDocument = {
      ...fallback,
      sequences: fallback.sequences.filter(sequence => sequence.id !== 'joyful'),
    }

    const restored = loadStudioDocument(storage(JSON.stringify(localDocument)))
    const joyful = restored.sequences.find(sequence => sequence.id === 'joyful')

    expect(joyful?.steps.map(step => step.expressionId)).toEqual([
      'expression-11',
      'expression-joyful-arc',
    ])
    expect(joyful?.blink.enabled).toBe(false)
  })

  it('updates the bundled joyful arc thickness in an existing local project', () => {
    const fallback = loadStudioDocument(storage())
    const legacyExpressions = fallback.expressions.map(expression =>
      expression.semanticKey === 'joyful-arc'
        ? { ...expression, heightLeft: 11, heightRight: 11 }
        : expression
    )
    const localDocument = {
      ...fallback,
      expressions: legacyExpressions,
      library: {
        ...fallback.library,
        avatars: fallback.library.avatars.map((avatar, index) =>
          index === 0
            ? {
                ...avatar,
                behavior: { expressions: legacyExpressions, sequences: fallback.sequences },
              }
            : avatar
        ),
      },
    }

    const restored = loadStudioDocument(storage(JSON.stringify(localDocument)))
    const joyfulArc = restored.expressions.find(
      expression => expression.semanticKey === 'joyful-arc'
    )

    expect(joyfulArc?.heightLeft).toBe(15)
    expect(joyfulArc?.heightRight).toBe(15)
    const avatarJoyfulArc = restored.library.avatars[0].behavior?.expressions.find(
      expression => expression.semanticKey === 'joyful-arc'
    )
    expect(avatarJoyfulArc?.heightLeft).toBe(15)
    expect(avatarJoyfulArc?.heightRight).toBe(15)
    expect(
      restored.library.avatars[0].behavior?.sequences.some(sequence => sequence.id === 'joyful')
    ).toBe(true)
  })

  it('removes retired bundled avatars from a locally saved project', () => {
    const fallback = loadStudioDocument(storage())
    const retired = createAvatar('Freddy')
    retired.id = 'avatar-4fe2d1bd-cf46-4e5e-a62d-d6b60be519ed'
    const retiredFox = createAvatar('Продовый песец')
    retiredFox.id = 'memento-arctic-fox'
    const localDocument: StudioDocument = {
      ...fallback,
      library: {
        activeAvatarId: retiredFox.id,
        avatars: [retired, retiredFox, ...fallback.library.avatars],
      },
    }

    const document = loadStudioDocument(storage(JSON.stringify(localDocument)))

    expect(document.library.avatars.map(avatar => avatar.name)).toEqual(bundledAvatarNames)
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

  it('simplifies bundled animal names in an existing local project', () => {
    const fallback = loadStudioDocument(storage())
    const legacyNames: Record<string, string> = {
      'oneworks-dog': 'OneWorks Dog',
      'oneworks-bear': 'OneWorks Bear',
      'oneworks-rabbit': 'OneWorks Rabbit',
      'oneworks-bun': 'OneWorks Bun',
    }
    const legacy = {
      ...fallback,
      library: {
        ...fallback.library,
        avatars: fallback.library.avatars.map(avatar => ({
          ...avatar,
          name: legacyNames[avatar.id] ?? avatar.name,
        })),
      },
    }

    const restored = loadStudioDocument(storage(JSON.stringify(legacy)))
    const restoredById = new Map(restored.library.avatars.map(avatar => [avatar.id, avatar]))

    expect(restoredById.has('oneworks-cat')).toBe(false)
    expect(restoredById.get('oneworks-dog')?.name).toBe('Dog')
    expect(restoredById.get('oneworks-bear')?.name).toBe('Bear')
    expect(restoredById.get('oneworks-rabbit')?.name).toBe('Rabbit')
    expect(restoredById.get('oneworks-bun')?.name).toBe('Bun')
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
