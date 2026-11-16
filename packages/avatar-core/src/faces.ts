import facesData from './catalogue/faces.json' with { type: 'json' }

// Faces. A face is the shape of the two eyes. An eye is a line with a thickness: the line bends
// for a smile, shrinks to a point for a round eye, and lies flat for a squint. One face turns
// into another by moving the numbers of each eye, so any face can follow any other.
//
// An eye is drawn in its own small frame: up is up, and across points away from the middle of
// the face for both eyes, so that one description serves the two. Lengths are in head radii.

/** One eye of a face. */
export type FaceEye = {
  /** Where the eye's middle is from its place on the face: outward, and up. */
  off: [number, number]
  /** How far the top of the eye leans outward, in radians. */
  tilt: number
  /** Half the thickness of the line. */
  wid: number
  /** How open the eye is: 1 open. It flattens the line towards its base. */
  lidY: number
  /** The radii of the oval the eye turns into, or zeros for none. */
  oval: [number, number]
  /**
   * How far the outline has become the oval, from 0 to 1, while a face morphs towards or away
   * from an oval. Left out, the oval's own size decides.
   */
  ovalMix?: number
  /**
   * The line: three anchors, each `[x, y, inX, inY, outX, outY]`, the handles relative to their
   * anchor. Eighteen numbers.
   */
  path: number[]
}

export type FaceShape = {
  /** Whether a blink written in a clip closes these eyes. A smile does not blink. */
  blinks: boolean
  /** The eye on the left of the screen, then the one on the right. */
  eyes: [FaceEye, FaceEye]
}

export const faceNames = [
  'neutral',
  'happy',
  'surprised',
  'sad',
  'sleepy',
  'squinted',
  'calm',
  'inspecting',
  'confused',
] as const
export type FaceName = (typeof faceNames)[number]

type StoredEye = { off: number[]; wid: number; oval: number[]; path: number[] }
type StoredFace = { blinks: boolean; eyes: StoredEye[] }

const fromStore = (eye: StoredEye): FaceEye => ({
  off: [eye.off[0], eye.off[1]],
  tilt: 0,
  wid: eye.wid,
  lidY: 1,
  oval: [eye.oval[0], eye.oval[1]],
  path: [...eye.path],
})

export const faces = Object.fromEntries(
  Object.entries(facesData as Record<string, StoredFace>).map(([name, face]) => [
    name,
    { blinks: face.blinks, eyes: [fromStore(face.eyes[0]), fromStore(face.eyes[1])] },
  ])
) as Record<FaceName, FaceShape>

/**
 * What each face asks of a mouth, from -1 to 1: the corners down, as they are on the character,
 * or up. The eyes are the face; a character that has a mouth has it follow them.
 */
export const faceSmiles: Readonly<Record<FaceName, number>> = {
  neutral: 0,
  happy: 1,
  surprised: 0,
  sad: -1,
  sleepy: 0.15,
  squinted: -0.1,
  calm: 0.4,
  inspecting: 0,
  confused: -0.35,
}

const faceAliases: Record<string, FaceName> = {
  thinking: 'sad',
  strange: 'inspecting',
  angry: 'neutral',
  inspect: 'inspecting',
  squint: 'squinted',
  idle: 'neutral',
  smile: 'happy',
  sleep: 'sleepy',
}

/** The face a name stands for. A name that is not known stands for `neutral`. */
export const resolveFaceName = (name: string): FaceName => {
  const key = name.trim().toLowerCase()
  if (key in faces) return key as FaceName
  return faceAliases[key] ?? 'neutral'
}

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress

export const mixEyeShapes = (from: FaceEye, to: FaceEye, progress: number): FaceEye => {
  const eye: FaceEye = {
    off: [mix(from.off[0], to.off[0], progress), mix(from.off[1], to.off[1], progress)],
    tilt: mix(from.tilt, to.tilt, progress),
    wid: mix(from.wid, to.wid, progress),
    lidY: mix(from.lidY, to.lidY, progress),
    oval: [mix(from.oval[0], to.oval[0], progress), mix(from.oval[1], to.oval[1], progress)],
    path: from.path.map((value, index) => mix(value, to.path[index], progress)),
  }
  // An eye left halfway to an oval goes on from where its outline is.
  if (from.ovalMix !== undefined || to.ovalMix !== undefined) {
    eye.ovalMix = mix(ovalShareOf(from), ovalShareOf(to), progress)
  }
  return eye
}

// Morphs. Numbers mixed one by one serve eyes whose lines bend: a smile opens into a line, a
// line folds into a frown. Eyes that are straight, or oval, pass instead through a capsule:
// its middle, its angle, its length and its width are mixed, so a line turns about its
// middle rather than shrinking through it, and an oval swells out of a capsule of its size.

/** How an eye passes from one face to another. */
export type EyeMorph = 'numbers' | 'capsule' | 'oval'

const hasOval = (eye: Readonly<FaceEye>) => eye.oval[0] > 1e-4 && eye.oval[1] > 1e-4

/** How far the outline of an eye is the oval: its morph's share, or what its oval's size says. */
const ovalShareOf = (eye: Readonly<FaceEye>) =>
  eye.ovalMix ?? smoothstep(Math.min(eye.oval[0], eye.oval[1]) / OVAL_FULL)

/** Whether the line of an eye bends away from the straight line between its ends. */
const isBent = (eye: Readonly<FaceEye>) => {
  if (hasOval(eye)) return false
  const line = eyeLine(eye.path, 1)
  const [firstX, firstY] = line[0]
  const [lastX, lastY] = line[line.length - 1]
  const acrossX = lastX - firstX
  const acrossY = lastY - firstY
  const length = acrossX * acrossX + acrossY * acrossY
  if (length < 1e-8) return false
  let farthest = 0
  for (const [x, y] of line) {
    const share = ((x - firstX) * acrossX + (y - firstY) * acrossY) / length
    farthest = Math.max(
      farthest,
      Math.hypot(x - (firstX + share * acrossX), y - (firstY + share * acrossY))
    )
  }
  return farthest > Math.max(0.012, eye.wid * 0.2)
}

/** How the two eyes of a face pass to those of another. */
export const eyeMorphOf = (
  from: readonly Readonly<FaceEye>[],
  to: readonly Readonly<FaceEye>[]
): EyeMorph => {
  if (from.some(isBent) || to.some(isBent)) return 'numbers'
  return from.some(hasOval) || to.some(hasOval) ? 'oval' : 'capsule'
}

/** A capsule: its middle on the face, the angle of its length from up, its half sizes. */
type Capsule = { center: [number, number]; angle: number; halfLength: number; halfWidth: number }

const capsuleOf = (eye: Readonly<FaceEye>): Capsule => {
  const cosine = Math.cos(eye.tilt)
  const sine = Math.sin(eye.tilt)
  if (hasOval(eye)) {
    const [across, up] = eye.oval
    return {
      center: [eye.off[0], eye.off[1]],
      angle: eye.tilt + (across >= up ? Math.PI / 2 : 0),
      halfLength: Math.max(across, up),
      halfWidth: Math.min(across, up),
    }
  }
  const [firstX, firstY] = [eye.path[0], eye.path[1]]
  const [lastX, lastY] = [eye.path[12], eye.path[13]]
  const middleX = (firstX + lastX) / 2
  const middleY = (firstY + lastY) / 2
  const reach = Math.hypot(lastX - firstX, lastY - firstY) / 2
  return {
    // The middle of the line, turned with the eye as its outline is.
    center: [
      eye.off[0] + middleX * cosine + middleY * sine,
      eye.off[1] - middleX * sine + middleY * cosine,
    ],
    angle: reach < 1e-9 ? eye.tilt : Math.atan2(lastX - firstX, lastY - firstY) + eye.tilt,
    halfLength: reach + eye.wid,
    halfWidth: eye.wid,
  }
}

/** The eye drawn as a capsule: a straight line turned to its angle, as thick as the capsule. */
const capsuleEye = (capsule: Capsule, lidY: number, ovalMix: number): FaceEye => {
  const reach = Math.max(0, capsule.halfLength - capsule.halfWidth)
  const third = reach / 3
  const eye: FaceEye = {
    off: capsule.center,
    tilt: capsule.angle,
    wid: capsule.halfWidth,
    lidY,
    oval: ovalMix > 1e-4 ? [capsule.halfWidth, capsule.halfLength] : [0, 0],
    path: [0, -reach, 0, 0, 0, third, 0, 0, 0, -third, 0, third, 0, reach, 0, -third, 0, 0],
  }
  if (ovalMix > 1e-4) eye.ovalMix = ovalMix
  return eye
}

/** The turn from one angle to another, the short way: a capsule is the same either way up. */
const turnBetween = (from: number, to: number) => {
  let turn = to - from
  while (turn > Math.PI / 2) turn -= Math.PI
  while (turn < -Math.PI / 2) turn += Math.PI
  return turn
}

const capsuleBetween = (from: Capsule, to: Capsule, progress: number): Capsule => ({
  center: [
    mix(from.center[0], to.center[0], progress),
    mix(from.center[1], to.center[1], progress),
  ],
  angle: from.angle + turnBetween(from.angle, to.angle) * progress,
  halfLength: Math.max(mix(from.halfLength, to.halfLength, progress), 1e-4),
  halfWidth: Math.max(mix(from.halfWidth, to.halfWidth, progress), 1e-4),
})

/**
 * Towards or away from an oval: the eye is a capsule of the oval's size, which swells into the
 * oval late on the way there and leaves it early on the way back.
 */
const ovalMorph = (from: FaceEye, to: FaceEye, progress: number): FaceEye => {
  if (progress <= 1e-4) return from
  if (progress >= 0.995) return to
  const start = ovalShareOf(from)
  const towardsOval = hasOval(to)
  const eased = towardsOval ? 1 - (1 - progress) ** 3 : progress ** 3
  const share = start + ((towardsOval ? 1 : 0) - start) * eased
  return capsuleEye(
    capsuleBetween(capsuleOf(from), capsuleOf(to), progress),
    mix(from.lidY, to.lidY, progress),
    share
  )
}

/**
 * Between straight eyes: a capsule that turns about its middle the short way, grows or shrinks
 * its straight part, and changes its width.
 */
const capsuleMorph = (from: FaceEye, to: FaceEye, progress: number): FaceEye => {
  if (progress >= 0.9999) return to
  const start = capsuleOf(from)
  const end = capsuleOf(to)
  const halfWidth = Math.max(1e-4, mix(start.halfWidth, end.halfWidth, progress))
  const straight = mix(
    Math.max(0, start.halfLength - start.halfWidth),
    Math.max(0, end.halfLength - end.halfWidth),
    progress
  )
  return capsuleEye(
    {
      ...capsuleBetween(start, end, progress),
      halfLength: straight + halfWidth,
      halfWidth,
    },
    mix(from.lidY, to.lidY, progress),
    0
  )
}

/** The eyes on their way from one face to another, `progress` from 0 to 1. */
export const morphEyeShapes = (
  from: readonly [FaceEye, FaceEye],
  to: readonly [FaceEye, FaceEye],
  progress: number
): [FaceEye, FaceEye] => {
  if (progress >= 1) return [to[0], to[1]]
  const way = eyeMorphOf(from, to)
  const one = (index: 0 | 1) =>
    way === 'oval'
      ? ovalMorph(from[index], to[index], progress)
      : way === 'capsule'
        ? capsuleMorph(from[index], to[index], progress)
        : mixEyeShapes(from[index], to[index], progress)
  return [one(0), one(1)]
}

// The two eyes of `inspecting` are of two sizes. Which is the large one follows the turn of the
// head, or a fixed lean: at one end they are as drawn, at the other they have traded sizes.
const INSPECT_TURN = 20

/**
 * The size of each eye while the face inspects. `weight` is how much of the face is
 * `inspecting`, `lean` runs from -1 to 1.
 */
export const inspectEyeScales = (weight: number, lean: number): [number, number] => {
  if (weight <= 0) return [1, 1]
  const ratio = faces.inspecting.eyes[1].wid / faces.inspecting.eyes[0].wid
  const share = (1 + Math.max(-1, Math.min(1, lean))) / 2
  return [1 + (ratio ** share - 1) * weight, 1 + ((1 / ratio) ** share - 1) * weight]
}

/** The lean of `inspecting` for a turn of the head, in degrees, when it follows the head. */
export const inspectLeanOfTurn = (turn: number) => Math.max(-1, Math.min(1, turn / INSPECT_TURN))

const LINE_STEPS = 10
const CAP_STEPS = 8
// Closed, an eye is a flat bar this tall for its width.
const CLOSED_EYE_RATIO = 0.42

const cubicAt = (from: number, first: number, second: number, to: number, progress: number) => {
  const rest = 1 - progress
  return (
    rest ** 3 * from +
    3 * rest * rest * progress * first +
    3 * rest * progress * progress * second +
    progress ** 3 * to
  )
}

/** The points of an eye's line, through its three anchors. */
const eyeLine = (path: readonly number[], scale: number): [number, number][] => {
  const points: [number, number][] = []
  for (let segment = 0; segment < 2; segment += 1) {
    const from = segment * 6
    const to = from + 6
    for (let step = segment === 0 ? 0 : 1; step <= LINE_STEPS; step += 1) {
      const progress = step / LINE_STEPS
      points.push([
        scale *
          cubicAt(
            path[from],
            path[from] + path[from + 4],
            path[to] + path[to + 2],
            path[to],
            progress
          ),
        scale *
          cubicAt(
            path[from + 1],
            path[from + 1] + path[from + 5],
            path[to + 1] + path[to + 3],
            path[to + 1],
            progress
          ),
      ])
    }
  }
  return points
}

/** The outline of a line of a given half thickness, with round ends. */
const strokeOutline = (line: [number, number][], radius: number): [number, number][] => {
  let length = 0
  for (let index = 1; index < line.length; index += 1) {
    length += Math.hypot(line[index][0] - line[index - 1][0], line[index][1] - line[index - 1][1])
  }
  // A line with no length is a point: its outline is a circle.
  if (length < 1e-6) {
    const steps = CAP_STEPS * 4
    return Array.from({ length: steps }, (_, step) => {
      const angle = (step / steps) * Math.PI * 2
      return [line[0][0] + Math.cos(angle) * radius, line[0][1] + Math.sin(angle) * radius]
    })
  }
  const last = line.length - 1
  const directionAt = (index: number): [number, number] => {
    const before = line[Math.max(0, index - 1)]
    const after = line[Math.min(last, index + 1)]
    const x = after[0] - before[0]
    const y = after[1] - before[1]
    const size = Math.hypot(x, y) || 1
    return [x / size, y / size]
  }
  const outline: [number, number][] = []
  // Along one side, round the far end, back along the other side, round the near end.
  for (let index = 0; index <= last; index += 1) {
    const [x, y] = directionAt(index)
    outline.push([line[index][0] - y * radius, line[index][1] + x * radius])
  }
  const cap = (index: number, heading: number) => {
    for (let step = 1; step < CAP_STEPS; step += 1) {
      const angle = heading + Math.PI / 2 - (step / CAP_STEPS) * Math.PI
      outline.push([
        line[index][0] + Math.cos(angle) * radius,
        line[index][1] + Math.sin(angle) * radius,
      ])
    }
  }
  const [endX, endY] = directionAt(last)
  cap(last, Math.atan2(endY, endX))
  for (let index = last; index >= 0; index -= 1) {
    const [x, y] = directionAt(index)
    outline.push([line[index][0] + y * radius, line[index][1] - x * radius])
  }
  const [startX, startY] = directionAt(0)
  cap(0, Math.atan2(-startY, -startX))
  return outline
}

// An oval this small across is whole; a smaller one only rounds the eye towards it.
const OVAL_FULL = 0.08

const smoothstep = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * The outline of an eye in its own frame: across is outward, up is up. `size` scales the eye
 * about its middle, as `inspecting` does. `lids` closes it: 0 open, 1 closed.
 */
export const eyeOutline = (eye: Readonly<FaceEye>, size = 1, lids = 0): [number, number][] => {
  let outline = strokeOutline(eyeLine(eye.path, size), eye.wid * size)
  // Towards an oval, each point of the outline moves to the oval's edge in its own direction.
  const ovalShare = ovalShareOf(eye)
  if (ovalShare > 0) {
    const radiusX = Math.max(eye.oval[0] * size, 1e-6)
    const radiusY = Math.max(eye.oval[1] * size, 1e-6)
    outline = outline.map(([x, y]) => {
      const distance = Math.hypot(x, y) || 1e-6
      const edge = 1 / Math.hypot(x / distance / radiusX, y / distance / radiusY)
      return [mix(x, (x / distance) * edge, ovalShare), mix(y, (y / distance) * edge, ovalShare)]
    })
  }
  if (lids > 1e-4) {
    // A closing eye is a bar as wide as the eye, which flattens where the eye stands.
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const [x, y] of outline) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    const width = maxX - minX
    const open = maxY - minY
    const height = open + (CLOSED_EYE_RATIO * width - open) * Math.min(1, lids)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const radius = Math.min(width, height) / 2
    const reach = Math.max(width, height) / 2 - radius
    const bar: [number, number][] =
      height >= width
        ? [
            [centerX, centerY - reach],
            [centerX, centerY + reach],
          ]
        : [
            [centerX - reach, centerY],
            [centerX + reach, centerY],
          ]
    outline = strokeOutline(reach < 1e-6 ? [bar[0], bar[0]] : bar, radius)
  }
  const cosine = Math.cos(eye.tilt)
  const sine = Math.sin(eye.tilt)
  return outline.map(([x, rawY]) => {
    const y = rawY * eye.lidY
    return [x * cosine + y * sine + eye.off[0], -x * sine + y * cosine + eye.off[1]]
  })
}

// Where the eyes sit on a head that is a ball of radius one: on its equator, this far to each
// side of the middle of the face.
const EYE_TURN = (18.38 * Math.PI) / 180

/** How far an eye's place is from the middle of the face, along the head, in head radii. */
export const eyeReach = (gap = 1) => EYE_TURN * gap

/**
 * Lay a point of an eye's own frame on the ball of the head, and give where it lands as seen
 * from the front: across to the right of the screen, and down. The eye is wrapped on the ball,
 * not slid over it: far from its place it turns away with the surface.
 */
export const eyePointOnFace = (
  side: -1 | 1,
  outward: number,
  up: number,
  gap = 1
): [number, number] => {
  const turn = EYE_TURN * gap
  // The eye's place on the ball, and the direction that leads outward from it.
  const placeX = side * Math.sin(turn)
  const placeZ = Math.cos(turn)
  const reach = Math.hypot(outward, up)
  if (reach < 1e-9) return [placeX, 0]
  const along = Math.sin(reach) / reach
  const x = Math.cos(reach) * placeX + along * outward * side * placeZ
  const y = along * up
  return [x, -y]
}
