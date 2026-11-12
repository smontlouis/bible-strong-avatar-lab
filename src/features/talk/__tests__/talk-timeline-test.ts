import { defaultAnimaleseSettings, prepareRpgTalkVoice } from '@/features/talk/animalese'
import {
  formatTalkTime,
  talkHighlightOffsetAtTime,
  talkSequenceStepIndexAtTime,
  talkTextOffsetAtTime,
  talkTimeAtTextOffset,
  talkWordRangeAtOffset,
  type PreparedTalkVoice,
} from '@/features/talk/talkTimeline'

const timeline: PreparedTalkVoice = {
  samples: new Float32Array(),
  sampleRate: 44_100,
  gainScale: 1,
  durationMs: 1_000,
  segments: [
    { source: 'Hi', startOffset: 0, endOffset: 2, startMs: 0, durationMs: 400 },
    { source: ' ', startOffset: 2, endOffset: 3, startMs: 400, durationMs: 100 },
    { source: 'you', startOffset: 3, endOffset: 6, startMs: 500, durationMs: 500 },
  ],
}

describe('Talk timeline', () => {
  it('maps time and text offsets in both directions', () => {
    expect(talkTextOffsetAtTime(timeline, 0)).toBe(0)
    expect(talkTextOffsetAtTime(timeline, 750)).toBe(4)
    expect(talkTextOffsetAtTime(timeline, 1_000)).toBe(6)
    expect(talkTimeAtTextOffset(timeline, 4)).toBeCloseTo(666.67, 1)
    expect(talkHighlightOffsetAtTime(timeline, 750)).toBe(3)
    expect(talkHighlightOffsetAtTime(timeline, 1_000)).toBe(5)
  })

  it('finds a whole French word around the playhead', () => {
    const text = 'Voici l’histoire maintenant'
    expect(talkWordRangeAtOffset(text, 8)).toEqual({ from: 6, to: 16 })
  })

  it('resolves loop, once and ping-pong sequence frames', () => {
    const steps = [
      { holdMs: 100, transitionMs: 0 },
      { holdMs: 100, transitionMs: 0 },
      { holdMs: 100, transitionMs: 0 },
    ]
    expect(talkSequenceStepIndexAtTime({ playbackMode: 'loop', steps }, 350)).toBe(0)
    expect(talkSequenceStepIndexAtTime({ playbackMode: 'once', steps }, 900)).toBe(2)
    expect(talkSequenceStepIndexAtTime({ playbackMode: 'pingPong', steps }, 350)).toBe(1)
  })

  it('prepares deterministic seekable RPG samples', () => {
    const prepared = prepareRpgTalkVoice('Hi!', defaultAnimaleseSettings)
    expect(prepared.samples.length).toBeGreaterThan(0)
    expect(prepared.durationMs).toBeGreaterThan(0)
    expect(prepared.segments.map(segment => segment.source)).toEqual(['H', 'i', '!'])
  })

  it('formats compact transport timestamps', () => {
    expect(formatTalkTime(65_430)).toBe('1:05.4')
  })
})
