import {
  advanceEngine,
  characterOf,
  clips,
  createAvatarEngine,
  engineFrame,
  pauseEngine,
  playEngineClip,
  pokeEngine,
  renderCharacterFrame,
  resolveStateName,
  resumeEngine,
  seedOfName,
  setEngineCompact,
  setEngineEmphasis,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEngineState,
  states,
  type AvatarCharacter,
  type CharacterScene,
  type GestureName,
} from '@bible-strong/avatar-core'

export type CreateAvatarOptions = {
  /**
   * The character to draw: a character exported by the Studio, or an `.avatar.json` of the
   * first format, of which only the character is kept. It is checked once, here.
   */
  character: unknown
  /** The state the avatar starts in. With neither a state nor a clip it is `idle`. */
  state?: string
  /** A clip to play alone, round and round, instead of a state. */
  clip?: string
  /** A face to hold whatever the avatar does. */
  face?: string
  /** A state without a face of its own shows surprise. */
  emphasis?: boolean
  /** Start still, where the clip begins. */
  paused?: boolean
  /** Let the avatar follow the pointer with its head. */
  followPointer?: boolean
  /** Two avatars with the same seed draw the same clips. By default it comes from the name. */
  seed?: number
  /** Width and height. A number is in pixels. */
  size?: number | string
  ariaLabel?: string
  className?: string
  /** Called when the avatar goes into another state, by itself or because it was asked to. */
  onStateChange?: (state: string | null) => void
}

export type AvatarSnapshot = {
  /** The state that draws the clips, or `null` while a clip plays alone. */
  state: string | null
  /** The clip that plays. */
  clip: string | null
  paused: boolean
}

export type AvatarController = {
  /** Put the avatar in a state of the catalogue. Returns `false` for a name it does not know. */
  setState(state: string): boolean
  /** Play one clip alone, round and round. Returns `false` for a name it does not know. */
  playClip(clip: string): boolean
  /** Hold a face whatever the avatar does, or pass `null` to let it decide again. */
  setFace(face: string | null): void
  setEmphasis(emphasis: boolean): void
  /** Lay a gesture over what the avatar does: `nod`, `bounce` or `spin`. */
  poke(gesture: GestureName, turns?: number): void
  pause(): void
  resume(): void
  setFollowPointer(follow: boolean): void
  getState(): AvatarSnapshot
  /** Remove the avatar from the page and stop everything it runs. */
  destroy(): void
}

const svgNamespace = 'http://www.w3.org/2000/svg'
// A spinner draws at most this many marks at once, two patterns crossing included.
const MARK_SLOTS = 12
// Under this size an avatar is shown compact: a state with a shorter list of clips uses it.
const COMPACT_UNDER = 48
// How long the avatar is run to find a pose to hold for someone who asked for less motion.
const SETTLE_STEPS = 60
const SETTLE_STEP_SECONDS = 0.1

let instances = 0

const dimension = (size: number | string) => (typeof size === 'number' ? `${size}px` : size)

const resolveTarget = (target: string | HTMLElement) => {
  const element = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (!element) throw new Error(`Avatar target '${String(target)}' was not found.`)
  return element
}

const element = <Name extends keyof SVGElementTagNameMap>(
  name: Name,
  attributes: Record<string, string> = {}
) => {
  const created = document.createElementNS(svgNamespace, name)
  for (const [key, value] of Object.entries(attributes)) created.setAttribute(key, value)
  return created
}

// One media query for every avatar of the page.
let reducedMotionQuery: MediaQueryList | null | undefined
const prefersReducedMotion = () => {
  if (reducedMotionQuery === undefined) {
    reducedMotionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null
  }
  return reducedMotionQuery?.matches ?? false
}

/** The SVG of an avatar, made once: each frame only writes attributes on it. */
const buildPicture = (character: AvatarCharacter, id: string) => {
  const slots = character.body.nodes.length + 2
  const svg = element('svg', { viewBox: '-150 -150 300 300', 'aria-hidden': 'true' })
  svg.style.display = 'block'
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.overflow = 'visible'

  const defs = element('defs')
  const headClip = element('path')
  const headClipPath = element('clipPath', { id: `${id}-head` })
  headClipPath.append(headClip)
  defs.append(headClipPath)
  const frontClips = Array.from({ length: slots }, (_, index) => {
    const shape = element('path')
    const clip = element('clipPath', { id: `${id}-front-${index}` })
    clip.append(shape)
    defs.append(clip)
    return shape
  })

  const outline = character.style?.outline?.enabled ? character.style.outline : null
  const stroked = (path: SVGPathElement) => {
    if (!outline) return path
    path.setAttribute('stroke', outline.color)
    path.setAttribute('stroke-width', String(outline.width))
    path.setAttribute('stroke-opacity', String(outline.opacity))
    path.setAttribute('stroke-linejoin', 'round')
    return path
  }

  const marks = Array.from({ length: MARK_SLOTS }, () =>
    element('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  )
  const body = element('g')
  const backGroup = element('g')
  const back = Array.from({ length: slots }, () => stroked(element('path')))
  backGroup.append(...back)
  const head = stroked(element('path'))
  const face = element('g', { 'clip-path': `url(#${id}-head)` })
  const left = element('path')
  const right = element('path')
  const nose = element('path')
  const mouth = element('path')
  face.append(left, right, nose, mouth)
  const frontGroup = element('g')
  const front = Array.from({ length: slots }, () => stroked(element('path')))
  frontGroup.append(...front)
  const disc = element('path')
  body.append(backGroup, head, face, frontGroup, disc)
  svg.append(defs, ...marks, body)

  return {
    svg,
    slots,
    headClip,
    frontClips,
    marks,
    body,
    backGroup,
    back,
    head,
    face,
    left,
    right,
    nose,
    mouth,
    frontGroup,
    front,
    disc,
  }
}

type Picture = ReturnType<typeof buildPicture>

const paint = (picture: Picture, scene: CharacterScene, id: string) => {
  const { geometry, colors, bodyColors, transform, spinner } = scene
  const round = spinner?.round ?? 0
  const fading = String(1 - round)
  picture.body.setAttribute('transform', `matrix(${transform.join(' ')})`)
  picture.body.setAttribute('opacity', String(spinner?.opacity ?? 1))
  picture.head.setAttribute('d', geometry.headPath)
  picture.head.setAttribute('fill', colors.body)
  picture.head.setAttribute('visibility', round >= 0.999 ? 'hidden' : 'visible')
  picture.headClip.setAttribute('d', geometry.headPath)
  picture.left.setAttribute('d', geometry.leftVisible ? geometry.leftPath : '')
  picture.right.setAttribute('d', geometry.rightVisible ? geometry.rightPath : '')
  picture.nose.setAttribute('d', geometry.nosePath)
  picture.mouth.setAttribute('d', geometry.mouthPath)
  picture.face.setAttribute('fill', colors.eyes)
  picture.face.setAttribute('opacity', fading)
  picture.backGroup.setAttribute('opacity', fading)
  picture.frontGroup.setAttribute('opacity', fading)
  for (let index = 0; index < picture.slots; index += 1) {
    const backPath = picture.back[index]
    backPath.setAttribute('d', geometry.backPaths[index] ?? '')
    backPath.setAttribute('fill', bodyColors.back[index] ?? colors.body)
    const frontPath = picture.front[index]
    const clipped = geometry.frontClipPaths[index] ?? ''
    frontPath.setAttribute('d', geometry.frontPaths[index] ?? '')
    frontPath.setAttribute('fill', bodyColors.front[index] ?? colors.body)
    picture.frontClips[index].setAttribute('d', clipped)
    if (clipped) frontPath.setAttribute('clip-path', `url(#${id}-front-${index})`)
    else frontPath.removeAttribute('clip-path')
  }
  picture.disc.setAttribute('d', spinner && round > 0 ? spinner.disc : '')
  picture.disc.setAttribute('fill', colors.body)
  picture.disc.setAttribute('opacity', String(round))
  for (let index = 0; index < MARK_SLOTS; index += 1) {
    const mark = spinner?.marks[index]
    const path = picture.marks[index]
    path.setAttribute('d', mark?.d ?? '')
    if (!mark) continue
    path.setAttribute('opacity', String(mark.opacity))
    if (mark.strokeWidth === undefined) {
      path.setAttribute('fill', colors.body)
      path.setAttribute('stroke', 'none')
    } else {
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', colors.body)
      path.setAttribute('stroke-width', String(mark.strokeWidth))
    }
  }
}

/**
 * Draw an avatar in an element of the page and run it. Every frame is computed by the core and
 * written on SVG elements made once. The avatar stops while it is out of sight; for someone who
 * asked for less motion it holds one settled picture, drawn again when it is asked for something.
 */
export function createAvatar(
  target: string | HTMLElement,
  {
    character: input,
    state,
    clip,
    face,
    emphasis = false,
    paused = false,
    followPointer = false,
    seed,
    size = 240,
    ariaLabel = 'Avatar',
    className,
    onStateChange,
  }: CreateAvatarOptions
): AvatarController {
  const character = characterOf(input)
  const mount = resolveTarget(target)
  const id = `bs-avatar-web-${++instances}`

  const host = document.createElement('span')
  host.className = ['bs-avatar', className ?? ''].filter(Boolean).join(' ')
  host.style.display = 'inline-block'
  host.style.width = dimension(size)
  host.style.height = dimension(size)
  host.setAttribute('role', 'img')
  host.setAttribute('aria-label', ariaLabel)
  const picture = buildPicture(character, id)
  host.append(picture.svg)
  mount.append(host)

  const engine = createAvatarEngine({
    seed: seed ?? seedOfName(character.name ?? 'avatar'),
    compact: typeof size === 'number' && size < COMPACT_UNDER,
  })
  setEngineEmphasis(engine, emphasis)
  if (state === undefined && clip !== undefined && clips[clip]) playEngineClip(engine, clips[clip])
  else setEngineState(engine, state ?? 'idle')
  if (face !== undefined) setEngineFace(engine, face)
  if (paused) pauseEngine(engine)

  let destroyed = false
  let visible = true
  let request: number | null = null
  let last: number | undefined
  let reported = engine.state

  const draw = () => paint(picture, renderCharacterFrame(character, engineFrame(engine)), id)
  const report = () => {
    if (engine.state === reported) return
    reported = engine.state
    onStateChange?.(engine.state)
  }
  const tick = (now: number) => {
    request = null
    if (destroyed) return
    // A frame that comes late does not throw the avatar: the engine caps its own step.
    advanceEngine(engine, last === undefined ? 0 : (now - last) / 1000)
    last = now
    draw()
    report()
    if (visible) request = requestAnimationFrame(tick)
  }
  const stopLoop = () => {
    if (request !== null) cancelAnimationFrame(request)
    request = null
    last = undefined
  }
  // Something was asked of the avatar: run it, or show the pose it settles in.
  const refresh = () => {
    if (destroyed) return
    if (prefersReducedMotion()) {
      stopLoop()
      for (let step = 0; step < SETTLE_STEPS; step += 1) advanceEngine(engine, SETTLE_STEP_SECONDS)
      draw()
      report()
      return
    }
    if (request === null && visible) request = requestAnimationFrame(tick)
  }

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(entries => {
          const seen = entries[entries.length - 1]?.isIntersecting ?? true
          if (seen === visible) return
          visible = seen
          if (visible) refresh()
          else stopLoop()
        })
  observer?.observe(host)

  let pointerListener: ((event: PointerEvent) => void) | null = null
  const setFollowPointer = (follow: boolean) => {
    setEngineGazeAlways(engine, follow)
    if (pointerListener) window.removeEventListener('pointermove', pointerListener)
    pointerListener = null
    if (!follow) {
      setEngineGaze(engine, null)
      return
    }
    pointerListener = event => {
      const box = picture.svg.getBoundingClientRect()
      if (box.width === 0) return
      // Twice the width of the avatar away is as far as the gaze goes.
      setEngineGaze(engine, [
        (event.clientX - (box.left + box.width / 2)) / (box.width * 2),
        -(event.clientY - (box.top + box.height / 2)) / (box.width * 2),
      ])
    }
    window.addEventListener('pointermove', pointerListener)
  }
  if (followPointer) setFollowPointer(true)

  draw()
  refresh()

  return {
    setState(name) {
      if (!states[resolveStateName(name)]) return false
      setEngineState(engine, name)
      refresh()
      return true
    },
    playClip(name) {
      const asked = clips[name]
      if (!asked) return false
      playEngineClip(engine, asked)
      refresh()
      return true
    },
    setFace(name) {
      setEngineFace(engine, name)
      refresh()
    },
    setEmphasis(on) {
      setEngineEmphasis(engine, on)
      refresh()
    },
    poke(gesture, turns) {
      pokeEngine(engine, gesture, turns)
      refresh()
    },
    pause() {
      pauseEngine(engine)
    },
    resume() {
      resumeEngine(engine)
      refresh()
    },
    setFollowPointer(follow) {
      setFollowPointer(follow)
      refresh()
    },
    getState() {
      return {
        state: engine.state,
        clip: engine.player.clip?.name ?? null,
        paused: !engine.player.playing,
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      stopLoop()
      observer?.disconnect()
      setFollowPointer(false)
      host.remove()
    },
  }
}

export type { AvatarCharacter, GestureName }
