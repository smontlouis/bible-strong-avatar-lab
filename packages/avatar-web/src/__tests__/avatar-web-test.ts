// @vitest-environment jsdom

import { characterFromLegacyDefinition, validateAvatarDefinition } from '@bible-strong/avatar-core'

import legacyJson from '../../../../examples/react-vite-consumer/src/strobi.avatar.json'
import { createAvatar } from '../index'

let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 1
let clock = 0
let reduced = false

/** Run the frames asked for, `count` times, each a sixtieth of a second after the last. */
const run = (count: number) => {
  for (let step = 0; step < count; step += 1) {
    clock += 1000 / 60
    const due = [...frames.values()]
    frames = new Map()
    for (const callback of due) callback(clock)
  }
}

const head = () => document.querySelectorAll('#avatar svg > g > path')[0]?.getAttribute('d')

describe('@bible-strong/avatar-web', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="avatar"></div>'
    frames = new Map()
    clock = 0
    reduced = false
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrame++
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    // A media query list follows the setting, as the browser's does.
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return reduced
      },
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('draws a file of the first format as its character, without React', () => {
    const avatar = createAvatar('#avatar', { character: legacyJson, size: 180 })
    const host = document.querySelector('#avatar [role="img"]')
    expect(host?.getAttribute('aria-label')).toBe('Avatar')
    expect(document.querySelector('#avatar svg')?.getAttribute('viewBox')).toBe('-150 -150 300 300')
    expect(head()).toMatch(/^M/)
    expect(avatar.getState()).toEqual({ state: 'idle', clip: expect.any(String), paused: false })
    avatar.destroy()
    expect(document.querySelector('#avatar svg')).toBeNull()
    expect(frames.size).toBe(0)
  })

  it('reads a character as the Studio exports it, and says what is wrong with another', () => {
    const definition = validateAvatarDefinition(legacyJson)
    if (!definition.ok) throw new Error('The fixture is not valid')
    const character = characterFromLegacyDefinition(definition.value)
    expect(() => createAvatar('#avatar', { character }).destroy()).not.toThrow()
    expect(() => createAvatar('#avatar', { character: { body: {} } })).toThrow(
      /Invalid avatar character/
    )
  })

  it('moves at every frame while it is in sight', () => {
    createAvatar('#avatar', { character: legacyJson })
    const before = head()
    run(30)
    expect(head()).not.toBe(before)
    expect(frames.size).toBe(1)
  })

  it('plays what it is asked, and refuses a name it does not know', () => {
    const onStateChange = vi.fn()
    const avatar = createAvatar('#avatar', { character: legacyJson, onStateChange })
    expect(avatar.setState('nowhere')).toBe(false)
    expect(avatar.playClip('nothing')).toBe(false)

    expect(avatar.setState('thinking')).toBe(true)
    run(1)
    expect(onStateChange).toHaveBeenLastCalledWith('thinking')
    // An alias leads to its state.
    avatar.setState('dots')
    expect(avatar.getState().state).toBe('thinking')

    const clip = avatar.getState().clip!
    avatar.setState('happy')
    expect(avatar.playClip(clip)).toBe(true)
    run(1)
    expect(avatar.getState()).toMatchObject({ state: null, clip })
    expect(onStateChange).toHaveBeenLastCalledWith(null)
  })

  it('turns into a spinner for a state that asks for one', () => {
    const avatar = createAvatar('#avatar', { character: legacyJson, state: 'searching' })
    run(120)
    const marks = [...document.querySelectorAll('#avatar svg > path')].filter(path =>
      path.getAttribute('d')
    )
    expect(marks.length).toBeGreaterThan(0)
    avatar.destroy()
  })

  it('holds still when paused, and goes on when resumed', () => {
    const avatar = createAvatar('#avatar', { character: legacyJson, state: 'happy', paused: true })
    // Nothing is computed while it is paused.
    expect(frames.size).toBe(0)
    const held = head()
    avatar.setState('thinking')
    expect(head()).toBe(held)
    expect(avatar.getState().paused).toBe(true)
    avatar.resume()
    run(30)
    expect(head()).not.toBe(held)
  })

  it('looks at the point it is given, and turns there smoothly', () => {
    const middle = () => {
      const left = document.querySelectorAll('#avatar svg > g > g')[1]?.querySelector('path')
      const numbers = (left?.getAttribute('d')?.match(/-?\d+\.?\d*/g) ?? []).map(Number)
      const xs = numbers.filter((_, index) => index % 2 === 0)
      return xs.reduce((sum, x) => sum + x, 0) / xs.length
    }
    const avatar = createAvatar('#avatar', { character: legacyJson, clip: 'Blocked_B' })
    run(30)
    const ahead = middle()
    avatar.setLookAt([1, 0])
    run(1)
    const first = middle()
    run(90)
    const right = middle()
    expect(right - ahead).toBeGreaterThan(10)
    expect(first - ahead).toBeLessThan((right - ahead) / 2)
    avatar.setLookAt(null)
    run(90)
    expect(Math.abs(middle() - ahead)).toBeLessThan(2)
  })

  it('fades to grey when muted, and back', () => {
    const avatar = createAvatar('#avatar', { character: legacyJson, muted: true })
    const svg = document.querySelector<SVGSVGElement>('#avatar svg')!
    expect(svg.style.filter).toBe('grayscale(1)')
    expect(svg.style.transition).toContain('filter')
    avatar.setMuted(false)
    expect(svg.style.filter).toBe('')
  })

  it('stops computing once settled, eyes open, and wakes when asked for something', () => {
    const avatar = createAvatar('#avatar', { character: legacyJson, settleAfterMs: 500 })
    run(20)
    expect(frames.size).toBe(1)
    // Within a few seconds the eyes are open past the delay: the loop stops.
    run(60 * 6)
    expect(frames.size).toBe(0)
    const held = head()

    avatar.setState('happy')
    expect(frames.size).toBe(1)
    run(60 * 6)
    expect(frames.size).toBe(0)

    avatar.poke('nod')
    expect(frames.size).toBe(1)
    run(10)
    expect(head()).not.toBe(held)

    avatar.setSettleAfterMs(0)
    run(60 * 6)
    expect(frames.size).toBe(1)
  })

  it('stops its frames while out of sight', () => {
    let notify: IntersectionObserverCallback = () => undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback
        }
        observe() {}
        disconnect() {}
      }
    )
    createAvatar('#avatar', { character: legacyJson })
    const seen = (isIntersecting: boolean) =>
      notify([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
    seen(false)
    expect(frames.size).toBe(0)
    seen(true)
    expect(frames.size).toBe(1)
  })

  it('holds one settled picture for someone who asked for less motion', () => {
    reduced = true
    const avatar = createAvatar('#avatar', { character: legacyJson })
    expect(frames.size).toBe(0)
    expect(head()).toMatch(/^M/)
    avatar.setState('sleeping')
    expect(frames.size).toBe(0)
    expect(avatar.getState().state).toBe('sleeping')
  })
})
