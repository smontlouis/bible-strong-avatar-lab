// @vitest-environment jsdom

import { type AvatarDefinition } from '@bible-strong/avatar-core'
import { act, createRef, Profiler, StrictMode } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { Avatar, type AvatarController } from '../LegacyAvatar'
import { createAvatar } from '../legacyCreateAvatar'

const expression = {
  head: { x: 0, y: 0, z: 0 },
  eyes: {
    left: { width: 28, height: 38, x: 0, y: 0, angle: 0 },
    right: { width: 28, height: 38, x: 0, y: 0, angle: 0 },
    spacing: 54,
  },
  perspective: 1,
  motion: { eyes: 'none', body: 'none' },
} as const

const ambientExpression = {
  ...expression,
  motion: { eyes: 'none', body: 'shake' },
} as const

const blinkingExpression = {
  ...expression,
  blinking: true,
} as const

const definition: AvatarDefinition = {
  schema: 'bible-strong/avatar-definition',
  schemaVersion: 1,
  name: 'React fixture',
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [],
  },
  colors: { body: '#5b7fe5', eyes: '#111316' },
  expressions: {
    neutral: expression,
    smile: { ...expression, head: { x: 0, y: 10, z: 0 } },
    restless: ambientExpression,
    blinking: blinkingExpression,
  },
  expressionOrder: ['neutral', 'smile', 'restless', 'blinking'],
  animations: {
    greet: {
      playbackMode: 'loop',
      steps: [{ expression: 'smile', holdMs: 1_000, transitionMs: 100, transition: 'smooth' }],
      blink: {
        enabled: false,
        initialDelayMs: 0,
        minIntervalMs: 1_000,
        maxIntervalMs: 1_000,
        durationMs: 100,
      },
    },
    'wave-once': {
      playbackMode: 'once',
      steps: [{ expression: 'smile', holdMs: 100, transitionMs: 0, transition: 'snappy' }],
      blink: {
        enabled: false,
        initialDelayMs: 0,
        minIntervalMs: 1_000,
        maxIntervalMs: 1_000,
        durationMs: 100,
      },
    },
  },
  animationOrder: ['greet', 'wave-once'],
}

beforeAll(() => {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})

describe('@bible-strong/avatar-react', () => {
  it('creates a validated concrete component from a definition', () => {
    const ConcreteAvatar = createAvatar(definition)
    const view = render(<ConcreteAvatar animation="greet" ariaLabel="Concrete avatar" />)

    expect(view.getByRole('img', { name: 'Concrete avatar' })).toBeTruthy()
  })

  it('rejects invalid definitions before creating a component', () => {
    expect(() => createAvatar({})).toThrow('Invalid avatar definition')
  })

  it('renders semantic SVG geometry', () => {
    const view = render(<Avatar definition={definition} ariaLabel="Assistant avatar" />)
    const avatar = view.getByRole('img', { name: 'Assistant avatar' })
    expect(avatar.classList.contains('bs-avatar')).toBe(true)
    expect(avatar.className).toBe('bs-avatar')
    expect(avatar.querySelector('svg path')).not.toBeNull()
  })

  it('clips the front copy of a coloured node to where it is nearer than the head', () => {
    const coloured: AvatarDefinition = {
      ...definition,
      body: {
        ...definition.body,
        nodes: [
          {
            color: '#e5a15b',
            surface: { type: 'sphere', width: 70, height: 70, depth: 70, roundness: 1 },
            position: [-100, 0, 20],
            rotation: [0, 0, 0],
          },
        ],
      },
    }
    const view = render(<Avatar definition={coloured} ariaLabel="Masked avatar" />)
    const svg = view.getByRole('img', { name: 'Masked avatar' }).querySelector('svg')
    const clip = svg?.querySelector('clipPath[id$="-front-0"]')
    const clipped = svg?.querySelector(':scope > path[clip-path]')

    expect(clip?.querySelector('path')?.getAttribute('d')).toMatch(/^M.*Z$/)
    expect(clipped?.getAttribute('clip-path')).toBe(`url(#${clip?.id})`)
    expect(clipped?.getAttribute('fill')).toBe('#e5a15b')

    const plain = render(<Avatar definition={definition} ariaLabel="Plain avatar" />)
    const plainSvg = plain.getByRole('img', { name: 'Plain avatar' }).querySelector('svg')
    expect(plainSvg?.querySelector(':scope > path[clip-path]')).toBeNull()
  })

  it('keeps stable SVG layer slots for nodes moving in front of or behind the head', () => {
    const view = render(<Avatar definition={definition} ariaLabel="Layered avatar" />)
    const svg = view.getByRole('img', { name: 'Layered avatar' }).querySelector('svg')

    // The head, plus two slots behind and two in front for a body without nodes.
    expect(svg?.querySelectorAll(':scope > path')).toHaveLength(5)

    const withNodes: AvatarDefinition = {
      ...definition,
      body: {
        ...definition.body,
        nodes: [
          {
            surface: { type: 'sphere', width: 60, height: 60, depth: 60, roundness: 1 },
            position: [-90, -90, 0],
            rotation: [0, 0, 0],
          },
        ],
      },
    }
    const noded = render(<Avatar definition={withNodes} ariaLabel="Noded avatar" />)
    const nodedSvg = noded.getByRole('img', { name: 'Noded avatar' }).querySelector('svg')
    // Every node can be on either side: one more slot behind and one more in front.
    expect(nodedSvg?.querySelectorAll(':scope > path')).toHaveLength(7)
  })

  it('exposes semantic imperative controls without Studio identifiers', () => {
    const controller = createRef<AvatarController>()
    render(<Avatar definition={definition} ref={controller} />)

    let result: ReturnType<AvatarController['setExpression']> | undefined
    act(() => {
      result = controller.current?.setExpression('smile')
    })
    expect(result).toEqual({ ok: true })
    expect(controller.current?.getState()).toMatchObject({
      activeExpression: 'smile',
      status: 'playing',
    })
    expect(controller.current?.play('missing')).toMatchObject({
      ok: false,
      error: { code: 'unknown_animation', key: 'missing' },
    })
    act(() => {
      result = controller.current?.play('greet')
    })
    expect(result).toEqual({ ok: true })
    expect(controller.current?.getState()).toMatchObject({
      activeAnimation: 'greet',
      activeExpression: 'smile',
      status: 'playing',
    })
  })

  it('rejects imperative target changes when playback is controlled by props', () => {
    const controller = createRef<AvatarController>()
    render(<Avatar definition={definition} expression="neutral" ref={controller} />)
    expect(controller.current?.setExpression('smile')).toMatchObject({
      ok: false,
      error: { code: 'controlled_by_props' },
    })
  })

  it('smoothly transitions when a controlled expression changes', () => {
    const controller = createRef<AvatarController>()
    const view = render(<Avatar definition={definition} expression="neutral" ref={controller} />)

    view.rerender(<Avatar definition={definition} expression="smile" ref={controller} />)

    expect(controller.current?.getState()).toEqual({
      activeExpression: 'smile',
      status: 'playing',
    })
  })

  it('retargets from the currently painted SVG frame without a target-frame flash', () => {
    let nextFrame = 0
    const frames = new Map<number, FrameRequestCallback>()
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id)
    })
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const controller = createRef<AvatarController>()
    const view = render(<Avatar definition={definition} ref={controller} />)
    const eye = view.container.querySelector<SVGPathElement>('.bs-avatar__svg g path')
    const neutralPath = eye?.getAttribute('d')

    act(() => controller.current?.setExpression('smile'))
    expect(eye?.getAttribute('d')).toBe(neutralPath)

    act(() => {
      const callback = [...frames.values()].at(-1)
      frames.clear()
      callback?.(1_200)
    })
    const inFlightPath = eye?.getAttribute('d')
    expect(inFlightPath).not.toBe(neutralPath)

    clock.mockReturnValue(1_200)
    act(() => controller.current?.setExpression('neutral'))
    expect(eye?.getAttribute('d')).toBe(inFlightPath)

    act(() => {
      const callback = [...frames.values()].at(-1)
      frames.clear()
      callback?.(1_200)
    })
    expect(eye?.getAttribute('d')).toBe(inFlightPath)

    clock.mockRestore()
    request.mockRestore()
    cancel.mockRestore()
  })

  it('rejects simultaneous controlled animation and expression props', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() =>
      render(<Avatar definition={definition} animation="greet" expression="neutral" />)
    ).toThrow('Avatar accepts either animation or expression, not both.')
    errors.mockRestore()
  })

  it('rejects simultaneous uncontrolled animation and expression defaults', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() =>
      render(
        <Avatar definition={definition} defaultAnimation="greet" defaultExpression="neutral" />
      )
    ).toThrow('Avatar accepts either defaultAnimation or defaultExpression, not both.')
    errors.mockRestore()
  })

  it('reports unknown controlled and default targets through onError', () => {
    const onError = vi.fn()
    const controlled = render(
      <Avatar definition={definition} animation="missing-animation" onError={onError} />
    )

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown_animation', key: 'missing-animation' })
    )

    onError.mockClear()
    controlled.rerender(
      <Avatar definition={definition} defaultExpression="missing-expression" onError={onError} />
    )
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown_expression', key: 'missing-expression' })
    )
  })

  it('keeps a controlled expression above an uncontrolled animation default', () => {
    const controller = createRef<AvatarController>()
    render(
      <Avatar
        definition={definition}
        expression="neutral"
        defaultAnimation="greet"
        ref={controller}
      />
    )
    expect(controller.current?.getState()).toEqual({
      activeExpression: 'neutral',
      status: 'stopped',
    })
  })

  it('honors uncontrolled defaults without autoplay when requested', () => {
    const controller = createRef<AvatarController>()
    render(
      <Avatar definition={definition} defaultAnimation="greet" autoplay={false} ref={controller} />
    )
    expect(controller.current?.getState()).toEqual({
      activeExpression: 'smile',
      status: 'stopped',
    })
  })

  it('resumes the current paused animation instead of restarting it', () => {
    const controller = createRef<AvatarController>()
    const clock = vi.spyOn(performance, 'now')
    clock.mockReturnValueOnce(100).mockReturnValueOnce(250).mockReturnValueOnce(1_250)
    render(<Avatar definition={definition} ref={controller} />)
    act(() => {
      controller.current?.play('greet')
      controller.current?.pause()
      controller.current?.play('greet')
    })
    expect(controller.current?.getState()).toMatchObject({
      activeAnimation: 'greet',
      activeExpression: 'smile',
      status: 'playing',
    })
    clock.mockRestore()
  })

  it('updates SVG frames without rendering React once per animation frame', () => {
    let nextFrame = 0
    const frames = new Map<number, FrameRequestCallback>()
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id)
    })
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1_000)
    let renders = 0
    render(
      <Profiler id="animated-avatar" onRender={() => renders++}>
        <Avatar definition={definition} defaultAnimation="greet" />
      </Profiler>
    )
    const beforeFrames = renders
    act(() => {
      for (let index = 1; index <= 20; index++) {
        const callback = [...frames.values()].at(-1)
        frames.clear()
        callback?.(1_000 + index)
      }
    })
    expect(renders).toBe(beforeFrames)
    clock.mockRestore()
    request.mockRestore()
    cancel.mockRestore()
  })

  it('keeps scheduling frames for a controlled expression with ambient motion', () => {
    let nextFrame = 0
    const frames = new Map<number, FrameRequestCallback>()
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id)
    })

    render(<Avatar definition={definition} expression="restless" />)

    act(() => {
      for (let index = 1; index <= 3; index++) {
        const callback = [...frames.values()].at(-1)
        frames.clear()
        callback?.(index * 1_000)
      }
    })

    expect(request).toHaveBeenCalledTimes(4)
    expect(frames).toHaveLength(1)
    request.mockRestore()
    cancel.mockRestore()
  })

  it('keeps scheduling frames for a controlled expression with automatic blinking', () => {
    let nextFrame = 0
    const frames = new Map<number, FrameRequestCallback>()
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id)
    })

    render(<Avatar definition={definition} expression="blinking" />)

    act(() => {
      const callback = [...frames.values()].at(-1)
      frames.clear()
      callback?.(1_000)
    })

    expect(request).toHaveBeenCalledTimes(2)
    expect(frames).toHaveLength(1)
    request.mockRestore()
    cancel.mockRestore()
  })

  it('fires once-completion exactly once under Strict Mode', () => {
    let nextFrame = 0
    const frames = new Map<number, FrameRequestCallback>()
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id)
    })
    const ended = vi.fn()
    render(
      <StrictMode>
        <Avatar definition={definition} defaultAnimation="wave-once" onAnimationEnd={ended} />
      </StrictMode>
    )
    act(() => {
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(performance.now() + 1_000))
    })
    expect(ended).toHaveBeenCalledTimes(1)
    expect(ended).toHaveBeenCalledWith('wave-once')
    request.mockRestore()
    cancel.mockRestore()
  })
})
