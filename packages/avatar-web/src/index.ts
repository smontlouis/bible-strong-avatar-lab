import {
  advanceAvatarPlayback,
  createAvatarPlaybackState,
  nextAvatarFrameAt,
  pauseAvatarPlayback,
  playAvatarAnimation,
  renderAvatarDefinition,
  renderAvatarSample,
  resolveAnimation,
  resolveExpression,
  resumeAvatarPlayback,
  sampleAvatarFrame,
  validateAvatarDefinition,
  type AnimationKey,
  type AvatarDefinition,
  type AvatarPlaybackState as CorePlaybackState,
  type AvatarRuntimeError,
  type ExpressionKey,
} from '@bible-strong/avatar-core'

export type AvatarCommandResult = { ok: true } | { ok: false; error: AvatarRuntimeError }

export type AvatarPlaybackState = Pick<
  CorePlaybackState,
  'activeAnimation' | 'activeExpression' | 'status'
>

export type AvatarController = {
  play(animation: AnimationKey): AvatarCommandResult
  setExpression(expression: ExpressionKey): AvatarCommandResult
  pause(): void
  stop(): void
  getState(): AvatarPlaybackState
  destroy(): void
}

export type CreateAvatarOptions = {
  definition: unknown
  defaultAnimation?: AnimationKey
  defaultExpression?: ExpressionKey
  autoplay?: boolean
  size?: number | string
  ariaLabel?: string
  className?: string
  onError?: (error: AvatarRuntimeError) => void
  onAnimationEnd?: (animation: AnimationKey) => void
  onExpressionChange?: (expression: ExpressionKey) => void
}

const svgNamespace = 'http://www.w3.org/2000/svg'
const controlledExpressionTransitionMs = 420
let avatarInstanceId = 0

const dimension = (size: number | string) => (typeof size === 'number' ? `${size}px` : size)

const invalidDefinitionError = (errors: readonly { path: string; message: string }[]) => {
  const first = errors[0]
  return new Error(
    first
      ? `Invalid avatar definition${first.path ? ` at ${first.path}` : ''}: ${first.message}`
      : 'Invalid avatar definition.'
  )
}

const resolveTarget = (target: string | HTMLElement) => {
  const element = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (!element) throw new Error(`Avatar target '${target}' was not found.`)
  return element
}

const createSvgElement = <Name extends keyof SVGElementTagNameMap>(name: Name) =>
  document.createElementNS(svgNamespace, name)

const playbackSnapshot = (state: CorePlaybackState): AvatarPlaybackState => ({
  ...(state.activeAnimation ? { activeAnimation: state.activeAnimation } : {}),
  activeExpression: state.activeExpression,
  status: state.status,
})

// One media query for every avatar of the page, read each frame rather than created each frame.
let reducedMotion: { source: typeof window.matchMedia; query: MediaQueryList } | undefined
const runtimeEnvironment = () => {
  if (reducedMotion?.source !== window.matchMedia) {
    reducedMotion = {
      source: window.matchMedia,
      query: window.matchMedia?.('(prefers-reduced-motion: reduce)'),
    }
  }
  return { random: Math.random, reduceMotion: reducedMotion.query?.matches ?? false }
}

const shouldRunFrameLoop = (
  definition: AvatarDefinition,
  playback: Readonly<CorePlaybackState>,
  reduceMotion: boolean
) => {
  if (playback.status === 'playing') return true
  const expression = definition.expressions[playback.activeExpression]
  return (
    playback.status === 'stopped' &&
    !reduceMotion &&
    (expression?.blinking === true ||
      expression?.motion.eyes !== 'none' ||
      expression?.motion.body !== 'none')
  )
}

export function createAvatar(
  target: string | HTMLElement,
  {
    definition: input,
    defaultAnimation,
    defaultExpression,
    autoplay = true,
    size = 240,
    ariaLabel = 'Procedural avatar',
    className,
    onError,
    onAnimationEnd,
    onExpressionChange,
  }: CreateAvatarOptions
): AvatarController {
  if (defaultAnimation !== undefined && defaultExpression !== undefined) {
    throw new Error('Choose either defaultAnimation or defaultExpression, not both.')
  }
  const validated = validateAvatarDefinition(input)
  if (!validated.ok) throw invalidDefinitionError(validated.errors)
  const definition: Readonly<AvatarDefinition> = validated.value
  const mount = resolveTarget(target)
  const host = document.createElement('span')
  host.className = ['bs-avatar', className ?? ''].filter(Boolean).join(' ')
  host.style.display = 'inline-block'
  host.style.width = dimension(size)
  host.style.height = dimension(size)
  host.setAttribute('role', 'img')
  host.setAttribute('aria-label', ariaLabel)

  const svg = createSvgElement('svg')
  svg.setAttribute('viewBox', '-150 -150 300 300')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.display = 'block'
  svg.style.width = '100%'
  svg.style.height = '100%'
  const defs = createSvgElement('defs')
  const clipPath = createSvgElement('clipPath')
  const clipId = `bs-avatar-web-${++avatarInstanceId}`
  clipPath.id = clipId
  const clipHeadPath = createSvgElement('path')
  clipPath.append(clipHeadPath)
  defs.append(clipPath)
  // A node of another colour than the body shows in front only where it is nearer than the
  // head: each front path has a clip for that region.
  const frontClips = Array.from({ length: definition.body.nodes.length + 2 }, (_, index) => {
    const clip = createSvgElement('clipPath')
    clip.id = `${clipId}-front-${index}`
    const clipShape = createSvgElement('path')
    clip.append(clipShape)
    defs.append(clip)
    return clipShape
  })
  svg.append(defs)

  const initialScene = renderAvatarDefinition(definition)
  // A body node is drawn behind or in front of the head depending on the pose.
  const bodyPathSlots = definition.body.nodes.length + 2
  const backPaths = Array.from({ length: bodyPathSlots }, () => createSvgElement('path'))
  const headPath = createSvgElement('path')
  const backOutlines = Array.from({ length: bodyPathSlots }, () => createSvgElement('path'))
  const headOutline = createSvgElement('path')
  const eyeGroup = createSvgElement('g')
  eyeGroup.setAttribute('clip-path', `url(#${clipId})`)
  const leftPath = createSvgElement('path')
  const rightPath = createSvgElement('path')
  const nosePath = createSvgElement('path')
  const mouthPath = createSvgElement('path')
  eyeGroup.append(leftPath, rightPath, nosePath, mouthPath)
  const frontPaths = Array.from({ length: bodyPathSlots }, () => createSvgElement('path'))
  const frontOutlines = Array.from({ length: bodyPathSlots }, () => createSvgElement('path'))
  const outline = definition.style?.outline?.enabled ? definition.style.outline : undefined
  ;[...backOutlines, headOutline, ...frontOutlines].forEach(element => {
    element.setAttribute('fill', 'none')
  })
  if (outline) {
    ;[...backOutlines, headOutline, ...frontOutlines].forEach(element => {
      element.setAttribute('stroke', outline.color)
      element.setAttribute('stroke-width', String(outline.width))
      element.setAttribute('stroke-opacity', String(outline.opacity))
      element.setAttribute('stroke-linejoin', 'round')
    })
  }
  svg.append(
    ...(outline ? [...backOutlines, headOutline, ...frontOutlines] : []),
    ...backPaths,
    headPath,
    eyeGroup,
    ...frontPaths
  )
  host.append(svg)
  mount.append(host)

  const reportError = (error: AvatarRuntimeError) => {
    if (onError) onError(error)
    else console.error(`[Avatar] ${error.message}`)
  }
  const paint = (scene: ReturnType<typeof renderAvatarDefinition>) => {
    clipHeadPath.setAttribute('d', scene.geometry.headPath)
    headPath.setAttribute('d', scene.geometry.headPath)
    headOutline.setAttribute('d', scene.geometry.headPath)
    headPath.setAttribute('fill', scene.colors.body)
    leftPath.setAttribute('d', scene.geometry.leftPath)
    leftPath.setAttribute('fill', scene.colors.eyes)
    leftPath.setAttribute('opacity', scene.geometry.leftVisible ? '1' : '0')
    rightPath.setAttribute('d', scene.geometry.rightPath)
    rightPath.setAttribute('fill', scene.colors.eyes)
    rightPath.setAttribute('opacity', scene.geometry.rightVisible ? '1' : '0')
    nosePath.setAttribute('d', scene.geometry.nosePath)
    nosePath.setAttribute('fill', scene.colors.eyes)
    mouthPath.setAttribute('d', scene.geometry.mouthPath)
    mouthPath.setAttribute('fill', scene.geometry.mouthStrokeWidth > 0 ? 'none' : scene.colors.eyes)
    mouthPath.setAttribute(
      'stroke',
      scene.geometry.mouthStrokeWidth > 0 ? scene.colors.eyes : 'none'
    )
    mouthPath.setAttribute('stroke-width', String(scene.geometry.mouthStrokeWidth))
    mouthPath.setAttribute('stroke-linecap', 'round')
    mouthPath.setAttribute('stroke-linejoin', 'round')
    backPaths.forEach((element, index) => {
      element.setAttribute('d', scene.geometry.backPaths[index] ?? '')
      element.setAttribute('fill', scene.bodyColors.back[index] ?? scene.colors.body)
      backOutlines[index].setAttribute('d', scene.geometry.backPaths[index] ?? '')
    })
    frontPaths.forEach((element, index) => {
      element.setAttribute('d', scene.geometry.frontPaths[index] ?? '')
      element.setAttribute('fill', scene.bodyColors.front[index] ?? scene.colors.body)
      frontOutlines[index].setAttribute('d', scene.geometry.frontPaths[index] ?? '')
      const clip = scene.geometry.frontClipPaths[index] ?? ''
      frontClips[index].setAttribute('d', clip)
      if (clip) element.setAttribute('clip-path', `url(#${clipId}-front-${index})`)
      else element.removeAttribute('clip-path')
    })
  }

  let playback = createAvatarPlaybackState()
  let frameRequest: number | null = null
  let destroyed = false
  let completedAnimation: AnimationKey | undefined
  let lastExpression: ExpressionKey | undefined
  let paintedFrame: ReturnType<typeof sampleAvatarFrame> | undefined
  // Until when the picture stays the same, whether the avatar is in view, and whether the
  // picture on screen is behind the timeline.
  let nextFrameAt = 0
  let visible = true
  let stale = false

  const notifyExpression = () => {
    if (lastExpression === playback.activeExpression) return
    lastExpression = playback.activeExpression
    onExpressionChange?.(playback.activeExpression)
  }
  const renderCurrent = (now: number) => {
    const environment = runtimeEnvironment()
    paintedFrame = sampleAvatarFrame(definition, playback, now, environment)
    paint(renderAvatarSample(definition, paintedFrame, environment))
    stale = false
    notifyExpression()
  }
  const tick = (now: number) => {
    frameRequest = null
    if (destroyed) return
    if (now < nextFrameAt && !(visible && stale)) {
      frameRequest = requestAnimationFrame(tick)
      return
    }
    const environment = runtimeEnvironment()
    const currentAnimation = playback.activeAnimation
    const wasPlaying = playback.status === 'playing'
    playback = advanceAvatarPlayback(definition, playback, now, environment)
    if (visible) renderCurrent(now)
    else {
      // Out of view the timeline goes on, undrawn. A new target starts from a fresh sample.
      stale = true
      paintedFrame = undefined
      notifyExpression()
    }
    nextFrameAt = nextAvatarFrameAt(definition, playback, now, environment)
    if (wasPlaying && playback.status === 'stopped' && currentAnimation) {
      if (completedAnimation !== currentAnimation) onAnimationEnd?.(currentAnimation)
      completedAnimation = currentAnimation
    }
    if (shouldRunFrameLoop(definition, playback, runtimeEnvironment().reduceMotion))
      frameRequest = requestAnimationFrame(tick)
  }
  const schedule = () => {
    // A command changes the picture now, whatever was planned.
    nextFrameAt = 0
    if (frameRequest === null && !destroyed) frameRequest = requestAnimationFrame(tick)
  }

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(entries => {
          visible = entries[entries.length - 1]?.isIntersecting ?? true
          if (visible && stale && !destroyed) renderCurrent(performance.now())
        })
  observer?.observe(host)

  const controller: AvatarController = {
    play(animation) {
      if (
        playback.status === 'paused' &&
        playback.activeAnimation === animation &&
        playback.pausedAt !== undefined
      ) {
        playback = resumeAvatarPlayback(playback, performance.now())
        schedule()
        return { ok: true }
      }
      const now = performance.now()
      const from =
        paintedFrame ?? sampleAvatarFrame(definition, playback, now, runtimeEnvironment())
      const result = playAvatarAnimation(definition, animation, now, from)
      if (!result.ok) return { ok: false, error: result.error }
      completedAnimation = undefined
      playback = result.value
      renderCurrent(performance.now())
      schedule()
      return { ok: true }
    },
    setExpression(expression) {
      const result = resolveExpression(definition, expression)
      if (!result.ok) return { ok: false, error: result.error }
      const now = performance.now()
      const from =
        paintedFrame ?? sampleAvatarFrame(definition, playback, now, runtimeEnvironment())
      playback = {
        ...createAvatarPlaybackState(),
        activeExpression: expression,
        ...(playback.activeExpression === expression
          ? {}
          : {
              status: 'playing' as const,
              directTransition: {
                from,
                startedAt: now,
                durationMs: controlledExpressionTransitionMs,
                transition: 'smooth' as const,
              },
            }),
      }
      renderCurrent(performance.now())
      if (shouldRunFrameLoop(definition, playback, runtimeEnvironment().reduceMotion)) schedule()
      return { ok: true }
    },
    pause() {
      if (playback.status !== 'playing') return
      playback = pauseAvatarPlayback(playback, performance.now())
      if (frameRequest !== null) cancelAnimationFrame(frameRequest)
      frameRequest = null
    },
    stop() {
      playback = createAvatarPlaybackState()
      if (frameRequest !== null) cancelAnimationFrame(frameRequest)
      frameRequest = null
      paint(renderAvatarDefinition(definition))
      notifyExpression()
      if (shouldRunFrameLoop(definition, playback, runtimeEnvironment().reduceMotion)) schedule()
    },
    getState() {
      return playbackSnapshot(playback)
    },
    destroy() {
      destroyed = true
      observer?.disconnect()
      if (frameRequest !== null) cancelAnimationFrame(frameRequest)
      frameRequest = null
      host.remove()
    },
  }

  if (defaultAnimation !== undefined) {
    const resolved = resolveAnimation(definition, defaultAnimation)
    if (!resolved.ok) reportError(resolved.error)
    else if (autoplay) controller.play(defaultAnimation)
    else {
      playback = {
        ...createAvatarPlaybackState(),
        activeExpression: resolved.value.steps[0]?.expression ?? 'neutral',
      }
      renderCurrent(performance.now())
      if (shouldRunFrameLoop(definition, playback, runtimeEnvironment().reduceMotion)) schedule()
    }
  } else if (defaultExpression !== undefined) {
    const resolved = resolveExpression(definition, defaultExpression)
    if (!resolved.ok) reportError(resolved.error)
    else {
      playback = { ...createAvatarPlaybackState(), activeExpression: defaultExpression }
      renderCurrent(performance.now())
      if (shouldRunFrameLoop(definition, playback, runtimeEnvironment().reduceMotion)) schedule()
    }
  } else {
    paint(initialScene)
    paintedFrame = sampleAvatarFrame(definition, playback, performance.now(), runtimeEnvironment())
    notifyExpression()
    if (shouldRunFrameLoop(definition, playback, runtimeEnvironment().reduceMotion)) schedule()
  }

  return controller
}

export type { AnimationKey, AvatarDefinition, AvatarRuntimeError, ExpressionKey }
