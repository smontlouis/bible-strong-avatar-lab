import { clamp } from '@/features/avatar/geometry'
import type { Landmark, ObservedHand, StandObservation, Visitor } from './standDirector'

export type HandRect = { x: number; y: number; width: number; height: number }
export type HandTarget = HandRect & { id: string }
export type HandMode =
  'hidden' | 'moving' | 'selecting' | 'closed' | 'grabbing' | 'rotating' | 'petting'
export type HandRotation = {
  at: number
  start: readonly [number, number]
  point: readonly [number, number]
}
export type HandFrame = {
  rotation: HandRotation | null
  point: Landmark
  mode: HandMode
  hover: string | null
  activate: string | null
  scrollDelta: number
  pet: { strength: number; x: number; y: number }
  // The tracked hand's classifier label and score, for diagnostics.
  sign: { gesture: string; confidence: number } | null
  // The control the cursor is snapped to; the drawn cursor glides onto it.
  snap: HandRect | null
}
type Input = {
  at: number
  observation: StandObservation | null
  visitor: Visitor | null
  visitorId: number
  mirror: boolean
  viewport: { width: number; height: number }
  targets: HandTarget[]
  petBounds: HandRect | null
  scrollBounds: HandRect | null
  context: string
}
const inside = (point: Landmark, rect: HandRect) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height
const gap = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y)
const distanceTo = (point: Landmark, rect: HandRect) =>
  Math.hypot(
    Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width),
    Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height)
  )
// Controls pull the hand cursor from a distance, which absorbs tracking jitter at 2–3 m.
export const snapRadius = (viewport: { width: number; height: number }) =>
  Math.min(90, viewport.height * 0.07)

/**
 * The nearest control within the snap radius. The hovered one holds on up to 1.5×
 * the radius, and a neighbour takes over only when clearly closer. Inside the
 * reader text, only a direct hit counts: a fist there scrolls.
 */
export function snapTarget(
  point: Landmark,
  targets: HandTarget[],
  hovered: string | null,
  radius: number,
  inText: boolean
): HandTarget | undefined {
  if (inText) return targets.find(target => inside(point, target))
  const ranked = targets
    .filter(target => distanceTo(point, target) <= radius * (target.id === hovered ? 1.5 : 1))
    .sort((a, b) => distanceTo(point, a) - distanceTo(point, b))
  const current = ranked.find(target => target.id === hovered)
  const best = ranked[0]
  return current && distanceTo(point, best) + radius * 0.25 >= distanceTo(point, current)
    ? current
    : best
}
const open = (hand: ObservedHand) => hand.open && (hand.confidence ?? 1) >= 0.55
// Landmark detection is independent of the gesture classifier: a relaxed hand
// often has a valid position but no Open_Palm label.
const pointing = (hand: ObservedHand) => open(hand) || !hand.gesture || hand.gesture === 'None'
const fist = (hand: ObservedHand) => hand.gesture === 'Closed_Fist' && (hand.confidence ?? 0) >= 0.5
// The classifier often doubts a moving fist for a frame or two. A held grip ends
// only on a clearly open hand, on doubt that lasts, or when the hand is lost.
export const GRIP_RELEASE_OPEN_MS = 150
export const GRIP_RELEASE_DOUBT_MS = 400
export const GRIP_GAP_MS = 250
export const HAND_POINTER_GAIN = 1.4

// Comfort-sized camera-space rectangle follows the visitor at acquisition, then
// remains fixed so moving one's head doesn't move the cursor. No 3D pointing ray.
export function projectHand(
  hand: Landmark,
  origin: Visitor,
  mirror: boolean,
  viewport: Input['viewport']
) {
  const span = clamp(origin.width * 5, 0.42, 0.72)
  const x = 0.5 + ((hand.x - origin.x) / span) * HAND_POINTER_GAIN * (mirror ? -1 : 1)
  // Preserve the resting hand position while shrinking the travel rectangle.
  const centerY = origin.y + span * 0.245
  const y = 0.5 + ((hand.y - centerY) / (span * 1.05)) * HAND_POINTER_GAIN
  const inset = Math.min(36, viewport.width * 0.08, viewport.height * 0.08)
  return {
    x: clamp(x, 0, 1) * (viewport.width - inset * 2) + inset,
    y: clamp(y, 0, 1) * (viewport.height - inset * 2) + inset,
  }
}

/** Inverse of `projectHand`, used by the stand simulator to place a synthetic hand. */
export function unprojectHand(
  point: Landmark,
  origin: Visitor,
  mirror: boolean,
  viewport: Input['viewport']
) {
  const span = clamp(origin.width * 5, 0.42, 0.72)
  const inset = Math.min(36, viewport.width * 0.08, viewport.height * 0.08)
  const x = clamp((point.x - inset) / (viewport.width - inset * 2), 0, 1)
  const y = clamp((point.y - inset) / (viewport.height - inset * 2), 0, 1)
  return {
    x: origin.x + (((x - 0.5) * span) / HAND_POINTER_GAIN) * (mirror ? -1 : 1),
    y: origin.y + span * 0.245 + ((y - 0.5) * span * 1.05) / HAND_POINTER_GAIN,
  }
}

function belongsTo(hand: ObservedHand, visitor: Visitor, faces: Visitor[]) {
  if (![hand.x, hand.y, visitor.x, visitor.y, visitor.width].every(Number.isFinite)) return false
  const body = (face: Visitor) => ({ x: face.x, y: face.y + face.height * 0.8 })
  const reach = clamp(visitor.width * 3.4, 0.26, 0.48)
  if (
    Math.abs(hand.x - visitor.x) > reach ||
    hand.y < visitor.y - 0.26 ||
    hand.y > visitor.y + 0.62
  )
    return false
  const own = gap(hand, body(visitor))
  return faces.every(face => face === visitor || own + 0.025 < gap(hand, body(face)))
}

/** Owns one hand, fist activation, clutched scrolling and gentle pet strokes. */
export function createHandNavigation() {
  let visitorId = -1,
    context = '',
    mirror = true,
    layout = ''
  let active: ObservedHand | null = null,
    origin: Visitor | null = null
  let candidateSide = '',
    candidateAt = 0,
    lastObserved = -Infinity,
    lastHandAt = -Infinity
  let point: Landmark = { x: 0, y: 0 },
    previousAt = 0
  let hover: string | null = null
  let blockUntil = 0,
    dragY: number | null = null
  let openedAt: number | null = null
  let gripArmed = false
  let grip: {
    target: string | null
    canDrag: boolean
    at: number
    observedAt: number
    // A fist seen in a later observation too: a single frame never acts.
    confirmed: boolean
    consumed: boolean
    avatar: HandRect | null
    start: Landmark
  } | null = null
  let loosenedAt: number | null = null
  let held: HandFrame | null = null
  let strokes: { at: number; distance: number }[] = [],
    lastPetPoint: Landmark | null = null,
    petSince = 0
  const resetActions = () => {
    hover = null
    dragY = null
    openedAt = null
    gripArmed = false
    grip = null
    loosenedAt = null
    held = null
    strokes = []
    lastPetPoint = null
  }
  const resetHand = () => {
    active = null
    origin = null
    candidateSide = ''
    resetActions()
  }
  return {
    reset() {
      resetHand()
      visitorId = -1
      lastObserved = lastHandAt = -Infinity
    },
    sample(input: Input): HandFrame {
      const { at, observation, visitor, viewport } = input
      const result: HandFrame = {
        rotation: null,
        point,
        mode: 'hidden',
        hover: null,
        activate: null,
        scrollDelta: 0,
        pet: { strength: 0, x: 0, y: 0 },
        sign: null,
        snap: null,
      }
      // While gripping, a brief detection gap keeps the grip where it was.
      const bridge = () =>
        grip && held && at - lastHandAt < GRIP_GAP_MS
          ? { ...held, activate: null, scrollDelta: 0 }
          : result
      const dt = clamp(at - previousAt, 0, 100)
      previousAt = at
      const layoutKey = `${viewport.width}:${viewport.height}`
      const returningVisitor =
        active &&
        origin &&
        visitor &&
        gap(visitor, origin) < Math.max(0.12, origin.width) &&
        visitor.width / origin.width > 0.55 &&
        visitor.width / origin.width < 1.8
      if (
        (visitorId !== input.visitorId && !returningVisitor) ||
        mirror !== input.mirror ||
        layout !== layoutKey
      ) {
        resetHand()
        visitorId = input.visitorId
        mirror = input.mirror
        layout = layoutKey
      }
      visitorId = input.visitorId
      if (context !== input.context) {
        context = input.context
        resetActions()
        blockUntil = at + 300
      }
      if (!observation || at - observation.timestamp > 350 || observation.timestamp > at) {
        resetHand()
        return result
      }
      if (observation.timestamp !== lastObserved) {
        lastObserved = observation.timestamp
        // Once acquired, hand continuity survives face occlusion. The saved
        // origin is only a pointer reference, not a requirement to see a face.
        if (!visitor && !active) return result
        const nearby = observation.hands.filter(hand =>
          visitor
            ? belongsTo(hand, visitor, observation.faces)
            : Number.isFinite(hand.x) && Number.isFinite(hand.y)
        )
        const hand = active
          ? nearby
              .filter(hand =>
                hand.side === active!.side
                  ? gap(hand, active!) < 0.2
                  : // Handedness often flips on a fist: same place, same hand.
                    (grip !== null || fist(hand)) && gap(hand, active!) < 0.06
              )
              .sort((a, b) => gap(a, active!) - gap(b, active!))[0]
          : nearby.filter(pointing).sort((a, b) => gap(a, visitor!) - gap(b, visitor!))[0]
        if (!hand) {
          candidateSide = ''
          const bridged = bridge()
          if (bridged !== result) return bridged
          resetActions()
          if (at - lastHandAt > 700) resetHand()
          return result
        }
        lastHandAt = at
        if (!active) {
          if (candidateSide !== hand.side) {
            candidateSide = hand.side
            candidateAt = at
          }
          if (at - candidateAt < 300) return result
          origin = { ...visitor! }
          point = projectHand(hand, origin, mirror, viewport)
          blockUntil = at + 120
        }
        active = hand
      }
      // Missing hand in a fresh frame must remain hidden on subsequent render ticks.
      if (!active || !origin) return result
      if (!observation.hands.includes(active)) return bridge()
      const projected = projectHand(active, origin, mirror, viewport)
      point = {
        x: point.x + (projected.x - point.x) * (1 - Math.exp(-dt / 65)),
        y: point.y + (projected.y - point.y) * (1 - Math.exp(-dt / 65)),
      }
      result.point = point
      result.mode = 'moving'
      result.sign = { gesture: active.gesture ?? 'None', confidence: active.confidence ?? 0 }
      if (at < blockUntil) return result
      const target = snapTarget(
        point,
        input.targets,
        hover,
        snapRadius(viewport),
        Boolean(input.scrollBounds && inside(point, input.scrollBounds))
      )
      const holdGrip = (closed: boolean, target: HandTarget | undefined): HandFrame => {
        result.mode = 'closed'
        lastPetPoint = null
        strokes = []
        // Opening during the grace period already counts towards the next click.
        if (closed || !pointing(active!)) openedAt = null
        else openedAt ??= at
        // A closure chooses one action. A click cannot turn into a drag, and a
        // held drag cannot click a button it happens to cross.
        if (closed && !grip && gripArmed) {
          grip = {
            target: target?.id ?? null,
            avatar:
              !target && input.petBounds && inside(point, input.petBounds)
                ? { ...input.petBounds }
                : null,
            start: { ...point },
            canDrag: Boolean(input.scrollBounds && inside(point, input.scrollBounds)),
            at,
            observedAt: observation.timestamp,
            confirmed: false,
            consumed: false,
          }
        }
        gripArmed = false
        if (!grip) return result
        if (closed && observation.timestamp > grip.observedAt) grip.confirmed = true
        if (grip.target) {
          if (target?.id !== grip.target) {
            grip.consumed = true
            hover = null
            return result
          }
          hover = grip.target
          result.hover = grip.target
          result.snap = target
          if (closed && grip.confirmed && !grip.consumed && at - grip.at >= 120) {
            result.activate = grip.target
            grip.consumed = true
          }
          return result
        }
        hover = null
        if (grip.avatar && grip.confirmed && at - grip.at >= 120) {
          const bounds = grip.avatar
          const project = (p: Landmark): readonly [number, number] => [
            ((p.x - bounds.x) / bounds.width - 0.5) * 300,
            ((p.y - bounds.y) / bounds.height - 0.5) * 300,
          ]
          result.mode = 'rotating'
          result.rotation = { at: grip.at, start: project(grip.start), point: project(point) }
          return result
        }
        if (grip.canDrag && grip.confirmed && input.scrollBounds && at - grip.at >= 180) {
          result.mode = 'grabbing'
          // A clearly open hand pauses the drag until it closes again or lets go.
          if (!closed && open(active!)) {
            dragY = null
            return result
          }
          if (dragY !== null) result.scrollDelta = clamp((dragY - point.y) * 1.5, -100, 100)
          dragY = point.y
        }
        return result
      }
      const closed = fist(active)
      if (closed) loosenedAt = null
      else if (grip) loosenedAt ??= at
      const holding =
        closed ||
        (grip !== null &&
          loosenedAt !== null &&
          at - loosenedAt < (open(active) ? GRIP_RELEASE_OPEN_MS : GRIP_RELEASE_DOUBT_MS))
      if (holding) {
        held = holdGrip(closed, target)
        return held
      }
      dragY = null
      grip = null
      loosenedAt = null
      held = null
      if (!pointing(active)) {
        resetActions()
        return result
      }
      openedAt ??= at
      if (at - openedAt >= 120) gripArmed = true
      if (target) {
        strokes = []
        lastPetPoint = null
        hover = target.id
        result.hover = target.id
        result.snap = target
        result.mode = 'selecting'
        return result
      }
      hover = null
      const head = open(active) ? input.petBounds : null
      const touching =
        head &&
        head.width > 0 &&
        head.height > 0 &&
        Math.hypot(
          (point.x - head.x - head.width / 2) / (head.width / 2),
          (point.y - head.y - head.height / 2) / (head.height / 2)
        ) <= 1 &&
        point.y < head.y + head.height * 0.72
      if (!touching) {
        strokes = []
        lastPetPoint = null
        return result
      }
      if (!lastPetPoint) petSince = at
      const movement = lastPetPoint ? gap(point, lastPetPoint) : 0
      const speed = dt > 0 ? ((movement / dt) * 1000) / head.width : 0
      lastPetPoint = point
      if (speed > 1.8) {
        strokes = []
        petSince = at
        return result
      }
      strokes.push({ at, distance: speed > 0.035 ? movement / head.width : 0 })
      strokes = strokes.filter(stroke => at - stroke.at < 650)
      const travel = strokes.reduce((sum, stroke) => sum + stroke.distance, 0)
      if (at - petSince >= 320 && travel > 0.07) {
        result.mode = 'petting'
        result.pet = {
          strength: clamp(travel / 0.23, 0, 1),
          x: clamp(((point.x - head.x) / head.width) * 2 - 1, -1, 1),
          y: clamp(((point.y - head.y) / head.height) * 2 - 1, -1, 1),
        }
      }
      return result
    },
  }
}
