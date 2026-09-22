export type TalkVoiceSegment = {
  source: string
  startOffset: number
  endOffset: number
  startMs: number
  durationMs: number
}

export type PreparedTalkVoice = {
  samples: Float32Array
  sampleRate: number
  gainScale: number
  durationMs: number
  segments: TalkVoiceSegment[]
}

export type TalkTextRange = { from: number; to: number }

export type TalkSequenceLike = {
  playbackMode: 'loop' | 'once' | 'pingPong'
  steps: Array<{ holdMs: number; transitionMs: number }>
}

export const clampTalkTime = (timeline: Pick<PreparedTalkVoice, 'durationMs'>, timeMs: number) =>
  Math.min(Math.max(Number.isFinite(timeMs) ? timeMs : 0, 0), timeline.durationMs)

export const talkTextOffsetAtTime = (
  timeline: Pick<PreparedTalkVoice, 'durationMs' | 'segments'>,
  timeMs: number
) => {
  const time = clampTalkTime(timeline, timeMs)
  if (time >= timeline.durationMs) return timeline.segments.at(-1)?.endOffset ?? 0
  const segment = timeline.segments.find(
    item => time >= item.startMs && time < item.startMs + item.durationMs
  )
  if (!segment) return timeline.segments.find(item => item.startMs >= time)?.startOffset ?? 0
  if (segment.durationMs <= 0 || segment.endOffset <= segment.startOffset)
    return segment.startOffset
  const progress = (time - segment.startMs) / segment.durationMs
  return Math.min(
    segment.endOffset,
    segment.startOffset + Math.floor((segment.endOffset - segment.startOffset) * progress)
  )
}

export const talkHighlightOffsetAtTime = (
  timeline: Pick<PreparedTalkVoice, 'durationMs' | 'segments'>,
  timeMs: number
) => {
  const textOffset = talkTextOffsetAtTime(timeline, timeMs)
  return textOffset > 0 ? textOffset - 1 : 0
}

export const talkTimeAtTextOffset = (
  timeline: Pick<PreparedTalkVoice, 'durationMs' | 'segments'>,
  textOffset: number
) => {
  const offset = Math.max(0, textOffset)
  const segment = timeline.segments.find(
    item => offset >= item.startOffset && offset < item.endOffset
  )
  if (!segment) {
    const next = timeline.segments.find(item => item.startOffset >= offset)
    return next?.startMs ?? timeline.durationMs
  }
  const length = Math.max(1, segment.endOffset - segment.startOffset)
  return segment.startMs + ((offset - segment.startOffset) / length) * segment.durationMs
}

const talkWordPattern = /[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu

export const talkWordRangeAtOffset = (text: string, textOffset: number): TalkTextRange | null => {
  const matches = [...text.matchAll(talkWordPattern)]
  if (!matches.length) return null
  const offset = Math.min(Math.max(textOffset, 0), text.length)
  const containing = matches.find(match => {
    const from = match.index ?? 0
    return offset >= from && offset < from + match[0].length
  })
  const match = containing ?? matches.find(item => (item.index ?? 0) >= offset) ?? matches.at(-1)
  if (!match) return null
  const from = match.index ?? 0
  return { from, to: from + match[0].length }
}

export const formatTalkTime = (timeMs: number) => {
  const totalTenths = Math.max(0, Math.round(timeMs / 100))
  const minutes = Math.floor(totalTenths / 600)
  const seconds = Math.floor((totalTenths % 600) / 10)
  const tenths = totalTenths % 10
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}

export const talkSequenceStepIndexAtTime = (sequence: TalkSequenceLike, elapsedMs: number) => {
  if (!sequence.steps.length) return null
  const indexes = sequence.steps.map((_, index) => index)
  const playbackIndexes =
    sequence.playbackMode === 'pingPong' && indexes.length > 1
      ? [...indexes, ...indexes.slice(1, -1).reverse()]
      : indexes
  const durations = playbackIndexes.map(index => {
    const step = sequence.steps[index]
    return Math.max(1, step.transitionMs + step.holdMs)
  })
  const cycleDuration = durations.reduce((total, duration) => total + duration, 0)
  const time = Math.max(0, elapsedMs)
  const boundedTime =
    sequence.playbackMode === 'once'
      ? Math.min(time, Math.max(0, cycleDuration - 1))
      : time % cycleDuration
  let cursor = 0
  for (let index = 0; index < playbackIndexes.length; index += 1) {
    cursor += durations[index]
    if (boundedTime < cursor) return playbackIndexes[index]
  }
  return playbackIndexes.at(-1) ?? null
}
