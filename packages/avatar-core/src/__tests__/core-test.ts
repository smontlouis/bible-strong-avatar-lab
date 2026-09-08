import {
  advanceAvatarPlayback,
  bodyFromDefinition,
  createAvatarPlaybackState,
  expressionFromDefinition,
  parseAvatarBody,
  parseAvatarDefinition,
  playAvatarAnimation,
  pauseAvatarPlayback,
  poseFromExpression,
  renderAvatar,
  renderAvatarDefinition,
  renderAvatarFrame,
  resumeAvatarPlayback,
  resolveAnimation,
  sampleAvatarFrame,
  type AvatarDefinition,
} from '../index'

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

const definition: AvatarDefinition = {
  schema: 'bible-strong/avatar-definition',
  schemaVersion: 1,
  name: 'Core fixture',
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [],
  },
  colors: { body: '#5b7fe5', eyes: '#111316' },
  expressions: {
    neutral: expression,
    'upward-side-glance': { ...expression, head: { x: -8, y: 18, z: -4 } },
    'curious-left': { ...expression, head: { x: 0, y: -12, z: 3 } },
  },
  expressionOrder: ['neutral', 'upward-side-glance', 'curious-left'],
  animations: {
    idle: {
      playbackMode: 'loop',
      steps: [
        {
          expression: 'upward-side-glance',
          holdMs: 5_200,
          transitionMs: 500,
          transition: 'smooth',
        },
        { expression: 'curious-left', holdMs: 5_200, transitionMs: 500, transition: 'smooth' },
      ],
      blink: {
        enabled: true,
        initialDelayMs: 2_600,
        minIntervalMs: 3_400,
        maxIntervalMs: 6_200,
        durationMs: 280,
      },
    },
  },
  animationOrder: ['idle'],
}

describe('@bible-strong/avatar-core', () => {
  it('loads a JSON definition and resolves an explicit semantic animation', () => {
    const parsed = parseAvatarDefinition(JSON.stringify(definition))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const idle = resolveAnimation(parsed.value, 'idle')
    expect(idle.ok).toBe(true)
    if (!idle.ok) return
    expect(idle.value.steps.map(step => step.expression)).toEqual([
      'upward-side-glance',
      'curious-left',
    ])
  })

  it('accepts the legacy standard-animation marker without restoring hidden animations', () => {
    const legacy = {
      ...definition,
      animations: {},
      animationOrder: [],
      standardAnimationSet: 1 as const,
    }
    const parsed = parseAvatarDefinition(JSON.stringify(legacy))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(resolveAnimation(parsed.value, 'idle')).toMatchObject({
      ok: false,
      error: { code: 'unknown_animation', key: 'idle' },
    })
  })

  it('advances playback deterministically from transition to hold and the next step', () => {
    const started = playAvatarAnimation(definition, 'idle', 1_000)
    expect(started.ok).toBe(true)
    if (!started.ok) return

    const holding = advanceAvatarPlayback(definition, started.value, 1_500, {
      random: () => 0.5,
    })
    expect(holding).toMatchObject({
      activeAnimation: 'idle',
      activeExpression: 'upward-side-glance',
      phase: 'hold',
      status: 'playing',
    })

    const next = advanceAvatarPlayback(definition, holding, 6_701, { random: () => 0.5 })
    expect(next).toMatchObject({
      activeExpression: 'curious-left',
      phase: 'transition',
      stepIndex: 1,
    })
  })

  it('interpolates and completes a direct expression transition', () => {
    const from = sampleAvatarFrame(definition, createAvatarPlaybackState(), 1_000, {
      random: () => 0.5,
    })
    const state = {
      ...createAvatarPlaybackState(),
      activeExpression: 'curious-left',
      status: 'playing' as const,
      directTransition: {
        from,
        startedAt: 1_000,
        durationMs: 400,
        transition: 'smooth' as const,
      },
    }
    const start = renderAvatarFrame(definition, state, 1_000, { random: () => 0.5 })
    const midway = renderAvatarFrame(definition, state, 1_200, { random: () => 0.5 })
    const end = renderAvatarFrame(definition, state, 1_400, { random: () => 0.5 })

    expect(midway.geometry).not.toEqual(start.geometry)
    expect(midway.geometry).not.toEqual(end.geometry)
    expect(advanceAvatarPlayback(definition, state, 1_400, { random: () => 0.5 })).toMatchObject({
      activeExpression: 'curious-left',
      status: 'stopped',
    })
  })

  it('starts a new animation from the currently displayed frame instead of neutral', () => {
    const current = {
      ...createAvatarPlaybackState(),
      activeExpression: 'curious-left',
    }
    const now = 1_000
    const from = sampleAvatarFrame(definition, current, now, { random: () => 0.5 })
    const started = playAvatarAnimation(definition, 'idle', now, from)
    if (!started.ok) throw new Error(started.error.message)

    expect(renderAvatarFrame(definition, started.value, now, { random: () => 0.5 })).toEqual(
      renderAvatarFrame(definition, current, now, { random: () => 0.5 })
    )
  })

  it('retargets a direct transition from its exact in-flight frame', () => {
    const neutral = createAvatarPlaybackState()
    const firstStartedAt = 1_000
    const first = {
      ...neutral,
      activeExpression: 'curious-left',
      status: 'playing' as const,
      directTransition: {
        from: sampleAvatarFrame(definition, neutral, firstStartedAt, { random: () => 0.5 }),
        startedAt: firstStartedAt,
        durationMs: 400,
        transition: 'smooth' as const,
      },
    }
    const retargetedAt = 1_200
    const inFlight = sampleAvatarFrame(definition, first, retargetedAt, { random: () => 0.5 })
    const second = {
      ...createAvatarPlaybackState(),
      activeExpression: 'upward-side-glance',
      status: 'playing' as const,
      directTransition: {
        from: inFlight,
        startedAt: retargetedAt,
        durationMs: 400,
        transition: 'smooth' as const,
      },
    }

    expect(renderAvatarFrame(definition, second, retargetedAt, { random: () => 0.5 })).toEqual(
      renderAvatarFrame(definition, first, retargetedAt, { random: () => 0.5 })
    )
  })

  it('interpolates expression color overrides during a transition', () => {
    const colored: AvatarDefinition = {
      ...definition,
      expressions: {
        ...definition.expressions,
        'curious-left': {
          ...definition.expressions['curious-left'],
          colors: { body: '#ff0000', eyes: '#ffffff' },
        },
      },
    }
    const neutral = createAvatarPlaybackState()
    const state = {
      ...neutral,
      activeExpression: 'curious-left',
      status: 'playing' as const,
      directTransition: {
        from: sampleAvatarFrame(colored, neutral, 1_000, { random: () => 0.5 }),
        startedAt: 1_000,
        durationMs: 400,
        transition: 'smooth' as const,
      },
    }

    expect(renderAvatarFrame(colored, state, 1_200, { random: () => 0.5 }).colors).toEqual({
      body: '#ad4073',
      eyes: '#88898b',
    })
  })

  it('generates the same geometry through the public definition adapter', () => {
    const scene = renderAvatarDefinition(definition, 'curious-left')
    const body = bodyFromDefinition(definition.body)
    const internalExpression = expressionFromDefinition(
      'curious-left',
      definition.expressions['curious-left']
    )
    const direct = renderAvatar(poseFromExpression(internalExpression), body.primary, 1, {
      bodyNodes: body.nodes,
    })

    expect(scene.geometry).toEqual(direct)
    expect(scene.colors).toEqual(definition.colors)
  })

  it('does not alias cached geometry for surfaces that differ beyond four decimals', () => {
    const narrow: AvatarDefinition = {
      ...definition,
      body: {
        primary: {
          type: 'cube',
          width: 199.00018,
          height: 200,
          depth: 200,
          roundness: 0.5,
        },
        nodes: [],
      },
    }
    const wide: AvatarDefinition = {
      ...narrow,
      body: {
        ...narrow.body,
        primary: { ...narrow.body.primary, width: 199.00022 },
      },
    }

    const narrowScene = renderAvatarDefinition(narrow)
    const wideScene = renderAvatarDefinition(wide)

    expect(wideScene.geometry.headPath).not.toBe(narrowScene.geometry.headPath)
    expect(wideScene.geometry.wirePaths).not.toEqual(narrowScene.geometry.wirePaths)
  })

  it('starts from the documented neutral stopped state', () => {
    expect(createAvatarPlaybackState()).toMatchObject({
      activeExpression: 'neutral',
      status: 'stopped',
    })
  })

  it('interpolates a bounded transition and freezes its exact progress while paused', () => {
    const started = playAvatarAnimation(definition, 'idle', 1_000)
    if (!started.ok) throw new Error(started.error.message)
    const neutral = renderAvatarDefinition(definition, 'neutral')
    const target = renderAvatarDefinition(definition, 'upward-side-glance')
    const halfway = renderAvatarFrame(definition, started.value, 1_250, {
      random: () => 0.5,
    })
    expect(halfway.geometry.leftPath).not.toBe(neutral.geometry.leftPath)
    expect(halfway.geometry.leftPath).not.toBe(target.geometry.leftPath)

    const paused = pauseAvatarPlayback(started.value, 1_250)
    const resumed = resumeAvatarPlayback(paused, 4_250)
    expect(resumed.phaseStartedAt).toBe(4_000)
    const resumedFrame = renderAvatarFrame(definition, resumed, 4_250, {
      random: () => 0.5,
    })
    expect(resumedFrame.geometry.leftPath).toBe(halfway.geometry.leftPath)
  })

  it('uses the injectable random source for a deterministic blink timeline', () => {
    const started = playAvatarAnimation(definition, 'idle', 1_000)
    if (!started.ok) throw new Error(started.error.message)
    const blinking = advanceAvatarPlayback(definition, started.value, 3_600, {
      random: () => 0,
    })
    expect(blinking.blinkStartedAt).toBe(3_600)
    expect(blinking.blinkDueAt).toBe(7_280)
    const open = renderAvatarFrame(definition, blinking, 3_600, { random: () => 0 })
    const closed = renderAvatarFrame(definition, blinking, 3_740, { random: () => 0 })
    expect(closed.geometry.leftPath).not.toBe(open.geometry.leftPath)
  })

  it('returns a typed error for an animation that is not present in the definition', () => {
    expect(resolveAnimation(definition, 'missing')).toMatchObject({
      ok: false,
      error: { code: 'unknown_animation', key: 'missing' },
    })
    expect(resolveAnimation(definition, 'happy')).toMatchObject({
      ok: false,
      error: { code: 'unknown_animation', key: 'happy' },
    })
  })

  it('resolves an explicit animation by its semantic key', () => {
    const overridden: AvatarDefinition = {
      ...definition,
      animations: {
        idle: {
          playbackMode: 'once',
          steps: [{ expression: 'neutral', holdMs: 100, transitionMs: 0, transition: 'snappy' }],
          blink: {
            enabled: false,
            initialDelayMs: 0,
            minIntervalMs: 1_000,
            maxIntervalMs: 1_000,
            durationMs: 100,
          },
        },
      },
      animationOrder: ['idle'],
    }
    expect(resolveAnimation(overridden, 'idle')).toMatchObject({
      ok: true,
      value: { playbackMode: 'once', steps: [{ expression: 'neutral' }] },
    })
  })

  it('completes once playback and deterministically removes transition motion', () => {
    const onceDefinition: AvatarDefinition = {
      ...definition,
      animations: {
        once: {
          playbackMode: 'once',
          steps: [
            {
              expression: 'curious-left',
              holdMs: 100,
              transitionMs: 100,
              transition: 'smooth',
            },
          ],
          blink: {
            enabled: false,
            initialDelayMs: 0,
            minIntervalMs: 1_000,
            maxIntervalMs: 1_000,
            durationMs: 100,
          },
        },
      },
      animationOrder: ['once'],
    }
    const started = playAvatarAnimation(onceDefinition, 'once', 0)
    if (!started.ok) throw new Error(started.error.message)
    const reduced = renderAvatarFrame(onceDefinition, started.value, 50, {
      random: () => 0.5,
      reduceMotion: true,
    })
    expect(reduced.geometry.leftPath).toBe(
      renderAvatarDefinition(onceDefinition, 'curious-left').geometry.leftPath
    )
    expect(
      advanceAvatarPlayback(onceDefinition, started.value, 200, { random: () => 0.5 })
    ).toMatchObject({
      activeExpression: 'curious-left',
      status: 'stopped',
    })
  })

  it('exposes a node color independently from the body color on the scene', () => {
    const withNode: AvatarDefinition = {
      ...definition,
      body: {
        primary: definition.body.primary,
        nodes: [
          {
            surface: { type: 'sphere', width: 80, height: 80, depth: 80, roundness: 1 },
            position: [90, -70, -20],
            rotation: [0, 0, 0],
            color: '#ff0000',
          },
          {
            surface: { type: 'cube', width: 60, height: 60, depth: 60, roundness: 0 },
            position: [-90, -70, -20],
            rotation: [0, 0, 0],
          },
        ],
      },
    }
    const parsed = parseAvatarDefinition(JSON.stringify(withNode))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const scene = renderAvatarDefinition(parsed.value, 'neutral')
    expect(scene.colors.body).toBe(definition.colors.body)
    expect(scene.nodeColors['runtime-node-0']).toBe('#ff0000')
    // A node without a color stays on the body color.
    expect(scene.nodeColors['runtime-node-1']).toBeUndefined()
  })

  it('drops a node color that is not a valid hex color', () => {
    const body = parseAvatarBody(
      {
        primary: definition.body.primary,
        nodes: [
          {
            id: 'shape-1',
            name: 'Shape',
            surface: { type: 'sphere', width: 80, height: 80, depth: 80, roundness: 1 },
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            color: 'not-a-color',
          },
        ],
      },
      definition.body.primary
    )
    expect(body.nodes[0].color).toBeUndefined()
  })
})
