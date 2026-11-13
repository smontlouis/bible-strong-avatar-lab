import {
  clipEaseAt,
  sampleClipTrack,
  type ClipDefinition,
  type ClipEase,
  type ClipKey,
} from './clips'
import {
  faces,
  faceSmiles,
  inspectEyeScales,
  inspectLeanOfTurn,
  mixEyeShapes,
  resolveFaceName,
  type FaceEye,
  type FaceName,
} from './faces'

// The player. It plays one clip at a time and joins it to the next: the body does not jump from
// the pose where one clip stops to the pose where the other starts, it is led there first. The
// face follows the clip unless something holds it. Everything here is plain data moved forward
// by plain functions, so that the same player runs wherever the avatar is drawn.

/** What the tracks of a clip ask of the body at a time. */
export type PlayerPose = {
  /** Across and up, in head radii. */
  position: [number, number]
  /** About x, y and z, in degrees: looking down, turning to the right of the screen, rolling. */
  rotation: [number, number, number]
  squash: [number, number]
  zoom: number
  lids: number
}

export const REST_ZOOM = 0.6
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5
/** How long a join between two clips takes, in seconds. */
export const JOIN_SECONDS = 0.35
const JOIN_EASE: ClipEase = [0.4, 0, 0.2, 1]
/** How long one face takes to turn into another, in seconds. */
export const FACE_SECONDS = 0.28
const FACE_EASE: ClipEase = [0.4, 0.06, 0.18, 1]
const BLINK_SECONDS = 0.26
// When, within a blink, the eyes are shut.
const BLINK_SHUT_AT = 0.45
const BLINK_EASE: ClipEase = [0.42, 0, 0.58, 1]
// The longest step the player takes at once: a frame that comes late does not throw the body.
const MAX_STEP_SECONDS = 0.1
const OPEN_LIDS = 1e-4

type FaceEvent = { t: number; face: FaceName }

/** A clip made ready to play: its blinks turned into eyelid keys, its faces named. */
type PreparedClip = {
  lids: ClipKey<readonly [number]>[]
  events: FaceEvent[]
  restTime: number
}

const prepared = new WeakMap<object, PreparedClip>()

const prepare = (clip: Readonly<ClipDefinition>): PreparedClip => {
  const known = prepared.get(clip)
  if (known) return known
  const lids: ClipKey<readonly [number]>[] = [...(clip.tracks.lids ?? [])]
  const events: FaceEvent[] = []
  for (const key of clip.tracks.expression ?? []) {
    if (key.v === 'blink') {
      lids.push(
        { t: key.t, v: [0], ease: BLINK_EASE },
        { t: key.t + BLINK_SECONDS * BLINK_SHUT_AT, v: [1], ease: BLINK_EASE },
        { t: key.t + BLINK_SECONDS, v: [0], ease: BLINK_EASE }
      )
    } else {
      events.push({ t: key.t, face: resolveFaceName(key.v) })
    }
  }
  lids.sort((left, right) => left.t - right.t)
  events.sort((left, right) => left.t - right.t)
  const result = { lids, events, restTime: clip.workArea?.start ?? 0 }
  prepared.set(clip, result)
  return result
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

/** What a clip asks of the body at a time. Without a zoom track, the zoom stays as it was. */
const poseAt = (clip: Readonly<ClipDefinition>, time: number, zoom: number): PlayerPose => {
  const { position, rotation, squash, scale } = clip.tracks
  const { lids } = prepare(clip)
  return {
    position: position?.length ? (sampleClipTrack(position, time) as [number, number]) : [0, 0],
    rotation: rotation?.length
      ? (sampleClipTrack(rotation, time) as [number, number, number])
      : [0, 0, 0],
    squash: squash?.length ? (sampleClipTrack(squash, time) as [number, number]) : [1, 1],
    zoom: scale?.length ? clamp(sampleClipTrack(scale, time)[0], MIN_ZOOM, MAX_ZOOM) : zoom,
    lids: lids.length ? clamp(sampleClipTrack(lids, time)[0], 0, 1) : 0,
  }
}

/** The pose of rest of a clip: where a join to it leads. */
export const clipRestPose = (clip: Readonly<ClipDefinition>): PlayerPose =>
  poseAt(clip, prepare(clip).restTime, REST_ZOOM)

/** The face a clip shows at a time: the last it asked for, `neutral` before the first. */
const faceAt = (clip: Readonly<ClipDefinition>, time: number): FaceName => {
  let face: FaceName = 'neutral'
  for (const event of prepare(clip).events) {
    if (event.t > time) break
    face = event.face
  }
  return face
}

/** The face a join to a clip aims at: the one of its pose of rest, else the first it asks for. */
const restFace = (clip: Readonly<ClipDefinition>): FaceName => {
  const { events, restTime } = prepare(clip)
  if (!events.length) return 'neutral'
  return events[0].t > restTime ? events[0].face : faceAt(clip, restTime)
}

type Join = {
  from: PlayerPose
  to: PlayerPose
  time: number
  target: ClipDefinition
  phase: number
}

export type AvatarPlayer = {
  /** The clip that plays, or the one a join leads to. */
  clip: ClipDefinition | null
  /** Seconds into the clip. */
  time: number
  playing: boolean
  /** How many times the clip has reached its end. */
  loopCount: number
  pose: PlayerPose
  squashAnchor: number
  join: Join | null
  /** The face the clip asks for now. */
  clipFace: FaceName
  /** A face asked for from outside: it comes before everything. */
  faceOverride: FaceName | null
  /** A face held by the state that plays: it comes before the clip's. */
  heldFace: FaceName | null
  /** The face shown, or the one the eyes are turning into. */
  face: FaceName
  faceFrom: [FaceEye, FaceEye]
  inspectFrom: number
  smileFrom: number
  /** Seconds since the eyes started turning into `face`. */
  faceTime: number
  /** A clip's eyelids are left open from the moment a face cannot blink until they reopen. */
  lidsBlocked: boolean
}

const restingPose = (): PlayerPose => ({
  position: [0, 0],
  rotation: [0, 0, 0],
  squash: [1, 1],
  zoom: REST_ZOOM,
  lids: 0,
})

export const createAvatarPlayer = (): AvatarPlayer => ({
  clip: null,
  time: 0,
  playing: false,
  loopCount: 0,
  pose: restingPose(),
  squashAnchor: 0,
  join: null,
  clipFace: 'neutral',
  faceOverride: null,
  heldFace: null,
  face: 'neutral',
  faceFrom: [faces.neutral.eyes[0], faces.neutral.eyes[1]],
  inspectFrom: 0,
  smileFrom: 0,
  faceTime: FACE_SECONDS,
  lidsBlocked: false,
})

const faceProgress = (player: Readonly<AvatarPlayer>) =>
  clipEaseAt(FACE_EASE, Math.min(1, player.faceTime / FACE_SECONDS))

/** The eyes as they are now, between the face they leave and the one they reach. */
export const playerEyes = (player: Readonly<AvatarPlayer>): [FaceEye, FaceEye] => {
  const target = faces[player.face].eyes
  if (player.faceTime >= FACE_SECONDS) return [target[0], target[1]]
  const progress = faceProgress(player)
  return [
    mixEyeShapes(player.faceFrom[0], target[0], progress),
    mixEyeShapes(player.faceFrom[1], target[1], progress),
  ]
}

const inspectWeight = (player: Readonly<AvatarPlayer>) => {
  const target = player.face === 'inspecting' ? 1 : 0
  if (player.faceTime >= FACE_SECONDS) return target
  return player.inspectFrom + (target - player.inspectFrom) * faceProgress(player)
}

const smile = (player: Readonly<AvatarPlayer>) => {
  const target = faceSmiles[player.face]
  if (player.faceTime >= FACE_SECONDS) return target
  return player.smileFrom + (target - player.smileFrom) * faceProgress(player)
}

/** How far the eyelids are closed now, once the faces that do not blink are left alone. */
const shownLids = (player: Readonly<AvatarPlayer>) => (player.lidsBlocked ? 0 : player.pose.lids)

const startJoin = (player: AvatarPlayer, target: ClipDefinition, phase: number) => {
  const rest = clipRestPose(target)
  // Each angle of the pose of rest is taken at the turn nearest to where the body is: a body
  // that has spun twice is not spun back.
  const nearest = (angle: number, from: number) => angle + 360 * Math.round((from - angle) / 360)
  player.join = {
    from: {
      position: [...player.pose.position],
      rotation: [...player.pose.rotation],
      squash: [...player.pose.squash],
      zoom: player.pose.zoom,
      lids: player.pose.lids,
    },
    to: {
      ...rest,
      rotation: [
        nearest(rest.rotation[0], player.pose.rotation[0]),
        nearest(rest.rotation[1], player.pose.rotation[1]),
        nearest(rest.rotation[2], player.pose.rotation[2]),
      ],
    },
    time: 0,
    target,
    phase,
  }
  player.clip = target
  player.clipFace = restFace(target)
  player.playing = true
}

const startClip = (player: AvatarPlayer, clip: ClipDefinition, phase: number) => {
  player.clip = clip
  player.join = null
  player.time = clamp(phase, 0, 1) * clip.duration
  player.squashAnchor = clip.squashAnchor ?? 0
  player.clipFace = faceAt(clip, player.time)
  player.pose = poseAt(clip, player.time, player.pose.zoom)
  player.playing = true
}

/**
 * Play a clip. From another clip the body is first led to the new clip's pose of rest; `cut`
 * starts it at once. `phase` is where in the clip to start, from 0 to 1.
 */
export const playClip = (
  player: AvatarPlayer,
  clip: ClipDefinition,
  options: { phase?: number; transition?: 'join' | 'cut' } = {}
) => {
  const phase = options.phase ?? 0
  const joins =
    options.transition !== 'cut' &&
    player.clip !== null &&
    (player.join !== null || player.clip.name !== clip.name)
  if (joins) startJoin(player, clip, phase)
  else startClip(player, clip, phase)
}

/**
 * Put the clip that plays at a time, in seconds, at once: a join under way is dropped. The
 * player stays playing or paused as it was.
 */
export const seekPlayer = (player: AvatarPlayer, seconds: number) => {
  const clip = player.clip
  if (!clip) return
  player.join = null
  player.time = clamp(seconds, 0, clip.duration)
  player.squashAnchor = clip.squashAnchor ?? 0
  player.clipFace = faceAt(clip, player.time)
  player.pose = poseAt(clip, player.time, player.pose.zoom)
}

export const pausePlayer = (player: AvatarPlayer) => {
  player.playing = false
}

export const resumePlayer = (player: AvatarPlayer) => {
  if (player.clip) player.playing = true
}

/** Hold a face from outside the clip, or pass `null` to let the clip decide again. */
export const setPlayerFace = (player: AvatarPlayer, face: string | null) => {
  player.faceOverride = face === null ? null : resolveFaceName(face)
}

/** Hold a face for as long as a state lasts, or pass `null` to release it. */
export const holdPlayerFace = (player: AvatarPlayer, face: string | null) => {
  player.heldFace = face === null ? null : resolveFaceName(face)
}

const angleApart = (left: number, right: number) => {
  const turn = (((left - right) % 360) + 360) % 360
  return Math.min(turn, 360 - turn)
}

/** Whether a pose is near enough to another for a clip to start again without a join. */
const near = (pose: Readonly<PlayerPose>, rest: Readonly<PlayerPose>) =>
  angleApart(pose.rotation[0], rest.rotation[0]) < 4 &&
  angleApart(pose.rotation[1], rest.rotation[1]) < 4 &&
  angleApart(pose.rotation[2], rest.rotation[2]) < 4 &&
  Math.abs(pose.position[0] - rest.position[0]) < 0.015 &&
  Math.abs(pose.position[1] - rest.position[1]) < 0.015 &&
  Math.abs(pose.squash[0] - rest.squash[0]) < 0.02 &&
  Math.abs(pose.squash[1] - rest.squash[1]) < 0.02 &&
  Math.abs(pose.zoom - rest.zoom) < 0.02 &&
  Math.abs(pose.lids - rest.lids) < 0.05

/** The faces a clip asks for after one time and up to another. */
const fireFaces = (player: AvatarPlayer, clip: ClipDefinition, after: number, upTo: number) => {
  for (const event of prepare(clip).events) {
    if (event.t > upTo) break
    if (event.t > after) player.clipFace = event.face
  }
}

const advanceClip = (player: AvatarPlayer, seconds: number) => {
  const clip = player.clip
  if (!clip) return
  const join = player.join
  if (join) {
    join.time += seconds
    if (join.time >= JOIN_SECONDS) {
      startClip(player, join.target, join.phase)
      return
    }
    const progress = clipEaseAt(JOIN_EASE, join.time / JOIN_SECONDS)
    const between = (from: number, to: number) => from + (to - from) * progress
    player.pose = {
      position: [
        between(join.from.position[0], join.to.position[0]),
        between(join.from.position[1], join.to.position[1]),
      ],
      rotation: [
        between(join.from.rotation[0], join.to.rotation[0]),
        between(join.from.rotation[1], join.to.rotation[1]),
        between(join.from.rotation[2], join.to.rotation[2]),
      ],
      squash: [
        between(join.from.squash[0], join.to.squash[0]),
        between(join.from.squash[1], join.to.squash[1]),
      ],
      zoom: between(join.from.zoom, join.to.zoom),
      lids: between(join.from.lids, join.to.lids),
    }
    return
  }
  const reached = player.time + seconds
  if (reached < clip.duration) {
    fireFaces(player, clip, player.time, reached)
    player.time = reached
    player.pose = poseAt(clip, reached, player.pose.zoom)
    return
  }
  // The end of the clip. If the body is where the clip starts, the clip goes round; if not, it
  // is led back to the clip's pose of rest first.
  fireFaces(player, clip, player.time, clip.duration)
  player.loopCount += 1
  player.pose = poseAt(clip, clip.duration, player.pose.zoom)
  if (!near(player.pose, clipRestPose(clip))) {
    startJoin(player, clip, 0)
    return
  }
  const wrapped = reached - clip.duration
  player.time = wrapped >= clip.duration ? 0 : wrapped
  fireFaces(player, clip, -1e-9, player.time)
  player.pose = poseAt(clip, player.time, player.pose.zoom)
}

/**
 * Move the player forward. `clipRate` slows the clip without slowing the face: a body that is
 * turning into something else stops its choreography.
 */
export const advancePlayer = (player: AvatarPlayer, seconds: number, clipRate = 1) => {
  const step = clamp(seconds, 0, MAX_STEP_SECONDS)
  if (player.playing) advanceClip(player, step * clipRate)
  player.faceTime = Math.min(FACE_SECONDS, player.faceTime + step)

  // A face that cannot blink leaves the clip's eyelids open, and so does a face that is
  // changing. They close again only once the clip has opened them: a blink is never taken up
  // halfway.
  const changing = player.faceTime < FACE_SECONDS
  if (!faces[player.face].blinks || changing) player.lidsBlocked = true
  else if (player.pose.lids <= OPEN_LIDS) player.lidsBlocked = false

  // The face changes with open eyes: a change asked for during a blink waits for its end.
  const wanted = player.faceOverride ?? player.heldFace ?? player.clipFace
  if (wanted !== player.face && shownLids(player) <= OPEN_LIDS) {
    player.faceFrom = playerEyes(player)
    player.inspectFrom = inspectWeight(player)
    player.smileFrom = smile(player)
    player.face = wanted
    player.faceTime = 0
    player.lidsBlocked = true
  }
}

/** Everything a renderer needs to draw the avatar now. */
export type PlayerFrame = PlayerPose & {
  squashAnchor: number
  face: FaceName
  eyes: [FaceEye, FaceEye]
  /** The size of each eye about its middle: `inspecting` makes one large and one small. */
  eyeScales: [number, number]
  /** How much of the face is `inspecting`, from 0 to 1. */
  inspectWeight: number
  /** What the face asks of a mouth, from -1 to 1: corners down, as they are, or up. */
  smile: number
}

export const playerFrame = (player: Readonly<AvatarPlayer>): PlayerFrame => {
  const inspect = player.clip?.inspect
  const lean =
    inspect && !inspect.follow ? inspect.bias : inspectLeanOfTurn(player.pose.rotation[1])
  return {
    position: [player.pose.position[0], player.pose.position[1]],
    rotation: [player.pose.rotation[0], player.pose.rotation[1], player.pose.rotation[2]],
    squash: [player.pose.squash[0], player.pose.squash[1]],
    zoom: player.pose.zoom,
    lids: shownLids(player),
    squashAnchor: player.squashAnchor,
    face: player.face,
    eyes: playerEyes(player),
    eyeScales: inspectEyeScales(inspectWeight(player), lean),
    inspectWeight: inspectWeight(player),
    smile: smile(player),
  }
}
