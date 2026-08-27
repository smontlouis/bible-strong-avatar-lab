import { avatarIdentityExpression, defaultExpression } from '@/features/avatar/presets'
import { createInitialSequences, NEUTRAL_EXPRESSION_ID } from '@/features/animation/sequences'
import { interpolatePose, poseFromExpression } from '@/features/avatar/geometry'
import {
  applyAvatarEyeDefaults,
  cloneAvatarBehavior,
  createAvatar,
  createUnkeyedExpressionCopy,
  defaultAvatarEyes,
  parseAvatarEyeDefaults,
  parseAvatarLibrary,
  parseExpressions,
  parseAvatarRenderStyle,
  overrideExpressionMouthNumeric,
  prepareMouthTransition,
  resolveAvatarBehavior,
} from '@/features/avatar/avatars'
import { initialExpressions } from '@/features/avatar/presets'

describe('avatar eye defaults', () => {
  it('persists automatic blinking and keeps it disabled by default', () => {
    expect(parseExpressions([{ ...defaultExpression, blinking: true }])[0].blinking).toBe(true)
    expect(parseExpressions([{ ...defaultExpression, blinking: false }])[0].blinking).toBe(false)
    expect(parseExpressions([{ ...defaultExpression, blinking: 'invalid' }])[0].blinking).toBe(
      undefined
    )
  })

  it('keeps the avatar identity preview independent from expression 00', () => {
    const editedFirstExpression = { ...initialExpressions[0], headX: 65, headY: -40, headZ: 20 }

    expect(editedFirstExpression).not.toMatchObject({ headX: 0, headY: 0, headZ: 0 })
    expect(avatarIdentityExpression).toMatchObject({ headX: 0, headY: 0, headZ: 0 })
    expect(avatarIdentityExpression.id).not.toBe(editedFirstExpression.id)
  })

  it('clears the public semantic key when creating custom content from a preset', () => {
    const source = { ...defaultExpression, semanticKey: 'attentive-left' }

    const copy = createUnkeyedExpressionCopy(source, 'expression-copy')

    expect(copy.id).toBe('expression-copy')
    expect(copy.semanticKey).toBeUndefined()
    expect(source.semanticKey).toBe('attentive-left')
  })

  it('keeps the historical rendering when using default values', () => {
    expect(applyAvatarEyeDefaults(defaultExpression, defaultAvatarEyes)).toEqual(defaultExpression)
  })

  it('composes avatar defaults as variations around the neutral expression', () => {
    const expression = { ...defaultExpression, widthLeft: 28, positionYLeft: 5 }
    const eyes = { ...defaultAvatarEyes, widthLeft: 30, positionYLeft: -12 }

    const result = applyAvatarEyeDefaults(expression, eyes)

    expect(result.widthLeft).toBe(38)
    expect(result.positionYLeft).toBe(0)
    expect(expression.widthLeft).toBe(28)
  })

  it('composes pose translation around the avatar neutral position', () => {
    const neutral = { ...defaultAvatarEyes, positionX: 18, positionY: -12, positionZ: 40 }
    const expression = {
      ...defaultExpression,
      positionX: 7,
      positionY: 2,
      positionZ: -10,
    }

    expect(applyAvatarEyeDefaults(expression, neutral)).toMatchObject({
      positionX: 25,
      positionY: -10,
      positionZ: 30,
    })
  })

  it('sanitizes partial persisted values', () => {
    const result = parseAvatarEyeDefaults({ widthLeft: 42, heightRight: Number.NaN })

    expect(result.widthLeft).toBe(42)
    expect(result.heightRight).toBe(defaultAvatarEyes.heightRight)
    expect(result.spacing).toBe(defaultAvatarEyes.spacing)
  })

  it('inherits the neutral face while preserving explicit expression overrides', () => {
    const neutral = {
      ...defaultAvatarEyes,
      eyeShape: 'ellipse' as const,
      mouthEnabled: true,
      mouthCurve: 35,
      noseEnabled: true,
    }

    const inherited = applyAvatarEyeDefaults(defaultExpression, neutral)
    const overridden = applyAvatarEyeDefaults(
      {
        ...defaultExpression,
        eyeShape: 'rounded',
        mouthEnabled: false,
        mouthShape: 'curve',
        mouthCurve: -40,
      },
      neutral
    )

    expect(inherited.eyeShape).toBe('ellipse')
    expect(inherited.mouthEnabled).toBe(true)
    expect(inherited.mouthCurve).toBe(35)
    expect(inherited.noseEnabled).toBe(true)
    expect(overridden.eyeShape).toBe('rounded')
    expect(overridden.mouthEnabled).toBe(false)
    expect(overridden.mouthCurve).toBe(-50)
  })

  it.each(['curve', 'ellipse', 'rounded', 'rounded-triangle'] as const)(
    'fully inherits neutral %s mouth geometry when the expression does not define it',
    mouthShape => {
      const neutral = {
        ...defaultAvatarEyes,
        mouthEnabled: true,
        mouthShape,
        mouthCurve: 63,
        mouthWidth: 37,
        mouthHeight: 13,
        mouthX: 4,
        mouthY: 31,
        mouthAngle: -9,
      }

      const inherited = applyAvatarEyeDefaults(defaultExpression, neutral)

      expect(inherited.mouthShape ?? 'curve').toBe(mouthShape)
      expect(inherited).toMatchObject({
        mouthEnabled: true,
        mouthCurve: 63,
        mouthWidth: 37,
        mouthHeight: 13,
        mouthX: 4,
        mouthY: 31,
        mouthAngle: -9,
      })
    }
  )

  it.each(['curve', 'ellipse', 'rounded', 'rounded-triangle'] as const)(
    'materializes an inherited %s mouth for a continuous same-shape transition',
    mouthShape => {
      const neutral = {
        ...defaultAvatarEyes,
        mouthShape,
        mouthCurve: 20,
        mouthWidth: 32,
        mouthHeight: 12,
        mouthX: 3,
        mouthY: 30,
        mouthAngle: -4,
      }
      const target = {
        ...defaultExpression,
        mouthShape,
        mouthCurve: 75,
      }

      const prepared = prepareMouthTransition(defaultExpression, target, neutral)

      expect(prepared.from).toMatchObject({
        mouthShape,
        mouthCurve: defaultAvatarEyes.mouthCurve,
        mouthWidth: defaultAvatarEyes.mouthWidth,
        mouthHeight: defaultAvatarEyes.mouthHeight,
        mouthX: defaultAvatarEyes.mouthX,
        mouthY: defaultAvatarEyes.mouthY,
        mouthAngle: defaultAvatarEyes.mouthAngle,
      })
      expect(applyAvatarEyeDefaults(prepared.from, neutral)).toMatchObject({
        mouthShape,
        mouthCurve: 20,
        mouthWidth: 32,
        mouthHeight: 12,
        mouthX: 3,
        mouthY: 30,
        mouthAngle: -4,
      })
      const midpoint = interpolatePose(
        poseFromExpression(prepared.from),
        poseFromExpression(prepared.to),
        0.5
      ).expression
      expect(applyAvatarEyeDefaults(midpoint, neutral).mouthCurve).toBe(35)
      expect(prepared.to).toBe(target)
      expect(prepared.changesShape).toBe(false)
    }
  )

  it('materializes inherited mouth geometry when the transition changes shape', () => {
    const from = { ...defaultExpression }
    const to = { ...defaultExpression, mouthShape: 'ellipse' as const }

    const prepared = prepareMouthTransition(from, to, defaultAvatarEyes)

    expect(prepared.from).toMatchObject({ mouthShape: 'curve', mouthWidth: 20, mouthY: 35 })
    expect(prepared.to).toBe(to)
    expect(prepared.changesShape).toBe(true)
  })

  it('preserves every visible inherited value when the first mouth field is edited', () => {
    const neutral = {
      ...defaultAvatarEyes,
      mouthEnabled: true,
      mouthShape: 'curve' as const,
      mouthCurve: 45,
      mouthWidth: 20,
      mouthHeight: 6,
      mouthX: 0,
      mouthY: 35,
      mouthAngle: 0,
    }
    const expressionWithStaleValues = {
      ...defaultExpression,
      mouthWidth: 42,
      mouthY: 45,
    }

    const updated = overrideExpressionMouthNumeric(
      expressionWithStaleValues,
      neutral,
      'mouthCurve',
      46
    )

    expect(applyAvatarEyeDefaults(updated, neutral)).toMatchObject({
      mouthShape: 'curve',
      mouthCurve: 46,
      mouthWidth: 20,
      mouthHeight: 6,
      mouthX: 0,
      mouthY: 35,
      mouthAngle: 0,
    })
  })
})

describe('avatar render style', () => {
  it('keeps vector rendering as the compatible default', () => {
    expect(parseAvatarRenderStyle(undefined)).toEqual({ type: 'vector' })
  })

  it('falls back to vector rendering while pixel mode is disabled', () => {
    expect(
      parseAvatarRenderStyle({
        type: 'pixel',
        resolution: 500,
      })
    ).toEqual({ type: 'vector' })
    expect(parseAvatarRenderStyle({ type: 'pixel', resolution: 1 })).toEqual({ type: 'vector' })
  })

  it('sanitizes a persisted vector outline', () => {
    expect(
      parseAvatarRenderStyle({
        type: 'vector',
        outline: { enabled: true, color: '#123456', width: 99, opacity: -2 },
      })
    ).toEqual({
      type: 'vector',
      outline: { enabled: true, color: '#123456', width: 24, opacity: 0 },
    })
  })
})

describe('avatar behavior library', () => {
  const base = {
    expressions: initialExpressions,
    sequences: createInitialSequences(),
  }

  it('inherits the base library until the avatar owns a customization', () => {
    const avatar = createAvatar('Strobi')

    expect(resolveAvatarBehavior(avatar, base)).toBe(base)
  })

  it('clones expressions, animations and nested steps as one independent library', () => {
    const behavior = cloneAvatarBehavior(base)

    expect(behavior).not.toBe(base)
    expect(behavior.expressions).not.toBe(base.expressions)
    expect(behavior.sequences).not.toBe(base.sequences)
    expect(behavior.sequences[0].steps).not.toBe(base.sequences[0].steps)
    expect(behavior.sequences[0].blink).not.toBe(base.sequences[0].blink)
  })

  it('preserves an owned neutral-only behavior library on reload', () => {
    const avatar = createAvatar('Neutral only')
    const sequence = createInitialSequences()[0]
    avatar.behavior = {
      expressions: [],
      sequences: [
        {
          ...sequence,
          steps: [{ ...sequence.steps[0], expressionId: NEUTRAL_EXPRESSION_ID }],
        },
      ],
    }
    const fallbackAvatar = createAvatar('Fallback')

    const parsed = parseAvatarLibrary(
      { activeAvatarId: avatar.id, avatars: [avatar] },
      { activeAvatarId: fallbackAvatar.id, avatars: [fallbackAvatar] },
      base
    )

    expect(parsed.avatars[0].behavior?.expressions).toEqual([])
    expect(parsed.avatars[0].behavior?.sequences[0].steps[0].expressionId).toBe(
      NEUTRAL_EXPRESSION_ID
    )
  })
})
