import {
  engineFrame,
  renderCharacterFrame,
  seedOfName,
  type AvatarCharacter,
  type GestureName,
} from '@bible-strong/avatar-core'
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { ReactElement, ReactNode, Ref } from 'react'
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
  MARK_SLOTS,
  applyAvatarCommand,
  createAvatarRun,
  greyOf,
  paintCharacterScene,
  stepAvatarRun,
  type AvatarCommand,
  type AvatarRun,
  type PaintedFrame,
  type RunSettings,
} from './engine'

const MUTE_TRANSITION_MS = 300
// Under this size an avatar is shown compact: a state with a shorter list of clips uses it.
const COMPACT_UNDER = 48
// A clip moves the body past its box (a jump, a stretch). React Native clips an SVG to its
// bounds, so the drawing is this much larger than the box, centred on it, at the same scale.
const ROOM = 1.5
const VIEW = 300 * ROOM

/** What can be asked of an avatar from outside, through its `ref`. */
export type AvatarHandle = {
  /** Lay a gesture over what the avatar is doing: `nod`, `bounce` or `spin`. */
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
  /**
   * A point to look at, `[x, y]`: to the right and up, each from -1 to 1. The head turns there
   * smoothly whatever the avatar plays, and back when it is `null`.
   */
  lookAt?: readonly [number, number] | null
  /** Stop the avatar where it is: nothing is computed until it goes on. */
  paused?: boolean
  /** A state without a face of its own shows surprise. */
  emphasis?: boolean
  /**
   * Two avatars with the same seed draw the same clips at the same time. By default the seed
   * comes from the character's name.
   */
  seed?: number
  /** Width and height in density-independent pixels. */
  size?: number
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  /** Fades every colour to its grey, as for a control left idle. */
  muted?: boolean
  /**
   * Hold the pose this long after the avatar was last asked for something, eyes open, and stop
   * computing frames: for an avatar set in a row or a card, which need not move for as long as
   * it is on screen. Asking it for something else wakes it. 0 keeps it moving.
   */
  settleAfterMs?: number
  /** Frames computed per second on the UI thread. */
  frameRate?: 30 | 60
  /** Called when the avatar goes into another state, by itself or because it was asked to. */
  onStateChange?: (state: string | null) => void
}

type AvatarReport = { state: string | null; idle: boolean; processed: number }

type AvatarCommandInput = AvatarCommand extends infer Command
  ? Command extends unknown
    ? Omit<Command, 'seq'>
    : never
  : never

const characterIds = new WeakMap<object, number>()
let lastCharacterId = 0
const characterIdOf = (character: object) => {
  const known = characterIds.get(character)
  if (known !== undefined) return known
  lastCharacterId += 1
  characterIds.set(character, lastCharacterId)
  return lastCharacterId
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

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)

// An avatar is rarely on its way to grey: the colour itself is the common case.
const tint = (color: string, muted: SharedValue<number>) => {
  'worklet'
  const progress = muted.get()
  if (progress <= 0) return color
  const grey = greyOf(color)
  return progress >= 1 ? grey : interpolateColor(progress, [0, 1], [color, grey])
}

type Painted = { frame: SharedValue<PaintedFrame>; muted: SharedValue<number> }

/** The body as a whole: where the clip moves it, and how much of it shows. */
function BodyGroup({ frame, children }: { frame: SharedValue<PaintedFrame>; children: ReactNode }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return { matrix: current.matrix, opacity: current.bodyOpacity }
  })
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>
}

/** The parts and the face, which fade while the body turns into a spinner's disc. */
function FadingGroup({
  frame,
  clipPath,
  children,
}: {
  frame: SharedValue<PaintedFrame>
  clipPath?: string
  children: ReactNode
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: frame.get().fading }
  })
  return (
    <AnimatedG animatedProps={animatedProps} clipPath={clipPath}>
      {children}
    </AnimatedG>
  )
}

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

function FacePath({ frame, muted, part }: Painted & { part: 'left' | 'right' | 'nose' | 'mouth' }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return { d: current[part], fill: tint(current.eyes, muted) }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

function DiscPath({ frame, muted }: Painted) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    return { d: current.disc, opacity: current.discOpacity, fill: tint(current.body, muted) }
  })
  return <AnimatedPath animatedProps={animatedProps} />
}

// A mark is filled or drawn as a line. Both paints stay set, in the body's colour: the one a
// mark does not use is turned off by its opacity or its width, so no paint animates to `none`.
function MarkPath({ frame, muted, index }: Painted & { index: number }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const current = frame.get()
    const mark = current.marks[index]
    const color = tint(current.body, muted)
    const line = mark !== undefined && mark.strokeWidth > 0
    return {
      d: mark?.d ?? '',
      opacity: mark?.opacity ?? 0,
      fill: color,
      fillOpacity: line ? 0 : 1,
      stroke: color,
      strokeWidth: line ? mark.strokeWidth : 0,
    }
  })
  return <AnimatedPath animatedProps={animatedProps} strokeLinecap="round" strokeLinejoin="round" />
}

function AvatarInstance(props: AvatarProps): ReactElement {
  const {
    character,
    ref,
    state,
    clip,
    face,
    lookAt = null,
    paused = false,
    emphasis = false,
    seed,
    size = 240,
    style,
    accessibilityLabel = 'Avatar',
    muted = false,
    settleAfterMs = 0,
    frameRate = 30,
    onStateChange,
  } = props

  const clipId = `${useId().replaceAll(':', '')}-head`
  const compact = size < COMPACT_UNDER
  // Given as two numbers, so that a new array of the same point is not a new point.
  const lookX = lookAt?.[0]
  const lookY = lookAt?.[1]
  const [initial] = useState(() => {
    const created = createAvatarRun({
      seed: seed ?? seedOfName(character.name ?? 'avatar'),
      compact,
      emphasis,
      state,
      clip,
      face,
      lookAt: lookX !== undefined && lookY !== undefined ? [lookX, lookY] : null,
      paused,
    })
    return {
      run: created,
      frame: paintCharacterScene(renderCharacterFrame(character, engineFrame(created.engine))),
    }
  })
  const run = useSharedValue<AvatarRun>(initial.run)
  const frame = useSharedValue(initial.frame)
  const commands = useSharedValue<AvatarCommand[]>([])
  const reported = useSharedValue<AvatarReport>({
    state: initial.run.engine.state,
    idle: false,
    processed: 0,
  })
  const settings = useSharedValue<RunSettings & { frameMs: number }>({
    reduceMotion: false,
    settleAfterMs,
    frameMs: 1000 / frameRate,
  })
  const mutedProgress = useSharedValue(muted ? 1 : 0)

  const sequence = useRef(0)
  const callbacks = useRef({ onStateChange })
  // The frame callback reports when nothing moves any more: it stops until the next command.
  const [still, setStill] = useState(false)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')

  useEffect(() => {
    callbacks.current = { onStateChange }
  })

  const send = (command: AvatarCommandInput) => {
    sequence.current += 1
    const queued = { ...command, seq: sequence.current } as AvatarCommand
    commands.modify(queue => {
      'worklet'
      return [...queue, queued]
    })
    setStill(false)
  }

  // Stable for the frame callback, which would otherwise be registered again at every render.
  const receiveReport = useRef<(report: AvatarReport, changed: boolean) => void>(() => undefined)
  const [handleReport] = useState(
    () => (report: AvatarReport, changed: boolean) => receiveReport.current(report, changed)
  )
  useEffect(() => {
    receiveReport.current = (report, changed) => {
      if (changed) callbacks.current.onStateChange?.(report.state)
      // A report older than the last command describes an avatar already asked for more.
      if (report.processed !== sequence.current) return
      setStill(report.idle)
    }
  })

  // What is given to the avatar after it was made. Its first values made the run.
  const given = useRef({
    state,
    clip,
    face,
    lookX,
    lookY,
    emphasis,
    compact,
    paused,
    settleAfterMs,
    frameRate,
  })
  useEffect(() => {
    const before = given.current
    given.current = {
      state,
      clip,
      face,
      lookX,
      lookY,
      emphasis,
      compact,
      paused,
      settleAfterMs,
      frameRate,
    }
    if (before.state !== state || before.clip !== clip) {
      if (state === undefined && clip !== undefined) send({ type: 'clip', clip })
      else send({ type: 'state', state: state ?? 'idle' })
    }
    if (before.face !== face) send({ type: 'face', face: face ?? null })
    if (before.lookX !== lookX || before.lookY !== lookY) {
      send({
        type: 'look',
        target: lookX !== undefined && lookY !== undefined ? [lookX, lookY] : null,
      })
    }
    if (before.emphasis !== emphasis) send({ type: 'emphasis', emphasis })
    if (before.compact !== compact) send({ type: 'compact', compact })
    if (before.paused !== paused) send({ type: paused ? 'pause' : 'resume' })
    if (before.settleAfterMs !== settleAfterMs || before.frameRate !== frameRate) {
      settings.modify(current => {
        'worklet'
        return { ...current, settleAfterMs, frameMs: 1000 / frameRate }
      })
      send({ type: 'wake' })
    }
    // `send` and `settings` are the same for the life of the avatar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, clip, face, lookX, lookY, emphasis, compact, paused, settleAfterMs, frameRate])

  useEffect(() => {
    let mounted = true
    const apply = (enabled: boolean) => {
      if (!mounted) return
      settings.modify(current => {
        'worklet'
        return { ...current, reduceMotion: enabled }
      })
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
    mutedProgress.set(withTiming(muted ? 1 : 0, { duration: MUTE_TRANSITION_MS }))
  }, [muted, mutedProgress])

  // The display may keep firing in background (it does in the simulator): nothing to draw there.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next =>
      setAppActive(next === 'active')
    )
    return () => subscription.remove()
  }, [])

  const frameCallback = useFrameCallback(({ timestamp: now }) => {
    'worklet'
    // The run is changed in place on the UI thread, then set back so that it is the one kept.
    const current = run.get()
    const queue = commands.get()
    const options = settings.get()
    if (queue.length > 0) {
      for (const command of queue) applyAvatarCommand(current, command, now)
      commands.set([])
    } else if (current.idle || now - current.renderedAt < options.frameMs - 1) {
      return
    }
    frame.set(stepAvatarRun(character, current, now, options))
    run.set(current)
    const last = reported.get()
    const changed = last.state !== current.engine.state
    if (changed || last.idle !== current.idle || last.processed !== current.processed) {
      const report = {
        state: current.engine.state,
        idle: current.idle,
        processed: current.processed,
      }
      reported.set(report)
      scheduleOnRN(handleReport, report, changed)
    }
  }, AppState.currentState === 'active')

  useEffect(() => {
    frameCallback.setActive(appActive && !still)
  }, [frameCallback, appActive, still])

  useImperativeHandle(ref, () => ({
    poke(gesture, turns = 1) {
      send({ type: 'poke', gesture, turns })
    },
  }))

  // A face part the character does not have has no element at all.
  const hasNose = character.face.nose?.enabled === true
  const hasMouth = character.face.mouth?.enabled === true
  // A body node is drawn behind or in front of the head depending on the pose.
  const layers = Array.from({ length: character.body.nodes.length + 2 }, (_, index) => index)
  const outline = character.style?.outline?.enabled ? character.style.outline : undefined
  // Only a node with a colour of its own can sink into the head: without one, no clip exists.
  const masked = character.body.nodes.some(node => node.color !== undefined)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[style, { width: size, height: size }]}
    >
      <Svg
        width={size * ROOM}
        height={size * ROOM}
        viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (-size * (ROOM - 1)) / 2,
          top: (-size * (ROOM - 1)) / 2,
        }}
      >
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
        {Array.from({ length: MARK_SLOTS }, (_, index) => (
          <MarkPath key={`mark-${index}`} frame={frame} muted={mutedProgress} index={index} />
        ))}
        <BodyGroup frame={frame}>
          {outline && (
            <FadingGroup frame={frame}>
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
            </FadingGroup>
          )}
          <FadingGroup frame={frame}>
            {layers.map(index => (
              <BodyPath
                key={`back-${index}`}
                frame={frame}
                muted={mutedProgress}
                layer="back"
                index={index}
              />
            ))}
          </FadingGroup>
          <HeadPath frame={frame} muted={mutedProgress} />
          <FadingGroup frame={frame} clipPath={`url(#${clipId})`}>
            <FacePath frame={frame} muted={mutedProgress} part="left" />
            <FacePath frame={frame} muted={mutedProgress} part="right" />
            {hasNose && <FacePath frame={frame} muted={mutedProgress} part="nose" />}
            {hasMouth && <FacePath frame={frame} muted={mutedProgress} part="mouth" />}
          </FadingGroup>
          <FadingGroup frame={frame}>
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
          </FadingGroup>
          <DiscPath frame={frame} muted={mutedProgress} />
        </BodyGroup>
      </Svg>
    </View>
  )
}

/**
 * React Native renderer of an avatar character. The engine lives on the UI thread: each frame is
 * computed there, in a Reanimated frame callback, and written to the SVG through a shared value,
 * so no frame goes through the JS thread. Frames stop while the app is not active, while the
 * avatar is paused, and once it has settled.
 */
export function Avatar(props: AvatarProps): ReactElement {
  assertRuntime()
  // Another character, or another seed, is another avatar: it starts afresh.
  return <AvatarInstance key={`${characterIdOf(props.character)}-${props.seed ?? ''}`} {...props} />
}
