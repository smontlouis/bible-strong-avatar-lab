import {
  advanceAvatarPlayback,
  createAvatarPlaybackState,
  MAX_BODY_NODES,
  pauseAvatarPlayback,
  playAvatarAnimation,
  renderAvatarDefinition,
  renderAvatarFrame,
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
const bodyPathSlots = MAX_BODY_NODES + 2
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

const runtimeEnvironment = () => ({
  random: Math.random,
  reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
})

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
  svg.append(defs)

  const initialScene = renderAvatarDefinition(definition)
  const backPaths = Array.from({ length: bodyPathSlots }, () => createSvgElement('path'))
  const headPath = createSvgElement('path')
  const eyeGroup = createSvgElement('g')
  eyeGroup.setAttribute('clip-path', `url(#${clipId})`)
  const leftPath = createSvgElement('path')
  const rightPath = createSvgElement('path')
  eyeGroup.append(leftPath, rightPath)
  const frontPaths = Array.from({ length: bodyPathSlots }, () => createSvgElement('path'))
  svg.append(...backPaths, headPath, eyeGroup, ...frontPaths)
  host.append(svg)
  mount.append(host)

  const reportError = (error: AvatarRuntimeError) => {
    if (onError) onError(error)
    else console.error(`[Avatar] ${error.message}`)
  }
  const colorForNodeId = (
    id: string | null | undefined,
    fallback: string,
    bodyColorOverride: boolean
  ) => {
    if (bodyColorOverride) return fallback
    if (!id?.startsWith('runtime-node-')) return fallback
    const index = Number(id.slice('runtime-node-'.length))
    return definition.body.nodes[index]?.color ?? fallback
  }
  const paint = (scene: ReturnType<typeof renderAvatarDefinition>, bodyColorOverride = false) => {
    host.style.setProperty('--bs-avatar-body-color', scene.colors.body)
    host.style.setProperty('--bs-avatar-eye-color', scene.colors.eyes)
    clipHeadPath.setAttribute('d', scene.geometry.headPath)
    headPath.setAttribute('d', scene.geometry.headPath)
    headPath.setAttribute('fill', scene.colors.body)
    leftPath.setAttribute('d', scene.geometry.leftPath)
    leftPath.setAttribute('fill', scene.colors.eyes)
    leftPath.setAttribute('opacity', scene.geometry.leftVisible ? '1' : '0')
    rightPath.setAttribute('d', scene.geometry.rightPath)
    rightPath.setAttribute('fill', scene.colors.eyes)
    rightPath.setAttribute('opacity', scene.geometry.rightVisible ? '1' : '0')
    backPaths.forEach((element, index) => {
      element.setAttribute('d', scene.geometry.backPaths[index] ?? '')
      const color = colorForNodeId(
        scene.geometry.backNodeIds[index],
        scene.colors.body,
        bodyColorOverride
      )
      element.setAttribute('fill', color)
      element.style.setProperty('--bs-avatar-node-color', color)
    })
    frontPaths.forEach((element, index) => {
      element.setAttribute('d', scene.geometry.frontPaths[index] ?? '')
      const color = colorForNodeId(
        scene.geometry.frontNodeIds[index],
        scene.colors.body,
        bodyColorOverride
      )
      element.setAttribute('fill', color)
      element.style.setProperty('--bs-avatar-node-color', color)
    })
  }

  let playback = createAvatarPlaybackState()
  let frameRequest: number | null = null
  let destroyed = false
  let completedAnimation: AnimationKey | undefined
  let lastExpression: ExpressionKey | undefined
  let paintedFrame: ReturnType<typeof sampleAvatarFrame> | undefined

  const notifyExpression = () => {
    if (lastExpression === playback.activeExpression) return
    lastExpression = playback.activeExpression
    onExpressionChange?.(playback.activeExpression)
  }
  const renderCurrent = (now: number) => {
    const environment = runtimeEnvironment()
    paintedFrame = sampleAvatarFrame(definition, playback, now, environment)
    paint(
      renderAvatarFrame(definition, playback, now, environment),
      Boolean(definition.expressions[playback.activeExpression]?.colors?.body)
    )
    notifyExpression()
  }
  const tick = (now: number) => {
    frameRequest = null
    if (destroyed) return
    const currentAnimation = playback.activeAnimation
    const wasPlaying = playback.status === 'playing'
    playback = advanceAvatarPlayback(definition, playback, now, {
      random: Math.random,
      reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    })
    renderCurrent(now)
    if (wasPlaying && playback.status === 'stopped' && currentAnimation) {
      if (completedAnimation !== currentAnimation) onAnimationEnd?.(currentAnimation)
      completedAnimation = currentAnimation
    }
    if (playback.status === 'playing') frameRequest = requestAnimationFrame(tick)
  }
  const schedule = () => {
    if (frameRequest === null && !destroyed) frameRequest = requestAnimationFrame(tick)
  }

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
      if (playback.status === 'playing') schedule()
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
      paint(
        renderAvatarDefinition(definition),
        Boolean(definition.expressions.neutral.colors?.body)
      )
      notifyExpression()
    },
    getState() {
      return playbackSnapshot(playback)
    },
    destroy() {
      destroyed = true
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
    }
  } else if (defaultExpression !== undefined) {
    const resolved = resolveExpression(definition, defaultExpression)
    if (!resolved.ok) reportError(resolved.error)
    else {
      playback = { ...createAvatarPlaybackState(), activeExpression: defaultExpression }
      renderCurrent(performance.now())
    }
  } else {
    paint(initialScene, Boolean(definition.expressions.neutral.colors?.body))
    paintedFrame = sampleAvatarFrame(definition, playback, performance.now(), runtimeEnvironment())
    notifyExpression()
  }

  return controller
}

export type { AnimationKey, AvatarDefinition, AvatarRuntimeError, ExpressionKey }
