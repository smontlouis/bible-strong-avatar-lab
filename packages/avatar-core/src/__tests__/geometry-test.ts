import {
  bodyFromDefinition,
  characterFromLegacyDefinition,
  createAvatarPlayer,
  expressionFromDefinition,
  playerFrame,
  poseFromExpression,
  renderAvatar,
  renderCharacterFrame,
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

/** The geometry of a definition's body, facing, as the Studio and the engine draw it. */
const geometryOf = (source: AvatarDefinition) => {
  const body = bodyFromDefinition(source.body)
  return renderAvatar(
    poseFromExpression(expressionFromDefinition('neutral', source.expressions.neutral)),
    body.primary,
    1,
    { bodyNodes: body.nodes }
  )
}

describe('@bible-strong/avatar-core geometry', () => {
  it('gives a body node the exact outline its surface would have as a head, in its place', () => {
    const neutral = expressionFromDefinition('neutral', definition.expressions.neutral)
    const facing = { ...neutral, headX: 0, headY: 0, headZ: 0 }
    const surface = { type: 'sphere', width: 60, height: 44, depth: 30, roundness: 1 } as const
    const node = {
      id: 'ear',
      name: 'Ear',
      surface,
      position: [-80, -60, -10] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    }
    const withNode = renderAvatar(poseFromExpression(facing), definition.body.primary, 1, {
      bodyNodes: [node],
    })
    const alone = renderAvatar(
      poseFromExpression({ ...facing, positionX: -80, positionY: -60, positionZ: -10 }),
      surface,
      1
    )
    const outline = [...withNode.backPaths, ...withNode.frontPaths][0]

    expect(outline).toBe(alone.headPath)
    // An ellipse drawn as arcs, not a polygon wrapped around sampled points.
    expect(outline).toContain('A')

    const turned = renderAvatar(poseFromExpression(facing), definition.body.primary, 1, {
      bodyNodes: [{ ...node, rotation: [0, 0, 40] }],
    })
    expect([...turned.backPaths, ...turned.frontPaths][0]).not.toBe(outline)
  })

  it('keeps custom body-node colors while inherited nodes follow the body color', () => {
    const coloredNodes: AvatarDefinition = {
      ...definition,
      body: {
        ...definition.body,
        nodes: [
          {
            color: '#00aaff',
            surface: { type: 'sphere', width: 42, height: 42, depth: 42, roundness: 1 },
            position: [-70, -65, -15],
            rotation: [0, 0, 0],
          },
          {
            surface: { type: 'sphere', width: 42, height: 42, depth: 42, roundness: 1 },
            position: [70, -65, -15],
            rotation: [0, 0, 0],
          },
        ],
      },
      colors: { ...definition.colors, body: '#ff3355' },
    }

    const scene = renderCharacterFrame(
      characterFromLegacyDefinition(coloredNodes),
      playerFrame(createAvatarPlayer())
    )

    expect([...scene.bodyColors.back, ...scene.bodyColors.front]).toEqual(
      expect.arrayContaining(['#00aaff', '#ff3355'])
    )
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

    const narrowGeometry = geometryOf(narrow)
    const wideGeometry = geometryOf(wide)

    expect(wideGeometry.headPath).not.toBe(narrowGeometry.headPath)
    expect(wideGeometry.wirePaths).not.toEqual(narrowGeometry.wirePaths)
  })
})
