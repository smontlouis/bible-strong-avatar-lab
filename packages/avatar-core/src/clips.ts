// Clips. A clip is a piece of choreography of a set length: several tracks, each a list of keys
// with its own times. Tracks are not in step with one another: a turn can start before a move,
// and the face can change between the two. A track that a clip does not have is not invented;
// whoever plays the clip decides what holds in its place.

/** The control points of a cubic Bézier from (0, 0) to (1, 1): `[x1, y1, x2, y2]`. */
export type ClipEase = readonly [number, number, number, number]

/** A value at a time of the clip, in seconds, with the curve that leads to the next key. */
export type ClipKey<Value extends readonly number[]> = {
  t: number
  v: Value
  ease?: ClipEase
}

/**
 * A change of face at a time of the clip. `blink` is not a face: it closes and opens the eyes
 * once. `cut` changes the face at once, without passing through closed eyes.
 */
export type ClipFaceKey = {
  t: number
  v: string
  cut?: boolean
}

export type ClipTracks = {
  /** Where the body is, across and down, in body widths. */
  position?: ClipKey<readonly [number, number]>[]
  /** How the body is turned about x, y and z, in degrees. Full turns are kept: 360 is not 0. */
  rotation?: ClipKey<readonly [number, number, number]>[]
  /** How the body is stretched across and down. 1 leaves it as it is. */
  squash?: ClipKey<readonly [number, number]>[]
  /** How large the body is drawn. Not a stretch: see `squash`. */
  scale?: ClipKey<readonly [number]>[]
  /** How far the eyelids are closed: 0 open, 1 closed. */
  lids?: ClipKey<readonly [number]>[]
  expression?: ClipFaceKey[]
}

export type ClipDefinition = {
  name: string
  /** In seconds. */
  duration: number
  /** The body the clip was drawn for. A clip plays on any body. */
  body?: string
  /** Which point of the body a stretch leaves in place: 0 its centre, -1 its base. */
  squashAnchor?: number
  /** `start` is the time of the clip's pose of rest, which a join to this clip aims at. */
  workArea?: { start: number; end: number }
  inspect?: { bias: number; follow: boolean }
  tracks: ClipTracks
}

const LINEAR: ClipEase = [0, 0, 1, 1]
const EASE_SOLVER_STEPS = 8
const EASE_SOLVER_PRECISION = 1e-6

const bezierAt = (first: number, second: number, progress: number) => {
  const rest = 1 - progress
  return (
    3 * rest * rest * progress * first + 3 * rest * progress * progress * second + progress ** 3
  )
}

const bezierSlopeAt = (first: number, second: number, progress: number) => {
  const rest = 1 - progress
  return (
    3 * rest * rest * first +
    6 * rest * progress * (second - first) +
    3 * progress * progress * (1 - second)
  )
}

/**
 * How far a segment has gone at a share of its time. The curve's horizontal coordinate is time,
 * so it is solved for first; the vertical one is then read. It may leave 0…1: a curve whose
 * control points do overshoots its target.
 */
export const clipEaseAt = (ease: ClipEase, time: number) => {
  if (time <= 0) return 0
  if (time >= 1) return 1
  const [x1, y1, x2, y2] = ease
  if (x1 === y1 && x2 === y2) return time
  // Newton's steps find the parameter fast where the curve is not flat; halving finishes the
  // job where they do not settle.
  let parameter = time
  for (let step = 0; step < EASE_SOLVER_STEPS; step += 1) {
    const error = bezierAt(x1, x2, parameter) - time
    if (Math.abs(error) < EASE_SOLVER_PRECISION) return bezierAt(y1, y2, parameter)
    const slope = bezierSlopeAt(x1, x2, parameter)
    if (Math.abs(slope) < 1e-6) break
    parameter -= error / slope
  }
  let low = 0
  let high = 1
  parameter = time
  for (let step = 0; step < 24; step += 1) {
    const reached = bezierAt(x1, x2, parameter)
    if (Math.abs(reached - time) < EASE_SOLVER_PRECISION) break
    if (reached < time) low = parameter
    else high = parameter
    parameter = (low + high) / 2
  }
  return bezierAt(y1, y2, parameter)
}

/**
 * The value of a track at a time of the clip. Before the first key the first value holds, after
 * the last the last one does. Every number of a key moves along the same curve.
 */
export const sampleClipTrack = <Value extends readonly number[]>(
  keys: readonly ClipKey<Value>[],
  time: number
): number[] => {
  const first = keys[0]
  if (time <= first.t) return [...first.v]
  const last = keys[keys.length - 1]
  if (time >= last.t) return [...last.v]
  // Tracks are short: a walk is as fast as a search, and reads better.
  let index = 0
  while (keys[index + 1].t <= time) index += 1
  const from = keys[index]
  const to = keys[index + 1]
  const span = to.t - from.t
  const progress = span > 0 ? clipEaseAt(from.ease ?? LINEAR, (time - from.t) / span) : 1
  return from.v.map((value, component) => value + (to.v[component] - value) * progress)
}

/** The pose a clip asks of the body at a time. A track the clip lacks leaves its field unset. */
export type ClipPose = {
  position?: [number, number]
  rotation?: [number, number, number]
  squash?: [number, number]
  scale?: number
  lids?: number
}

export const sampleClipPose = (clip: Readonly<ClipDefinition>, time: number): ClipPose => {
  const { position, rotation, squash, scale, lids } = clip.tracks
  const pose: ClipPose = {}
  if (position?.length) pose.position = sampleClipTrack(position, time) as [number, number]
  if (rotation?.length) {
    pose.rotation = sampleClipTrack(rotation, time) as [number, number, number]
  }
  if (squash?.length) pose.squash = sampleClipTrack(squash, time) as [number, number]
  if (scale?.length) pose.scale = sampleClipTrack(scale, time)[0]
  if (lids?.length) pose.lids = sampleClipTrack(lids, time)[0]
  return pose
}
