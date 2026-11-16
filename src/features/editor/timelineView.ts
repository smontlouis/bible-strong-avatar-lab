// The window of time a timeline shows: from `start` to `end`, in seconds of the clip. Zoomed in,
// the timeline shows less of the clip, larger; it is moved along the clip by scrolling, by the
// overview bar, or by the playhead as the clip plays. Plain functions of plain numbers.

export type TimelineView = { start: number; end: number }

/** The shortest window, in seconds: a few frames at 60 a second, whatever the clip. */
export const MIN_VIEW_SECONDS = 0.1

export const fullView = (duration: number): TimelineView => ({ start: 0, end: duration })

export const isFullView = (view: Readonly<TimelineView>, duration: number) =>
  view.start <= 1e-6 && view.end >= duration - 1e-6

/** A window kept inside the clip, at least the shortest window long. */
export const clampView = (view: Readonly<TimelineView>, duration: number): TimelineView => {
  const span = Math.min(
    duration,
    Math.max(Math.min(MIN_VIEW_SECONDS, duration), view.end - view.start)
  )
  const start = Math.min(Math.max(0, view.start), duration - span)
  return { start, end: start + span }
}

/** Zoom by a factor (above 1 shows more, below 1 less) about a time that stays where it is. */
export const zoomView = (
  view: Readonly<TimelineView>,
  factor: number,
  about: number,
  duration: number
): TimelineView => {
  const share = (about - view.start) / (view.end - view.start || 1)
  const span = (view.end - view.start) * factor
  return clampView({ start: about - share * span, end: about - share * span + span }, duration)
}

/** Move the window along the clip by a time, keeping its length. */
export const panView = (view: Readonly<TimelineView>, by: number, duration: number): TimelineView =>
  clampView({ start: view.start + by, end: view.end + by }, duration)

/** Where a time falls across the window, from 0 at its start to 1 at its end. */
export const shareOf = (view: Readonly<TimelineView>, time: number) =>
  (time - view.start) / (view.end - view.start || 1)

export const timeOfShare = (view: Readonly<TimelineView>, share: number) =>
  view.start + share * (view.end - view.start)

const TICK_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10]

/** The step between two marks of the ruler, for at most `most` marks over the window. */
export const tickStep = (view: Readonly<TimelineView>, most: number) => {
  const span = view.end - view.start
  return TICK_STEPS.find(step => span / step <= most) ?? TICK_STEPS.at(-1)!
}

/** The times of the ruler's marks inside the window. */
export const tickTimes = (view: Readonly<TimelineView>, step: number) => {
  const times: number[] = []
  const first = Math.ceil(view.start / step - 1e-9) * step
  for (let time = first; time <= view.end + 1e-9; time += step) {
    times.push(Math.round(time * 1000) / 1000)
  }
  return times
}

/**
 * The window that shows a time as the clip plays: the same window while the time is inside it,
 * else the next page, which starts a little before the time.
 */
export const followView = (
  view: Readonly<TimelineView>,
  time: number,
  duration: number
): TimelineView => {
  if (time >= view.start && time <= view.end) return view
  const span = view.end - view.start
  return clampView({ start: time - span * 0.05, end: time - span * 0.05 + span }, duration)
}
