import {
  advanceAvatarPlayback,
  createAvatarPlaybackState,
  MAX_BODY_NODES,
  playAvatarAnimation,
  pauseAvatarPlayback,
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
  type AvatarRuntimeError as CoreRuntimeError,
  type ExpressionKey,
} from '@bible-strong/avatar-core'
import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type Ref,
} from 'react'

import './styles.css'

const validatedDefinitions = new WeakSet<object>()
const controlledExpressionTransitionMs = 420
const bodyPathSlots = MAX_BODY_NODES + 2

const runtimeEnvironment = () => ({
  random: Math.random,
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
})

const shouldRunFrameLoop = (
  definition: AvatarDefinition,
  playback: Readonly<CorePlaybackState>,
  environment: ReturnType<typeof runtimeEnvironment>
) => {
  if (playback.status === 'playing') return true
  const motion = definition.expressions[playback.activeExpression]?.motion
  return (
    playback.status === 'stopped' &&
    !environment.reduceMotion &&
    motion !== undefined &&
    (motion.eyes !== 'none' || motion.body !== 'none')
  )
}

export const markAvatarDefinitionValidated = (definition: object) => {
  validatedDefinitions.add(definition)
}

const assertValidDefinition = (definition: AvatarDefinition) => {
  if (validatedDefinitions.has(definition)) return
  const result = validateAvatarDefinition(definition)
  if (!result.ok) {
    throw new Error(`Invalid avatar definition: ${result.errors[0]?.message}`)
  }
  validatedDefinitions.add(definition)
}

export type AvatarRuntimeError =
  | CoreRuntimeError
  | {
      code: 'controlled_by_props'
      key: string
      message: string
    }

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
}

export type AvatarProps = {
  definition: AvatarDefinition
  ref?: Ref<AvatarController>
  /** Controlled animation timeline. Mutually exclusive with `expression`. */
  animation?: AnimationKey
  /** Controlled expression target. Mutually exclusive with `animation`. */
  expression?: ExpressionKey
  /** Uncontrolled initial animation. Mutually exclusive with `defaultExpression`. */
  defaultAnimation?: AnimationKey
  /** Uncontrolled initial expression. Mutually exclusive with `defaultAnimation`. */
  defaultExpression?: ExpressionKey
  autoplay?: boolean
  size?: number | string
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  /** Receives invalid animation or expression targets supplied through props. */
  onError?: (error: AvatarRuntimeError) => void
  onAnimationEnd?: (animation: AnimationKey) => void
  onExpressionChange?: (expression: ExpressionKey) => void
}

const samePlayback = (left: CorePlaybackState, right: CorePlaybackState) =>
  left.activeAnimation === right.activeAnimation &&
  left.activeExpression === right.activeExpression &&
  left.status === right.status &&
  left.stepIndex === right.stepIndex &&
  left.direction === right.direction &&
  left.phase === right.phase &&
  left.phaseStartedAt === right.phaseStartedAt &&
  left.transitionFrom === right.transitionFrom &&
  left.blinkDueAt === right.blinkDueAt &&
  left.blinkStartedAt === right.blinkStartedAt &&
  left.transitionSnapshot === right.transitionSnapshot &&
  left.directTransition?.from === right.directTransition?.from &&
  left.directTransition?.startedAt === right.directTransition?.startedAt &&
  left.directTransition?.durationMs === right.directTransition?.durationMs &&
  left.directTransition?.transition === right.directTransition?.transition

const assertPlaybackProps = ({
  animation,
  expression,
  defaultAnimation,
  defaultExpression,
}: Pick<AvatarProps, 'animation' | 'expression' | 'defaultAnimation' | 'defaultExpression'>) => {
  if (animation !== undefined && expression !== undefined) {
    throw new Error(
      'Avatar accepts either animation or expression, not both. Animation controls a timeline; expression controls a single target.'
    )
  }
  if (defaultAnimation !== undefined && defaultExpression !== undefined) {
    throw new Error(
      'Avatar accepts either defaultAnimation or defaultExpression, not both. Choose one uncontrolled initial target.'
    )
  }
}

const createInitialPlayback = (
  definition: AvatarDefinition,
  animation: AnimationKey | undefined,
  expression: ExpressionKey | undefined,
  defaultAnimation: AnimationKey | undefined,
  defaultExpression: ExpressionKey | undefined
): CorePlaybackState => {
  const animationKey = animation ?? (expression === undefined ? defaultAnimation : undefined)
  if (animationKey) {
    const result = resolveAnimation(definition, animationKey)
    if (result.ok) {
      return {
        ...createAvatarPlaybackState(),
        activeExpression: result.value.steps[0]?.expression ?? 'neutral',
      }
    }
  }
  const expressionKey =
    expression ?? (animation === undefined ? defaultExpression : undefined) ?? 'neutral'
  const resolved = resolveExpression(definition, expressionKey)
  return {
    ...createAvatarPlaybackState(),
    activeExpression: resolved.ok ? expressionKey : 'neutral',
  }
}

export function Avatar({
  definition,
  ref,
  animation,
  expression,
  defaultAnimation,
  defaultExpression,
  autoplay,
  size = 240,
  className,
  style,
  ariaLabel = 'Procedural avatar',
  onError,
  onAnimationEnd,
  onExpressionChange,
}: AvatarProps): ReactElement {
  assertPlaybackProps({ animation, expression, defaultAnimation, defaultExpression })
  assertValidDefinition(definition)

  const clipId = `${useId().replaceAll(':', '')}-head`
  const clipPathRef = useRef<SVGPathElement>(null)
  const headPathRef = useRef<SVGPathElement>(null)
  const leftPathRef = useRef<SVGPathElement>(null)
  const rightPathRef = useRef<SVGPathElement>(null)
  const backPathRefs = useRef<(SVGPathElement | null)[]>([])
  const frontPathRefs = useRef<(SVGPathElement | null)[]>([])
  const defaultPlaybackStarted = useRef(false)
  const completedAnimation = useRef<AnimationKey | undefined>(undefined)
  const playbackRef = useRef<CorePlaybackState | null>(null)
  const paintedFrameRef = useRef<ReturnType<typeof sampleAvatarFrame> | null>(null)
  const previousDefinitionRef = useRef(definition)
  const [playback, setPlayback] = useState<CorePlaybackState>(() =>
    createInitialPlayback(definition, animation, expression, defaultAnimation, defaultExpression)
  )

  const paintScene = (frameScene: ReturnType<typeof renderAvatarFrame>) => {
    headPathRef.current?.setAttribute('d', frameScene.geometry.headPath)
    clipPathRef.current?.setAttribute('d', frameScene.geometry.headPath)
    headPathRef.current?.setAttribute('fill', frameScene.colors.body)
    leftPathRef.current?.setAttribute('d', frameScene.geometry.leftPath)
    leftPathRef.current?.setAttribute('fill', frameScene.colors.eyes)
    leftPathRef.current?.setAttribute('opacity', frameScene.geometry.leftVisible ? '1' : '0')
    rightPathRef.current?.setAttribute('d', frameScene.geometry.rightPath)
    rightPathRef.current?.setAttribute('fill', frameScene.colors.eyes)
    rightPathRef.current?.setAttribute('opacity', frameScene.geometry.rightVisible ? '1' : '0')
    backPathRefs.current.forEach((element, index) => {
      element?.setAttribute('d', frameScene.geometry.backPaths[index] ?? '')
      const nodeId = frameScene.geometry.backNodeIds[index]
      element?.setAttribute(
        'fill',
        nodeId ? (frameScene.nodeColors[nodeId] ?? frameScene.colors.body) : frameScene.colors.body
      )
    })
    frontPathRefs.current.forEach((element, index) => {
      element?.setAttribute('d', frameScene.geometry.frontPaths[index] ?? '')
      const nodeId = frameScene.geometry.frontNodeIds[index]
      element?.setAttribute(
        'fill',
        nodeId ? (frameScene.nodeColors[nodeId] ?? frameScene.colors.body) : frameScene.colors.body
      )
    })
  }

  const renderPlaybackFrame = (
    current: Readonly<CorePlaybackState>,
    now: number,
    environment: ReturnType<typeof runtimeEnvironment>
  ) => {
    paintedFrameRef.current = sampleAvatarFrame(definition, current, now, environment)
    return renderAvatarFrame(definition, current, now, environment)
  }

  useLayoutEffect(() => {
    const current = playbackRef.current ?? playback
    const now = performance.now()
    const environment = runtimeEnvironment()
    paintScene(renderPlaybackFrame(current, now, environment))
  })

  useEffect(() => {
    playbackRef.current = playback
  }, [playback])

  useEffect(() => {
    if (previousDefinitionRef.current === definition) return
    previousDefinitionRef.current = definition
    paintedFrameRef.current = null
    defaultPlaybackStarted.current = false
    completedAnimation.current = undefined
    const next = createInitialPlayback(
      definition,
      animation,
      expression,
      defaultAnimation,
      defaultExpression
    )
    playbackRef.current = next
    setPlayback(next)
  }, [animation, defaultAnimation, defaultExpression, definition, expression])

  useEffect(() => {
    if (animation !== undefined || expression !== undefined) return
    const result = defaultAnimation
      ? resolveAnimation(definition, defaultAnimation)
      : defaultExpression
        ? resolveExpression(definition, defaultExpression)
        : null
    if (result && !result.ok) {
      if (onError) onError(result.error)
      else console.error(`[Avatar] ${result.error.message}`)
    }
  }, [animation, defaultAnimation, defaultExpression, definition, expression, onError])

  useEffect(() => {
    if (
      defaultPlaybackStarted.current ||
      animation !== undefined ||
      expression !== undefined ||
      defaultAnimation === undefined ||
      autoplay === false
    ) {
      return
    }
    defaultPlaybackStarted.current = true
    const result = playAvatarAnimation(definition, defaultAnimation, performance.now())
    if (result.ok) {
      playbackRef.current = result.value
      setPlayback(result.value)
    }
  }, [animation, autoplay, defaultAnimation, definition, expression])

  useEffect(() => {
    if (expression !== undefined) {
      const resolved = resolveExpression(definition, expression)
      if (resolved.ok) {
        const current = playbackRef.current ?? createAvatarPlaybackState()
        const now = performance.now()
        const from =
          paintedFrameRef.current ??
          sampleAvatarFrame(definition, current, now, runtimeEnvironment())
        const next = {
          ...createAvatarPlaybackState(),
          activeExpression: expression,
          ...(current.activeExpression === expression
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
        playbackRef.current = next
        setPlayback(next)
      } else if (onError) onError(resolved.error)
      else console.error(`[Avatar] ${resolved.error.message}`)
      return
    }
    if (animation !== undefined) {
      const current = playbackRef.current ?? createAvatarPlaybackState()
      const now = performance.now()
      const from =
        paintedFrameRef.current ?? sampleAvatarFrame(definition, current, now, runtimeEnvironment())
      const result = playAvatarAnimation(definition, animation, now, from)
      if (result.ok) {
        playbackRef.current = result.value
        setPlayback(result.value)
      } else if (onError) onError(result.error)
      else console.error(`[Avatar] ${result.error.message}`)
    }
  }, [animation, definition, expression, onError])

  useEffect(() => {
    onExpressionChange?.(playback.activeExpression)
  }, [playback.activeExpression, onExpressionChange])

  useEffect(() => {
    if (!shouldRunFrameLoop(definition, playback, runtimeEnvironment())) return
    let frame = 0
    const tick = (now: number) => {
      const current = playbackRef.current
      if (!current) return
      const environment = runtimeEnvironment()
      const next = advanceAvatarPlayback(definition, current, now, environment)
      playbackRef.current = next
      if (!samePlayback(current, next)) setPlayback(next)
      if (
        current.status === 'playing' &&
        next.status === 'stopped' &&
        current.activeAnimation &&
        completedAnimation.current !== current.activeAnimation
      ) {
        completedAnimation.current = current.activeAnimation
        onAnimationEnd?.(current.activeAnimation)
      }
      const frameScene = renderPlaybackFrame(next, now, environment)
      paintScene(frameScene)
      if (shouldRunFrameLoop(definition, next, environment)) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [definition, playback.activeExpression, playback.status, onAnimationEnd])

  const controlled = animation !== undefined || expression !== undefined
  useImperativeHandle(ref, () => ({
    play(key) {
      if (controlled) {
        return {
          ok: false,
          error: {
            code: 'controlled_by_props',
            key,
            message: 'Playback is controlled by Avatar props.',
          },
        }
      }
      const current = playbackRef.current ?? createAvatarPlaybackState()
      if (
        current.status === 'paused' &&
        current.activeAnimation === key &&
        current.pausedAt !== undefined
      ) {
        const now = performance.now()
        const resumed = resumeAvatarPlayback(current, now)
        playbackRef.current = resumed
        setPlayback(resumed)
        return { ok: true }
      }
      const now = performance.now()
      const from =
        paintedFrameRef.current ?? sampleAvatarFrame(definition, current, now, runtimeEnvironment())
      const result = playAvatarAnimation(definition, key, now, from)
      if (!result.ok) return { ok: false, error: result.error }
      completedAnimation.current = undefined
      playbackRef.current = result.value
      setPlayback(result.value)
      return { ok: true }
    },
    setExpression(key) {
      if (controlled) {
        return {
          ok: false,
          error: {
            code: 'controlled_by_props',
            key,
            message: 'Expression is controlled by Avatar props.',
          },
        }
      }
      const result = resolveExpression(definition, key)
      if (!result.ok) return { ok: false, error: result.error }
      const current = playbackRef.current ?? createAvatarPlaybackState()
      const now = performance.now()
      const from =
        paintedFrameRef.current ?? sampleAvatarFrame(definition, current, now, runtimeEnvironment())
      const next = {
        ...createAvatarPlaybackState(),
        activeExpression: key,
        ...(current.activeExpression === key
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
      playbackRef.current = next
      setPlayback(next)
      return { ok: true }
    },
    pause() {
      const current = playbackRef.current
      if (!current || current.status !== 'playing') return
      const next = pauseAvatarPlayback(current, performance.now())
      playbackRef.current = next
      setPlayback(next)
    },
    stop() {
      if (!controlled) {
        const next = createAvatarPlaybackState()
        playbackRef.current = next
        setPlayback(next)
      }
    },
    getState() {
      const current = playbackRef.current ?? createAvatarPlaybackState()
      return {
        ...(current.activeAnimation ? { activeAnimation: current.activeAnimation } : {}),
        activeExpression: current.activeExpression,
        status: current.status,
      }
    },
  }))

  const scene = renderAvatarDefinition(definition)
  return (
    <div
      className={['bs-avatar', className ?? ''].filter(Boolean).join(' ')}
      style={{
        ...style,
        width: size,
        height: size,
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg className="bs-avatar__svg" viewBox="-150 -150 300 300" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path ref={clipPathRef} d={scene.geometry.headPath} />
          </clipPath>
        </defs>
        {Array.from({ length: bodyPathSlots }, (_, index) => (
          <path
            ref={element => {
              backPathRefs.current[index] = element
            }}
            d={scene.geometry.backPaths[index] ?? ''}
            fill={
              scene.geometry.backNodeIds[index]
                ? (scene.nodeColors[scene.geometry.backNodeIds[index]!] ?? scene.colors.body)
                : scene.colors.body
            }
            key={`back-${index}`}
          />
        ))}
        <path ref={headPathRef} d={scene.geometry.headPath} fill={scene.colors.body} />
        <g clipPath={`url(#${clipId})`} fill={scene.colors.eyes}>
          <path
            ref={leftPathRef}
            d={scene.geometry.leftPath}
            opacity={scene.geometry.leftVisible ? 1 : 0}
          />
          <path
            ref={rightPathRef}
            d={scene.geometry.rightPath}
            opacity={scene.geometry.rightVisible ? 1 : 0}
          />
        </g>
        {Array.from({ length: bodyPathSlots }, (_, index) => (
          <path
            ref={element => {
              frontPathRefs.current[index] = element
            }}
            d={scene.geometry.frontPaths[index] ?? ''}
            fill={
              scene.geometry.frontNodeIds[index]
                ? (scene.nodeColors[scene.geometry.frontNodeIds[index]!] ?? scene.colors.body)
                : scene.colors.body
            }
            key={`front-${index}`}
          />
        ))}
      </svg>
    </div>
  )
}
