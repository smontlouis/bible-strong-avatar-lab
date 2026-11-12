import {
  defaultAnimaleseSettings,
  FrenchAnalyzer,
  getAnimaleseVoiceAssets,
  getRpgBlipDuration,
  getRpgBlipFrequency,
} from '@/features/talk/animalese'

describe('Animalese Talk Mode', () => {
  it('matches the upstream voice defaults', () => {
    expect(defaultAnimaleseSettings).toMatchObject({
      language: 'fr',
      voiceBank: 'animalese',
      gameBoyPitch: 'male',
      pitch: 1.5,
      speed: 4,
      randomness: 0.1,
      melodyRate: 0.05,
      melodyAmplitude: 0.1,
      spaceDelay: 0.03,
      punctuationDelay: 0.3,
      maxRetries: 3,
      punctuations: `.,!?;:()~…。、！？`,
      volume: 0.4,
    })
  })

  it.each([
    ['fr', 'english'],
    ['en', 'english'],
    ['ja', 'japanese'],
  ] as const)('uses local %s voice assets', (language, fileStem) => {
    expect(getAnimaleseVoiceAssets(language)).toEqual({
      mapUrl: `/vendor/animalese/${fileStem}-sprite.json`,
      audioUrl: `/vendor/animalese/${fileStem}-sprite.wav`,
    })
  })

  it('creates deterministic RPG tones from text and voice settings', () => {
    const settings = {
      pitch: 1.5,
      randomness: 0.1,
      melodyRate: 0.05,
      melodyAmplitude: 0.1,
    }

    expect(getRpgBlipFrequency('A', 4, settings)).toBe(getRpgBlipFrequency('A', 4, settings))
    expect(getRpgBlipFrequency('A', 4, settings)).not.toBe(getRpgBlipFrequency('B', 4, settings))
  })

  it('keeps RPG blips short at every playback speed', () => {
    expect(getRpgBlipDuration(0.5)).toBe(0.09)
    expect(getRpgBlipDuration(4)).toBeCloseTo(0.0275)
    expect(getRpgBlipDuration(5)).toBe(0.025)
  })

  it('normalizes French characters while preserving text alignment', () => {
    const text = 'Été, ça va ? Œuf.'
    const analysis = new FrenchAnalyzer().analyze(text)
    const phonemes = analysis.flatMap(tokens => tokens.map(token => token.phoneme))

    expect(analysis).toHaveLength(text.length)
    expect(phonemes).toContain('e')
    expect(phonemes).toContain('c')
    expect(phonemes).toContain('o')
    expect(phonemes).not.toEqual(expect.arrayContaining(['é', 'ç', 'œ']))
  })
})
