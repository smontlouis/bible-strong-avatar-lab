import {
  AnimaleseEngine,
  EnglishAnalyzer,
  JapaneseAnalyzer,
  PitchManager,
  WebSampler,
  type TextAnalyzer,
} from 'animalese-tts'

import { nextTalkCueIndex, type TimedTalkCue } from '@/features/talk/talkScript'
import { speakGameBoySpeech, type GameBoyPitchPreset } from '@/features/talk/gameBoySpeech'

export type AnimaleseLanguage = 'fr' | 'en' | 'ja'
export type AnimaleseVoiceBank = 'animalese' | 'rpg' | 'game-boy'
export type TalkPlaybackStatus = 'idle' | 'loading' | 'speaking' | 'error'

export type AnimaleseSettings = {
  language: AnimaleseLanguage
  voiceBank: AnimaleseVoiceBank
  gameBoyPitch: GameBoyPitchPreset
  pitch: number
  speed: number
  randomness: number
  melodyRate: number
  melodyAmplitude: number
  spaceDelay: number
  punctuationDelay: number
  maxRetries: number
  punctuations: string
  volume: number
}

export const defaultAnimaleseSettings: AnimaleseSettings = {
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
}

const animaleseAssetRoot = '/vendor/animalese'

export const getAnimaleseVoiceAssets = (language: AnimaleseLanguage) => {
  const assetName = language === 'ja' ? 'japanese' : 'english'

  return {
    mapUrl: `${animaleseAssetRoot}/${assetName}-sprite.json`,
    audioUrl: `${animaleseAssetRoot}/${assetName}-sprite.wav`,
  }
}

const normalizeFrenchCharacter = (character: string) => {
  if (character === 'œ' || character === 'Œ') return 'o'
  if (character === 'æ' || character === 'Æ') return 'a'
  return character.normalize('NFD').replace(/\p{M}/gu, '') || '\u0000'
}

export class FrenchAnalyzer implements TextAnalyzer {
  private readonly analyzer = new EnglishAnalyzer()

  analyze(text: string) {
    const normalizedText = text.split('').map(normalizeFrenchCharacter).join('')

    return this.analyzer.analyze(normalizedText)
  }
}

const createAnalyzer = (language: AnimaleseLanguage): TextAnalyzer => {
  if (language === 'fr') return new FrenchAnalyzer()
  if (language === 'ja') return new JapaneseAnalyzer()
  return new EnglishAnalyzer()
}

const abortError = () => new DOMException('Talk playback stopped.', 'AbortError')

const playBuffer = (
  context: AudioContext,
  bufferData: Float32Array,
  sampleRate: number,
  volume: number,
  signal: AbortSignal
) => {
  if (signal.aborted) return Promise.reject(abortError())
  if (bufferData.length === 0) return Promise.resolve()

  const audioBuffer = context.createBuffer(1, bufferData.length, sampleRate)
  audioBuffer.copyToChannel(new Float32Array(bufferData), 0)
  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = audioBuffer
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(context.destination)

  return new Promise<void>((resolve, reject) => {
    const stop = () => {
      source.onended = null
      try {
        source.stop()
      } catch {
        // The source may already have completed between the abort event and this callback.
      }
      reject(abortError())
    }
    signal.addEventListener('abort', stop, { once: true })
    source.onended = () => {
      signal.removeEventListener('abort', stop)
      resolve()
    }
    source.start()
  })
}

type SpeakVoiceOptions = {
  signal: AbortSignal
  cues?: TimedTalkCue[]
  onCue?: (cue: TimedTalkCue) => void
  onReady?: () => void
  onCharacter?: (character: string) => void
}

export async function speakAnimalese(
  text: string,
  settings: AnimaleseSettings,
  { cues = [], signal, onCue, onReady, onCharacter }: SpeakVoiceOptions
) {
  if (signal.aborted) throw abortError()

  const context = new AudioContext()
  try {
    await context.resume()
    const assets = getAnimaleseVoiceAssets(settings.language)
    const response = await fetch(assets.mapUrl, { signal })
    if (!response.ok) throw new Error(`Unable to load Animalese sprite map (${response.status}).`)
    const spriteMap = await response.json()
    const sampler = new WebSampler(assets.audioUrl, spriteMap, {
      maxRetries: settings.maxRetries,
      minSilenceDurationMs: 50,
    })
    const engine = new AnimaleseEngine({
      analyzer: createAnalyzer(settings.language),
      sampler,
      effect: new PitchManager({
        pitch: settings.pitch,
        speed: settings.speed,
        randomness: settings.randomness,
        melodyRate: settings.melodyRate,
        melodyAmplitude: settings.melodyAmplitude,
      }),
      spaceDelay: settings.spaceDelay,
      punctuationDelay: settings.punctuationDelay,
      punctuations: [...settings.punctuations],
    })
    const speaker = engine.synthesize(text)
    await engine.load()
    if (signal.aborted) throw abortError()
    onReady?.()

    let cueIndex = 0
    let emittedLength = 0
    for await (const output of speaker.speak()) {
      if (signal.aborted) throw abortError()
      const nextLength = emittedLength + output.char.length
      const nextCueIndex = nextTalkCueIndex(cues, cueIndex, emittedLength, output.char.length)
      while (cueIndex < nextCueIndex) onCue?.(cues[cueIndex++])
      onCharacter?.(output.char)
      await playBuffer(
        context,
        output.buffer as Float32Array,
        sampler.sampleRate ?? 44_100,
        settings.volume,
        signal
      )
      emittedLength = nextLength
    }
    while (cueIndex < cues.length) {
      onCue?.(cues[cueIndex])
      cueIndex += 1
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}

const waitForRpgCharacter = (durationSeconds: number, signal: AbortSignal) => {
  if (signal.aborted) return Promise.reject(abortError())

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener('abort', stop)
      resolve()
    }, durationSeconds * 1000)
    const stop = () => {
      window.clearTimeout(timeout)
      reject(abortError())
    }
    signal.addEventListener('abort', stop, { once: true })
  })
}

const characterHash = (character: string) =>
  [...character].reduce((hash, value) => (hash * 31 + (value.codePointAt(0) ?? 0)) >>> 0, 17)

export const getRpgBlipFrequency = (
  character: string,
  characterIndex: number,
  settings: Pick<AnimaleseSettings, 'pitch' | 'randomness' | 'melodyRate' | 'melodyAmplitude'>
) => {
  const hash = characterHash(character)
  const noteOffsets = [-5, -2, 0, 3, 5]
  const note = noteOffsets[hash % noteOffsets.length]
  const deterministicVariation = ((hash % 101) / 100 - 0.5) * settings.randomness * 5
  const melody =
    Math.sin(characterIndex * settings.melodyRate * Math.PI * 2) * settings.melodyAmplitude * 5

  return 220 * settings.pitch * 2 ** ((note + deterministicVariation + melody) / 12)
}

export const getRpgBlipDuration = (speed: number) => Math.min(0.09, Math.max(0.025, 0.11 / speed))

const playRpgBlip = (
  context: AudioContext,
  frequency: number,
  durationSeconds: number,
  volume: number,
  signal: AbortSignal
) => {
  if (signal.aborted) return Promise.reject(abortError())

  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const startTime = context.currentTime
  const endTime = startTime + durationSeconds
  oscillator.type = 'square'
  oscillator.frequency.value = frequency
  filter.type = 'lowpass'
  filter.frequency.value = 1_800
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.36), startTime + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime)
  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)

  return new Promise<void>((resolve, reject) => {
    const stop = () => {
      oscillator.onended = null
      try {
        oscillator.stop()
      } catch {
        // The oscillator may already have ended while handling the abort.
      }
      reject(abortError())
    }
    signal.addEventListener('abort', stop, { once: true })
    oscillator.onended = () => {
      signal.removeEventListener('abort', stop)
      resolve()
    }
    oscillator.start(startTime)
    oscillator.stop(endTime)
  })
}

export async function speakRpgBlips(
  text: string,
  settings: AnimaleseSettings,
  { cues = [], signal, onCue, onReady, onCharacter }: SpeakVoiceOptions
) {
  if (signal.aborted) throw abortError()

  const context = new AudioContext()
  try {
    await context.resume()
    if (signal.aborted) throw abortError()
    onReady?.()

    let cueIndex = 0
    let emittedLength = 0
    let audibleCharacterIndex = 0
    for (const character of text) {
      if (signal.aborted) throw abortError()
      const nextCueIndex = nextTalkCueIndex(cues, cueIndex, emittedLength, character.length)
      while (cueIndex < nextCueIndex) onCue?.(cues[cueIndex++])
      onCharacter?.(character)

      if (/\s/u.test(character)) {
        await waitForRpgCharacter(settings.spaceDelay, signal)
      } else if (settings.punctuations.includes(character)) {
        await waitForRpgCharacter(settings.punctuationDelay, signal)
      } else {
        const duration = getRpgBlipDuration(settings.speed)
        await playRpgBlip(
          context,
          getRpgBlipFrequency(character, audibleCharacterIndex, settings),
          duration,
          settings.volume,
          signal
        )
        audibleCharacterIndex += 1
      }
      emittedLength += character.length
    }

    while (cueIndex < cues.length) onCue?.(cues[cueIndex++])
  } finally {
    await context.close().catch(() => undefined)
  }
}

export const speakTalkVoice = (
  text: string,
  settings: AnimaleseSettings,
  options: SpeakVoiceOptions
) => {
  if (settings.voiceBank === 'game-boy') {
    return speakGameBoySpeech(
      text,
      {
        pitchPreset: settings.gameBoyPitch,
        speed: settings.speed,
        volume: settings.volume,
      },
      options
    )
  }
  if (settings.voiceBank === 'rpg') return speakRpgBlips(text, settings, options)
  return speakAnimalese(text, settings, options)
}
