// @vitest-environment jsdom

import definitionJson from '../../../../examples/react-vite-consumer/src/strobi.avatar.json'
import { createAvatar } from '../index'

describe('@bible-strong/avatar-web', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="avatar"></div>'
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('mounts the shared avatar definition without React', () => {
    const avatar = createAvatar('#avatar', {
      definition: definitionJson,
      defaultExpression: 'neutral',
      size: 180,
    })

    expect(document.querySelector('#avatar svg')).not.toBeNull()
    expect(document.querySelectorAll('#avatar svg > path')).toHaveLength(37)
    expect(document.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Procedural avatar'
    )
    expect(avatar.getState()).toMatchObject({
      activeExpression: 'neutral',
      status: 'stopped',
    })

    avatar.destroy()
    expect(document.querySelector('#avatar svg')).toBeNull()
  })

  it('tints fixed-color body parts when an expression overrides the body color', () => {
    const tintedDefinition = {
      ...definitionJson,
      body: {
        ...definitionJson.body,
        nodes: [
          {
            layer: 'back',
            color: '#a95f47',
            surface: {
              type: 'ellipse',
              width: 40,
              height: 68,
              depth: 36,
              roundness: 1,
            },
            position: [-64, -80, -18],
            rotation: [-4, -7, 8],
          },
        ],
      },
      expressions: {
        ...definitionJson.expressions,
        neutral: {
          ...definitionJson.expressions.neutral,
          colors: { body: '#ba3636' },
        },
      },
    }

    const avatar = createAvatar('#avatar', {
      definition: tintedDefinition,
      defaultExpression: 'neutral',
    })
    const firstBodyPart = document.querySelector('#avatar svg > path')

    expect(firstBodyPart?.getAttribute('fill')).toBe('#ba3636')
    avatar.destroy()
  })

  it('returns typed errors for unknown targets', () => {
    const avatar = createAvatar('#avatar', { definition: definitionJson })

    expect(avatar.play('missing')).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'unknown_animation', key: 'missing' }),
    })
    expect(avatar.setExpression('missing')).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'unknown_expression', key: 'missing' }),
    })
  })
})
