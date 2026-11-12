import {
  expressionFromDefinition,
  poseFromExpression,
  renderAvatar,
  renderAvatarDefinition,
  validateAvatarDefinition,
  type AvatarDefinition,
  type BodyNode,
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

  it('moves the mask smoothly through a whole turn of the head', () => {
    let previous: ReturnType<typeof box> | undefined
    let widest = 0
    for (let yaw = -80; yaw <= 80; yaw += 0.5) {
      const clip = render(node([-100, 0, 20], '#e5a15b'), yaw).frontClipPaths[0]
      if (!clip) {
        previous = undefined
        continue
      }
      const current = box(clip)
      if (previous) {
        for (const side of ['minX', 'maxX', 'minY', 'maxY'] as const) {
          widest = Math.max(widest, Math.abs(current[side] - previous[side]))
        }
      }
      previous = current
    }
    // Half a degree of turn moves a point of the node by about one unit: no side of the mask
    // may jump further than a few.
    expect(widest).toBeLessThan(4)
  })

  it('keeps the plain rule where a surface is not an ellipsoid', () => {
    const cone: BodyNode = {
      ...node([-100, 0, 20], '#e5a15b'),
      surface: { type: 'cone', width: 70, height: 70, depth: 70, roundness: 1 },
    }
    expect(render(cone)).toEqual(render(cone, 0, 'layer'))

    const cube = { type: 'cube', width: 200, height: 200, depth: 200, roundness: 0.5 } as const
    const options = { bodyNodes: [node([-100, 0, 20], '#e5a15b')], includeWire: false, bodyColor }
    const pose = poseFromExpression(expressionFromDefinition('neutral', expression))
    expect(renderAvatar(pose, cube, 1, { ...options, nodeOcclusion: 'mask' })).toEqual(
      renderAvatar(pose, cube, 1, { ...options, nodeOcclusion: 'layer' })
    )
  })

  it('reaches a rendered definition, with the colour of each copy', () => {
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
    const scene = renderAvatarDefinition(validated.value)

    expect(scene.geometry.frontClipPaths[0]).toMatch(/^M.*Z$/)
    expect(scene.bodyColors.back).toEqual(['#e5a15b'])
    expect(scene.bodyColors.front).toEqual(['#e5a15b'])
  })
})
