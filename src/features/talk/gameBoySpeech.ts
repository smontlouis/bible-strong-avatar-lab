import { nextTalkCueIndex, type TimedTalkCue } from '@/features/talk/talkScript'

export type GameBoyPitchPreset = 'low' | 'male' | 'medium' | 'female' | 'high'

export const gameBoyPitchFrequencies: Record<GameBoyPitchPreset, number> = {
  low: 100,
  male: 120,
  medium: 150,
  female: 180,
  high: 280,
}

type PhonemeKind = 'vowel' | 'consonant' | 'diphthong' | 'silence'

type GameBoyPhoneme = {
  kind: PhonemeKind
  normalizedFrequency: number
  duration: number
  voiced: boolean
}

export type GameBoySpeechSegment = {
  source: string
  phonemes: string[]
}

type GameBoySpeechOptions = {
  pitchPreset: GameBoyPitchPreset
  speed: number
  volume: number
}

type SpeakGameBoyOptions = {
  signal: AbortSignal
  cues?: TimedTalkCue[]
  onCue?: (cue: TimedTalkCue) => void
  onReady?: () => void
  onCharacter?: (character: string) => void
}

const phonemes: Record<string, GameBoyPhoneme> = {
  a: { kind: 'vowel', normalizedFrequency: 180, duration: 12, voiced: true },
  A: { kind: 'vowel', normalizedFrequency: 120, duration: 14, voiced: true },
  e: { kind: 'vowel', normalizedFrequency: 160, duration: 10, voiced: true },
  E: { kind: 'vowel', normalizedFrequency: 100, duration: 12, voiced: true },
  i: { kind: 'vowel', normalizedFrequency: 80, duration: 10, voiced: true },
  I: { kind: 'vowel', normalizedFrequency: 60, duration: 14, voiced: true },
  o: { kind: 'vowel', normalizedFrequency: 140, duration: 12, voiced: true },
  O: { kind: 'vowel', normalizedFrequency: 100, duration: 14, voiced: true },
  u: { kind: 'vowel', normalizedFrequency: 80, duration: 10, voiced: true },
  U: { kind: 'vowel', normalizedFrequency: 60, duration: 14, voiced: true },
  V: { kind: 'vowel', normalizedFrequency: 140, duration: 10, voiced: true },
  '@': { kind: 'vowel', normalizedFrequency: 160, duration: 8, voiced: true },
  Y: { kind: 'diphthong', normalizedFrequency: 120, duration: 16, voiced: true },
  W: { kind: 'diphthong', normalizedFrequency: 100, duration: 16, voiced: true },
  Q: { kind: 'diphthong', normalizedFrequency: 140, duration: 14, voiced: true },
  m: { kind: 'consonant', normalizedFrequency: 120, duration: 8, voiced: true },
  n: { kind: 'consonant', normalizedFrequency: 140, duration: 8, voiced: true },
  N: { kind: 'consonant', normalizedFrequency: 140, duration: 8, voiced: true },
  l: { kind: 'consonant', normalizedFrequency: 100, duration: 6, voiced: true },
  r: { kind: 'consonant', normalizedFrequency: 80, duration: 6, voiced: true },
  w: { kind: 'consonant', normalizedFrequency: 60, duration: 4, voiced: true },
  j: { kind: 'consonant', normalizedFrequency: 60, duration: 4, voiced: true },
  p: { kind: 'consonant', normalizedFrequency: 0, duration: 4, voiced: false },
  b: { kind: 'consonant', normalizedFrequency: 80, duration: 4, voiced: true },
  t: { kind: 'consonant', normalizedFrequency: 0, duration: 4, voiced: false },
  d: { kind: 'consonant', normalizedFrequency: 100, duration: 4, voiced: true },
  k: { kind: 'consonant', normalizedFrequency: 0, duration: 4, voiced: false },
  g: { kind: 'consonant', normalizedFrequency: 80, duration: 4, voiced: true },
  f: { kind: 'consonant', normalizedFrequency: 0, duration: 8, voiced: false },
  v: { kind: 'consonant', normalizedFrequency: 80, duration: 8, voiced: true },
  T: { kind: 'consonant', normalizedFrequency: 0, duration: 6, voiced: false },
  D: { kind: 'consonant', normalizedFrequency: 100, duration: 6, voiced: true },
  s: { kind: 'consonant', normalizedFrequency: 0, duration: 8, voiced: false },
  z: { kind: 'consonant', normalizedFrequency: 80, duration: 8, voiced: true },
  S: { kind: 'consonant', normalizedFrequency: 0, duration: 8, voiced: false },
  Z: { kind: 'consonant', normalizedFrequency: 80, duration: 8, voiced: true },
  h: { kind: 'consonant', normalizedFrequency: 60, duration: 4, voiced: false },
  C: { kind: 'consonant', normalizedFrequency: 0, duration: 10, voiced: false },
  J: { kind: 'consonant', normalizedFrequency: 80, duration: 10, voiced: true },
  ' ': { kind: 'silence', normalizedFrequency: 0, duration: 4, voiced: false },
  '.': { kind: 'silence', normalizedFrequency: 0, duration: 12, voiced: false },
  ',': { kind: 'silence', normalizedFrequency: 0, duration: 8, voiced: false },
  '!': { kind: 'silence', normalizedFrequency: 0, duration: 10, voiced: false },
  '?': { kind: 'silence', normalizedFrequency: 0, duration: 10, voiced: false },
}

type GraphemeRule = readonly [pattern: string, phonemes: string]

const lowerUpperTitle = (pattern: string, replacement: string): GraphemeRule[] => [
  [pattern, replacement],
  [pattern.toUpperCase(), replacement],
  [`${pattern[0].toUpperCase()}${pattern.slice(1)}`, replacement],
]

const lowerUpper = (pattern: string, replacement: string): GraphemeRule[] => [
  [pattern, replacement],
  [pattern.toUpperCase(), replacement],
]

const lowerTitle = (pattern: string, replacement: string): GraphemeRule[] => [
  [pattern, replacement],
  [`${pattern[0].toUpperCase()}${pattern.slice(1)}`, replacement],
]

// Keep the source order: the first matching rule wins.
const graphemeRules: GraphemeRule[] = [
  ...lowerUpperTitle('th', 'T'),
  ...lowerUpperTitle('sh', 'S'),
  ...lowerUpperTitle('ch', 'C'),
  ...lowerUpperTitle('ng', 'N'),
  ...lowerUpper('ck', 'k'),
  ...lowerUpperTitle('ph', 'f'),
  ...lowerUpperTitle('wh', 'w'),
  ...lowerUpperTitle('ee', 'I'),
  ...lowerUpperTitle('oo', 'U'),
  ...lowerUpperTitle('ou', 'W'),
  ...lowerUpperTitle('ow', 'W'),
  ...lowerUpperTitle('ai', 'Y'),
  ...lowerUpperTitle('ay', 'Y'),
  ...lowerUpperTitle('oi', 'Q'),
  ...lowerUpperTitle('oy', 'Q'),
  ...lowerUpperTitle('ea', 'E'),
  ...lowerUpperTitle('ie', 'I'),
  ...lowerUpperTitle('oa', 'O'),
  ...lowerUpperTitle('er', '@r'),
  ...lowerUpperTitle('ir', '@r'),
  ...lowerUpperTitle('ur', '@r'),
  ...lowerUpperTitle('ar', 'Ar'),
  ...lowerUpperTitle('or', 'Or'),
  ['ed', 'd'],
  ['es', 'z'],
  ['ly', 'lI'],
  ['ing', 'IN'],
  ['est', 'Ist'],
  ['tion', 'S@n'],
  ...lowerTitle('is', 'Iz'),
  ...lowerTitle('it', 'It'),
  ...lowerTitle('to', 'tU'),
  ...lowerTitle('of', 'Vf'),
  ...lowerTitle('she', 'SI'),
  ...lowerTitle('the', 'D@'),
  ...lowerTitle('how', 'hW'),
  ...lowerTitle('are', 'Ar'),
  ...lowerTitle('but', 'bVt'),
  ...lowerTitle('not', 'nt'),
  ...lowerTitle('all', 'Ol'),
  ...lowerTitle('can', 'kn'),
  ...lowerTitle('her', 'h@r'),
  ...lowerTitle('was', 'wz'),
  ...lowerTitle('one', 'wVn'),
  ...lowerTitle('our', 'Wr'),
  ...lowerTitle('out', 'Wt'),
  ...lowerTitle('and', 'nd'),
  ...lowerTitle('for', 'fOr'),
  ...lowerTitle('you', 'jU'),
  ...lowerTitle('bye', 'bY'),
  ...lowerTitle('that', 'Dt'),
  ...lowerTitle('this', 'Ds'),
  ...lowerTitle('with', 'wIT'),
  ...lowerTitle('have', 'hv'),
  ...lowerTitle('nice', 'nYs'),
  ...lowerTitle('meet', 'mIt'),
  ...lowerTitle('very', 'v@rI'),
  ...lowerTitle('much', 'mVC'),
  ...lowerTitle('good', 'gUd'),
  ...lowerTitle('game', 'gEm'),
  ...lowerTitle('hello', 'h@lO'),
  ...lowerTitle('world', 'w@rld'),
  ...lowerTitle('thank', 'TNk'),
  ...lowerTitle('welcome', 'w@lk@m'),
  ...lowerTitle('we', 'wI'),
  ...lowerTitle('he', 'hI'),
]

const normalizedCharacter = (character: string) => {
  if (character === 'œ' || character === 'Œ') return 'oe'
  if (character === 'æ' || character === 'Æ') return 'ae'
  return character.normalize('NFD').replace(/\p{M}/gu, '')
}

const fallbackPhonemes = (character: string) => {
  if (/\s/u.test(character)) return [' ']
  if (character === '.' || character === '…') return ['.']
  if (character === ',') return [',']
  if (character === '!' || character === '?') return [character]

  const normalized = normalizedCharacter(character)
  if (/^[A-Z]$/.test(normalized)) {
    return ['AEIOU'.includes(normalized) ? normalized : normalized.toLowerCase()]
  }
  if (/^[a-z]$/.test(normalized)) return [normalized]

  const codePoint = character.codePointAt(0) ?? 0
  const multilingualFallback = ['a', 'e', 'i', 'o', 'u', 'm', 'n', 'r']
  return [multilingualFallback[codePoint % multilingualFallback.length]]
}

export const textToGameBoySpeech = (text: string): GameBoySpeechSegment[] => {
  const characters = [...text]
  const segments: GameBoySpeechSegment[] = []

  for (let index = 0; index < characters.length;) {
    let match: (typeof graphemeRules)[number] | undefined
    let matchLength = 0
    for (const rule of graphemeRules) {
      const candidate = characters.slice(index, index + [...rule[0]].length).join('')
      if (normalizedCharacter(candidate) === rule[0]) {
        match = rule
        matchLength = [...rule[0]].length
        break
      }
    }

    if (match) {
      segments.push({
        source: characters.slice(index, index + matchLength).join(''),
        phonemes: [...match[1]],
      })
      index += matchLength
      continue
    }

    segments.push({ source: characters[index], phonemes: fallbackPhonemes(characters[index]) })
    index += 1
  }

  return segments
}

const getGameBoyPhonemeTicks = (phoneme: string, speed: number) => {
  const definition = phonemes[phoneme] ?? phonemes[' ']
  const effectiveSpeed = speed * 2.5
  return Math.max(2, Math.floor((definition.duration * 10) / (2 * effectiveSpeed)))
}

export const getGameBoyPhonemeDuration = (phoneme: string, speed: number) =>
  getGameBoyPhonemeTicks(phoneme, speed) / 60

type Intonation = 'statement' | 'question' | 'exclamation' | 'neutral'

const getIntonation = (text: string): Intonation => {
  const ending = text.trimEnd().at(-1)
  if (ending === '.') return 'statement'
  if (ending === '?') return 'question'
  if (ending === '!') return 'exclamation'
  return 'neutral'
}

const pitchJitter = [0, 4, 7, 5, 0, -5, -7, -4]

export const getGameBoyPitchTarget = (
  pitchBase: number,
  position: number,
  total: number,
  intonation: Intonation
) => {
  const safeTotal = Math.max(1, total)
  let offset = 20
  if (intonation === 'statement') offset = 40 - Math.trunc((position * 60) / safeTotal)
  if (intonation === 'question') {
    const half = Math.max(1, safeTotal >> 1)
    offset = position < half ? 10 : 10 + Math.trunc(((position - half) * 40) / half)
  }
  if (intonation === 'exclamation') offset = 60 - Math.trunc((position * 80) / safeTotal)
  return pitchBase + offset + pitchJitter[position % pitchJitter.length]
}

const normalizedToFrequency = (normalized: number) => 200 + Math.floor((normalized * 800) / 255)

const synthesizedFrequency = (pitch: number, formant: number, voiced: boolean) => {
  if (voiced) return (pitch >> 1) + (((formant >> 1) * pitch) >> 7)
  const reducedFormant = Math.floor(formant / 3)
  return (reducedFormant >> 1) + (((pitch >> 1) * reducedFormant) >> 7)
}

export const quantizeGameBoyFrequency = (frequency: number) => {
  const clamped = Math.min(2_000, Math.max(64, frequency))
  const register = Math.min(2_047, 2_048 - Math.floor(131_072 / clamped))
  return 131_072 / (2_048 - register)
}

const abortError = () => new DOMException('Game Boy speech stopped.', 'AbortError')

const gameBoyFrameDuration = 1 / 60

export type GameBoySpeechFrame = {
  audible: boolean
  frequency: number | null
}

export type GameBoySpeechTimeline = {
  frames: GameBoySpeechFrame[]
  segmentStartFrames: number[]
  segments: GameBoySpeechSegment[]
}

export const buildGameBoySpeechTimeline = (
  text: string,
  settings: Pick<GameBoySpeechOptions, 'pitchPreset' | 'speed'>
): GameBoySpeechTimeline => {
  const segments = textToGameBoySpeech(text)
  const totalLength = [...text].length
  const pitchBase = gameBoyPitchFrequencies[settings.pitchPreset]
  const intonation = getIntonation(text)
  const frames: GameBoySpeechFrame[] = []
  const segmentStartFrames: number[] = []
  let formantState = 500
  let pitchState = pitchBase
  let characterPosition = 0
  let previousFrame: GameBoySpeechFrame = { audible: false, frequency: null }

  for (const segment of segments) {
    segmentStartFrames.push(frames.length)
    for (const [phonemeIndex, symbol] of segment.phonemes.entries()) {
      // `SYNTH_PROCESSING` consumes one VSync while CH2 keeps its previous state.
      frames.push(previousFrame)

      const definition = phonemes[symbol] ?? phonemes[' ']
      const ticks = getGameBoyPhonemeTicks(symbol, settings.speed)
      const formantTarget = normalizedToFrequency(definition.normalizedFrequency)
      const pitchPosition = Math.floor(
        characterPosition + ([...segment.source].length * phonemeIndex) / segment.phonemes.length
      )
      const pitchTarget = getGameBoyPitchTarget(pitchBase, pitchPosition, totalLength, intonation)

      for (let tick = 0; tick < ticks; tick += 1) {
        formantState += (formantTarget - formantState) >> 2
        pitchState += (pitchTarget - pitchState) >> 1
        previousFrame = {
          audible: definition.kind !== 'silence',
          frequency:
            definition.kind === 'silence'
              ? previousFrame.frequency
              : quantizeGameBoyFrequency(
                  synthesizedFrequency(pitchState, formantState, definition.voiced)
                ),
        }
        frames.push(previousFrame)
      }
    }
    characterPosition += [...segment.source].length
  }

  // The original state machine spends one final processing frame before muting CH2.
  frames.push(previousFrame)
  return { frames, segmentStartFrames, segments }
}

const pulseWaves = new WeakMap<BaseAudioContext, PeriodicWave>()

const getGameBoyPulseWave = (context: BaseAudioContext) => {
  const existing = pulseWaves.get(context)
  if (existing) return existing

  const harmonics = 32
  const duty = 0.25
  const real = new Float32Array(harmonics)
  const imaginary = new Float32Array(harmonics)
  for (let harmonic = 1; harmonic < harmonics; harmonic += 1) {
    real[harmonic] = Math.sin(2 * Math.PI * harmonic * duty) / (Math.PI * harmonic)
    imaginary[harmonic] = -(1 - Math.cos(2 * Math.PI * harmonic * duty)) / (Math.PI * harmonic)
  }
  const wave = context.createPeriodicWave(real, imaginary, { disableNormalization: false })
  pulseWaves.set(context, wave)
  return wave
}

const playTimeline = (
  context: AudioContext,
  timeline: GameBoySpeechTimeline,
  volume: number,
  signal: AbortSignal,
  onSegment: (segmentIndex: number) => void
) => {
  if (signal.aborted) return Promise.reject(abortError())

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const start = context.currentTime + 0.02
  const end = start + timeline.frames.length * gameBoyFrameDuration
  const audibleGain = Math.max(0, volume * 0.18)
  oscillator.setPeriodicWave(getGameBoyPulseWave(context))
  oscillator.frequency.setValueAtTime(120, start)
  gain.gain.setValueAtTime(0, start)
  timeline.frames.forEach((frame, frameIndex) => {
    const time = start + frameIndex * gameBoyFrameDuration
    if (frame.frequency !== null) oscillator.frequency.setValueAtTime(frame.frequency, time)
    gain.gain.setValueAtTime(frame.audible ? audibleGain : 0, time)
  })
  gain.gain.setValueAtTime(0, end)
  oscillator.connect(gain)
  gain.connect(context.destination)

  return new Promise<void>((resolve, reject) => {
    const timers = timeline.segmentStartFrames.map((frame, segmentIndex) =>
      window.setTimeout(
        () => onSegment(segmentIndex),
        Math.max(0, (start - context.currentTime + frame * gameBoyFrameDuration) * 1000)
      )
    )
    const clearTimers = () => timers.forEach(timer => window.clearTimeout(timer))
    const stop = () => {
      clearTimers()
      oscillator.onended = null
      try {
        oscillator.stop()
      } catch {
        // The oscillator may have completed while the abort was handled.
      }
      reject(abortError())
    }
    signal.addEventListener('abort', stop, { once: true })
    oscillator.onended = () => {
      clearTimers()
      signal.removeEventListener('abort', stop)
      resolve()
    }
    oscillator.start(start)
    oscillator.stop(end)
  })
}

export async function speakGameBoySpeech(
  text: string,
  settings: GameBoySpeechOptions,
  { cues = [], signal, onCue, onReady, onCharacter }: SpeakGameBoyOptions
) {
  if (signal.aborted) throw abortError()

  const context = new AudioContext()
  const timeline = buildGameBoySpeechTimeline(text, settings)

  try {
    await context.resume()
    if (signal.aborted) throw abortError()
    onReady?.()

    let cueIndex = 0
    let emittedLength = 0
    await playTimeline(context, timeline, settings.volume, signal, segmentIndex => {
      const segment = timeline.segments[segmentIndex]
      const nextCueIndex = nextTalkCueIndex(cues, cueIndex, emittedLength, segment.source.length)
      while (cueIndex < nextCueIndex) onCue?.(cues[cueIndex++])
      onCharacter?.(segment.source)
      emittedLength += segment.source.length
    })

    while (cueIndex < cues.length) onCue?.(cues[cueIndex++])
  } finally {
    await context.close().catch(() => undefined)
  }
}
