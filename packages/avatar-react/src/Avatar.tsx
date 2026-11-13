import {
  advanceEngine,
  clips,
  createAvatarEngine,
  engineFrame,
  pauseEngine,
  playEngineClip,
  pokeEngine,
  renderCharacterFrame,
  resumeEngine,
  seedOfName,
  setEngineCompact,
  setEngineEmphasis,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEngineLookAt,
  engineAtRest,
  setEnginePose,
  setEngineState,
  type AvatarCharacter,
  type AvatarEngine,
  type CharacterScene,
  type FreePose,
  type GestureName,
} from '@bible-strong/avatar-core'
import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactElement,
  type Ref,
} from 'react'

/** What can be asked of an avatar from outside, through its `ref`. */
export type AvatarHandle = {
  /** Lay a gesture over what the avatar is doing. */
  poke: (gesture: GestureName, turns?: number) => void
}

export type AvatarProps = {
  character: AvatarCharacter
  ref?: Ref<AvatarHandle>
  /**
   * What the avatar does. A state draws its own clips; a clip plays alone, round and round. A
   * state wins over a clip. With none the avatar is `idle`.
   */
  state?: string
  clip?: string
  /** A face to hold whatever the avatar does. Leave it out to let the avatar decide. */
  face?: string
  /** A pose set by hand: what it gives takes the place of what the clip asks. */
  pose?: FreePose
  /** Stop the avatar where it is: nothing is computed until it goes on. */
  paused?: boolean
  /**
   * A point to look at, `[x, y]`: to the right and up, each from -1 to 1. The head turns there
   * smoothly whatever the avatar plays, and back when it is `null`. It comes before
   * `followPointer`.
   */
  lookAt?: readonly [number, number] | null
  /** Let the avatar follow the pointer with its head. */
  followPointer?: boolean
  /** A state without a face of its own shows surprise. */
  emphasis?: boolean
  /**
   * Two avatars with the same seed draw the same clips at the same time. By default the seed
   * comes from the character's name.
   */
  seed?: number
  /** Fades every colour to its grey in 300 ms, as for a control left idle. */
  muted?: boolean
  /**
   * Hold the pose this long after the avatar was last asked for something, eyes open, and stop
   * computing frames: for an avatar set in a row or a card, which need not move for as long as
   * it is on screen. Asking it for something else wakes it. 0 keeps it moving.
   */
  settleAfterMs?: number
  /** Width and height. A number is in pixels. */
  size?: number | string
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  /** Called when the avatar goes into another state, by itself or because it was asked to. */
  onStateChange?: (state: string | null) => void
}

// A spinner draws at most this many marks at once, two patterns crossing included.
const MARK_SLOTS = 12
// Under this size an avatar is shown compact: a state with a shorter list of clips uses it.
const COMPACT_UNDER = 48
// How long the avatar is run to find a pose to hold for someone who asked for less motion.
const SETTLE_STEPS = 60
const SETTLE_STEP_SECONDS = 0.1
// Below this the eyelids are open: a pose the avatar can hold.
const OPEN_LIDS = 0.05
const MUTE_TRANSITION = 'filter 300ms ease-out'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const applyDoing = (engine: AvatarEngine, state: string | undefined, clip: string | undefined) => {
  if (state === undefined && clip !== undefined && clips[clip]) playEngineClip(engine, clips[clip])
  else setEngineState(engine, state ?? 'idle')
}

export function Avatar({
  character,
  ref,
  state,
  clip,
  face,
  pose,
  paused = false,
  lookAt = null,
  followPointer = false,
  emphasis = false,
  muted = false,
  settleAfterMs = 0,
  seed,
  size = 240,
  className,
  style,
  ariaLabel = 'Avatar',
  onStateChange,
}: AvatarProps): ReactElement {
  const id = useId().replace(/:/g, '')
  const compact = typeof size === 'number' && size < COMPACT_UNDER
  const resolvedSeed = seed ?? seedOfName(character.name ?? 'avatar')
  const nodeSlots = character.body.nodes.length + 2

  // The engine is made once for a seed. What the avatar does, and how, is then set on it: on the
  // first render so that the first picture is right, and in effects after that.
  const engine = useMemo(() => {
    const created = createAvatarEngine({ seed: resolvedSeed, compact })
    setEngineEmphasis(created, emphasis)
    applyDoing(created, state, clip)
    setEngineFace(created, face ?? null)
    setEnginePose(created, pose ?? null)
    return created
    // Only the seed makes a new engine: everything else is set on the one that lives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSeed])
  const first = useMemo(
    () => renderCharacterFrame(character, engineFrame(engine)),
    [character, engine]
  )

  const svg = useRef<SVGSVGElement | null>(null)
  const callbacks = useRef({ onStateChange })
  callbacks.current = { onStateChange }
  // Starts the loop again once the avatar has settled: something was asked of it.
  const wake = useRef(() => {})

  useImperativeHandle(
    ref,
    () => ({
      poke: (gesture, turns) => {
        pokeEngine(engine, gesture, turns)
        wake.current()
      },
    }),
    [engine]
  )

  // Write a scene to the elements that React made once: a frame does not go through React.
  const draw = (scene: CharacterScene) => {
    const root = svg.current
    if (!root) return
    const set = (name: string, attribute: string, value: string) =>
      root.querySelector(`[data-part="${name}"]`)?.setAttribute(attribute, value)
    const { geometry, colors, bodyColors, transform, spinner } = scene
    const round = spinner?.round ?? 0
    const fading = String(1 - round)
    set('body', 'transform', `matrix(${transform.join(' ')})`)
    set('body', 'opacity', String(spinner?.opacity ?? 1))
    set('head', 'd', geometry.headPath)
    set('head', 'fill', colors.body)
    set('head', 'visibility', round >= 0.999 ? 'hidden' : 'visible')
    set('head-clip', 'd', geometry.headPath)
    set('left', 'd', geometry.leftVisible ? geometry.leftPath : '')
    set('right', 'd', geometry.rightVisible ? geometry.rightPath : '')
    set('nose', 'd', geometry.nosePath)
    set('mouth', 'd', geometry.mouthPath)
    set('face', 'fill', colors.eyes)
    set('face', 'opacity', fading)
    set('back', 'opacity', fading)
    set('front', 'opacity', fading)
    for (let index = 0; index < nodeSlots; index += 1) {
      set(`back-${index}`, 'd', geometry.backPaths[index] ?? '')
      set(`back-${index}`, 'fill', bodyColors.back[index] ?? colors.body)
      const clipped = geometry.frontClipPaths[index] ?? ''
      set(`front-${index}`, 'd', geometry.frontPaths[index] ?? '')
      set(`front-${index}`, 'fill', bodyColors.front[index] ?? colors.body)
      set(`front-clip-${index}`, 'd', clipped)
      const front = root.querySelector(`[data-part="front-${index}"]`)
      if (clipped) front?.setAttribute('clip-path', `url(#${id}-front-${index})`)
      else front?.removeAttribute('clip-path')
    }
    set('disc', 'd', spinner && round > 0 ? spinner.disc : '')
    set('disc', 'fill', colors.body)
    set('disc', 'opacity', String(round))
    for (let index = 0; index < MARK_SLOTS; index += 1) {
      const mark = spinner?.marks[index]
      const element = root.querySelector(`[data-part="mark-${index}"]`)
      if (!element) continue
      element.setAttribute('d', mark?.d ?? '')
      if (!mark) continue
      element.setAttribute('opacity', String(mark.opacity))
      if (mark.strokeWidth === undefined) {
        element.setAttribute('fill', colors.body)
        element.setAttribute('stroke', 'none')
      } else {
        element.setAttribute('fill', 'none')
        element.setAttribute('stroke', colors.body)
        element.setAttribute('stroke-width', String(mark.strokeWidth))
      }
    }
  }

  // What the avatar does, set on the engine that lives.
  const doing = useRef({ state, clip })
  useEffect(() => {
    const before = doing.current
    if (before.state === state && before.clip === clip) return
    doing.current = { state, clip }
    applyDoing(engine, state, clip)
  }, [engine, state, clip])
  useEffect(() => setEngineFace(engine, face ?? null), [engine, face])
  useEffect(() => setEnginePose(engine, pose ?? null), [engine, pose])
  useEffect(() => setEngineEmphasis(engine, emphasis), [engine, emphasis])
  useEffect(() => setEngineCompact(engine, compact), [engine, compact])
  useEffect(() => {
    if (paused) pauseEngine(engine)
    else resumeEngine(engine)
  }, [engine, paused])

  // Where the avatar looks: the point it is given, or else the pointer if it follows it. Given
  // as two numbers, so that a new array of the same point is not a new point.
  const lookX = lookAt?.[0]
  const lookY = lookAt?.[1]
  useEffect(() => {
    wake.current()
    if (lookX !== undefined && lookY !== undefined) {
      setEngineLookAt(engine, [lookX, lookY])
      return
    }
    setEngineGazeAlways(engine, followPointer)
    setEngineGaze(engine, null)
    if (!followPointer) return
    const look = (event: PointerEvent) => {
      const box = svg.current?.getBoundingClientRect()
      if (!box || box.width === 0) return
      // Twice the width of the avatar away is as far as the gaze goes.
      setEngineGaze(engine, [
        (event.clientX - (box.left + box.width / 2)) / (box.width * 2),
        -(event.clientY - (box.top + box.height / 2)) / (box.width * 2),
      ])
      // A settled avatar looks up when the pointer moves.
      wake.current()
    }
    window.addEventListener('pointermove', look)
    return () => window.removeEventListener('pointermove', look)
  }, [engine, followPointer, lookX, lookY])

  // The loop. It stops while the avatar is out of sight, once it has settled, and does not start
  // for someone who asked for less motion: they get one settled picture, drawn again when
  // something changes.
  const reduced = prefersReducedMotion()
  useLayoutEffect(() => {
    let reported = engine.state
    const report = () => {
      if (engine.state !== reported) callbacks.current.onStateChange?.(engine.state)
      reported = engine.state
    }
    if (reduced) {
      for (let step = 0; step < SETTLE_STEPS; step += 1) advanceEngine(engine, SETTLE_STEP_SECONDS)
      draw(renderCharacterFrame(character, engineFrame(engine)))
      report()
      return
    }
    // Paused, nothing is computed: what is asked meanwhile plays once the avatar goes on.
    if (paused) return
    let request: number | null = null
    let last: number | undefined
    let visible = true
    // When the avatar was last asked for something: the first frame after it.
    let askedAt: number | undefined
    const tick = (now: number) => {
      request = null
      // A frame that comes late does not throw the avatar: the engine caps its own step.
      advanceEngine(engine, last === undefined ? 0 : (now - last) / 1000)
      last = now
      askedAt ??= now
      const frame = engineFrame(engine)
      draw(renderCharacterFrame(character, frame))
      report()
      const settled =
        settleAfterMs > 0 &&
        now - askedAt >= settleAfterMs &&
        frame.lids < OPEN_LIDS &&
        engineAtRest(engine)
      if (settled) last = undefined
      else if (visible) request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    wake.current = () => {
      askedAt = undefined
      if (request === null && visible) request = requestAnimationFrame(tick)
    }
    const observer =
      typeof IntersectionObserver === 'undefined' || !svg.current
        ? null
        : new IntersectionObserver(entries => {
            const seen = entries[entries.length - 1]?.isIntersecting ?? true
            if (seen === visible) return
            visible = seen
            if (request !== null) cancelAnimationFrame(request)
            request = null
            last = undefined
            if (visible) request = requestAnimationFrame(tick)
          })
    if (observer && svg.current) observer.observe(svg.current)
    return () => {
      if (request !== null) cancelAnimationFrame(request)
      observer?.disconnect()
      wake.current = () => {}
    }
    // `draw` reads the latest refs; the loop only restarts for what it closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, character, reduced, state, clip, face, pose, paused, emphasis, settleAfterMs])

  const outline = character.style?.outline?.enabled ? character.style.outline : null
  const stroke = outline
    ? {
        stroke: outline.color,
        strokeWidth: outline.width,
        strokeOpacity: outline.opacity,
        strokeLinejoin: 'round' as const,
      }
    : {}
  const { geometry, colors, bodyColors, transform, spinner } = first
  const round = spinner?.round ?? 0
  const slots = Array.from({ length: nodeSlots }, (_, index) => index)

  return (
    <svg
      ref={svg}
      role="img"
      aria-label={ariaLabel}
      viewBox="-150 -150 300 300"
      className={className}
      style={{
        width: size,
        height: size,
        overflow: 'visible',
        filter: muted ? 'grayscale(1)' : undefined,
        transition: MUTE_TRANSITION,
        ...style,
      }}
    >
      <defs>
        <clipPath id={`${id}-head`}>
          <path data-part="head-clip" d={geometry.headPath} />
        </clipPath>
        {slots.map(index => (
          <clipPath id={`${id}-front-${index}`} key={index}>
            <path data-part={`front-clip-${index}`} d={geometry.frontClipPaths[index] ?? ''} />
          </clipPath>
        ))}
      </defs>
      {Array.from({ length: MARK_SLOTS }, (_, index) => {
        const mark = spinner?.marks[index]
        return (
          <path
            data-part={`mark-${index}`}
            d={mark?.d ?? ''}
            opacity={mark?.opacity ?? 0}
            fill={mark && mark.strokeWidth === undefined ? colors.body : 'none'}
            stroke={mark && mark.strokeWidth !== undefined ? colors.body : 'none'}
            strokeWidth={mark?.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            key={index}
          />
        )
      })}
      <g
        data-part="body"
        transform={`matrix(${transform.join(' ')})`}
        opacity={spinner?.opacity ?? 1}
      >
        <g data-part="back" opacity={1 - round}>
          {slots.map(index => (
            <path
              data-part={`back-${index}`}
              d={geometry.backPaths[index] ?? ''}
              fill={bodyColors.back[index] ?? colors.body}
              {...stroke}
              key={index}
            />
          ))}
        </g>
        <path
          data-part="head"
          d={geometry.headPath}
          fill={colors.body}
          visibility={round >= 0.999 ? 'hidden' : 'visible'}
          {...stroke}
        />
        <g data-part="face" clipPath={`url(#${id}-head)`} fill={colors.eyes} opacity={1 - round}>
          <path data-part="left" d={geometry.leftVisible ? geometry.leftPath : ''} />
          <path data-part="right" d={geometry.rightVisible ? geometry.rightPath : ''} />
          <path data-part="nose" d={geometry.nosePath} />
          <path data-part="mouth" d={geometry.mouthPath} />
        </g>
        <g data-part="front" opacity={1 - round}>
          {slots.map(index => (
            <path
              data-part={`front-${index}`}
              d={geometry.frontPaths[index] ?? ''}
              fill={bodyColors.front[index] ?? colors.body}
              clipPath={geometry.frontClipPaths[index] ? `url(#${id}-front-${index})` : undefined}
              {...stroke}
              key={index}
            />
          ))}
        </g>
        <path
          data-part="disc"
          d={spinner && round > 0 ? spinner.disc : ''}
          fill={colors.body}
          opacity={round}
        />
      </g>
    </svg>
  )
}
