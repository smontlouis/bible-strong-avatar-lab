import {
  AVATAR_DEFINITION_MAX_BYTES,
  avatarDefinitionFileName,
  createAvatarDefinition,
  parseAvatarDefinition,
  validateAvatarDefinition,
  type AvatarDefinition,
} from '@/features/avatar/avatarDefinition'
import {
  defaultAvatarColors,
  defaultAvatarEyes,
  resolveAvatarBehavior,
  type AvatarBehaviorLibrary,
  type StudioAvatar,
} from '@/features/avatar/avatars'
import { createInitialSequences, createSequence } from '@/features/animation/sequences'
import { defaultExpression, initialExpressions } from '@/features/avatar/presets'
import { surfacePresets } from '@/features/avatar/surfaces'
import { loadStudioDocument } from '@/features/studio/studioDocument'

const avatarFixture = (): StudioAvatar => ({
  id: 'avatar-fixture',
  name: 'Fixture',
  body: {
    primary: {
      ...surfacePresets.cone,
      width: 251.123456,
      roundness: 0.25,
      morphRoundness: 0.2,
      tipRoundness: 0.3,
      baseRoundness: 0.4,
    },
    nodes: [
      {
        id: 'shape-private',
        name: 'Private label',
        surface: { ...surfacePresets.cylinder, roundness: 0.45, morphRoundness: 0.2 },
        position: [1.25, -2.5, 3.75],
        rotation: [-10, 20, 30],
      },
    ],
  },
  colors: { body: '#abcdef', eyes: '#123456' },
  renderStyle: { type: 'vector' },
  eyes: {
    ...defaultAvatarEyes,
    widthLeft: defaultAvatarEyes.widthLeft + 3,
    positionYRight: defaultAvatarEyes.positionYRight - 4,
  },
})

const behaviorFixture = (): AvatarBehaviorLibrary => {
  const expression = {
    ...initialExpressions[0],
    semanticKey: 'happy-smile',
    bodyColor: '#fedcba',
    eyeColor: '#654321',
    eyeMotion: 'microSaccades' as const,
    bodyMotion: 'slowDrift' as const,
  }
  const sequence = createInitialSequences()[0]
  return {
    expressions: [expression],
    sequences: [
      {
        ...sequence,
        semanticKey: 'happy',
        playbackMode: 'once',
        steps: [
          {
            ...sequence.steps[0],
            expressionId: expression.id,
            holdMs: 1234,
            transitionMs: 432,
            transition: 'snappy',
          },
        ],
        blink: {
          enabled: true,
          initialDelayMs: 100,
          minIntervalMs: 250,
          maxIntervalMs: 120000,
          durationMs: 50,
        },
      },
    ],
  }
}

const definitionFixture = (): AvatarDefinition => {
  const result = createAvatarDefinition({ avatar: avatarFixture(), behavior: behaviorFixture() })
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return structuredClone(result.value) as AvatarDefinition
}

const expectError = (value: unknown, code: string, path?: string) => {
  const result = validateAvatarDefinition(value)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code, ...(path === undefined ? {} : { path }) }),
    ])
  )
}

describe('avatar definition validation', () => {
  it('validates, clones, deeply freezes, and JSON round-trips a v1 definition', () => {
    const input = definitionFixture()
    const result = validateAvatarDefinition(input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).not.toBe(input)
    expect(Object.isFrozen(result.value)).toBe(true)
    expect(Object.isFrozen(result.value.expressions.neutral.eyes.left)).toBe(true)
    expect(structuredClone(result.value)).toEqual(input)
    expect(validateAvatarDefinition(structuredClone(result.value)).ok).toBe(true)
  })

  it('rejects unsupported versions, unknown fields, malformed keys, and missing neutral', () => {
    expectError(
      { ...definitionFixture(), schemaVersion: 2 },
      'unsupported_version',
      '/schemaVersion'
    )
    expectError({ ...definitionFixture(), surprise: true }, 'additionalProperties', '/surprise')

    const malformed = definitionFixture()
    malformed.expressions['Happy Smile'] = malformed.expressions['happy-smile']
    malformed.expressionOrder.push('Happy Smile')
    expectError(malformed, 'pattern', '/expressions/Happy Smile')

    const missingNeutral = definitionFixture()
    delete missingNeutral.expressions.neutral
    missingNeutral.expressionOrder = missingNeutral.expressionOrder.filter(key => key !== 'neutral')
    expectError(missingNeutral, 'required', '/expressions/neutral')
  })

  it('rejects incomplete order lists and dangling animation references with JSON pointers', () => {
    const incomplete = definitionFixture()
    incomplete.expressionOrder = ['neutral']
    expectError(incomplete, 'incomplete_order', '/expressionOrder')

    const dangling = definitionFixture()
    dangling.animations.happy.steps[0].expression = 'missing'
    expectError(dangling, 'unknown_expression', '/animations/happy/steps/0/expression')
  })

  it('requires neutral to be the first expression-order entry', () => {
    const definition = definitionFixture()
    definition.expressionOrder = ['happy-smile', 'neutral']

    expectError(definition, 'neutral_not_first', '/expressionOrder/0')
  })

  it('rejects non-finite numbers, non-plain objects, and invalid blink ranges', () => {
    const nonFinite = definitionFixture()
    nonFinite.body.primary.width = Number.POSITIVE_INFINITY
    expectError(nonFinite, 'non_finite_number', '/body/primary/width')

    const nonPlain = definitionFixture()
    nonPlain.colors = new (class {
      body = '#abcdef' as const
      eyes = '#123456' as const
    })()
    expectError(nonPlain, 'non_plain_object', '/colors')

    const interval = definitionFixture()
    interval.animations.happy.blink.minIntervalMs = 500
    interval.animations.happy.blink.maxIntervalMs = 499
    expectError(interval, 'invalid_interval_range', '/animations/happy/blink/minIntervalMs')
  })

  it.each([
    ['dimension minimum', (value: AvatarDefinition) => (value.body.primary.width = 0), 'minimum'],
    [
      'dimension maximum',
      (value: AvatarDefinition) => (value.body.primary.height = 10000.1),
      'maximum',
    ],
    [
      'roundness minimum',
      (value: AvatarDefinition) => (value.body.primary.roundness = -0.1),
      'minimum',
    ],
    [
      'roundness maximum',
      (value: AvatarDefinition) => (value.body.primary.roundness = 2.1),
      'maximum',
    ],
    [
      'position minimum',
      (value: AvatarDefinition) => (value.body.nodes[0].position[0] = -10000.1),
      'minimum',
    ],
    [
      'position maximum',
      (value: AvatarDefinition) => (value.body.nodes[0].position[1] = 10000.1),
      'maximum',
    ],
    [
      'rotation minimum',
      (value: AvatarDefinition) => (value.body.nodes[0].rotation[0] = -360.1),
      'minimum',
    ],
    [
      'rotation maximum',
      (value: AvatarDefinition) => (value.body.nodes[0].rotation[1] = 360.1),
      'maximum',
    ],
    [
      'perspective minimum',
      (value: AvatarDefinition) => (value.expressions.neutral.perspective = 0.09),
      'minimum',
    ],
    [
      'perspective maximum',
      (value: AvatarDefinition) => (value.expressions.neutral.perspective = 10.01),
      'maximum',
    ],
    [
      'eye bound',
      (value: AvatarDefinition) => (value.expressions.neutral.eyes.left.x = 10001),
      'maximum',
    ],
    [
      'head bound',
      (value: AvatarDefinition) => (value.expressions.neutral.head.z = -10001),
      'minimum',
    ],
    [
      'hold minimum',
      (value: AvatarDefinition) => (value.animations.happy.steps[0].holdMs = 99),
      'minimum',
    ],
    [
      'hold maximum',
      (value: AvatarDefinition) => (value.animations.happy.steps[0].holdMs = 60001),
      'maximum',
    ],
    [
      'transition minimum',
      (value: AvatarDefinition) => (value.animations.happy.steps[0].transitionMs = -1),
      'minimum',
    ],
    [
      'transition maximum',
      (value: AvatarDefinition) => (value.animations.happy.steps[0].transitionMs = 5001),
      'maximum',
    ],
    [
      'blink initial delay',
      (value: AvatarDefinition) => (value.animations.happy.blink.initialDelayMs = 60001),
      'maximum',
    ],
    [
      'blink interval minimum',
      (value: AvatarDefinition) => (value.animations.happy.blink.minIntervalMs = 249),
      'minimum',
    ],
    [
      'blink interval maximum',
      (value: AvatarDefinition) => (value.animations.happy.blink.maxIntervalMs = 120001),
      'maximum',
    ],
    [
      'blink duration minimum',
      (value: AvatarDefinition) => (value.animations.happy.blink.durationMs = 49),
      'minimum',
    ],
    [
      'blink duration maximum',
      (value: AvatarDefinition) => (value.animations.happy.blink.durationMs = 2001),
      'maximum',
    ],
  ])('enforces the documented %s boundary', (_name, mutate, code) => {
    const definition = definitionFixture()
    mutate(definition)
    expectError(definition, code)
  })

  it('accepts all inclusive numeric boundaries', () => {
    const definition = definitionFixture()
    definition.body.primary.width = 0.001
    definition.body.primary.height = 10000
    definition.body.primary.roundness = 0
    definition.body.primary.morphRoundness = 2
    definition.body.primary.tipRoundness = 2
    definition.body.primary.baseRoundness = 2
    definition.body.nodes[0].surface.roundness = 2
    definition.body.nodes[0].surface.morphRoundness = 2
    definition.body.nodes[0].surface.tipRoundness = 2
    definition.body.nodes[0].surface.baseRoundness = 2
    definition.body.nodes[0].position = [-10000, 0, 10000]
    definition.body.nodes[0].rotation = [-360, 0, 360]
    definition.expressions.neutral.head = { x: -10000, y: 0, z: 10000 }
    definition.expressions.neutral.perspective = 0.1
    definition.expressions['happy-smile'].perspective = 10
    definition.animations.happy.steps[0].holdMs = 60000
    definition.animations.happy.steps[0].transitionMs = 5000
    definition.animations.happy.blink = {
      enabled: false,
      initialDelayMs: 60000,
      minIntervalMs: 250,
      maxIntervalMs: 120000,
      durationMs: 2000,
    }

    expect(validateAvatarDefinition(definition).ok).toBe(true)
  })

  it('enforces collection and text limits', () => {
    const nodes = definitionFixture()
    nodes.body.nodes = Array.from({ length: 17 }, () => structuredClone(nodes.body.nodes[0]))
    expectError(nodes, 'maxItems', '/body/nodes')

    const steps = definitionFixture()
    steps.animations.happy.steps = Array.from({ length: 129 }, () => ({
      ...steps.animations.happy.steps[0],
    }))
    expectError(steps, 'maxItems', '/animations/happy/steps')

    const text = definitionFixture()
    text.name = 'n'.repeat(121)
    text.animations.happy.metadata!.label = 'l'.repeat(121)
    text.animations.happy.metadata!.description = 'd'.repeat(513)
    text.animations.happy.metadata!.group = 'g'.repeat(65)
    expectError(text, 'maxLength')
  })

  it('enforces expression and animation collection limits', () => {
    const expressions = definitionFixture()
    const pose = expressions.expressions['happy-smile']
    expressions.expressions = { neutral: expressions.expressions.neutral }
    expressions.expressionOrder = ['neutral']
    for (let index = 0; index < 128; index += 1) {
      const key = `pose-${index}`
      expressions.expressions[key] = structuredClone(pose)
      expressions.expressionOrder.push(key)
    }
    expectError(expressions, 'maxProperties', '/expressions')

    const animations = definitionFixture()
    const animation = animations.animations.happy
    animations.animations = {}
    animations.animationOrder = []
    for (let index = 0; index < 65; index += 1) {
      const key = `animation-${index}`
      animations.animations[key] = structuredClone(animation)
      animations.animationOrder.push(key)
    }
    expectError(animations, 'maxProperties', '/animations')
  })

  it('accepts exact collection and text maxima', () => {
    const definition = definitionFixture()
    definition.name = 'n'.repeat(120)
    definition.animations.happy.metadata = {
      label: 'l'.repeat(120),
      description: 'd'.repeat(512),
      group: 'g'.repeat(64),
    }
    definition.body.nodes = Array.from({ length: 16 }, () =>
      structuredClone(definition.body.nodes[0])
    )
    definition.animations.happy.steps = Array.from({ length: 128 }, () => ({
      ...definition.animations.happy.steps[0],
    }))

    expect(validateAvatarDefinition(definition).ok).toBe(true)
  })

  it('enforces the 64-character semantic-key maximum', () => {
    const definition = definitionFixture()
    const expression = definition.expressions['happy-smile']
    delete definition.expressions['happy-smile']
    const key = `a${'b'.repeat(64)}`
    definition.expressions[key] = expression
    definition.expressionOrder = ['neutral', key]

    expectError(definition, 'maxLength', `/expressions/${key}`)
  })

  it('requires lowercase six-digit colors and known secondary surface types', () => {
    const color = definitionFixture()
    color.colors.body = '#ABCDEF'
    expectError(color, 'pattern', '/colors/body')

    const surface = definitionFixture()
    surface.body.nodes[0].surface.type = 'cursor' as 'sphere'
    expectError(surface, 'enum', '/body/nodes/0/surface/type')
  })
})

describe('bounded avatar JSON parser', () => {
  it('rejects duplicate object members at the second member path', () => {
    const result = parseAvatarDefinition('{"schema":1,"schema":2}')

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ path: '/schema', code: 'duplicate_key' })],
    })
  })

  it('rejects oversized UTF-8 input and excessive nesting', () => {
    const oversized = parseAvatarDefinition(' '.repeat(AVATAR_DEFINITION_MAX_BYTES + 1))
    expect(oversized).toEqual({
      ok: false,
      errors: [expect.objectContaining({ path: '', code: 'max_bytes' })],
    })

    const nested = parseAvatarDefinition(`${'['.repeat(33)}null${']'.repeat(33)}`)
    expect(nested).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: 'max_depth' })],
    })
  })

  it('accepts the exact byte limit and depth limit before schema validation', () => {
    const json = JSON.stringify(definitionFixture())
    const jsonBytes = new TextEncoder().encode(json).byteLength
    const exactBytes = `${json}${' '.repeat(AVATAR_DEFINITION_MAX_BYTES - jsonBytes)}`
    expect(new TextEncoder().encode(exactBytes)).toHaveLength(AVATAR_DEFINITION_MAX_BYTES)
    expect(parseAvatarDefinition(exactBytes).ok).toBe(true)

    const depth32 = `${'['.repeat(32)}null${']'.repeat(32)}`
    const result = parseAvatarDefinition(depth32)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(error => error.code === 'max_depth')).toBe(false)
  })

  it('rejects overlong decoded strings before schema validation', () => {
    const result = parseAvatarDefinition(`{"name":"${'a'.repeat(513)}"}`)
    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ path: '/name', code: 'string_too_long' })],
    })
  })

  it('applies semantic-key limits while tokenizing and treats prototype keys as data', () => {
    const longKey = `a${'b'.repeat(64)}`
    const longKeyResult = parseAvatarDefinition(`{"expressions":{"${longKey}":null}}`)
    expect(longKeyResult).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          path: `/expressions/${longKey}`,
          code: 'string_too_long',
        }),
      ],
    })

    const prototypeResult = parseAvatarDefinition('{"__proto__":{"polluted":true}}')
    expect(prototypeResult.ok).toBe(false)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
    if (!prototypeResult.ok) {
      expect(prototypeResult.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: '/__proto__', code: 'additionalProperties' }),
        ])
      )
    }
  })

  it('parses a valid definition and rejects malformed JSON', () => {
    expect(parseAvatarDefinition(JSON.stringify(definitionFixture())).ok).toBe(true)
    const malformed = parseAvatarDefinition('{"schema":]')
    expect(malformed).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: 'invalid_json' })],
    })
  })
})

describe('Studio to avatar definition conversion', () => {
  it('exports the complete bundled document with curated semantic keys', () => {
    const document = loadStudioDocument({ getItem: () => null })
    const avatar = document.library.avatars[0]
    const behavior = resolveAvatarBehavior(avatar, {
      expressions: document.expressions,
      sequences: document.sequences,
    })

    const result = createAvatarDefinition({ avatar, behavior })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.expressionOrder).toHaveLength(31)
    expect(result.value.expressionOrder[0]).toBe('neutral')
    expect(result.value.animationOrder).toHaveLength(25)
    expect(result.value.animationOrder).toContain('idle')
    expect(result.value.animations.idle.steps.map(step => step.expression)).toEqual([
      'upward-side-glance',
      'curious-left',
    ])
    expect(JSON.stringify(result.value)).not.toContain('expression-00')
  })

  it('exports a valid expression-only definition when no animation is selected', () => {
    const behavior = behaviorFixture()
    const result = createAvatarDefinition({
      avatar: avatarFixture(),
      behavior: { ...behavior, sequences: [] },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.expressionOrder).toEqual(['neutral', 'happy-smile'])
    expect(result.value.animations).toEqual({})
    expect(result.value.animationOrder).toEqual([])
  })

  it('rejects newly created custom content until semantic keys are supplied', () => {
    const expression = { ...initialExpressions[0], id: 'expression-custom', semanticKey: undefined }
    const sequence = createSequence(expression.id)

    expect(expression.semanticKey).toBeUndefined()
    expect(sequence.semanticKey).toBeUndefined()
    const result = createAvatarDefinition({
      avatar: avatarFixture(),
      behavior: { expressions: [expression], sequences: [sequence] },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.map(error => error.code)).toEqual(
        expect.arrayContaining(['missing_semantic_key'])
      )
    }
  })

  it('preserves geometry, colors, timing, motion, and resolves avatar eye defaults', () => {
    const avatar = avatarFixture()
    const behavior = behaviorFixture()
    const result = createAvatarDefinition({ avatar, behavior })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.body.primary).toEqual(avatar.body.primary)
    expect(result.value.body.nodes).toEqual([
      {
        surface: avatar.body.nodes[0].surface,
        position: avatar.body.nodes[0].position,
        rotation: avatar.body.nodes[0].rotation,
      },
    ])
    expect(result.value.body.nodes[0]).not.toHaveProperty('id')
    expect(result.value.body.nodes[0]).not.toHaveProperty('name')
    expect(result.value.colors).toEqual(avatar.colors)
    expect(result.value.expressions.neutral.eyes.left.width).toBe(defaultExpression.widthLeft + 3)
    expect(result.value.expressions.neutral.eyes.right.y).toBe(defaultExpression.positionYRight - 4)
    expect(result.value.expressions['happy-smile'].eyes.left.width).toBeCloseTo(
      behavior.expressions[0].widthLeft + 3
    )
    expect(result.value.expressions['happy-smile'].colors).toEqual({
      body: '#fedcba',
      eyes: '#654321',
    })
    expect(result.value.expressions['happy-smile'].motion).toEqual({
      eyes: 'microSaccades',
      body: 'slowDrift',
    })
    expect(result.value.expressionOrder).toEqual(['neutral', 'happy-smile'])
    expect(result.value.animations.happy).toMatchObject({
      playbackMode: 'once',
      steps: [
        {
          expression: 'happy-smile',
          holdMs: 1234,
          transitionMs: 432,
          transition: 'snappy',
        },
      ],
      blink: behavior.sequences[0].blink,
    })
  })

  it.each([
    [undefined, 'missing_semantic_key'],
    ['Bad Key', 'invalid_semantic_key'],
    ['neutral', 'reserved_semantic_key'],
  ])('rejects an unexportable expression semantic key', (semanticKey, code) => {
    const behavior = behaviorFixture()
    behavior.expressions[0].semanticKey = semanticKey
    const result = createAvatarDefinition({ avatar: avatarFixture(), behavior })

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code })]))
  })

  it('rejects duplicate keys and unresolved animation expression references', () => {
    const duplicate = behaviorFixture()
    duplicate.expressions.push({ ...duplicate.expressions[0], id: 'other-expression' })
    const duplicateResult = createAvatarDefinition({ avatar: avatarFixture(), behavior: duplicate })
    expect(duplicateResult.ok).toBe(false)
    if (!duplicateResult.ok) {
      expect(duplicateResult.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'duplicate_semantic_key' })])
      )
    }

    const dangling = behaviorFixture()
    dangling.sequences[0].steps[0].expressionId = 'missing-expression'
    const danglingResult = createAvatarDefinition({ avatar: avatarFixture(), behavior: dangling })
    expect(danglingResult.ok).toBe(false)
    if (!danglingResult.ok) {
      expect(danglingResult.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: '/studio/animations/0/steps/0/expressionId',
            code: 'unresolved_expression_reference',
          }),
        ])
      )
    }
  })

  it('does not mutate Studio inputs', () => {
    const avatar = avatarFixture()
    const behavior = behaviorFixture()
    const before = JSON.stringify({ avatar, behavior })

    createAvatarDefinition({ avatar, behavior })

    expect(JSON.stringify({ avatar, behavior })).toBe(before)
    expect(defaultAvatarColors).toEqual({ body: '#7c89ff', eyes: '#7c89ff' })
  })
})

describe('runtime definition filenames', () => {
  it('creates a sanitized runtime-definition filename', () => {
    expect(avatarDefinitionFileName('  Éric Avatar!  ')).toBe('eric-avatar.avatar.json')
    expect(avatarDefinitionFileName('***')).toBe('avatar.avatar.json')
  })
})
