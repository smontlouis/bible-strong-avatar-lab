// @vitest-environment jsdom
import type { AvatarCharacter } from '@bible-strong/avatar-core'
import { act, createRef } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { Avatar, createAvatar, type AvatarHandle } from '../index'

const character: AvatarCharacter = {
  name: 'Fixture',
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [
      {
        color: '#e5a15b',
        surface: { type: 'sphere', width: 70, height: 70, depth: 70, roundness: 1 },
        position: [-100, 0, 20],
        rotation: [0, 0, 0],
      },
    ],
  },
  colors: { body: '#5b7fe5', eyes: '#111316' },
  face: { eyes: { width: 1, height: 1, gap: 1, shiftY: 0 }, perspective: 1 },
}

// Frames are asked for by hand: `frames(n)` runs n of them, a sixtieth of a second apart.
let pending: FrameRequestCallback[] = []
let clock = 0
const frames = (count: number) => {
  act(() => {
    for (let index = 0; index < count; index += 1) {
      clock += 1000 / 60
      const due = pending
      pending = []
      due.forEach(callback => callback(clock))
    }
  })
}
let reduced = false

beforeEach(() => {
  pending = []
  clock = 0
  reduced = false
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => pending.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = []
  })
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})
afterEach(() => vi.unstubAllGlobals())

const part = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-part="${name}"]`)!

describe('@bible-strong/avatar-react', () => {
  it('draws the character at once, before any frame', () => {
    const { container, getByRole } = render(<Avatar character={character} ariaLabel="Fixture" />)
    expect(getByRole('img', { name: 'Fixture' })).toBeTruthy()
    expect(part(container, 'head').getAttribute('d')).toMatch(/^M/)
    expect(part(container, 'left').getAttribute('d')).toMatch(/^M/)
    expect(part(container, 'head').getAttribute('fill')).toBe('#5b7fe5')
  })

  it('moves without a render of React: the paths change from frame to frame', () => {
    const { container } = render(<Avatar character={character} clip="Streaming_A" />)
    frames(2)
    const before = part(container, 'left').getAttribute('d')
    frames(30)
    expect(part(container, 'left').getAttribute('d')).not.toBe(before)
  })

  it('is idle when nothing is asked of it, and goes to the state it is given', () => {
    const states: (string | null)[] = []
    const { rerender } = render(
      <Avatar character={character} onStateChange={state => states.push(state)} />
    )
    frames(2)
    rerender(
      <Avatar character={character} state="finished" onStateChange={state => states.push(state)} />
    )
    frames(2)
    expect(states).toEqual(['finished'])
    // `finished` plays its two clips then gives way to `idle` by itself.
    frames(60 * 9)
    expect(states).toEqual(['finished', 'idle'])
  })

  it('holds the face it is given whatever it does', () => {
    const wide = (container: HTMLElement) => {
      const numbers = (
        part(container, 'left')
          .getAttribute('d')!
          .match(/-?\d+\.?\d*/g) ?? []
      ).map(Number)
      const xs = numbers.filter((_, index) => index % 2 === 0)
      return Math.max(...xs) - Math.min(...xs)
    }
    const { container, rerender } = render(<Avatar character={character} clip="Logo_A" />)
    frames(30)
    const neutral = wide(container)
    rerender(<Avatar character={character} clip="Logo_A" face="surprised" />)
    frames(40)
    expect(wide(container)).toBeGreaterThan(neutral * 1.3)
  })

  it('takes a gesture through its ref', () => {
    const handle = createRef<AvatarHandle>()
    const { container } = render(<Avatar character={character} clip="Blocked_B" ref={handle} />)
    frames(30)
    const before = part(container, 'body').getAttribute('transform')
    act(() => handle.current!.poke('bounce'))
    frames(18)
    expect(part(container, 'body').getAttribute('transform')).not.toBe(before)
    frames(40)
    expect(part(container, 'body').getAttribute('transform')).toBe(before)
  })

  it('turns into a spinner: marks appear and the face goes', () => {
    const { container } = render(<Avatar character={character} state="thinking" />)
    frames(120)
    expect(part(container, 'mark-0').getAttribute('d')).toMatch(/^M/)
    expect(part(container, 'left').getAttribute('d')).toBe('')
    expect(Number(part(container, 'disc').getAttribute('opacity'))).toBeGreaterThan(0.99)
  })

  it('says what a scenario says', () => {
    const texts: (string | null)[] = []
    render(<Avatar character={character} routine="code" onText={text => texts.push(text)} />)
    frames(60 * 5)
    expect(texts.length).toBeGreaterThan(1)
    expect(texts.at(-1)).toBe('Reading the file')
  })

  it('draws one settled picture, and asks for no frame, for who wants less motion', () => {
    reduced = true
    const { container } = render(<Avatar character={character} state="streaming" />)
    expect(pending).toHaveLength(0)
    expect(part(container, 'head').getAttribute('d')).toMatch(/^M/)
  })

  it('clips the front copy of a coloured node, as the core asks', () => {
    const { container } = render(<Avatar character={character} clip="Blocked_B" />)
    frames(2)
    const front = part(container, 'front-0')
    expect(front.getAttribute('fill')).toBe('#e5a15b')
    expect(front.getAttribute('clip-path')).toMatch(/^url\(#.*-front-0\)$/)
  })

  it('makes a component for one character', () => {
    const Fixture = createAvatar(character)
    const { getByRole } = render(<Fixture ariaLabel="Mine" size={32} />)
    expect(getByRole('img', { name: 'Mine' })).toBeTruthy()
  })
})
