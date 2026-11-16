import {
  clampView,
  followView,
  fullView,
  isFullView,
  panView,
  shareOf,
  tickStep,
  tickTimes,
  zoomView,
} from '@/features/editor/timelineView'

describe('the window of a timeline', () => {
  it('zooms about a time that stays where it is', () => {
    const view = zoomView(fullView(6), 0.25, 4, 6)
    expect(view.end - view.start).toBeCloseTo(1.5)
    expect(shareOf(view, 4)).toBeCloseTo(4 / 6)
    expect(isFullView(zoomView(view, 100, 4, 6), 6)).toBe(true)
  })

  it('stays inside the clip, and never shorter than a tenth of a second', () => {
    expect(panView({ start: 4, end: 5 }, 3, 6)).toEqual({ start: 5, end: 6 })
    expect(panView({ start: 1, end: 2 }, -3, 6)).toEqual({ start: 0, end: 1 })
    const tight = clampView({ start: 2, end: 2.01 }, 6)
    expect(tight.end - tight.start).toBeCloseTo(0.1)
  })

  it('marks the ruler at a step that suits the window', () => {
    expect(tickStep(fullView(6), 8)).toBe(1)
    expect(tickStep({ start: 3.8, end: 4.4 }, 8)).toBe(0.1)
    expect(tickTimes({ start: 3.85, end: 4.4 }, 0.1)).toEqual([3.9, 4, 4.1, 4.2, 4.3, 4.4])
  })

  it('turns the page when the playhead leaves the window', () => {
    const view = { start: 1, end: 2 }
    expect(followView(view, 1.5, 6)).toBe(view)
    const next = followView(view, 2.2, 6)
    expect(next.start).toBeCloseTo(2.15)
    expect(next.end - next.start).toBeCloseTo(1)
    expect(followView(view, 0.1, 6).start).toBe(0.05)
  })
})
