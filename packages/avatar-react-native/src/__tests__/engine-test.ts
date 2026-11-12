import { validateAvatarDefinition, type AvatarDefinition } from '@bible-strong/avatar-core'

import {
  applyAvatarCommand,
  avatarNeedsFrames,
  createAvatarEngine,
  greyOf,
  stepAvatarEngine,
  type AvatarCommand,
  type AvatarEngine,
} from '../engine'

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

const blink = {
  enabled: false,
  initialDelayMs: 0,
  minIntervalMs: 1_000,
  maxIntervalMs: 1_000,
  durationMs: 100,
}

const source: AvatarDefinition = {
  schema: 'bible-strong/avatar-definition',
  schemaVersion: 1,
  name: 'React Native fixture',
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [],
  },
  colors: { body: '#5b7fe5', eyes: '#111316' },
  expressions: {
    neutral: expression,
    smile: { ...expression, head: { x: 0, y: 10, z: 0 } },
    restless: { ...expression, motion: { eyes: 'none', body: 'shake' } },
  },
  expressionOrder: ['neutral', 'smile', 'restless'],
  animations: {
    greet: {
      playbackMode: 'loop',
      steps: [{ expression: 'smile', holdMs: 1_000, transitionMs: 100, transition: 'smooth' }],
      blink,
    },
    'wave-once': {
      playbackMode: 'once',
      steps: [{ expression: 'smile', holdMs: 100, transitionMs: 0, transition: 'snappy' }],
      blink,
    },
  },
  animationOrder: ['greet', 'wave-once'],
}

const validated = validateAvatarDefinition(source)
if (!validated.ok) throw new Error(validated.errors[0]?.message)
const definition = validated.value
const environment = { random: () => 0.5, reduceMotion: false }

let seq = 0
type CommandInput = AvatarCommand extends infer Command
  ? Command extends unknown
    ? Omit<Command, 'seq'>
    : never
  : never

const run = (engine: AvatarEngine, command: CommandInput, now: number) => {
  seq += 1
  return applyAvatarCommand(
    definition,
    engine,
    { ...command, seq } as AvatarCommand,
    now,
    environment
  )
}
const step = (engine: AvatarEngine, now: number, settleAfterMs = 0) =>
  stepAvatarEngine(definition, engine, now, environment, settleAfterMs)

describe('avatar engine on the UI thread', () => {
  it('plays an animation from the frame on screen and reports the command it applied', () => {
    const started = run(createAvatarEngine('neutral'), { type: 'play', animation: 'greet' }, 1_000)
    expect(started.playback.activeAnimation).toBe('greet')
    expect(started.playback.status).toBe('playing')
    expect(started.playback.transitionSnapshot).toBeDefined()
    expect(started.processed).toBe(seq)

    const next = step(started, 1_050)
    expect(next.engine.idle).toBe(false)
    expect(next.frame.head).not.toBe('')
    expect(next.frame.body).toBe('#5b7fe5')
  })

  it('ignores an unknown target without losing the command count', () => {
    const engine = createAvatarEngine('neutral')
    const played = run(engine, { type: 'play', animation: 'missing' }, 0)
    expect(played.playback).toEqual(engine.playback)
    expect(played.processed).toBe(seq)
    const shown = run(engine, { type: 'expression', expression: 'missing' }, 0)
    expect(shown.playback).toEqual(engine.playback)
  })

  it('ends a once animation, names it, then goes idle on a motionless expression', () => {
    const started = run(createAvatarEngine('neutral'), { type: 'play', animation: 'wave-once' }, 0)
    const during = step(started, 50)
    expect(during.ended).toBeUndefined()
    const after = step(during.engine, 200)
    expect(after.ended).toBe('wave-once')
    expect(after.engine.playback.status).toBe('stopped')
    expect(after.engine.idle).toBe(true)
  })

  it('moves to an expression with a transition, and keeps sampling one that moves', () => {
    const moving = run(
      createAvatarEngine('neutral'),
      { type: 'expression', expression: 'restless' },
      0
    )
    expect(moving.playback.directTransition?.durationMs).toBe(420)
    const arrived = step(moving, 500)
    expect(arrived.engine.playback.status).toBe('stopped')
    expect(arrived.ended).toBeUndefined()
    expect(arrived.engine.idle).toBe(false)

    const same = run(arrived.engine, { type: 'expression', expression: 'restless' }, 600)
    expect(same.playback.directTransition).toBeUndefined()
  })

  it('pauses on the exact frame and resumes the same animation where it stopped', () => {
    const started = run(createAvatarEngine('neutral'), { type: 'play', animation: 'greet' }, 0)
    const paused = run(step(started, 40).engine, { type: 'pause' }, 50)
    expect(paused.playback.status).toBe('paused')
    const held = step(paused, 5_000)
    expect(held.engine.idle).toBe(true)
    expect(held.engine.playback.phase).toBe('transition')

    const resumed = run(held.engine, { type: 'play', animation: 'greet' }, 6_000)
    expect(resumed.playback.status).toBe('playing')
    expect(resumed.playback.phaseStartedAt).toBe(5_950)
    expect(resumed.idle).toBe(false)
  })

  it('stops on neutral', () => {
    const started = run(createAvatarEngine('neutral'), { type: 'play', animation: 'greet' }, 0)
    const stopped = run(started, { type: 'stop' }, 100)
    expect(stopped.playback.activeAnimation).toBeUndefined()
    expect(stopped.playback.activeExpression).toBe('neutral')
  })

  it('settles in the held pose after the delay, and wakes on demand', () => {
    const started = run(createAvatarEngine('neutral'), { type: 'play', animation: 'greet' }, 0)
    expect(step(started, 50, 400).engine.idle).toBe(false)
    expect(step(started, 300, 400).engine.idle).toBe(false)
    const settled = step(started, 500, 400)
    expect(settled.engine.playback.phase).toBe('hold')
    expect(settled.engine.idle).toBe(true)

    const woken = run(settled.engine, { type: 'wake' }, 600)
    expect(woken.idle).toBe(false)
    expect(woken.playback).toEqual(settled.engine.playback)
    expect(step(woken, 620).engine.idle).toBe(false)
  })

  it('needs no frame for a still expression, nor for any when motion is reduced', () => {
    const still = createAvatarEngine('neutral').playback
    const restless = createAvatarEngine('restless').playback
    expect(avatarNeedsFrames(definition, still, false)).toBe(false)
    expect(avatarNeedsFrames(definition, restless, false)).toBe(true)
    expect(avatarNeedsFrames(definition, restless, true)).toBe(false)
  })

  it('greys a hex colour at the same lightness and leaves any other colour alone', () => {
    expect(greyOf('#ffffff')).toBe('rgb(255, 255, 255)')
    expect(greyOf('#f00')).toBe('rgb(76, 76, 76)')
    expect(greyOf('#5b7fe5')).toBe('rgb(128, 128, 128)')
    expect(greyOf('rebeccapurple')).toBe('rebeccapurple')
  })
})
