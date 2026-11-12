import {
  advanceAvatarPlayback,
  createAvatarPlaybackState,
  pauseAvatarPlayback,
  nextAvatarFrameAt,
  playAvatarAnimation,
  renderAvatarSample,
  resumeAvatarPlayback,
  sampleAvatarFrame,
  type AnimationKey,
  type AvatarDefinition,
  type AvatarPlaybackState,
  type AvatarRuntimeEnvironment,
  type AvatarScene,
  type ExpressionKey,
} from '@bible-strong/avatar-core'

// Every function of this file runs on the UI thread, inside the frame callback of `Avatar`.
// Each one carries the `worklet` directive, and reaches the core through Bundle Mode's import
// forwarding. None of them touches React or React Native, so they are tested in plain Node.

const EXPRESSION_TRANSITION_MS = 420

type AvatarSample = ReturnType<typeof sampleAvatarFrame>

/** What React asks of the avatar. `seq` grows by one with each command of a component. */
export type AvatarCommand = { seq: number } & (
  | { type: 'play'; animation: AnimationKey }
  | { type: 'expression'; expression: ExpressionKey }
  | { type: 'pause' }
  | { type: 'stop' }
  // Sample again after a settled pose, without changing the target.
  | { type: 'wake' }
)

/** The playback of one avatar, owned by the UI thread. */
export type AvatarEngine = {
  playback: AvatarPlaybackState
  /** The last sampled frame: a new target starts its transition from it. */
  sample: AvatarSample | null
  renderedAt: number
  /** When the current target started, for `settleAfterMs`. */
  targetStartedAt: number
  /** The picture stays the same until this time: no frame is sampled before it. */
  nextFrameAt: number
  /** Nothing moves until the next command: the frame callback can stop. */
  idle: boolean
  /** `seq` of the last command applied. */
  processed: number
}

/** The paths and colours of one frame, as the SVG elements read them. */
export type PaintedFrame = {
  head: string
  left: string
  right: string
  leftVisible: boolean
  rightVisible: boolean
  nose: string
  mouth: string
  mouthStrokeWidth: number
  back: string[]
  front: string[]
  backColors: string[]
  frontColors: string[]
  body: string
  eyes: string
}

export const createAvatarEngine = (expression: ExpressionKey): AvatarEngine => ({
  playback: { ...createAvatarPlaybackState(), activeExpression: expression },
  sample: null,
  renderedAt: 0,
  targetStartedAt: 0,
  nextFrameAt: 0,
  idle: false,
  processed: 0,
})

export const paintAvatarScene = (scene: AvatarScene): PaintedFrame => {
  'worklet'
  return {
    head: scene.geometry.headPath,
    left: scene.geometry.leftPath,
    right: scene.geometry.rightPath,
    leftVisible: scene.geometry.leftVisible,
    rightVisible: scene.geometry.rightVisible,
    nose: scene.geometry.nosePath,
    mouth: scene.geometry.mouthPath,
    mouthStrokeWidth: scene.geometry.mouthStrokeWidth,
    back: scene.geometry.backPaths,
    front: scene.geometry.frontPaths,
    backColors: scene.bodyColors.back,
    frontColors: scene.bodyColors.front,
    body: scene.colors.body,
    eyes: scene.colors.eyes,
  }
}

/** The grey of a hex colour at the same lightness. Any other colour is returned unchanged. */
export const greyOf = (color: string) => {
  'worklet'
  const short = /^#[0-9a-f]{3}$/i.test(color)
  if (!short && !/^#[0-9a-f]{6}$/i.test(color)) return color
  const hex = short
    ? `${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color.slice(1)
  const value = parseInt(hex, 16)
  const level = Math.round(
    0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)
  )
  return `rgb(${level}, ${level}, ${level})`
}

export const applyAvatarCommand = (
  definition: Readonly<AvatarDefinition>,
  engine: Readonly<AvatarEngine>,
  command: AvatarCommand,
  now: number,
  environment: AvatarRuntimeEnvironment
): AvatarEngine => {
  'worklet'
  const next = { ...engine, idle: false, renderedAt: 0, nextFrameAt: 0, processed: command.seq }
  const current = engine.playback
  if (command.type === 'wake') return next
  if (command.type === 'pause') {
    return current.status === 'playing'
      ? { ...next, playback: pauseAvatarPlayback(current, now) }
      : next
  }
  if (command.type === 'stop') {
    return { ...next, playback: createAvatarPlaybackState(), targetStartedAt: now }
  }
  if (
    command.type === 'play' &&
    current.status === 'paused' &&
    current.activeAnimation === command.animation &&
    current.pausedAt !== undefined
  ) {
    return { ...next, playback: resumeAvatarPlayback(current, now) }
  }
  const sample = engine.sample ?? sampleAvatarFrame(definition, current, now, environment)
  const from = { expression: sample.expression, colors: sample.colors }
  if (command.type === 'play') {
    const started = playAvatarAnimation(definition, command.animation, now, from)
    return started.ok ? { ...next, playback: started.value, targetStartedAt: now } : next
  }
  if (!definition.expressions[command.expression]) return next
  const playback: AvatarPlaybackState = {
    ...createAvatarPlaybackState(),
    activeExpression: command.expression,
  }
  if (current.activeExpression !== command.expression) {
    playback.status = 'playing'
    playback.directTransition = {
      from,
      startedAt: now,
      durationMs: EXPRESSION_TRANSITION_MS,
      transition: 'smooth',
    }
  }
  return { ...next, playback, targetStartedAt: now }
}

/**
 * Advance the playback to `now` and draw its frame. The caller need not call it again before
 * `engine.nextFrameAt`: a pose held between two blinks is the same picture.
 */
export const stepAvatarEngine = (
  definition: Readonly<AvatarDefinition>,
  engine: Readonly<AvatarEngine>,
  now: number,
  environment: AvatarRuntimeEnvironment,
  settleAfterMs: number
): { engine: AvatarEngine; frame: PaintedFrame; ended?: AnimationKey } => {
  'worklet'
  const before = engine.playback
  const playback = advanceAvatarPlayback(definition, before, now, environment)
  const sample = sampleAvatarFrame(definition, playback, now, environment)
  const scene = renderAvatarSample(definition, sample, environment)
  // Between two blinks, once the pose is reached: a frame the avatar can hold.
  const resting =
    playback.directTransition === undefined &&
    (playback.activeAnimation === undefined || playback.phase === 'hold') &&
    sample.blink === 1
  const settled = settleAfterMs > 0 && now - engine.targetStartedAt >= settleAfterMs && resting
  const changesAt = nextAvatarFrameAt(definition, playback, now, environment)
  // A held pose is not sampled again, so the moment to settle has to be a frame of its own.
  const settlesAt = settleAfterMs > 0 ? engine.targetStartedAt + settleAfterMs : Infinity
  const nextFrameAt = settlesAt > now ? Math.min(changesAt, settlesAt) : changesAt
  const ended =
    before.status === 'playing' && playback.status === 'stopped'
      ? before.activeAnimation
      : undefined
  return {
    engine: {
      ...engine,
      playback,
      sample,
      renderedAt: now,
      nextFrameAt,
      idle: settled || nextFrameAt === Infinity,
    },
    frame: paintAvatarScene(scene),
    ...(ended ? { ended } : {}),
  }
}
