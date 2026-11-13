import {
  createAvatarPlaybackState,
  renderAvatarDefinition,
  resolveAnimation,
  resolveExpression,
  validateAvatarDefinition,
  type AnimationKey,
  type AvatarDefinition,
  type AvatarPlaybackState as CorePlaybackState,
  type AvatarRuntimeError as CoreRuntimeError,
  type ExpressionKey,
} from '@bible-strong/avatar-core'
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { ReactElement, Ref } from 'react'
import {
  AccessibilityInfo,
  AppState,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg'
import { isBundleModeEnabled, scheduleOnRN } from 'react-native-worklets'

import {
  applyAvatarCommand,
  createAvatarEngine,
  greyOf,
  paintAvatarScene,
  stepAvatarEngine,
  type AvatarCommand,
  type PaintedFrame,
} from './engine'

const MUTE_TRANSITION_MS = 300

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
  /** Width and height in density-independent pixels. */
  size?: number
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  /** Fades every colour to its grey, as for a control left idle. */
  muted?: boolean
  /**
   * Holds the pose this long after a target starts, eyes open, and stops sampling: for an avatar
   * set in a row or a card, which need not move for as long as it is on screen. A new target
   * plays again. 0 keeps it moving.
   */
  settleAfterMs?: number
  /** Frames sampled per second on the UI thread. */
  frameRate?: 30 | 60
  /** Receives invalid animation or expression targets supplied through props. */
  onError?: (error: AvatarRuntimeError) => void
  onAnimationEnd?: (animation: AnimationKey) => void
  onExpressionChange?: (expression: ExpressionKey) => void
}

type AvatarReport = {
  animation: AnimationKey | undefined
  expression: ExpressionKey
  status: CorePlaybackState['status']
  idle: boolean
  processed: number
  ended?: AnimationKey
}

type AvatarCommandInput = AvatarCommand extends infer Command
  ? Command extends unknown
    ? Omit<Command, 'seq'>
    : never
  : never

const validatedDefinitions = new WeakSet<object>()
const definitionIds = new WeakMap<object, number>()
let lastDefinitionId = 0

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

const definitionIdOf = (definition: object) => {
  const known = definitionIds.get(definition)
  if (known !== undefined) return known
  lastDefinitionId += 1
  definitionIds.set(definition, lastDefinitionId)
  return lastDefinitionId
}

const assertRuntime = () => {
  if (Platform.OS === 'web') {
    throw new Error(
      '@bible-strong/avatar-react-native only renders on iOS and Android. On the web, use @bible-strong/avatar-react.'
    )
  }
  // Jest runs without worklet runtimes: the avatar keeps its first frame there.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  if (env?.JEST_WORKER_ID !== undefined) return
  if (typeof isBundleModeEnabled === 'function' && !isBundleModeEnabled()) {
    throw new Error(
      "@bible-strong/avatar-react-native needs the Bundle Mode of react-native-worklets, with '@bible-strong/avatar-core' in importForwarding.moduleNames. See the package README, section « Setup »."
    )
  }
}

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

const initialExpressionOf = ({
  definition,
  animation,
  expression,
  defaultAnimation,
  defaultExpression,
}: AvatarProps): ExpressionKey => {
  const animationKey = animation ?? (expression === undefined ? defaultAnimation : undefined)
  if (animationKey) {
    const result = resolveAnimation(definition, animationKey)
    if (result.ok) return result.value.steps[0]?.expression ?? 'neutral'
  }
  const expressionKey =
    expression ?? (animation === undefined ? defaultExpression : undefined) ?? 'neutral'
  return resolveExpression(definition, expressionKey).ok ? expressionKey : 'neutral'
}

const AnimatedPath = Animated.createAnimatedComponent(Path)

// An avatar is rarely on its way to grey: the colour itself is the common case.
const tint = (color: string, muted: SharedValue<number>) => {
  'worklet'
  const progress = muted.get()
  if (progress <= 0) return color
  const grey = greyOf(color)
  return progress >= 1 ? grey : interpolateColor(progress, [0, 1], [color, grey])
}

type Painted = { frame: SharedValue<PaintedFrame>; muted: SharedValue<number> }

function HeadPath({ frame, muted }: Painted) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return { d: current.head, fill: tint(current.body, muted) }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

function OutlinePath({
  frame,
  layer,
  index,
}: {
  frame: SharedValue<PaintedFrame>
  layer: 'head' | 'back' | 'front'
  index: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return { d: layer === 'head' ? current.head : (current[layer][index] ?? '') }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

function BodyPath({
  frame,
  muted,
  layer,
  index,
  clipped,
  clipPath,
}: Painted & {
  layer: 'back' | 'front'
  index: number
  /** For a front path: draw it only when it has a clip (true) or only when it has none. */
  clipped?: boolean
  clipPath?: string
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    const colors = layer === 'back' ? current.backColors : current.frontColors
    const shown = clipped === undefined || ((current.frontClips[index] ?? '') !== '') === clipped
    return {
      d: shown ? (current[layer][index] ?? '') : '',
      fill: tint(colors[index] ?? current.body, muted),
    }
  })
  return <AnimatedPath animatedProps={animatedProps} clipPath={clipPath} />
}

function FrontClipShape({ frame, index }: { frame: SharedValue<PaintedFrame>; index: number }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    return { d: frame.get().frontClips[index] ?? '' }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

function EyePath({ frame, muted, side }: Painted & { side: 'left' | 'right' }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    const visible = side === 'left' ? current.leftVisible : current.rightVisible
    return { d: current[side], opacity: visible ? 1 : 0, fill: tint(current.eyes, muted) }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

function NosePath({ frame, muted }: Painted) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return { d: current.nose, fill: tint(current.eyes, muted) }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

// A mouth is either a filled shape or a stroked curve. Each has its own element, shown in turn,
// so that no paint ever has to animate to `none`.
function FilledMouthPath({ frame, muted }: Painted) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return {
      d: current.mouth,
      opacity: current.mouthStrokeWidth > 0 ? 0 : 1,
      fill: tint(current.eyes, muted),
    }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

function StrokedMouthPath({ frame, muted }: Painted) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return {
      d: current.mouth,
      opacity: current.mouthStrokeWidth > 0 ? 1 : 0,
      stroke: tint(current.eyes, muted),
      strokeWidth: current.mouthStrokeWidth,
    }
  })
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function AvatarInstance(props: AvatarProps): ReactElement {
  const {
    definition,
    ref,
    animation,
    expression,
    defaultAnimation,
    defaultExpression,
    autoplay,
    size = 240,
    style,
    accessibilityLabel = 'Procedural avatar',
    muted = false,
    settleAfterMs = 0,
    frameRate = 30,
    onError,
    onAnimationEnd,
    onExpressionChange,
  } = props

  const clipId = `${useId().replaceAll(':', '')}-head`
  const [initial] = useState(() => {
    const initialExpression = initialExpressionOf(props)
    return {
      expression: initialExpression,
      engine: createAvatarEngine(initialExpression),
      frame: paintAvatarScene(renderAvatarDefinition(definition, initialExpression)),
    }
  })
  const engine = useSharedValue(initial.engine)
  const frame = useSharedValue(initial.frame)
  const commands = useSharedValue<AvatarCommand[]>([])
  const reported = useSharedValue<AvatarReport | null>(null)
  const mutedProgress = useSharedValue(muted ? 1 : 0)
  const reduceMotion = useSharedValue(false)

  // What React knows of a playback that lives on the UI thread.
  const sequence = useRef(0)
  const state = useRef<AvatarPlaybackState>({
    activeExpression: initial.expression,
    status: 'stopped',
  })
  const notifiedExpression = useRef<ExpressionKey | undefined>(undefined)
  const callbacks = useRef({ onError, onAnimationEnd, onExpressionChange })
  const settleRef = useRef(settleAfterMs)
  // The frame callback reports when nothing moves any more: it stops until the next command.
  const [still, setStill] = useState(false)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')

  useEffect(() => {
    callbacks.current = { onError, onAnimationEnd, onExpressionChange }
  })

  const notifyExpression = (key: ExpressionKey) => {
    if (notifiedExpression.current === key) return
    notifiedExpression.current = key
    callbacks.current.onExpressionChange?.(key)
  }

  const reportError = (error: AvatarRuntimeError) => {
    if (callbacks.current.onError) callbacks.current.onError(error)
    else console.error(`[Avatar] ${error.message}`)
  }

  const send = (command: AvatarCommandInput) => {
    sequence.current += 1
    const queued = { ...command, seq: sequence.current } as AvatarCommand
    commands.modify(queue => {
      'worklet'
      return [...queue, queued]
    })
    setStill(false)
  }

  const startAnimation = (key: AnimationKey): AvatarCommandResult => {
    const resolved = resolveAnimation(definition, key)
    if (!resolved.ok) return { ok: false, error: resolved.error }
    const paused = state.current.status === 'paused' && state.current.activeAnimation === key
    state.current = {
      activeAnimation: key,
      activeExpression: paused
        ? state.current.activeExpression
        : (resolved.value.steps[0]?.expression ?? 'neutral'),
      status: 'playing',
    }
    send({ type: 'play', animation: key })
    notifyExpression(state.current.activeExpression)
    return { ok: true }
  }

  const showExpression = (key: ExpressionKey): AvatarCommandResult => {
    const resolved = resolveExpression(definition, key)
    if (!resolved.ok) return { ok: false, error: resolved.error }
    state.current = {
      activeExpression: key,
      status: state.current.activeExpression === key ? 'stopped' : 'playing',
    }
    send({ type: 'expression', expression: key })
    notifyExpression(key)
    return { ok: true }
  }

  // Stable for the frame callback, which would otherwise be registered again at every render.
  const receiveReport = useRef<(report: AvatarReport) => void>(() => undefined)
  const [handleReport] = useState(() => (report: AvatarReport) => receiveReport.current(report))
  useEffect(() => {
    receiveReport.current = report => {
      if (report.ended) callbacks.current.onAnimationEnd?.(report.ended)
      // A report older than the last command describes a playback already replaced.
      if (report.processed !== sequence.current) return
      state.current = {
        ...(report.animation ? { activeAnimation: report.animation } : {}),
        activeExpression: report.expression,
        status: report.status,
      }
      notifyExpression(report.expression)
      setStill(report.idle)
    }
  })

  useEffect(() => {
    notifyExpression(initial.expression)
    if (animation !== undefined || expression !== undefined) return
    if (defaultAnimation !== undefined) {
      const resolved = resolveAnimation(definition, defaultAnimation)
      if (!resolved.ok) reportError(resolved.error)
      else if (autoplay !== false) startAnimation(defaultAnimation)
    } else if (defaultExpression !== undefined) {
      const resolved = resolveExpression(definition, defaultExpression)
      if (!resolved.ok) reportError(resolved.error)
    }
    // The uncontrolled defaults are read once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const result =
      expression !== undefined
        ? showExpression(expression)
        : animation !== undefined
          ? startAnimation(animation)
          : undefined
    if (result && !result.ok) reportError(result.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation, expression])

  useEffect(() => {
    let mounted = true
    const apply = (enabled: boolean) => {
      if (!mounted || reduceMotion.get() === enabled) return
      reduceMotion.set(enabled)
      send({ type: 'wake' })
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(apply)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply)
    return () => {
      mounted = false
      subscription.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (settleRef.current === settleAfterMs) return
    settleRef.current = settleAfterMs
    send({ type: 'wake' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleAfterMs])

  useEffect(() => {
    mutedProgress.set(withTiming(muted ? 1 : 0, { duration: MUTE_TRANSITION_MS }))
  }, [muted, mutedProgress])

  // The display may keep firing in background (it does in the simulator): nothing to draw there.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next =>
      setAppActive(next === 'active')
    )
    return () => subscription.remove()
  }, [])

  const frameMs = 1000 / frameRate
  const frameCallback = useFrameCallback(({ timestamp: now }) => {
    'worklet'
    let current = engine.get()
    const queue = commands.get()
    const environment = { random: Math.random, reduceMotion: reduceMotion.get() }
    if (queue.length > 0) {
      for (const command of queue) {
        current = applyAvatarCommand(definition, current, command, now, environment)
      }
      commands.set([])
    } else if (
      current.idle ||
      now < current.nextFrameAt ||
      now - current.renderedAt < frameMs - 1
    ) {
      return
    }
    const step = stepAvatarEngine(definition, current, now, environment, settleAfterMs)
    engine.set(step.engine)
    frame.set(step.frame)
    const playback = step.engine.playback
    const last = reported.get()
    if (
      step.ended !== undefined ||
      last === null ||
      last.animation !== playback.activeAnimation ||
      last.expression !== playback.activeExpression ||
      last.status !== playback.status ||
      last.idle !== step.engine.idle ||
      last.processed !== step.engine.processed
    ) {
      const report: AvatarReport = {
        animation: playback.activeAnimation,
        expression: playback.activeExpression,
        status: playback.status,
        idle: step.engine.idle,
        processed: step.engine.processed,
      }
      reported.set(report)
      scheduleOnRN(
        handleReport,
        step.ended === undefined ? report : { ...report, ended: step.ended }
      )
    }
  }, AppState.currentState === 'active')

  useEffect(() => {
    frameCallback.setActive(appActive && !still)
  }, [frameCallback, appActive, still])

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
      return startAnimation(key)
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
      return showExpression(key)
    },
    pause() {
      if (state.current.status !== 'playing') return
      state.current = { ...state.current, status: 'paused' }
      send({ type: 'pause' })
    },
    stop() {
      if (controlled) return
      const neutral = createAvatarPlaybackState()
      state.current = { activeExpression: neutral.activeExpression, status: neutral.status }
      send({ type: 'stop' })
      notifyExpression(neutral.activeExpression)
    },
    getState() {
      return { ...state.current }
    },
  }))

  // A face part no expression enables has no element at all.
  const expressions = Object.values(definition.expressions)
  const hasNose = expressions.some(item => item.nose?.enabled === true)
  const hasMouth = expressions.some(item => item.mouth?.enabled === true)
  // A body node is drawn behind or in front of the head depending on the pose.
  const layers = Array.from({ length: definition.body.nodes.length + 2 }, (_, index) => index)
  const outline = definition.style?.outline?.enabled ? definition.style.outline : undefined
  // Only a node with a colour of its own can sink into the head: without one, no clip exists.
  const masked = definition.body.nodes.some(node => node.color !== undefined)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[style, { width: size, height: size }]}
    >
      <Svg width={size} height={size} viewBox="-150 -150 300 300" pointerEvents="none">
        <Defs>
          <ClipPath id={clipId}>
            <OutlinePath frame={frame} layer="head" index={0} />
          </ClipPath>
          {masked &&
            layers.map(index => (
              <ClipPath id={`${clipId}-front-${index}`} key={`front-clip-${index}`}>
                <FrontClipShape frame={frame} index={index} />
              </ClipPath>
            ))}
        </Defs>
        {outline && (
          <G
            fill="none"
            stroke={outline.color}
            strokeWidth={outline.width}
            strokeOpacity={outline.opacity}
            strokeLinejoin="round"
          >
            {layers.map(index => (
              <OutlinePath key={`back-${index}`} frame={frame} layer="back" index={index} />
            ))}
            <OutlinePath frame={frame} layer="head" index={0} />
            {layers.map(index => (
              <OutlinePath key={`front-${index}`} frame={frame} layer="front" index={index} />
            ))}
          </G>
        )}
        {layers.map(index => (
          <BodyPath
            key={`back-${index}`}
            frame={frame}
            muted={mutedProgress}
            layer="back"
            index={index}
          />
        ))}
        <HeadPath frame={frame} muted={mutedProgress} />
        <G clipPath={`url(#${clipId})`}>
          <EyePath frame={frame} muted={mutedProgress} side="left" />
          <EyePath frame={frame} muted={mutedProgress} side="right" />
          {hasNose && <NosePath frame={frame} muted={mutedProgress} />}
          {hasMouth && <FilledMouthPath frame={frame} muted={mutedProgress} />}
          {hasMouth && <StrokedMouthPath frame={frame} muted={mutedProgress} />}
        </G>
        {layers.map(index => (
          <BodyPath
            key={`front-${index}`}
            frame={frame}
            muted={mutedProgress}
            layer="front"
            index={index}
            clipped={masked ? false : undefined}
          />
        ))}
        {masked &&
          layers.map(index => (
            <BodyPath
              key={`front-masked-${index}`}
              frame={frame}
              muted={mutedProgress}
              layer="front"
              index={index}
              clipped
              clipPath={`url(#${clipId}-front-${index})`}
            />
          ))}
      </Svg>
    </View>
  )
}

/**
 * React Native renderer of an avatar definition. The core samples each frame on the UI thread, in
 * a Reanimated frame callback, and writes the paths into a shared value: no frame goes through
 * the JS thread. Sampling pauses while the app is not active and stops once nothing moves.
 */
export function Avatar(props: AvatarProps): ReactElement {
  assertRuntime()
  assertPlaybackProps(props)
  assertValidDefinition(props.definition)
  // Another definition is another avatar: its playback starts afresh.
  return <AvatarInstance key={definitionIdOf(props.definition)} {...props} />
}
