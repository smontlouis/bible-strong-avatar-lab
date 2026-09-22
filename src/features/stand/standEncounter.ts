import { clamp } from '@/features/avatar/geometry'
import type { ObservedHand, Visitor } from './standDirector'

export type StandAction = 'wave' | 'smile' | 'thumbs-up' | 'tilt'
export type StandCue =
  | 'idle'
  | 'notice'
  | 'closer'
  | 'searching'
  | StandAction
  | 'hello'
  | 'smile-reply'
  | 'thumbs-up-reply'
  | 'tilt-reply'
  | 'connection'
  | 'free-play'

const replies: Record<StandAction, StandCue> = {
  wave: 'hello',
  smile: 'smile-reply',
  'thumbs-up': 'thumbs-up-reply',
  tilt: 'tilt-reply',
}
const activities: StandCue[] = ['smile', 'thumbs-up', 'tilt', 'free-play', 'connection']
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

/** Short, forgiving invitations. No identity, emotion inference or visitor history. */
export function createStandEncounter() {
  const smile = createHeldSignal(600)
  const thumb = createHeldSignal(500)
  const tilt = createHeldSignal(650)
  let metAt = 0
  let lastAt = -Infinity
  let reaction: StandAction | null = null
  let reactionAt = -Infinity
  let waveAt = -Infinity
  let nextActivity = 0
  let thumbSide: string | null = null
  const discoveries = new Set<StandAction>()
  const resetSignals = () => {
    smile.reset()
    thumb.reset()
    tilt.reset()
    thumbSide = null
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
      const raisedThumb = hands.find(
        hand => hand.gesture === 'Thumb_Up' && (hand.confidence ?? 0) >= 0.65
      )
      if (raisedThumb && thumbSide !== raisedThumb.side) thumb.reset()
      if (raisedThumb) thumbSide = raisedThumb.side
      const smiled = smile.observe(signal.smile >= 0.5, signal.smile < 0.25, at)
      const approved = thumb.observe(Boolean(raisedThumb), !raisedThumb, at)
      const tilted = tilt.observe(Math.abs(signal.tilt) >= 12, Math.abs(signal.tilt) < 6, at)
      // Read all detectors even during a reply: a held pose cannot queue rewards.
      const action: StandAction | null =
        waved && at - waveAt >= 4500
          ? 'wave'
          : approved
            ? 'thumbs-up'
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
      nextActivity = action === 'wave' ? 0 : action === 'smile' ? 1 : action === 'thumbs-up' ? 2 : 3
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
        progress,
      }
    },
  }
}
