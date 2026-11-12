import { clamp, type Expression } from '@/features/avatar/geometry'
import type { StandObservation, Visitor } from './standDirector'
import { visitorSignals } from './standEncounter'
import { ASSUMED_SCREEN_WIDTH_M, solveStandGaze } from './standGaze'

// A companion appears once a person is stable, and survives short detection gaps.
export const COMPANION_CONFIRM_MS = 600
export const COMPANION_LOSS_MS = 1500
export const COMPANION_EXIT_MS = 1300

type Track = { id: number; face: Visitor; firstSeen: number; lastSeen: number }
export type Companion = {
  // Index into the operator's chosen companion avatars.
  slot: number
  trackId: number
  face: Visitor
  since: number
  leftAt: number | null
  visible: boolean
}

const gap = (a: Visitor, b: Visitor) => Math.hypot(a.x - b.x, a.y - b.y)
// Same spatial continuity rule as the director: nearby box of a similar size.
const continues = (face: Visitor, previous: Visitor) =>
  gap(face, previous) < Math.max(0.12, previous.width * 0.65) &&
  face.width / previous.width > 0.55 &&
  face.width / previous.width < 1.8

/**
 * Hooks one companion character to each additional person in front of the stand.
 * The director keeps the main visitor; this is spatial continuity, not identity.
 */
export function createStandCrowd(initialSlots: number) {
  let slots = initialSlots
  let tracks: Track[] = []
  let companions: Companion[] = []
  let nextId = 1
  let primary: number | null = null
  let lastAt = -Infinity
  return {
    /** Changing the chosen characters sends away those without an avatar any more. */
    setSlots(count: number) {
      slots = count
    },
    reset() {
      tracks = []
      companions = []
      primary = null
      lastAt = -Infinity
    },
    observe(observation: StandObservation, target: Visitor | null) {
      const at = observation.timestamp
      if (at <= lastAt) return
      lastAt = at
      const unmatched = [...observation.faces]
      for (const track of [...tracks].sort((a, b) => b.lastSeen - a.lastSeen)) {
        const face = unmatched
          .filter(candidate => continues(candidate, track.face))
          .sort((a, b) => gap(a, track.face) - gap(b, track.face))[0]
        if (!face) continue
        track.face = face
        track.lastSeen = at
        unmatched.splice(unmatched.indexOf(face), 1)
      }
      for (const face of unmatched) tracks.push({ id: nextId++, face, firstSeen: at, lastSeen: at })
      tracks = tracks.filter(track => at - track.lastSeen <= COMPANION_LOSS_MS)
      primary = target
        ? ((
            tracks.find(track => track.face === target) ??
            tracks
              .filter(track => continues(target, track.face))
              .sort((a, b) => gap(a.face, target) - gap(b.face, target))[0]
          )?.id ?? null)
        : null
    },
    sample(at: number): readonly Companion[] {
      for (const companion of companions) {
        if (companion.leftAt !== null) continue
        const track = tracks.find(track => track.id === companion.trackId)
        // Leaving, or becoming the main visitor: the character hands over to Strobi.
        if (
          !track ||
          track.id === primary ||
          companion.slot >= slots ||
          at - track.lastSeen > COMPANION_LOSS_MS
        ) {
          companion.leftAt = at
          companion.visible = false
        } else {
          companion.face = track.face
          companion.visible = at - track.lastSeen < 350
        }
      }
      companions = companions.filter(
        companion => companion.leftAt === null || at - companion.leftAt < COMPANION_EXIT_MS
      )
      const taken = new Set(companions.map(companion => companion.slot))
      const hooked = new Set(
        companions.filter(companion => companion.leftAt === null).map(c => c.trackId)
      )
      for (const track of [...tracks].sort((a, b) => a.firstSeen - b.firstSeen)) {
        if (track.id === primary || hooked.has(track.id)) continue
        if (at - track.firstSeen < COMPANION_CONFIRM_MS || at - track.lastSeen > 350) continue
        const slot = Array.from({ length: slots }, (_, index) => index).find(
          index => !taken.has(index)
        )
        if (slot === undefined) break
        taken.add(slot)
        companions.push({
          slot,
          trackId: track.id,
          face: track.face,
          since: at,
          leftAt: null,
          visible: true,
        })
      }
      return companions
    },
  }
}

// Default friends from the bundled library, in order: Nova, then Citrus.
export const DEFAULT_COMPANION_IDS = [
  'avatar-1786600724626',
  'avatar-295e74a7-5d70-4d61-83d4-7beebb22bdd8',
]

/**
 * The operator's chosen characters. Otherwise the default friends, or the first
 * characters after the main one when the library no longer contains them.
 */
export function chooseCompanions<T extends { id: string }>(
  avatars: readonly T[],
  activeId: string,
  chosenIds: readonly string[],
  max = 3
): T[] {
  const others = avatars.filter(avatar => avatar.id !== activeId)
  const pick = (ids: readonly string[]) =>
    ids.flatMap(id => others.filter(avatar => avatar.id === id))
  const chosen = chosenIds.length ? pick(chosenIds) : pick(DEFAULT_COMPANION_IDS)
  return (chosenIds.length || chosen.length ? chosen : others).slice(0, max)
}

/** Where the person stands on screen, 0 (left) to 1 (right), matching the hand cursor. */
export const screenPosition = (face: Visitor, mirror: boolean) =>
  clamp(mirror ? 1 - face.x : face.x, 0, 1)

export type CompanionPlacement = { slot: number; x: number }

/**
 * Horizontal centres in pixels. Before exploring, each character stands in front of
 * its person, outside the main character's space. While exploring, they gather
 * behind the main character's shoulders and only their gaze follows.
 */
export function placeCompanions(
  companions: readonly Companion[],
  {
    mirror,
    exploring,
    width,
    center,
    clearance,
    size,
    previous,
  }: {
    mirror: boolean
    exploring: boolean
    width: number
    center: number
    clearance: number
    size: number
    // Last placements by slot, so a person swaying in front of the main
    // character does not make their companion cross back and forth behind it.
    previous?: ReadonlyMap<number, number>
  }
): CompanionPlacement[] {
  const ordered = [...companions].sort(
    (a, b) => screenPosition(a.face, mirror) - screenPosition(b.face, mirror)
  )
  if (exploring) {
    const right = ordered.filter(c => screenPosition(c.face, mirror) >= 0.5).length
    const anchors =
      ordered.length === 1
        ? [right ? 1 : -1]
        : ordered.length === 2
          ? [-1, 1]
          : right >= 2
            ? [-1, 1, 1.8]
            : [-1.8, -1, 1]
    return ordered.map((companion, index) => ({
      slot: companion.slot,
      x: center + anchors[index] * clearance,
    }))
  }
  const margin = size / 2 + 24
  const placed = ordered.map(companion => {
    const x = screenPosition(companion.face, mirror) * width
    // Step out of the main character's space, keeping the side it already stands on.
    const last = previous?.get(companion.slot)
    const side = Math.sign((last ?? x) - center || x - center || 1)
    const pushed =
      Math.abs(x - center) < clearance + size / 2 ? center + side * (clearance + size / 2) : x
    return { slot: companion.slot, x: clamp(pushed, margin, width - margin) }
  })
  // Keep neighbours from overlapping, left to right.
  for (let index = 1; index < placed.length; index++)
    placed[index].x = Math.max(placed[index].x, placed[index - 1].x + size * 0.85)
  return placed
}

export type CompanionPose = {
  expression: Expression
  blink: number
  y: number
  scale: number
  // 0 while arriving or leaving, 1 when fully present.
  presence: number
}

/** A lighter personality: hop in with a wave, look, smile back, wave goodbye. */
export function sampleCompanion(
  companion: Companion,
  at: number,
  base: Expression,
  { mirror, reducedMotion, screenX }: { mirror: boolean; reducedMotion: boolean; screenX: number }
): CompanionPose {
  const energy = reducedMotion ? 0 : 1
  const elapsed = at - companion.since
  const leaving = companion.leftAt === null ? -1 : at - companion.leftAt
  const gaze = solveStandGaze(
    companion.face,
    mirror,
    undefined,
    (screenX - 0.5) * ASSUMED_SCREEN_WIDTH_M
  )
  const hop = elapsed < 700 ? Math.sin((elapsed / 700) * Math.PI) : 0
  const hello = elapsed < 1900 ? Math.sin((elapsed / 1900) * Math.PI) : 0
  const bye = leaving >= 0 ? Math.sin(clamp(leaving / 900, 0, 1) * Math.PI) : 0
  const smile = companion.visible ? visitorSignals(companion.face).smile : 0
  const happy = Math.max(smile * 0.6, hello * 0.25)
  // Each companion blinks on its own rhythm.
  const blinkPhase = (at + companion.slot * 1370) % 4700
  const blink = blinkPhase < 150 ? 1 - Math.sin((blinkPhase / 150) * Math.PI) * 0.94 : 1
  const enter = clamp(elapsed / 350, 0, 1)
  const exit = leaving >= 0 ? 1 - clamp((leaving - 800) / 450, 0, 1) : 1
  return {
    expression: {
      ...base,
      headX: base.headX + gaze.headX,
      headY: base.headY + gaze.headY,
      headZ:
        base.headZ +
        (hello * Math.sin(elapsed / 140) * 10 + bye * Math.sin(leaving / 120) * 12) * energy,
      positionXLeft: base.positionXLeft + gaze.eyeX,
      positionXRight: base.positionXRight + gaze.eyeX,
      positionYLeft: base.positionYLeft + gaze.eyeY,
      positionYRight: base.positionYRight + gaze.eyeY,
      heightLeft: clamp(base.heightLeft * (1 + hop * 0.25 - happy), 3, 100),
      heightRight: clamp(base.heightRight * (1 + hop * 0.25 - happy), 3, 100),
      leftAngle: base.leftAngle - happy * 18,
      rightAngle: base.rightAngle + happy * 18,
      mouthCurve: happy > 0.2 ? 60 : base.mouthCurve,
    },
    blink,
    y:
      (Math.sin(at / 1150 + companion.slot) * 2 -
        hop * 16 -
        (hello + bye) * Math.abs(Math.sin(at / 130)) * 6) *
      energy,
    scale: 1 + hop * 0.05 * energy,
    presence: Math.min(enter, exit),
  }
}
