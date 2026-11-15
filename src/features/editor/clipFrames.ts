import {
  advanceEngine,
  createAvatarEngine,
  engineFrame,
  playEngineClip,
  type ClipDefinition,
  type EngineFrame,
} from '@bible-strong/avatar-core'

// The frames of a sheet: the clip played from its start by an engine of its own, and read at
// each frame time. Played, not sampled: faces change and blink over time, as on the stage.

/** The most frames a sheet draws: past it, the frames are spread over the whole clip. */
export const MAX_SHEET_FRAMES = 240

export type SheetFrame = { index: number; time: number; frame: EngineFrame }

/**
 * The times of a sheet: every frame of the rate from the start, and the clip's last moment.
 * A clip too long for the rate gets fewer frames, evenly spread.
 */
export const sheetTimes = (duration: number, fps: number) => {
  const step = Math.max(1 / fps, duration / (MAX_SHEET_FRAMES - 1))
  const times: number[] = []
  for (let time = 0; time < duration - 1e-6; time = times.length * step) times.push(time)
  times.push(duration)
  return times
}

// Just short of the end: at its very end a clip goes round, back to its first picture.
const END_MARGIN = 1e-4

export const clipSheet = (clip: ClipDefinition, fps: number): SheetFrame[] => {
  const engine = createAvatarEngine({ seed: 1 })
  playEngineClip(engine, clip, { transition: 'cut' })
  let now = 0
  return sheetTimes(clip.duration, fps).map((time, index) => {
    const target = Math.min(time, clip.duration - END_MARGIN)
    // The engine steps no more than a tenth of a second at once.
    while (now < target - 1e-9) {
      const step = Math.min(0.05, target - now)
      advanceEngine(engine, step)
      now += step
    }
    return { index, time, frame: engineFrame(engine) }
  })
}
