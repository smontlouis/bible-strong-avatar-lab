import { clipNames, clips } from '../catalogue'
import {
  advancePlayer,
  clipRestPose,
  createAvatarPlayer,
  holdPlayerFace,
  JOIN_SECONDS,
  playClip,
  playerFrame,
  setPlayerFace,
} from '../player'

const run = (player: ReturnType<typeof createAvatarPlayer>, seconds: number, step = 1 / 60) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) advancePlayer(player, step)
}

describe('the catalogue', () => {
  it('has the 28 clips', () => {
    expect(clipNames).toHaveLength(28)
    expect(clips.Working_A.duration).toBe(8)
  })
})

describe('the player', () => {
  it('plays every clip of the catalogue round several times with finite numbers', () => {
    for (const name of clipNames) {
      const player = createAvatarPlayer()
      playClip(player, clips[name])
      for (let step = 0; step < 60 * 14; step += 1) {
        advancePlayer(player, 1 / 60)
        const frame = playerFrame(player)
        const numbers = [
          ...frame.position,
          ...frame.rotation,
          ...frame.squash,
          frame.zoom,
          frame.lids,
        ]
        expect(numbers.every(Number.isFinite)).toBe(true)
        expect(frame.eyes[0].path.every(Number.isFinite)).toBe(true)
      }
      expect(player.loopCount).toBeGreaterThan(0)
    }
  })

  it('starts a first clip at once, and joins the next one', () => {
    const player = createAvatarPlayer()
    playClip(player, clips.Streaming_A)
    expect(player.join).toBeNull()
    run(player, 1)
    const before = playerFrame(player)
    playClip(player, clips.Done_C)
    expect(player.join).not.toBeNull()
    // The body does not jump when the join starts.
    advancePlayer(player, 1 / 600)
    const after = playerFrame(player)
    expect(Math.abs(after.rotation[1] - before.rotation[1])).toBeLessThan(1)
    expect(Math.abs(after.position[0] - before.position[0])).toBeLessThan(0.01)
    // It ends on the new clip's pose of rest, after which the clip plays.
    run(player, JOIN_SECONDS)
    expect(player.join).toBeNull()
    expect(player.clip?.name).toBe('Done_C')
  })

  it('leads a spun body to the nearest turn, not back through its spins', () => {
    const player = createAvatarPlayer()
    playClip(player, clips.Rotation_B)
    run(player, 9.5)
    const turned = playerFrame(player).rotation[1]
    playClip(player, clips.Idle_B)
    const target = player.join!.to.rotation[1]
    expect(Math.abs(target - turned)).toBeLessThanOrEqual(180)
    const rest = clipRestPose(clips.Idle_B).rotation[1]
    expect(Math.abs(((target - rest) % 360) + 0)).toBeCloseTo(0, 6)
  })

  it('shows the face the clip asks for, and closes the eyes on its blinks', () => {
    const player = createAvatarPlayer()
    playClip(player, clips.Done_C)
    run(player, 0.6)
    expect(playerFrame(player).face).toBe('happy')
    // `happy` does not blink; back to neutral, a clip's blink shuts the eyes.
    const blinker = createAvatarPlayer()
    playClip(blinker, clips.Idle_B)
    let shut = 0
    for (let step = 0; step < 60 * 4; step += 1) {
      advancePlayer(blinker, 1 / 60)
      shut = Math.max(shut, playerFrame(blinker).lids)
    }
    expect(shut).toBeGreaterThan(0.9)
  })

  it('keeps the eyes of a face that does not blink open', () => {
    const player = createAvatarPlayer()
    setPlayerFace(player, 'happy')
    playClip(player, clips.Idle_B)
    for (let step = 0; step < 60 * 4; step += 1) {
      advancePlayer(player, 1 / 60)
      expect(playerFrame(player).lids).toBe(0)
    }
    expect(playerFrame(player).face).toBe('happy')
  })

  it('puts a face asked from outside before a held one, and a held one before the clip', () => {
    const player = createAvatarPlayer()
    playClip(player, clips.Done_C)
    holdPlayerFace(player, 'calm')
    run(player, 0.3)
    expect(playerFrame(player).face).toBe('calm')
    setPlayerFace(player, 'sad')
    run(player, 0.3)
    expect(playerFrame(player).face).toBe('sad')
    setPlayerFace(player, null)
    holdPlayerFace(player, null)
    run(player, 0.2)
    expect(playerFrame(player).face).toBe('happy')
  })

  it('turns one face into another over time, not at once', () => {
    const player = createAvatarPlayer()
    playClip(player, clips.Logo_A)
    run(player, 0.1)
    const neutral = playerFrame(player).eyes[0].wid
    setPlayerFace(player, 'surprised')
    advancePlayer(player, 1 / 60)
    advancePlayer(player, 0.1)
    const between = playerFrame(player).eyes[0].wid
    expect(between).toBeGreaterThan(neutral)
    expect(between).toBeLessThan(0.21)
    run(player, 0.4)
    expect(playerFrame(player).eyes[0].wid).toBeCloseTo(0.21, 6)
  })

  it('stops the clip without stopping the face when the clip is slowed to nothing', () => {
    const player = createAvatarPlayer()
    playClip(player, clips.Streaming_A)
    run(player, 0.5)
    const time = player.time
    setPlayerFace(player, 'surprised')
    for (let step = 0; step < 30; step += 1) advancePlayer(player, 1 / 60, 0)
    expect(player.time).toBe(time)
    expect(playerFrame(player).eyes[0].wid).toBeCloseTo(0.21, 6)
  })
})
