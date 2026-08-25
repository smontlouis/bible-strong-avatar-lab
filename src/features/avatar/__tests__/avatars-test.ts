import { defaultExpression } from '@/features/avatar/presets'
import { createInitialSequences } from '@/features/animation/sequences'
import {
  applyAvatarEyeDefaults,
  cloneAvatarBehavior,
  createAvatar,
  createUnkeyedExpressionCopy,
  defaultAvatarEyes,
  ensurePrimitiveBundledAvatars,
  parseAvatarEyeDefaults,
  parseAvatarRenderStyle,
  resolveAvatarBehavior,
} from '@/features/avatar/avatars'
import { initialExpressions } from '@/features/avatar/presets'
import { surfacePresets } from '@/features/avatar/surfaces'

describe('avatar eye defaults', () => {
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

  it('sanitizes partial persisted values', () => {
    const result = parseAvatarEyeDefaults({ widthLeft: 42, heightRight: Number.NaN })

    expect(result.widthLeft).toBe(42)
    expect(result.heightRight).toBe(defaultAvatarEyes.heightRight)
    expect(result.spacing).toBe(defaultAvatarEyes.spacing)
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

  it('preserves the filled treatment for imported vector skins', () => {
    expect(parseAvatarRenderStyle({ type: 'vector', filled: true })).toEqual({
      type: 'vector',
      filled: true,
    })
  })
})

describe('OneWorks animal construction', () => {
  const createBundledLibrary = () => {
    const seed = createAvatar('Seed')
    seed.id = 'avatar-4b9ea0c1-286f-4aa1-b053-61fcc416ba7e'
    return ensurePrimitiveBundledAvatars({ activeAvatarId: seed.id, avatars: [seed] })
  }

  it('keeps the source occlusion order for every imported animal', () => {
    const library = createBundledLibrary()
    const layers = (id: string) =>
      library.avatars.find(avatar => avatar.id === id)?.body.nodes.map(node => node.layer)

    expect(layers('oneworks-cat')).toBeUndefined()
    expect(layers('oneworks-dog')).toEqual(['front', 'front'])
    expect(layers('oneworks-bear')).toEqual(['back', 'back'])
    expect(layers('oneworks-rabbit')).toEqual(['back', 'back'])
    expect(layers('oneworks-bun')).toEqual(['front'])
  })

  it('keeps the unfinished piglet hidden and removes a persisted copy', () => {
    const library = createBundledLibrary()
    const stored = {
      ...library,
      activeAvatarId: 'memento-piglet',
      avatars: [
        ...library.avatars,
        {
          ...createAvatar('Порося'),
          id: 'memento-piglet',
          body: {
            primary: { ...surfacePresets.sphere },
            nodes: [],
          },
        },
      ],
    }

    const restored = ensurePrimitiveBundledAvatars(stored)

    expect(restored.avatars.some(avatar => avatar.id === 'memento-piglet')).toBe(false)
    expect(restored.activeAvatarId).not.toBe('memento-piglet')
  })

  it('removes Cow Cat from a previously persisted library', () => {
    const library = createBundledLibrary()
    const cowCat = { ...createAvatar('Cow Cat'), id: 'oneworks-cat-cow' }
    const restored = ensurePrimitiveBundledAvatars({
      ...library,
      activeAvatarId: cowCat.id,
      avatars: [...library.avatars, cowCat],
    })

    expect(restored.avatars.some(avatar => avatar.id === cowCat.id)).toBe(false)
    expect(restored.activeAvatarId).not.toBe(cowCat.id)
  })

  it('repairs the previous persisted dog-ear layer and placement', () => {
    const library = createBundledLibrary()
    const stored = {
      ...library,
      avatars: library.avatars.map(avatar =>
        avatar.id !== 'oneworks-dog'
          ? avatar
          : {
              ...avatar,
              body: {
                ...avatar.body,
                nodes: avatar.body.nodes.map(node => ({
                  ...node,
                  layer: 'back' as const,
                  position: [node.position[0] < 0 ? -72 : 72, -52, 0] as const,
                })),
              },
            }
      ),
    }

    const dog = ensurePrimitiveBundledAvatars(stored).avatars.find(
      avatar => avatar.id === 'oneworks-dog'
    )!

    expect(dog.body.nodes.map(node => node.layer)).toEqual(['front', 'front'])
    expect(dog.body.nodes.map(node => node.position)).toEqual([
      [-82, -65, 0],
      [82, -65, 0],
    ])
  })

  it('moves previously persisted bear ears farther outside the head', () => {
    const library = createBundledLibrary()
    const stored = {
      ...library,
      avatars: library.avatars.map(avatar =>
        avatar.id !== 'oneworks-bear'
          ? avatar
          : {
              ...avatar,
              body: {
                ...avatar.body,
                nodes: avatar.body.nodes.map(node => ({
                  ...node,
                  position:
                    node.id === 'bear-ear-left'
                      ? ([-58, -72, -18] as const)
                      : ([58, -70, -20] as const),
                })),
              },
            }
      ),
    }

    const bear = ensurePrimitiveBundledAvatars(stored).avatars.find(
      avatar => avatar.id === 'oneworks-bear'
    )!

    expect(bear.body.nodes.map(node => node.position)).toEqual([
      [-64, -80, -18],
      [64, -78, -20],
    ])
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
})
