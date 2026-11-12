import { clamp } from '@/features/avatar/geometry'
import type { ObservedHand, Visitor } from './standDirector'

export type StandAction = 'wave' | 'smile' | 'thumbs-up' | 'victory' | 'tilt' | 'thumbs-down'
export type StandCue =
  | 'petted'
  | 'idle'
  | 'notice'
  | 'closer'
  | 'searching'
  | StandAction
  | 'hello'
  | 'smile-reply'
  | 'thumbs-up-reply'
  | 'victory-reply'
  | 'tilt-reply'
  | 'thumbs-down-reply'
  | 'connection'
  | 'free-play'
  | 'farewell'

const replies: Record<StandAction, StandCue> = {
  wave: 'hello',
  smile: 'smile-reply',
  'thumbs-up': 'thumbs-up-reply',
  victory: 'victory-reply',
  tilt: 'tilt-reply',
  'thumbs-down': 'thumbs-down-reply',
}
// The collection shown to visitors. Secret gestures are never suggested.
export const collectionActions: StandAction[] = [
  'wave',
  'smile',
  'thumbs-up',
  'victory',
  'tilt',
  'thumbs-down',
]
export const secretActions: ReadonlySet<StandAction> = new Set(['thumbs-down'])
const activities: StandCue[] = ['smile', 'thumbs-up', 'victory', 'tilt', 'free-play', 'connection']
export const REPLY_MS = 2200

export function visitorSignals(visitor: Visitor) {
  const coefficient = (key: string) => {
    const value = visitor.signals?.[key] ?? 0
    return Number.isFinite(value) ? clamp(value, 0, 1) : 0
  }
  // Outer eye corners in the Face Landmarker topology. Correct normalized Y
  // for the frame aspect ratio before measuring the roll in the image plane.
  const left = visitor.landmarks?.[33],
    right = visitor.landmarks?.[263]
  const roll =
    left && right
      ? (Math.atan2((right.y - left.y) / (visitor.frameAspectRatio ?? 4 / 3), right.x - left.x) *
          180) /
        Math.PI
      : 0
  return {
    smile: (coefficient('mouthSmileLeft') + coefficient('mouthSmileRight')) / 2,
    jaw: coefficient('jawOpen'),
    tilt: Number.isFinite(roll) ? clamp(roll, -30, 30) : 0,
  }
}

/** A held gesture fires once and needs a real release before it can fire again. */
function createHeldSignal(holdMs: number) {
  let since: number | null = null
  let releasedAt: number | null = null
  let fired = false
  return {
    reset() {
      since = null
      releasedAt = null
      fired = false
    },
    observe(active: boolean, released: boolean, at: number) {
      if (released) {
        since = null
        releasedAt ??= at
        if (at - releasedAt >= 300) fired = false
      } else {
        releasedAt = null
        if (!active) since = null
      }
      if (active) since ??= at
      if (!fired && since !== null && at - since >= holdMs) {
        fired = true
        return true
      }
      return false
    },
    progress(at: number) {
      return fired || since === null ? 0 : clamp((at - since) / holdMs, 0, 1)
    },
  }
}

/** A classifier label held by one hand; switching hands restarts the hold. */
function createHandSignal(gesture: string, holdMs: number) {
  const held = createHeldSignal(holdMs)
  let side: string | null = null
  return {
    reset() {
      held.reset()
      side = null
    },
    observe(hands: ObservedHand[], at: number) {
      const hand = hands.find(
        candidate => candidate.gesture === gesture && (candidate.confidence ?? 0) >= 0.65
      )
      if (hand && side !== hand.side) held.reset()
      if (hand) side = hand.side
      return held.observe(Boolean(hand), !hand, at)
    },
    progress: held.progress,
  }
}

/** Short, forgiving invitations. No identity, emotion inference or visitor history. */
export function createStandEncounter() {
  const smile = createHeldSignal(600)
  const thumb = createHandSignal('Thumb_Up', 500)
  const victory = createHandSignal('Victory', 500)
  const thumbDown = createHandSignal('Thumb_Down', 500)
  const tilt = createHeldSignal(650)
  let metAt = 0
  let lastAt = -Infinity
  let reaction: StandAction | null = null
  let reactionAt = -Infinity
  let waveAt = -Infinity
  let nextActivity = 0
  const discoveries = new Set<StandAction>()
  const resetSignals = () => {
    smile.reset()
    thumb.reset()
    victory.reset()
    thumbDown.reset()
    tilt.reset()
  }
  return {
    reset(at: number) {
      metAt = at
      lastAt = -Infinity
      reaction = null
      reactionAt = waveAt = -Infinity
      nextActivity = 0
      discoveries.clear()
      resetSignals()
    },
    observe(visitor: Visitor, hands: ObservedHand[], waved: boolean, at: number) {
      if (at <= lastAt) return
      if (at - lastAt > 350) resetSignals()
      lastAt = at
      const signal = visitorSignals(visitor)
      const smiled = smile.observe(signal.smile >= 0.5, signal.smile < 0.25, at)
      const approved = thumb.observe(hands, at)
      const cheered = victory.observe(hands, at)
      const booed = thumbDown.observe(hands, at)
      const tilted = tilt.observe(Math.abs(signal.tilt) >= 12, Math.abs(signal.tilt) < 6, at)
      // Read all detectors even during a reply: a held pose cannot queue rewards.
      const action: StandAction | null =
        waved && at - waveAt >= 4500
          ? 'wave'
          : approved
            ? 'thumbs-up'
            : cheered
              ? 'victory'
              : booed
                ? 'thumbs-down'
                : smiled
                  ? 'smile'
                  : tilted
                    ? 'tilt'
                    : null
      if (!action || at - reactionAt < REPLY_MS) return
      reaction = action
      reactionAt = at
      if (action === 'wave') waveAt = at
      discoveries.add(action)
      // Suggest the activity after the one just done (a secret restarts the list).
      nextActivity = action === 'wave' ? 0 : (activities.indexOf(action) + 1) % activities.length
    },
    sample(at: number, present: boolean, visible: boolean, distance: number, radius: number) {
      const friendly = discoveries.size > 0
      const replying = present && reaction !== null && at - reactionAt < REPLY_MS
      // Slow invitations rotate if the person prefers another gesture. Completing
      // three different interactions opens a natural invitation to visit the stand.
      const elapsed = at - reactionAt - REPLY_MS
      const activity =
        discoveries.size >= 3 && elapsed < 6500
          ? 'connection'
          : activities[(nextActivity + Math.floor(Math.max(0, elapsed) / 9000)) % activities.length]
      const cue: StandCue = !present
        ? 'idle'
        : !visible
          ? 'searching'
          : replying
            ? replies[reaction!]
            : friendly
              ? activity
              : at - metAt < 2400
                ? 'notice'
                : distance > radius
                  ? 'closer'
                  : Math.floor((at - metAt - 2400) / 10000) % 2 === 0
                    ? 'wave'
                    : 'smile'
      const progress = !visible
        ? 0
        : cue === 'smile'
          ? smile.progress(at)
          : cue === 'thumbs-up'
            ? thumb.progress(at)
            : cue === 'victory'
              ? victory.progress(at)
              : cue === 'tilt'
                ? tilt.progress(at)
                : 0
      return {
        cue,
        friendly: present && friendly,
        reaction: replying ? reaction : null,
        reactionElapsed: replying ? at - reactionAt : 0,
        greetingCooldownMs: Math.max(0, 4500 - (at - waveAt)),
        discoveries: present ? discoveries.size : 0,
        discovered: present ? [...discoveries] : [],
        progress,
      }
    },
  }
}
