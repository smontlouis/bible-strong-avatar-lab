import {
  expressionFromDefinition,
  multiplyQuaternions,
  poseFromExpression,
  quaternionFromEuler,
  renderAvatar,
  rotateWithQuaternion,
  surfaceField,
  surfacePresets,
  validateAvatarDefinition,
  characterFromLegacyDefinition,
  createAvatarPlayer,
  playerFrame,
  renderCharacterFrame,
  type AvatarDefinition,
  type BodyNode,
  type Quaternion,
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

const head = { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 } as const
const bodyColor = '#5b7fe5'

const node = (position: [number, number, number], color?: string): BodyNode => ({
  id: 'hand',
  name: 'Hand',
  ...(color ? { color } : {}),
  surface: { type: 'sphere', width: 70, height: 70, depth: 70, roundness: 1 },
  position,
  rotation: [0, 0, 0],
})

const render = (bodyNode: BodyNode, yaw = 0, nodeOcclusion: 'layer' | 'mask' = 'mask') =>
  renderAvatar(
    poseFromExpression({ ...expressionFromDefinition('neutral', expression), headY: yaw }),
    head,
    1,
    { bodyNodes: [bodyNode], includeWire: false, nodeOcclusion, bodyColor }
  )

/** The box around every point a path names. */
const box = (path: string) => {
  const numbers = (path.match(/-?\d+\.\d+/g) ?? []).map(Number)
  const xs = numbers.filter((_, index) => index % 2 === 0)
  const ys = numbers.filter((_, index) => index % 2 === 1)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

/** The loops of a clip path as polygons, its curves cut into short segments. */
const polygons = (path: string) => {
  const loops: [number, number][][] = []
  let pen: [number, number] = [0, 0]
  for (const [, command, values] of path.matchAll(/([MLC])([^MLCZ]*)/g)) {
    const numbers = (values.match(/-?\d+\.?\d*/g) ?? []).map(Number)
    if (command === 'M') loops.push([])
    const loop = loops[loops.length - 1]
    if (command === 'C') {
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8
        const u = 1 - t
        loop.push([
          u * u * u * pen[0] +
            3 * u * u * t * numbers[0] +
            3 * u * t * t * numbers[2] +
            t * t * t * numbers[4],
          u * u * u * pen[1] +
            3 * u * u * t * numbers[1] +
            3 * u * t * t * numbers[3] +
            t * t * t * numbers[5],
        ])
      }
      pen = [numbers[4], numbers[5]]
    } else {
      pen = [numbers[0], numbers[1]]
      loop.push(pen)
    }
  }
  return loops
}

/** Whether a point is inside any of the loops, by the non-zero rule a clip path follows. */
const inside = (loops: [number, number][][], x: number, y: number) => {
  let winding = 0
  for (const loop of loops) {
    for (let index = 0; index < loop.length; index += 1) {
      const from = loop[index]
      const to = loop[(index + 1) % loop.length]
      if (from[1] <= y === to[1] <= y) continue
      const crossing = from[0] + ((y - from[1]) / (to[1] - from[1])) * (to[0] - from[0])
      if (crossing > x) winding += to[1] > from[1] ? 1 : -1
    }
  }
  return winding !== 0
}

describe('occlusion masks', () => {
  it('leaves a node of the body colour, or of none, to the plain rule', () => {
    for (const plain of [node([-100, 0, 20]), node([-100, 0, 20], bodyColor)]) {
      const masked = render(plain)
      expect(masked).toEqual(render(plain, 0, 'layer'))
      expect(masked.frontClipPaths.every(clip => clip === '')).toBe(true)
    }
  })

  it('draws a coloured node behind the head and again in front where it is nearer', () => {
    // Half sunk into the side of the head, a little towards the viewer.
    const geometry = render(node([-100, 0, 20], '#e5a15b'))
    expect(geometry.backNodeIds).toEqual(['hand'])
    expect(geometry.frontNodeIds).toEqual(['hand'])
    expect(geometry.frontPaths[0]).toBe(geometry.backPaths[0])
    expect(geometry.frontClipPaths[0]).toMatch(/^M.*Z$/)
  })

  it('gives no copy in front to a coloured node wholly behind the head', () => {
    const geometry = render(node([0, 0, -150], '#e5a15b'))
    expect(geometry.backNodeIds).toEqual(['hand'])
    expect(geometry.frontPaths).toEqual([])
    expect(geometry.frontClipPaths).toEqual([])
  })

  it('does not measure a coloured node that does not meet the head on screen', () => {
    const geometry = render(node([-260, 0, 60], '#e5a15b'))
    expect(geometry.backNodeIds).toEqual(['hand'])
    expect(geometry.frontPaths).toEqual([])
  })

  it('draws a coloured node that stands in front of the head once, whole', () => {
    const geometry = render(node([0, 0, 140], '#e5a15b'))
    expect(geometry.backNodeIds).toEqual([])
    expect(geometry.frontNodeIds).toEqual(['hand'])
    expect(geometry.frontClipPaths).toEqual([''])
  })

  it('traces the line where the two solids meet as curves, not as a polygon', () => {
    const clip = render(node([-100, 0, 20], '#e5a15b')).frontClipPaths[0]
    expect((clip.match(/C/g) ?? []).length).toBeGreaterThan(4)
  })

  it.each([
    ['sphere', 'sphere'],
    ['sphere', 'cube'],
    ['cube', 'cone'],
    ['capsule', 'cylinder'],
    ['cylinder', 'diamond'],
    ['cone', 'capsule'],
    ['diamond', 'trapezoid'],
    ['trapezoid', 'sphere'],
    ['cursor', 'cube'],
    ['mickey', 'cylinder'],
  ] as const)(
    'agrees with every line of sight, for a %s head and a %s node',
    (headType, nodeType) => {
      const headSurface = surfacePresets[headType]
      const preset = surfacePresets[nodeType]
      const rotation: [number, number, number] = [20, 30, 15]
      const bodyNode: BodyNode = {
        id: 'hand',
        name: 'Hand',
        color: '#e5a15b',
        surface: {
          ...preset,
          width: preset.width * 0.36,
          height: preset.height * 0.36,
          depth: preset.depth * 0.36,
        },
        position: [-headSurface.width * 0.44, headSurface.height * 0.1, headSurface.depth * 0.12],
        rotation,
      }
      const headField = surfaceField(headSurface)
      const nodeField = surfaceField(bodyNode.surface)
      const radians = (degrees: number) => (degrees * Math.PI) / 180
      const inverse = ([w, x, y, z]: Quaternion): Quaternion => [w, -x, -y, -z]
      let compared = 0
      let different = 0
      for (const [pitch, yaw] of [
        [0, 0],
        [8, -30],
        [-12, 35],
        [20, 70],
      ]) {
        const pose = poseFromExpression({
          ...expressionFromDefinition('neutral', expression),
          headX: pitch,
          headY: yaw,
        })
        const geometry = renderAvatar(pose, headSurface, 1, {
          bodyNodes: [bodyNode],
          includeWire: false,
          nodeOcclusion: 'mask',
          bodyColor,
        })
        const front = geometry.frontNodeIds.indexOf('hand')
        const clip = front < 0 ? null : geometry.frontClipPaths[front]
        const loops = clip ? polygons(clip) : []
        const nodeTurn = multiplyQuaternions(
          pose.orientation,
          quaternionFromEuler(radians(rotation[0]), radians(rotation[1]), radians(rotation[2]))
        )
        const center = rotateWithQuaternion(pose.orientation, bodyNode.position)
        const toHead = inverse(pose.orientation)
        const toNode = inverse(nodeTurn)
        const eye = 620
        const scale = eye / (eye - center[2])
        for (
          let screenY = center[1] * scale - 60;
          screenY <= center[1] * scale + 60;
          screenY += 4
        ) {
          for (
            let screenX = center[0] * scale - 60;
            screenX <= center[0] * scale + 60;
            screenX += 4
          ) {
            // The first depth at which the line of sight is inside each solid.
            let nodeAt: number | undefined
            let headAt: number | undefined
            for (let depth = 280; depth >= -280; depth -= 1) {
              const ratio = (eye - depth) / eye
              const point: [number, number, number] = [screenX * ratio, screenY * ratio, depth]
              if (nodeAt === undefined) {
                const inNode = rotateWithQuaternion(toNode, [
                  point[0] - center[0],
                  point[1] - center[1],
                  point[2] - center[2],
                ])
                if (nodeField(inNode[0], inNode[1], inNode[2]) <= 0) nodeAt = depth
              }
              if (headAt === undefined) {
                const inHead = rotateWithQuaternion(toHead, point)
                if (headField(inHead[0], inHead[1], inHead[2]) <= 0) headAt = depth
              }
              if (nodeAt !== undefined && headAt !== undefined) break
            }
            // Only where both are met, and not within the grain of this march of the line itself.
            if (nodeAt === undefined || headAt === undefined || Math.abs(nodeAt - headAt) < 3) {
              continue
            }
            const drawnInFront = clip !== null && (clip === '' || inside(loops, screenX, screenY))
            compared += 1
            if (drawnInFront !== nodeAt > headAt) different += 1
          }
        }
      }
      expect(compared).toBeGreaterThan(200)
      expect(different / compared).toBeLessThan(0.01)
    }
  )

  it('hides the nose and the mouth with the eyes when the head is turned away', () => {
    const face = {
      ...expressionFromDefinition('neutral', expression),
      noseEnabled: true,
      mouthEnabled: true,
    }
    const at = (yaw: number) =>
      renderAvatar(poseFromExpression({ ...face, headY: yaw }), head, 1, { includeWire: false })
    expect(at(0).nosePath).not.toBe('')
    expect(at(0).mouthPath).not.toBe('')
    const away = at(180)
    expect(away.leftVisible).toBe(false)
    expect(away.nosePath).toBe('')
    expect(away.mouthPath).toBe('')
  })

  it('leaves a static node where it is while the head turns', () => {
    const following = node([-100, 0, 20])
    const fixed: BodyNode = { ...following, followsHead: false }
    const pathOf = (bodyNode: BodyNode, yaw: number) => {
      const geometry = render(bodyNode, yaw)
      return [...geometry.backPaths, ...geometry.frontPaths][0]
    }
    // At rest both are the same node.
    expect(pathOf(fixed, 0)).toBe(pathOf(following, 0))
    // The head turns: the node that follows moves, the static one does not.
    expect(pathOf(following, 40)).not.toBe(pathOf(following, 0))
    expect(pathOf(fixed, 40)).toBe(pathOf(fixed, 0))
  })

  it('moves a static node with the head when the head is moved, not turned', () => {
    const fixed: BodyNode = { ...node([-100, 0, 20]), followsHead: false }
    const at = (positionX: number) =>
      renderAvatar(
        poseFromExpression({ ...expressionFromDefinition('neutral', expression), positionX }),
        head,
        1,
        { bodyNodes: [fixed], includeWire: false, nodeOcclusion: 'mask', bodyColor }
      )
    const still = box([...at(0).backPaths, ...at(0).frontPaths][0])
    const moved = box([...at(30).backPaths, ...at(30).frontPaths][0])
    expect(moved.minX - still.minX).toBeGreaterThan(20)
  })

  it('sinks a static coloured node into the head that turns into it', () => {
    const fixed: BodyNode = { ...node([-100, 0, 20], '#e5a15b'), followsHead: false }
    const turned = render(fixed, 40)
    expect(turned.frontNodeIds).toEqual(['hand'])
    expect(turned.frontClipPaths[0]).toMatch(/^M.*Z$/)
  })

  it('reaches the frame of a character, with the colour of each copy', () => {
    const source: AvatarDefinition = {
      schema: 'bible-strong/avatar-definition',
      schemaVersion: 1,
      name: 'Masked',
      body: {
        primary: head,
        nodes: [
          {
            color: '#e5a15b',
            surface: { type: 'sphere', width: 70, height: 70, depth: 70, roundness: 1 },
            position: [-100, 0, 20],
            rotation: [0, 0, 0],
          },
        ],
      },
      colors: { body: bodyColor, eyes: '#111316' },
      expressions: { neutral: expression },
      expressionOrder: ['neutral'],
      animations: {},
      animationOrder: [],
    }
    const validated = validateAvatarDefinition(source)
    if (!validated.ok) throw new Error(validated.errors[0]?.message)
    const scene = renderCharacterFrame(
      characterFromLegacyDefinition(validated.value),
      playerFrame(createAvatarPlayer())
    )

    expect(scene.geometry.frontClipPaths[0]).toMatch(/^M.*Z$/)
    expect(scene.bodyColors.back).toEqual(['#e5a15b'])
    expect(scene.bodyColors.front).toEqual(['#e5a15b'])
  })
})
