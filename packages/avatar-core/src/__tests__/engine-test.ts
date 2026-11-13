import { clips, routines, stateGroups, stateNames, states } from '../catalogue'
import {
  advanceEngine,
  createAvatarEngine,
  engineFrame,
  playEngineClip,
  pokeEngine,
  seedOfName,
  setEngineCompact,
  setEngineEmphasis,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEnginePose,
  setEngineRoutine,
  setEngineState,
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
  it('has the 54 states, all of which name clips that exist', () => {
    expect(stateNames).toHaveLength(54)
    for (const name of stateNames) {
      for (const clip of [...states[name].clips, ...(states[name].compactClips ?? [])]) {
        expect(clips[clip]).toBeDefined()
      }
      if (states[name].next) expect(states[states[name].next!]).toBeDefined()
    }
    expect(stateGroups.flatMap(group => group.states).sort()).toEqual([...stateNames].sort())
  })

  it('has the four scenarios, whose steps name states that exist', () => {
    expect(Object.keys(routines).sort()).toEqual(['chat', 'code', 'computer-use', 'research'])
    for (const steps of Object.values(routines)) {
      for (const [state, seconds] of steps) {
        expect(states[state]).toBeDefined()
        expect(seconds).toBeGreaterThan(0)
      }
    }
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

describe('scenarios', () => {
  it('leads the avatar through the states of chat, each for its time, and starts over', () => {
    const engine = createAvatarEngine()
    setEngineRoutine(engine, 'chat')
    const seen: string[] = []
    for (let elapsed = 0; elapsed < 31.8 + 2; elapsed += STEP) {
      advanceEngine(engine, STEP)
      const step = routines.chat[engine.routine!.step][0]
      if (step !== seen[seen.length - 1]) seen.push(step)
    }
    expect(seen.slice(0, 13)).toEqual(routines.chat.map(step => step[0]))
    // Round again.
    expect(seen[13]).toBe('working')
  })

  it('changes state when a step is over, without waiting for the clip to end', () => {
    const engine = createAvatarEngine()
    setEngineRoutine(engine, 'chat')
    expect(engine.state).toBe('working')
    run(engine, 1.7)
    expect(engine.state).toBe('thinking')
    expect(engine.morph).toBe('thinking')
  })

  it('keeps the same clips going from one state of work to the next, and changes the text', () => {
    const engine = createAvatarEngine()
    setEngineRoutine(engine, 'code')
    // Steps 3 and 4 of code are reading then running: both are states of work.
    run(engine, 1.6 + 2.6 + 0.2)
    expect(engine.state).toBe('reading')
    expect(engine.routine!.text).toBe('Reading the file')
    const clip = engine.player.clip?.name
    run(engine, 2.8)
    expect(routines.code[engine.routine!.step][0]).toBe('running')
    expect(engine.routine!.text).toBe('Running a few commands')
    expect(engine.state).toBe('reading')
    expect(engine.player.clip?.name).toBe(clip)
  })

  it('does not say the same thing twice in a row when it has a choice', () => {
    const engine = createAvatarEngine({ seed: 9 })
    setEngineRoutine(engine, 'chat')
    const thoughts: string[] = []
    let step = -1
    for (let elapsed = 0; elapsed < 31.8 * 3; elapsed += STEP) {
      advanceEngine(engine, STEP)
      const routine = engine.routine!
      if (routine.step !== step) {
        step = routine.step
        if (routines.chat[step][0] === 'thinking') thoughts.push(routine.text!)
      }
    }
    expect(thoughts.length).toBeGreaterThan(6)
    for (let index = 1; index < thoughts.length; index += 1) {
      expect(thoughts[index]).not.toBe(thoughts[index - 1])
    }
  })

  it('stops a scenario and leaves the avatar where it is', () => {
    const engine = createAvatarEngine()
    setEngineRoutine(engine, 'research')
    run(engine, 2)
    setEngineRoutine(engine, null)
    const state = engine.state
    run(engine, 5)
    expect(engine.routine).toBeNull()
    expect(engine.state).toBe(state)
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

  it('still takes a gesture on top', () => {
    const engine = createAvatarEngine()
    setEnginePose(engine, { rotation: [0, 30, 0] })
    pokeEngine(engine, 'nod')
    run(engine, 0.25)
    expect(engineFrame(engine).rotation[0]).toBeCloseTo(16, 0)
    expect(engineFrame(engine).rotation[1]).toBe(30)
  })
})
