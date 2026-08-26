import {
  advanceAvatarPlayback,
  bodyFromDefinition,
  createAvatarPlaybackState,
  expressionFromDefinition,
  interpolatePose,
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
  surfaceFrontSampleAt,
  surfacePresets,
  surfaceSampleAt,
  type AvatarDefinition,
  type SurfaceType,
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

const pathPoints = (value: string): [number, number][] =>
  Array.from(value.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g), match => [
    Number(match[1]),
    Number(match[2]),
  ])

const pathSelfIntersects = (value: string) => {
  const points = pathPoints(value)
  const orientation = (
    [ax, ay]: [number, number],
    [bx, by]: [number, number],
    [cx, cy]: [number, number]
  ) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)

  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length
    for (let second = first + 2; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length
      if (secondNext === first) continue
      const abC = orientation(points[first], points[firstNext], points[second])
      const abD = orientation(points[first], points[firstNext], points[secondNext])
      const cdA = orientation(points[second], points[secondNext], points[first])
      const cdB = orientation(points[second], points[secondNext], points[firstNext])
      if (abC * abD < -0.000001 && cdA * cdB < -0.000001) return true
    }
  }
  return false
}

describe('@bible-strong/avatar-core', () => {
  it('renders every adapted OneWorks surface with finite body and eye geometry', () => {
    const types: SurfaceType[] = [
      'ellipse',
      'square',
      'rounded',
      'teardrop',
      'trapezoid',
      'frustum',
      'half-cone',
      'lock',
    ]
    const neutral = poseFromExpression(expressionFromDefinition('neutral', expression))

    types.forEach(type => {
      const surface = surfacePresets[type]
      const sample = surfaceSampleAt(surface, 0.4, -0.25)
      const face = surfaceFrontSampleAt(surface, 18, -12)
      const geometry = renderAvatar(neutral, surface)

      expect(
        [...sample.point, ...sample.normal, ...face.point, ...face.normal].every(Number.isFinite)
      ).toBe(true)
      expect(geometry.headPath).toContain('M')
      expect(geometry.leftPath).toContain('M')
      expect(geometry.rightPath).toContain('M')
      expect(JSON.stringify(geometry)).not.toContain('NaN')
    })
  })

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

  it('interpolates joyful eye curvature with the standard expression fields', () => {
    const regular = poseFromExpression(expressionFromDefinition('neutral', expression))
    const joyful = poseFromExpression(
      expressionFromDefinition('joyful', {
        ...expression,
        eyes: {
          ...expression.eyes,
          left: { ...expression.eyes.left, curvature: 1 },
          right: { ...expression.eyes.right, curvature: 1 },
        },
      })
    )

    const halfway = interpolatePose(regular, joyful, 0.5)

    expect(halfway.expression.curvatureLeft).toBe(0.5)
    expect(halfway.expression.curvatureRight).toBe(0.5)
  })

  it('keeps curved eyes from folding over themselves while morphing into tall eyes', () => {
    const joyful = poseFromExpression(
      expressionFromDefinition('joyful', {
        ...expression,
        eyes: {
          left: { width: 54, height: 15, x: 0, y: -18, angle: 0, curvature: 1 },
          right: { width: 54, height: 15, x: 0, y: -18, angle: 0, curvature: 1 },
          spacing: 69.276,
        },
      })
    )
    const tallTargets = [
      { left: [51.4, 50.1, 0], right: [50.5, 49.4, 0], spacing: 69 },
      { left: [28.8, 51.4, 0], right: [17.3, 42.7, 90], spacing: 56.6 },
    ] as const
    const surface = bodyFromDefinition(definition.body).primary

    tallTargets.forEach(target => {
      const targetPose = poseFromExpression(
        expressionFromDefinition('target', {
          ...expression,
          eyes: {
            left: {
              width: target.left[0],
              height: target.left[1],
              x: 0,
              y: 0,
              angle: target.left[2],
            },
            right: {
              width: target.right[0],
              height: target.right[1],
              x: 0,
              y: 0,
              angle: target.right[2],
            },
            spacing: target.spacing,
          },
        })
      )

      for (let step = 0; step <= 100; step += 1) {
        const geometry = renderAvatar(interpolatePose(joyful, targetPose, step / 100), surface, 1)
        expect(pathSelfIntersects(geometry.leftPath)).toBe(false)
        expect(pathSelfIntersects(geometry.rightPath)).toBe(false)
      }
    })
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
})
