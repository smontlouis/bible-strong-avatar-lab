import { engineFrame, renderCharacterFrame, type AvatarCharacter } from '@bible-strong/avatar-core'

import {
  MARK_SLOTS,
  applyAvatarCommand,
  createAvatarRun,
  greyOf,
  paintCharacterScene,
  stepAvatarRun,
  type AvatarCommand,
  type AvatarRun,
  type RunSettings,
} from '../engine'

const character: AvatarCharacter = {
  name: 'React Native fixture',
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [],
  },
  colors: { body: '#5b7fe5', eyes: '#111316' },
  face: { eyes: { width: 1, height: 1, gap: 1, shiftY: 0 }, perspective: 1 },
}

const moving: RunSettings = { reduceMotion: false, settleAfterMs: 0 }
const start = { seed: 7, compact: false, emphasis: false, paused: false }

let seq = 0
type CommandInput = AvatarCommand extends infer Command
  ? Command extends unknown
    ? Omit<Command, 'seq'>
    : never
  : never
const send = (run: AvatarRun, command: CommandInput, now: number) => {
  seq += 1
  applyAvatarCommand(run, { ...command, seq } as AvatarCommand, now)
}

/** Step the run from `from` for `count` frames a sixtieth of a second apart. */
const play = (run: AvatarRun, from: number, count: number, settings = moving) => {
  let frame = stepAvatarRun(character, run, from, settings)
  for (let step = 1; step <= count; step += 1) {
    frame = stepAvatarRun(character, run, from + (step * 1000) / 60, settings)
  }
  return frame
}

describe('the avatar run of the UI thread', () => {
  it('starts in the state it is given, idle by default, and draws its first frame', () => {
    expect(createAvatarRun(start).engine.state).toBe('idle')
    const run = createAvatarRun({ ...start, state: 'thinking' })
    expect(run.engine.state).toBe('thinking')
    const frame = stepAvatarRun(character, run, 1000, moving)
    expect(frame.head).toMatch(/^M/)
    expect(frame.left).toMatch(/^M/)
    expect(frame.matrix).toHaveLength(6)
    expect(frame.marks).toHaveLength(MARK_SLOTS)
    expect(frame.fading).toBe(1)
  })

  it('draws the same picture as the core for the same engine', () => {
    const run = createAvatarRun(start)
    const expected = paintCharacterScene(renderCharacterFrame(character, engineFrame(run.engine)))
    expect(stepAvatarRun(character, run, 1000, moving)).toEqual(expected)
  })

  it('moves from frame to frame, and keeps moving without a setting to settle', () => {
    const run = createAvatarRun({ ...start, clip: 'Streaming_A' })
    const first = stepAvatarRun(character, run, 1000, moving)
    const later = play(run, 1000, 30)
    expect(later.left).not.toBe(first.left)
    expect(run.idle).toBe(false)
  })

  it('plays the state, the clip, the face and the gestures it is asked for', () => {
    const run = createAvatarRun(start)
    play(run, 1000, 2)
    send(run, { type: 'state', state: 'dots' }, 1100)
    expect(run.engine.state).toBe('thinking')
    send(run, { type: 'clip', clip: 'Streaming_A' }, 1200)
    expect(run.engine.state).toBeNull()
    expect(run.engine.player.clip?.name).toBe('Streaming_A')
    send(run, { type: 'clip', clip: 'nothing' }, 1300)
    expect(run.engine.player.clip?.name).toBe('Streaming_A')
    send(run, { type: 'face', face: 'happy' }, 1400)
    expect(run.engine.player.faceOverride).toBe('happy')
    send(run, { type: 'poke', gesture: 'nod', turns: 1 }, 1500)
    expect(run.engine.gestures).toHaveLength(1)
    expect(run.processed).toBe(seq)
  })

  it('turns into a spinner for a state that asks for one', () => {
    const run = createAvatarRun({ ...start, state: 'searching' })
    const frame = play(run, 1000, 120)
    expect(frame.fading).toBeLessThan(0.01)
    expect(frame.head).toBe('')
    expect(frame.disc).toMatch(/^M/)
    expect(frame.marks.some(mark => mark.d !== '')).toBe(true)
  })

  it('stands still while paused, and goes on from where it was', () => {
    const run = createAvatarRun({ ...start, clip: 'Streaming_A', paused: true })
    const held = stepAvatarRun(character, run, 1000, moving)
    expect(run.idle).toBe(true)
    // What it is asked meanwhile waits.
    send(run, { type: 'state', state: 'happy' }, 2000)
    expect(run.engine.player.playing).toBe(false)
    expect(stepAvatarRun(character, run, 5000, moving).left).toBe(held.left)
    send(run, { type: 'resume' }, 6000)
    // No jump in time: the first frame after standing still is where it stood.
    expect(run.renderedAt).toBe(0)
    play(run, 6000, 30)
    expect(run.idle).toBe(false)
    expect(run.engine.player.playing).toBe(true)
  })

  it('holds one settled picture for someone who asked for less motion', () => {
    const run = createAvatarRun(start)
    stepAvatarRun(character, run, 1000, { reduceMotion: true, settleAfterMs: 0 })
    expect(run.idle).toBe(true)
    send(run, { type: 'state', state: 'sleeping' }, 2000)
    expect(run.idle).toBe(false)
    stepAvatarRun(character, run, 2016, { reduceMotion: true, settleAfterMs: 0 })
    expect(run.idle).toBe(true)
  })

  it('stands still once settled, eyes open, and moves again when asked', () => {
    const settle: RunSettings = { reduceMotion: false, settleAfterMs: 500 }
    const run = createAvatarRun(start)
    play(run, 1000, 20, settle)
    expect(run.idle).toBe(false)
    let now = 1000
    while (!run.idle && now < 10_000) {
      now += 1000 / 60
      stepAvatarRun(character, run, now, settle)
    }
    expect(run.idle).toBe(true)
    expect(engineFrame(run.engine).lids).toBeLessThan(0.05)
    send(run, { type: 'state', state: 'happy' }, now + 100)
    expect(run.idle).toBe(false)
  })

  it('looks at the point it is asked, turning there over several frames', () => {
    const run = createAvatarRun({ ...start, clip: 'Blocked_B' })
    const ahead = play(run, 1000, 30)
    send(run, { type: 'look', target: [1, 0] }, 1600)
    const first = stepAvatarRun(character, run, 1616, moving)
    const there = play(run, 1616, 90)
    expect(there.left).not.toBe(ahead.left)
    expect(first.left).not.toBe(there.left)
    // It does not settle while the head is still turning.
    const settle: RunSettings = { reduceMotion: false, settleAfterMs: 1 }
    send(run, { type: 'look', target: [-1, 0] }, 3200)
    stepAvatarRun(character, run, 3216, settle)
    expect(run.idle).toBe(false)
  })

  it('greys a hex colour at the same lightness and leaves any other unchanged', () => {
    expect(greyOf('#ffffff')).toBe('rgb(255, 255, 255)')
    expect(greyOf('#f00')).toBe('rgb(76, 76, 76)')
    expect(greyOf('red')).toBe('red')
  })
})
