import { clips } from '../catalogue/index.js'
import { renderCharacterFrame } from '../character.js'
import { characterOf } from '../characterFile.js'
import {
  ARTBOARD_RADII,
  compileFace,
  drawnEyeShapes,
  faceNameProblem,
  MAX_EYE_POINTS,
  type DrawnEye,
  type FaceDefinition,
} from '../drawnFaces.js'
import {
  advanceEngine,
  createAvatarEngine,
  engineAtRest,
  engineFrame,
  playEngineClip,
  setEngineFace,
  setEngineLibrary,
  stopEngine,
} from '../engine.js'
import { eyeOutline, faces } from '../faces.js'
import { faceFromSvg, readAvatarLibrary } from '../library.js'
import { FACE_SWAP_SECONDS, type PlayerFrame } from '../player.js'
import { faceEyesFromSvg } from '../svgFace.js'
import { flattenPath } from '../svgPath.js'
import strobi from '../../../../examples/react-vite-consumer/src/strobi.avatar.json' with { type: 'json' }

type Shape = readonly (readonly [number, number])[]

/** How many times the shapes wind round a point: what `nonzero` fills is not 0. */
const winding = (shapes: readonly Shape[], [px, py]: [number, number]) => {
  let total = 0
  for (const shape of shapes) {
    for (let index = 0; index < shape.length; index += 1) {
      const [x1, y1] = shape[index]
      const [x2, y2] = shape[(index + 1) % shape.length]
      if (y1 <= py && y2 > py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) > 0) total += 1
      if (y1 > py && y2 <= py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) < 0) total -= 1
    }
  }
  return total
}

/** A point of the artboard in the frame of the eye on the left of the screen. */
const leftFrame = (x: number, y: number): [number, number] => [
  -(x - 50) * (ARTBOARD_RADII / 100),
  -(y - 50) * (ARTBOARD_RADII / 100),
]

const box = (shapes: readonly Shape[]) => {
  const points = shapes.flat()
  const xs = points.map(point => point[0])
  const ys = points.map(point => point[1])
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

const cross: FaceDefinition = {
  name: 'Dead',
  blinks: false,
  eyes: {
    left: [{ d: 'M25 25L75 75M75 25L25 75', fill: false, stroke: { width: 14, cap: 'round' } }],
  },
}
const ring: FaceDefinition = {
  name: 'Ring',
  eyes: {
    left: [
      { d: 'M20 50A30 30 0 1 0 80 50A30 30 0 1 0 20 50Z', fill: false, stroke: { width: 12 } },
    ],
  },
}
const star: FaceDefinition = {
  name: 'Star',
  eyes: {
    left: [
      {
        d: 'M50 8L61 38L93 38L67 57L77 88L50 70L23 88L33 57L7 38L39 38Z',
        stroke: { width: 10, join: 'round' },
      },
    ],
  },
}
// An arrow pointing to the left of the artboard: outward, for the eye on the left of the screen.
const arrow: FaceDefinition = {
  name: 'Arrow',
  eyes: { left: [{ d: 'M10 50L60 20L60 80Z' }] },
}

const shapesOf = (face: FaceDefinition, index: 0 | 1 = 0) =>
  compileFace(face).face.eyes[index].shapes

describe('svg paths', () => {
  it('reads every command, relative and absolute, packed arc flags included', () => {
    const [square] = flattenPath('M0 0h10v10H0z')
    expect(square.closed).toBe(true)
    expect(square.points).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ])
    const [arc] = flattenPath('M0 0a10 10 0 01 20 0')
    const last = arc.points[arc.points.length - 1]
    expect(last[0]).toBeCloseTo(20, 6)
    expect(last[1]).toBeCloseTo(0, 6)
    // Half a circle of radius 10 reaches 10 away from its chord.
    expect(Math.max(...arc.points.map(point => Math.abs(point[1])))).toBeCloseTo(10, 0)
    const [smooth] = flattenPath('M0 0C0 10 10 10 10 0S20 -10 20 0Q25 5 30 0T40 0')
    expect(smooth.points[smooth.points.length - 1]).toEqual([40, 0])
    expect(() => flattenPath('M0 0L10')).toThrow(/missing a number/)
    expect(() => flattenPath('10 10')).toThrow(/start with a command/)
  })
})

describe('drawn faces', () => {
  it('fills a cross where its two strokes meet, with round ends', () => {
    const shapes = shapesOf(cross)
    expect(winding(shapes, leftFrame(50, 50))).not.toBe(0)
    // Along a stroke and past its end by less than half its width: the round end.
    expect(winding(shapes, leftFrame(22, 22))).not.toBe(0)
    // Between the arms, and past the ends: nothing.
    expect(winding(shapes, leftFrame(50, 25))).toBe(0)
    expect(winding(shapes, leftFrame(14, 14))).toBe(0)
  })

  it('draws a stroked circle as a ring, hollow in its middle', () => {
    const shapes = shapesOf(ring)
    expect(winding(shapes, leftFrame(50, 50))).toBe(0)
    expect(winding(shapes, leftFrame(20, 50))).not.toBe(0)
    expect(winding(shapes, leftFrame(50, 80))).not.toBe(0)
    expect(winding(shapes, leftFrame(50, 89))).toBe(0)
  })

  it('rounds the points of a filled star with a round stroke of its colour', () => {
    const shapes = shapesOf(star)
    expect(winding(shapes, leftFrame(50, 50))).not.toBe(0)
    // Just past the top point, inside the stroke's round corner.
    expect(winding(shapes, leftFrame(50, 5))).not.toBe(0)
    // Straight above it by more than half the stroke: outside.
    expect(winding(shapes, leftFrame(50, 1))).toBe(0)
  })

  it('makes holes the way SVG does: evenodd, or a path inside turning the other way', () => {
    const evenodd = shapesOf({
      name: 'Donut',
      eyes: {
        left: [
          {
            d: 'M10 50A40 40 0 1 0 90 50A40 40 0 1 0 10 50ZM35 50A15 15 0 1 0 65 50A15 15 0 1 0 35 50Z',
            fillRule: 'evenodd',
          },
        ],
      },
    })
    expect(winding(evenodd, leftFrame(50, 50))).toBe(0)
    expect(winding(evenodd, leftFrame(20, 50))).not.toBe(0)
    const nonzero = shapesOf({
      name: 'Donut2',
      eyes: {
        left: [{ d: 'M10 10H90V90H10ZM30 30V70H70V30Z' }],
      },
    })
    expect(winding(nonzero, leftFrame(50, 50))).toBe(0)
    expect(winding(nonzero, leftFrame(20, 50))).not.toBe(0)
  })

  it('points outward for both eyes when the right one mirrors the left', () => {
    const [left, right] = compileFace(arrow).face.eyes
    // The tip, at the left of the artboard, is outward: positive across in the eye's frame.
    expect(box(left.shapes).maxX).toBeCloseTo(0.24, 2)
    expect(right.shapes).toBe(left.shapes)
    // On the face, the left eye's tip is the leftmost of it, the right eye's the rightmost.
    const character = characterOf(strobi)
    const engine = createAvatarEngine({ faces: { Arrow: compileFace(arrow).face } })
    setEngineFace(engine, 'Arrow')
    for (let step = 0; step < 40; step += 1) advanceEngine(engine, 1 / 60)
    const scene = renderCharacterFrame(character, engineFrame(engine))
    const xsOf = (path: string) =>
      [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(match => Number(match[1]))
    const leftXs = xsOf(scene.geometry.leftPath)
    const rightXs = xsOf(scene.geometry.rightPath)
    const middle = (xs: number[]) => (Math.min(...xs) + Math.max(...xs)) / 2
    // The tip is a point: the far side of each eye is where one point is, not where two are.
    const far = (xs: number[], sign: number) =>
      xs.filter(x => sign * (x - middle(xs)) > 0.4 * (Math.max(...xs) - Math.min(...xs))).length
    expect(far(leftXs, -1)).toBeLessThan(far(leftXs, 1))
    expect(far(rightXs, 1)).toBeLessThan(far(rightXs, -1))
  })

  it('keeps an eye within the points every frame can draw', () => {
    const busy: FaceDefinition = {
      name: 'Busy',
      eyes: {
        left: Array.from({ length: 40 }, (_, index) => ({
          d: `M${10 + index * 2} 10A20 20 0 1 0 ${10 + index * 2} 90`,
          fill: false,
          stroke: { width: 3, cap: 'round' as const },
        })),
      },
    }
    const compiled = compileFace(busy)
    const points = compiled.face.eyes[0].shapes.reduce((total, shape) => total + shape.length, 0)
    expect(points <= MAX_EYE_POINTS || compiled.problems.length > 0).toBe(true)
  })

  it('says what is wrong with a name or a path', () => {
    expect(faceNameProblem('smile')).toMatch(/built-in/)
    expect(faceNameProblem('Happy')).toMatch(/built-in/)
    expect(faceNameProblem(' star')).toMatch(/spaces/)
    expect(faceNameProblem('Star')).toBeNull()
    expect(() => compileFace({ name: 'x', eyes: { left: [] } })).toThrow(/list of marks/)
    const bad = compileFace({ name: 'Bad', eyes: { left: [{ d: 'M0 0L' }] } })
    expect(bad.problems.join(' ')).toMatch(/left eye mark 1/)
  })

  it('closes a drawn eye by squashing it, from no change at all', () => {
    const eye: DrawnEye = compileFace(star).face.eyes[0]
    const open = box(drawnEyeShapes(eye, 1, 0))
    const barely = box(drawnEyeShapes(eye, 1, 0.01))
    expect(Math.abs(barely.height - open.height)).toBeLessThan(open.height * 0.02)
    const closed = box(drawnEyeShapes(eye, 1, 1))
    expect(closed.width).toBeCloseTo(open.width, 6)
    expect(closed.height).toBeCloseTo(open.width * 0.42, 6)
    const shut = box(drawnEyeShapes({ ...eye, shut: 1 }, 1, 0))
    expect(shut.height).toBeLessThan(open.height * 0.05)
  })
})

describe('drawn faces on the player', () => {
  const library = () => {
    const { library: read } = readAvatarLibrary({ faces: [star, cross] })
    return read
  }
  /** The eye on the left of the screen, frame after frame, as boxes. */
  const watch = (engine: ReturnType<typeof createAvatarEngine>, seconds: number) => {
    const boxes: ReturnType<typeof box>[] = []
    const frames: PlayerFrame[] = []
    for (let time = 0; time < seconds; time += 1 / 60) {
      advanceEngine(engine, 1 / 60)
      const frame = engineFrame(engine)
      frames.push(frame)
      const eye = frame.eyes[0]
      boxes.push(
        box('kind' in eye ? drawnEyeShapes(eye, 1, frame.lids) : [eyeOutline(eye, 1, frame.lids)])
      )
    }
    return { boxes, frames }
  }
  const jumps = (boxes: ReturnType<typeof box>[]) =>
    Math.max(
      ...boxes.slice(1).map((current, index) => {
        const before = boxes[index]
        return Math.max(
          Math.abs(current.minX - before.minX),
          Math.abs(current.maxX - before.maxX),
          Math.abs(current.minY - before.minY),
          Math.abs(current.maxY - before.maxY)
        )
      })
    )

  it('blinks from a built-in face to a drawn one, to another, and back, without a jump', () => {
    const engine = createAvatarEngine({ seed: 3 })
    setEngineLibrary(engine, library())
    playEngineClip(engine, clips.Logo_A)
    watch(engine, 0.5)
    for (const face of ['Star', 'Dead', 'surprised']) {
      setEngineFace(engine, face)
      const { boxes, frames } = watch(engine, 0.6)
      expect(engine.player.faceWay).toBe('blink')
      // A sixtieth of a second moves an edge by a few hundredths of a head at most.
      expect(jumps(boxes)).toBeLessThan(0.12)
      expect(frames[frames.length - 1].face).toBe(face)
      // Halfway, the eyes are shut: hardly any height.
      const shut = boxes[Math.round(FACE_SWAP_SECONDS * 0.45 * 60 - 1)]
      expect(shut.height).toBeLessThan(0.05)
    }
  })

  it('takes up a blink that a new face interrupts from where the eyes are', () => {
    const engine = createAvatarEngine({ seed: 3 })
    setEngineLibrary(engine, library())
    setEngineFace(engine, 'Star')
    watch(engine, 0.08)
    const eyesOf = () => {
      const frame = engineFrame(engine)
      const eye = frame.eyes[0]
      return box('kind' in eye ? drawnEyeShapes(eye, 1, frame.lids) : [eyeOutline(eye)])
    }
    const before = eyesOf()
    setEngineFace(engine, 'Dead')
    advanceEngine(engine, 0)
    expect(engine.player.face).toBe('Dead')
    const after = eyesOf()
    for (const key of ['minX', 'maxX', 'minY', 'maxY'] as const) {
      expect(after[key]).toBeCloseTo(before[key], 9)
    }
  })

  it('shows a drawn face that a clip names, and neutral for a name it does not know', () => {
    const engine = createAvatarEngine({ seed: 3 })
    setEngineLibrary(engine, library())
    playEngineClip(
      engine,
      { name: 'Starry', duration: 1, tracks: { expression: [{ t: 0, v: 'Star' }] } },
      { transition: 'cut' }
    )
    watch(engine, 0.5)
    expect(engineFrame(engine).face).toBe('Star')
    setEngineLibrary(engine, { faces: {} })
    setEngineFace(engine, 'Star')
    watch(engine, 0.6)
    expect(engineFrame(engine).face).toBe('neutral')
  })

  it('is not at rest while the eyes blink from one face to another', () => {
    const engine = createAvatarEngine({ seed: 3 })
    setEngineLibrary(engine, library())
    stopEngine(engine)
    watch(engine, 0.5)
    expect(engineAtRest(engine)).toBe(true)
    setEngineFace(engine, 'Star')
    advanceEngine(engine, 0.12)
    expect(engineAtRest(engine)).toBe(false)
    watch(engine, 0.3)
    expect(engineAtRest(engine)).toBe(true)
  })

  it('keeps the built-in faces morphing as they did', () => {
    const engine = createAvatarEngine({ seed: 3 })
    setEngineFace(engine, 'surprised')
    watch(engine, 0.05)
    expect(engine.player.faceWay).toBe('morph')
    expect(faces.surprised.eyes[0].wid).toBeGreaterThan(0)
  })
})

describe('libraries', () => {
  it('reads clips, states and faces, and says what it left out', () => {
    const { library, problems } = readAvatarLibrary({
      clips: [{ name: 'Hop', duration: 1, tracks: {} }],
      states: [{ name: 'starry', clips: ['Hop'], face: 'Star' }],
      faces: [
        star,
        { ...star },
        { name: 'smile', eyes: star.eyes },
        {
          name: 'Svg',
          svg: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/><text>hi</text></svg>',
        },
      ],
    })
    expect(Object.keys(library.clips)).toEqual(['Hop'])
    expect(library.states.starry).toEqual({ clips: ['Hop'], face: 'Star' })
    expect(Object.keys(library.faces).sort()).toEqual(['Star', 'Svg'])
    expect(problems.join('\n')).toMatch(/"Star" is given twice/)
    expect(problems.join('\n')).toMatch(/"smile".*built-in/)
    expect(problems.join('\n')).toMatch(/ignored <text>/)
  })
})

describe('svg files', () => {
  it('fits the view to the artboard and reads shapes, transforms and strokes', () => {
    const { eyes, ignored } = faceEyesFromSvg(`<?xml version="1.0"?>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <!-- a comment -->
        <g transform="translate(100 100)" fill="none" stroke="#000" stroke-width="20" stroke-linecap="round">
          <line x1="-50" y1="-50" x2="50" y2="50" />
          <line x1="50" y1="-50" x2="-50" y2="50" style="stroke-linejoin:round" />
        </g>
        <text x="0" y="0">ignored</text>
      </svg>`)
    expect(eyes.left).toHaveLength(2)
    expect(eyes.right).toBeUndefined()
    expect(eyes.left[0].fill).toBe(false)
    expect(eyes.left[0].stroke).toEqual({ width: 10, cap: 'round', join: 'miter' })
    expect(eyes.left[0].d).toBe('M25 25L75 75')
    expect(eyes.left[1].stroke?.join).toBe('round')
    expect(ignored).toEqual(['<text>'])
  })

  it('reads a group with the id right as the right eye', () => {
    const { face } = faceFromSvg({
      name: 'Wink',
      svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/><g id="right"><rect x="20" y="45" width="60" height="10" rx="5"/></g></svg>',
    })
    expect(face.eyes.left).toHaveLength(1)
    expect(face.eyes.right).toHaveLength(1)
    const [left, right] = compileFace(face).face.eyes
    expect(box(left.shapes).height).toBeGreaterThan(box(right.shapes).height * 3)
  })
})
