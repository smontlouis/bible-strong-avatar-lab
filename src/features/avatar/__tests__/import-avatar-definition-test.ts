import { describe, expect, it } from 'vitest'

import strobi from '../../../../examples/react-vite-consumer/src/strobi.avatar.json'
import { createAvatarDefinition } from '../avatarDefinition'
import { isAvatarDefinitionSource, studioAvatarFromDefinition } from '../importAvatarDefinition'

describe('studioAvatarFromDefinition', () => {
  it('recognises a definition and rejects a studio project', () => {
    expect(isAvatarDefinitionSource(strobi)).toBe(true)
    expect(isAvatarDefinitionSource({ version: 2, library: { avatars: [] } })).toBe(false)
    expect(isAvatarDefinitionSource(null)).toBe(false)
  })

  it('rejects a file that is not a valid definition', () => {
    expect(() => studioAvatarFromDefinition({ schema: 'bible-strong/avatar-definition' })).toThrow()
  })

  it('round-trips back to the same definition', () => {
    const { avatar, expressions, sequences } = studioAvatarFromDefinition(strobi)

    expect(avatar.name).toBe(strobi.name)
    expect(avatar.colors).toEqual(strobi.colors)
    expect(avatar.body.primary).toEqual(strobi.body.primary)
    expect(avatar.body.nodes).toHaveLength(strobi.body.nodes.length)
    // `neutral` becomes the avatar's eye defaults rather than an expression.
    expect(expressions).toHaveLength(strobi.expressionOrder.length - 1)
    expect(expressions.map(e => e.semanticKey)).not.toContain('neutral')
    expect(sequences).toHaveLength(strobi.animationOrder.length)

    // Eye defaults are taken from `neutral`, the resting pose.
    expect(avatar.eyes.spacing).toBe(strobi.expressions.neutral.eyes.spacing)

    const result = createAvatarDefinition({ avatar, behavior: { expressions, sequences } })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.body).toEqual(strobi.body)
    expect(result.value.colors).toEqual(strobi.colors)
    expect(result.value.expressionOrder).toEqual(strobi.expressionOrder)
    expect(result.value.animationOrder).toEqual(strobi.animationOrder)
    expect(result.value.expressions).toEqual(strobi.expressions)
  })
})
