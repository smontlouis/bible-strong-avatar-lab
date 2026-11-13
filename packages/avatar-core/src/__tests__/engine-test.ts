import { clips, stateAliases, stateGroups, stateNames, states } from '../catalogue'
import { frameOrientation } from '../turn'
import {
  advanceEngine,
  createAvatarEngine,
  engineFrame,
  pauseEngine,
  playEngineClip,
  resumeEngine,
  pokeEngine,
  seedOfName,
  seekEngine,
  setEngineCompact,
  setEngineEmphasis,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEngineHandover,
  setEnginePose,
  releaseEnginePose,
  setEngineState,
  stopEngine,
  type AvatarEngine,
} from '../engine'

const STEP = 1 / 60

/** Run an engine and list the clips it plays, one entry per change. */
const clipsPlayed = (engine: AvatarEngine, seconds: number) => {
  const played: string[] = []
  let loops = engine.player.loopCount
  if (engine.player.clip) played.push(engine.player.clip.name)
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
    advanceEngine(engine, STEP)
    const name = engine.player.clip?.name
    if (name && (name !== played[played.length - 1] || engine.player.loopCount !== loops)) {
      if (name !== played[played.length - 1]) played.push(name)
      loops = engine.player.loopCount
    }
  }
  return played
}

const run = (engine: AvatarEngine, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += STEP) advanceEngine(engine, STEP)
}

describe('the catalogue of states', () => {
  it('has the 50 states, all of which name clips that exist', () => {
    expect(stateNames).toHaveLength(50)
    for (const name of stateNames) {
      for (const clip of [...states[name].clips, ...(states[name].compactClips ?? [])]) {
        expect(clips[clip]).toBeDefined()
      }
      if (states[name].next) expect(states[states[name].next!]).toBeDefined()
    }
    expect(stateGroups.flatMap(group => group.states).sort()).toEqual([...stateNames].sort())
  })
})

describe('states', () => {
  it('plays each of the six clips of reading once per round, in an order that changes', () => {
    const engine = createAvatarEngine({ seed: 7 })
    setEngineState(engine, 'reading')
    const played = clipsPlayed(engine, 75)
    expect(played.length).toBeGreaterThanOrEqual(12)
    const first = played.slice(0, 6)
    const second = played.slice(6, 12)
    expect([...first].sort()).toEqual([...states.reading.clips].sort())
    expect([...second].sort()).toEqual([...states.reading.clips].sort())
    expect(second).not.toEqual(first)
    // A round does not start on the clip the last one ended on.
    expect(second[0]).not.toBe(first[5])
  })

  it('gives the same run for the same seed, and another for another', () => {
    const runOf = (seed: number) => {
      const engine = createAvatarEngine({ seed })
      setEngineState(engine, 'reading')
      return clipsPlayed(engine, 40)
    }
    expect(runOf(3)).toEqual(runOf(3))
    expect(runOf(3)).not.toEqual(runOf(4))
    expect(seedOfName('strobi')).not.toBe(seedOfName('kirby'))
  })

  it('keeps the weight of a clip listed several times: Idle_B three times out of five', () => {
    const engine = createAvatarEngine({ seed: 11 })
    setEngineState(engine, 'idle')
    const drawn: string[] = []
    // Each draw of a round is read from the bag itself: a clip that follows itself goes on
    // without starting again, so it does not show as a change of clip.
    for (let round = 0; round < 40; round += 1) {
      engine.bags = {}
      setEngineState(engine, 'idle')
      const bag = Object.values(engine.bags)[0]
      drawn.push(engine.lastClip!, ...bag)
    }
    expect(drawn.filter(name => name === 'Idle_B')).toHaveLength(120)
    expect(drawn.filter(name => name === 'Idle_A')).toHaveLength(40)
  })

  it('shares its rounds between the states that share a list of clips', () => {
    const engine = createAvatarEngine({ seed: 5 })
    setEngineState(engine, 'reading')
    const afterFirst = Object.values(engine.bags)[0].length
    setEngineState(engine, 'coding')
    expect(Object.keys(engine.bags)).toHaveLength(1)
    // Going to a state with the same list draws the next clip of the same round.
    expect(Object.values(engine.bags)[0].length).toBe(afterFirst - 1)
  })

  it('plays finished in order, then goes to idle', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'finished')
    expect(engine.player.clip?.name).toBe('Done_B')
    expect(engineFrame(engine).face).toBe('neutral')
    run(engine, 0.5)
    expect(engineFrame(engine).face).toBe('happy')
    const played = clipsPlayed(engine, 9)
    expect(played.slice(0, 2)).toEqual(['Done_B', 'Done_A'])
    expect(engine.state).toBe('idle')
  })

  it('leaves waking after 1.6 s and blocked after 120 s, whatever the clip is doing', () => {
    const waking = createAvatarEngine()
    setEngineState(waking, 'waking')
    run(waking, 1.5)
    expect(waking.state).toBe('waking')
    run(waking, 0.2)
    expect(waking.state).toBe('idle')

    const blocked = createAvatarEngine()
    setEngineState(blocked, 'blocked')
    run(blocked, 119)
    expect(blocked.state).toBe('blocked')
    run(blocked, 1.5)
    expect(blocked.state).toBe('drowsy')
  })

  it('uses the shorter list of a state when the avatar is shown small', () => {
    const engine = createAvatarEngine({ seed: 2, compact: true })
    setEngineState(engine, 'idle')
    expect(new Set(clipsPlayed(engine, 30))).toEqual(new Set(['Idle_B']))
    setEngineCompact(engine, false)
    expect(new Set(clipsPlayed(engine, 60)).size).toBeGreaterThan(1)
  })

  it('holds the face of the state, and surprised under emphasis only where there is none', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'listening')
    run(engine, 0.5)
    expect(engineFrame(engine).face).toBe('calm')
    setEngineEmphasis(engine, true)
    run(engine, 0.5)
    expect(engineFrame(engine).face).toBe('calm')
    setEngineState(engine, 'streaming')
    run(engine, 0.5)
    expect(engineFrame(engine).face).toBe('surprised')
    setEngineEmphasis(engine, false)
    setEngineFace(engine, 'sad')
    run(engine, 0.5)
    expect(engineFrame(engine).face).toBe('sad')
    setEngineFace(engine, null)
    run(engine, 0.1)
    expect(engineFrame(engine).face).not.toBe('sad')
  })

  it('names what the body turns into for the states that are spinners', () => {
    const engine = createAvatarEngine()
    setEngineState(engine, 'thinking')
    expect(engine.morph).toBe('thinking')
    setEngineState(engine, 'idle')
    expect(engine.morph).toBeNull()
  })
})

describe('gestures', () => {
  const still = () => {
    const engine = createAvatarEngine()
    playEngineClip(engine, clips.Blocked_B)
    run(engine, 0.5)
    return engine
  }

  it('lays a nod over the clip, then takes it away', () => {
    const engine = still()
    const before = engineFrame(engine).rotation[0]
    pokeEngine(engine, 'nod')
    run(engine, 0.25)
    expect(engineFrame(engine).rotation[0] - before).toBeCloseTo(16, 0)
    run(engine, 0.3)
    expect(engineFrame(engine).rotation[0]).toBeCloseTo(before, 6)
    expect(engine.gestures).toHaveLength(0)
  })

  it('does not start the clip again', () => {
    const engine = createAvatarEngine()
    playEngineClip(engine, clips.Streaming_A)
    run(engine, 0.6)
    const time = engine.player.time
    pokeEngine(engine, 'spin')
    run(engine, 0.3)
    expect(engine.player.time).toBeCloseTo(time + 0.3, 2)
    expect(engine.player.clip?.name).toBe('Streaming_A')
  })

  it('ends a spin on the turn it started from, a whole turn later', () => {
    const engine = still()
    const before = engineFrame(engine).rotation[1]
    pokeEngine(engine, 'spin', 2)
    run(engine, 0.65)
    expect(engineFrame(engine).rotation[1] - before).toBeCloseTo(360, 0)
    run(engine, 0.7)
    expect(engineFrame(engine).rotation[1]).toBeCloseTo(before, 6)
  })

  it('adds turns and lifts and multiplies stretches when two gestures meet', () => {
    const engine = still()
    const before = engineFrame(engine)
    pokeEngine(engine, 'spin')
    pokeEngine(engine, 'bounce')
    run(engine, 0.31)
    const during = engineFrame(engine)
    expect(during.rotation[1]).toBeGreaterThan(before.rotation[1] + 50)
    expect(during.position[1]).toBeGreaterThan(before.position[1] + 0.25)
    expect(during.squash[1]).toBeGreaterThan(1)
    expect(during.squash[0]).toBeLessThan(1)
  })
})

describe('gaze', () => {
  it('turns a still body towards what it looks at, and lets it go smoothly', () => {
    const engine = createAvatarEngine()
    setEngineGaze(engine, [1, 1])
    run(engine, 2)
    const looking = engineFrame(engine)
    // To the right of the screen, and up.
    expect(looking.rotation[1]).toBeCloseTo(18, 1)
    expect(looking.rotation[0]).toBeCloseTo(-14, 1)
    setEngineGaze(engine, null)
    advanceEngine(engine, STEP)
    expect(engineFrame(engine).rotation[1]).toBeGreaterThan(10)
    run(engine, 2)
    expect(engineFrame(engine).rotation[1]).toBeCloseTo(0, 3)
  })

  it('leaves a clip that plays alone unless it is asked to follow always', () => {
    const engine = createAvatarEngine()
    playEngineClip(engine, clips.Blocked_B)
    run(engine, 0.5)
    const before = engineFrame(engine).rotation[1]
    setEngineGaze(engine, [1, 0])
    run(engine, 1)
    expect(engineFrame(engine).rotation[1]).toBeCloseTo(before, 6)
    setEngineGazeAlways(engine, true)
    expect(engineFrame(engine).rotation[1]).toBeCloseTo(before + 18 * 0.55, 1)
  })
})

describe('states named twice', () => {
  it('has no two spinners that play the same thing', () => {
    // States that only move the body may share a recipe and differ in meaning: `reading` and
    // `coding` look alike. A spinner is listed once.
    const spinners = stateNames.filter(name => states[name].morph)
    const recipes = spinners.map(name => JSON.stringify(states[name]))
    expect(new Set(recipes).size).toBe(recipes.length)
  })

  it('leads an alias to the state it stands for', () => {
    for (const [alias, name] of Object.entries(stateAliases)) {
      expect(states[alias]).toBeUndefined()
      const engine = createAvatarEngine()
      setEngineState(engine, alias)
      expect(engine.state).toBe(name)
    }
  })
})

describe('a state kept instead of handed over', () => {
  it('plays a state that hands over again and again, after its clips or after its time', () => {
    for (const [name, seconds] of [
      ['finished', 12],
      ['waking', 6],
    ] as const) {
      const engine = createAvatarEngine({ seed: 2 })
      setEngineHandover(engine, false)
      setEngineState(engine, name)
      for (let step = 0; step < seconds * 60; step += 1) advanceEngine(engine, STEP)
      expect(engine.state).toBe(name)
      setEngineHandover(engine, true)
      for (let step = 0; step < seconds * 60; step += 1) advanceEngine(engine, STEP)
      expect(engine.state).toBe('idle')
    }
  })
})

describe('a pose set by hand that is let go', () => {
  it('goes back from where it is to the clip, in the time of a join, without a jump', () => {
    const engine = createAvatarEngine({ seed: 4 })
    playEngineClip(engine, clips.Working_B, { transition: 'cut' })
    for (let step = 0; step < 72; step += 1) advanceEngine(engine, STEP)
    pauseEngine(engine)
    const paused = engine.player.time
    setEnginePose(engine, { rotation: [10, 70, 0], position: [0.3, 0], zoom: 0.9 })
    const held = engineFrame(engine)
    releaseEnginePose(engine)
    resumeEngine(engine)
    const first = engineFrame(engine)
    expect(first.position).toEqual(held.position)
    expect(first.zoom).toBeCloseTo(held.zoom)
    expect(
      frameOrientation(first).every(
        (value, index) => Math.abs(value - frameOrientation(held)[index]) < 1e-9
      )
    ).toBe(true)
    for (let step = 0; step < 30; step += 1) advanceEngine(engine, STEP)
    // The join is over: the clip alone says where the body is.
    expect(engine.release).toBeNull()
    expect(engineFrame(engine).orientation).toBeUndefined()
    // The clip goes on from the time it was paused at.
    expect(engine.player.time).toBeCloseTo(paused + 30 * STEP)
  })
})

describe('an avatar stopped', () => {
  it('comes to rest and stays still, then starts again when a state is asked for', () => {
    const engine = createAvatarEngine({ seed: 5 })
    setEngineState(engine, 'thinking')
    pokeEngine(engine, 'spin')
    advanceEngine(engine, 2)
    stopEngine(engine)
    advanceEngine(engine, STEP)
    const rest = engineFrame(engine)
    expect(engine.state).toBeNull()
    expect(rest.rotation).toEqual([0, 0, 0])
    expect(rest.position).toEqual([0, 0])
    expect(rest.lids).toBe(0)
    expect(rest.face).toBe('neutral')
    expect(rest.spinner).toBeNull()
    advanceEngine(engine, 1)
    expect(engineFrame(engine)).toEqual(rest)
    setEngineState(engine, 'idle')
    advanceEngine(engine, 0.5)
    expect(engine.player.clip).not.toBeNull()
  })
})

describe('a clip put at a time', () => {
  it('shows the clip there at once, without leaving the state, and stays paused', () => {
    const engine = createAvatarEngine({ seed: 3 })
    setEngineState(engine, 'reading')
    advanceEngine(engine, 1)
    pauseEngine(engine)
    const clip = engine.player.clip!
    seekEngine(engine, clip.duration / 2)
    expect(engine.state).toBe('reading')
    expect(engine.player.join).toBeNull()
    expect(engine.player.time).toBeCloseTo(clip.duration / 2)
    advanceEngine(engine, 1)
    expect(engine.player.time).toBeCloseTo(clip.duration / 2)
    seekEngine(engine, 99)
    expect(engine.player.time).toBe(clip.duration)
  })
})

describe('a pose set by hand', () => {
  it('takes the place of what the clip asks, field by field, and gives it back', () => {
    const engine = createAvatarEngine()
    playEngineClip(engine, clips.Working_B)
    run(engine, 1.5)
    const played = engineFrame(engine)
    setEnginePose(engine, { rotation: [10, -40, 5] })
    const posed = engineFrame(engine)
    expect(posed.rotation).toEqual([10, -40, 5])
    // What is not given is left to the clip.
    expect(posed.zoom).toBe(played.zoom)
    expect(posed.position).toEqual(played.position)
    setEnginePose(engine, { position: [0.2, 0.1], zoom: 0.8 })
    expect(engineFrame(engine).zoom).toBe(0.8)
    expect(engineFrame(engine).position).toEqual([0.2, 0.1])
    setEnginePose(engine, null)
    expect(engineFrame(engine).rotation).toEqual(played.rotation)
  })

  it('carries a turn given whole to the frame', () => {
    const engine = createAvatarEngine()
    setEnginePose(engine, { orientation: [0.7071, 0, 0.7071, 0] })
    expect(engineFrame(engine).orientation).toEqual([0.7071, 0, 0.7071, 0])
    setEnginePose(engine, null)
    expect(engineFrame(engine).orientation).toBeUndefined()
  })

  it('keeps a gesture apart from a turn given whole, to be laid over it', () => {
    const engine = createAvatarEngine()
    setEnginePose(engine, { orientation: [0.7071, 0, 0.7071, 0] })
    pokeEngine(engine, 'nod')
    run(engine, 0.25)
    const frame = engineFrame(engine)
    expect(frame.orientation).toEqual([0.7071, 0, 0.7071, 0])
    expect(frame.rotation[0]).toBeCloseTo(16, 0)
    expect(frame.rotation[1]).toBe(0)
    run(engine, 0.3)
    expect(engineFrame(engine).rotation).toEqual([0, 0, 0])
  })

  it('still takes a gesture on top', () => {
    const engine = createAvatarEngine()
    setEnginePose(engine, { rotation: [0, 30, 0] })
    pokeEngine(engine, 'nod')
    run(engine, 0.25)
    expect(engineFrame(engine).rotation[0]).toBeCloseTo(16, 0)
    expect(engineFrame(engine).rotation[1]).toBe(30)
  })
})
