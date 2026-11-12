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
    // The head, plus two slots behind and two in front for a body without nodes.
    expect(document.querySelectorAll('#avatar svg > path')).toHaveLength(5)
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

  it('keeps a frame loop running for an expression with automatic blinking', () => {
    const request = vi.fn(() => 1)
    vi.stubGlobal('requestAnimationFrame', request)
    const blinkingDefinition = structuredClone(definitionJson)
    Object.assign(blinkingDefinition.expressions.neutral, { blinking: true })

    const avatar = createAvatar('#avatar', {
      definition: blinkingDefinition,
      defaultExpression: 'neutral',
    })

    expect(request).toHaveBeenCalledOnce()
    avatar.destroy()
  })

  it('draws a held pose once, then again when a blink or the next step is due', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback)
    )
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const steady = structuredClone(definitionJson)
    // One long pose, reached at once, with a blink far away.
    Object.assign(steady.animations.idle, {
      steps: [{ expression: 'neutral', holdMs: 10_000, transitionMs: 0, transition: 'smooth' }],
      blink: { ...steady.animations.idle.blink, enabled: true, initialDelayMs: 4_000 },
    })
    const avatar = createAvatar('#avatar', { definition: steady, defaultAnimation: 'idle' })
    const head = document.querySelector('#avatar svg > path')
    if (!head) throw new Error('No head path')
    const write = vi.spyOn(head, 'setAttribute')
    const tick = (now: number) => frames.shift()?.(now)

    tick(16)
    const afterFirst = write.mock.calls.length
    expect(afterFirst).toBeGreaterThan(0)
    for (let now = 32; now < 3_900; now += 16) tick(now)
    // Nothing changed for four seconds: nothing was written, and the loop is still alive.
    expect(write.mock.calls.length).toBe(afterFirst)
    expect(frames).toHaveLength(1)
    tick(4_010)
    expect(write.mock.calls.length).toBeGreaterThan(afterFirst)

    avatar.destroy()
  })
})
