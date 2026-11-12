import {
  buildGameBoySpeechTimeline,
  gameBoyPitchFrequencies,
  getGameBoyPhonemeDuration,
  getGameBoyPitchTarget,
  quantizeGameBoyFrequency,
  textToGameBoySpeech,
} from '@/features/talk/gameBoySpeech'

describe('Game Boy speech', () => {
  it('uses the five pitch registers from gb-speech', () => {
    expect(gameBoyPitchFrequencies).toEqual({
      low: 100,
      male: 120,
      medium: 150,
      female: 180,
      high: 280,
    })
  })

  it('converts known words and punctuation to the reference phoneme inventory', () => {
    expect(textToGameBoySpeech('Hello World.')).toEqual([
      { source: 'Hello', phonemes: ['h', '@', 'l', 'O'] },
      { source: ' ', phonemes: [' '] },
      { source: 'World', phonemes: ['w', '@', 'r', 'l', 'd'] },
      { source: '.', phonemes: ['.'] },
    ])
  })

  it('normalizes French characters and gives non-Latin text an audible fallback', () => {
    expect(textToGameBoySpeech('É')).toEqual([{ source: 'É', phonemes: ['E'] }])
    expect(textToGameBoySpeech('日')[0]).toMatchObject({ source: '日' })
    expect(textToGameBoySpeech('日')[0].phonemes).toHaveLength(1)
  })

  it('keeps the reference first-match rule order', () => {
    expect(textToGameBoySpeech('This')).toEqual([
      { source: 'Th', phonemes: ['T'] },
      { source: 'is', phonemes: ['I', 'z'] },
    ])
  })

  it('keeps the square channel audible while processing adjacent phonemes', () => {
    const timeline = buildGameBoySpeechTimeline('ab', { pitchPreset: 'male', speed: 7 })
    const secondSegmentStart = timeline.segmentStartFrames[1]

    expect(timeline.frames[secondSegmentStart - 1].audible).toBe(true)
    expect(timeline.frames[secondSegmentStart].audible).toBe(true)
    expect(timeline.frames[secondSegmentStart].frequency).toBe(
      timeline.frames[secondSegmentStart - 1].frequency
    )
  })

  it('maps the shared speed level 4 to the former Game Boy speed 10', () => {
    expect(getGameBoyPhonemeDuration('a', 1)).toBe(0.4)
    expect(getGameBoyPhonemeDuration('a', 4)).toBe(0.1)
    expect(getGameBoyPhonemeDuration('a', 10)).toBeCloseTo(2 / 60)
  })

  it('applies sentence intonation and Game Boy frequency quantization', () => {
    expect(getGameBoyPitchTarget(120, 0, 10, 'statement')).toBe(160)
    expect(getGameBoyPitchTarget(120, 9, 10, 'statement')).toBeLessThan(140)
    expect(getGameBoyPitchTarget(120, 9, 10, 'question')).toBeGreaterThan(160)
    expect(quantizeGameBoyFrequency(440)).toBeCloseTo(440, -1)
  })
})
