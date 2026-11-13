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
    run(2)
    const held = head()
    run(30)
    expect(head()).toBe(held)
    expect(avatar.getState().paused).toBe(true)
    avatar.resume()
    run(30)
    expect(head()).not.toBe(held)
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
