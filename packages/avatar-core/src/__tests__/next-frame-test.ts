import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  advanceAvatarPlayback,
  createAvatarPlaybackState,
  nextAvatarFrameAt,
  pauseAvatarPlayback,
  playAvatarAnimation,
  renderAvatarFrame,
  validateAvatarDefinition,
  type AvatarDefinition,
  type AvatarPlaybackState,
} from '../index'

const strobiPath = fileURLToPath(
  new URL('../../../../examples/react-vite-consumer/src/strobi.avatar.json', import.meta.url)
)
const source = JSON.parse(readFileSync(strobiPath, 'utf8')) as AvatarDefinition
// Strobi only loops and none of its expressions blinks by itself: cover those cases too.
source.animations.proud.playbackMode = 'once'
source.animations.happy.playbackMode = 'pingPong'
source.expressions.neutral.blinking = true
const validated = validateAvatarDefinition(source)
if (!validated.ok) throw new Error(validated.errors[0]?.message)
const definition = validated.value

const FRAME_MS = 1000 / 60

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/**
 * Plays `start` twice over the same frames: once drawing every frame, once drawing only when
 * `nextAvatarFrameAt` says the picture can have changed. Both must show the same picture at
 * every frame.
 */
const compare = (start: AvatarPlaybackState, reduceMotion: boolean, seconds = 10) => {
  const eager = { random: seeded(7), reduceMotion }
  const lazy = { random: seeded(7), reduceMotion }
  let eagerState = start
  let lazyState = start
  let shown = ''
  let nextAt = 0
  let drawn = 0
  let frames = 0
  for (let now = 1_000; now < 1_000 + seconds * 1_000; now += FRAME_MS) {
    frames += 1
    eagerState = advanceAvatarPlayback(definition, eagerState, now, eager)
    const expected = JSON.stringify(renderAvatarFrame(definition, eagerState, now, eager))
    if (now >= nextAt) {
      lazyState = advanceAvatarPlayback(definition, lazyState, now, lazy)
      shown = JSON.stringify(renderAvatarFrame(definition, lazyState, now, lazy))
      nextAt = nextAvatarFrameAt(definition, lazyState, now, lazy)
      drawn += 1
    }
    if (shown !== expected) throw new Error(`Frame at ${Math.round(now)} ms differs`)
  }
  return { drawn, frames, state: lazyState }
}

const play = (animation: string) => {
  const started = playAvatarAnimation(definition, animation, 1_000)
  if (!started.ok) throw new Error(started.error.message)
  return started.value
}

describe('next frame time', () => {
  it.each(Object.keys(definition.animations))(
    'shows the same picture for %s while drawing only the frames that change',
    animation => {
      expect(compare(play(animation), false).drawn).toBeGreaterThan(0)
      expect(compare(play(animation), true).drawn).toBeGreaterThan(0)
    }
  )

  it('draws a fraction of the frames of an animation that mostly holds its poses', () => {
    const { drawn, frames } = compare(play('idle'), false, 40)
    expect(drawn / frames).toBeLessThan(0.3)
  })

  it('follows an expression that blinks by itself, and one that moves', () => {
    const blinking = { ...createAvatarPlaybackState(), activeExpression: 'neutral' }
    const result = compare(blinking, false, 40)
    expect(result.drawn).toBeGreaterThan(10)
    expect(result.drawn / result.frames).toBeLessThan(0.2)

    const moving = Object.entries(definition.expressions).find(
      ([, expression]) => expression.motion.body !== 'none'
    )
    if (!moving) throw new Error('Fixture has no moving expression')
    const restless = compare({ ...createAvatarPlaybackState(), activeExpression: moving[0] }, false)
    expect(restless.drawn).toBe(restless.frames)
  })

  it('never asks for a frame once nothing can change', () => {
    const environment = { random: seeded(1), reduceMotion: false }
    const still = Object.entries(definition.expressions).find(
      ([, expression]) =>
        !expression.blinking &&
        expression.motion.eyes === 'none' &&
        expression.motion.body === 'none'
    )
    if (!still) throw new Error('Fixture has no still expression')
    const stopped = { ...createAvatarPlaybackState(), activeExpression: still[0] }
    expect(nextAvatarFrameAt(definition, stopped, 5_000, environment)).toBe(Infinity)
    const paused = pauseAvatarPlayback(play('idle'), 1_200)
    expect(nextAvatarFrameAt(definition, paused, 5_000, environment)).toBe(Infinity)
    // With reduced motion a blinking expression no longer blinks.
    const blinking = { ...createAvatarPlaybackState(), activeExpression: 'neutral' }
    expect(
      nextAvatarFrameAt(definition, blinking, 5_000, { ...environment, reduceMotion: true })
    ).toBe(Infinity)
  })

  it('ends a once animation on the frame it would end when drawing every frame', () => {
    const { state } = compare(play('proud'), false, 40)
    expect(state.status).toBe('stopped')
    expect(state.activeAnimation).toBeUndefined()
  })
})
