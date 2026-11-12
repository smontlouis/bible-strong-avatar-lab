import type { StandCue } from './standEncounter'

/**
 * attract: nobody in front of the screen.
 * approach: someone is noticed or still too far away.
 * play: the ice-breaking gestures (and free play when resources are hidden).
 * explore: resources and the virtual hand, unlocked by the first recognized gesture.
 */
export type StandStage = 'attract' | 'approach' | 'play' | 'explore'

// Exploration survives looking away, reading with the arm down or a brief
// tracking loss. After this, the next visitor starts again with the ice-breaker.
export const UNLOCK_GRACE_MS = 8000
// The first success is celebrated in place before the resources arrive.
export const UNLOCK_DELAY_MS = 1400

export function createStandJourney() {
  let unlocked = false
  let absentSince: number | null = null
  let friendlySince: number | null = null
  return {
    sample({
      at,
      present,
      friendly,
      cue,
      resources,
    }: {
      at: number
      present: boolean
      friendly: boolean
      cue: StandCue
      resources: boolean
    }): { stage: StandStage; unlocked: boolean } {
      if (present) absentSince = null
      else absentSince ??= at
      if (present && friendly) friendlySince ??= at
      else friendlySince = null
      if (friendlySince !== null && at - friendlySince >= UNLOCK_DELAY_MS) unlocked = true
      if (absentSince !== null && at - absentSince > UNLOCK_GRACE_MS) unlocked = false
      const stage: StandStage =
        resources && unlocked
          ? 'explore'
          : !present
            ? 'attract'
            : cue === 'notice' || cue === 'closer' || cue === 'searching'
              ? 'approach'
              : 'play'
      return { stage, unlocked }
    },
  }
}
