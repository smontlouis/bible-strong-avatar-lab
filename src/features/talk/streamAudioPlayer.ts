import type { PreparedTalkVoice } from '@/features/talk/talkTimeline'

export class StreamTalkAudioPlayer {
  private context: AudioContext | null = null
  private scheduledUntil = 0
  private sources = new Set<AudioBufferSourceNode>()
  private frames = new Set<number>()

  async enqueue(
    timeline: PreparedTalkVoice,
    {
      signal,
      volume,
      onStart,
      onTime,
      onEnd,
    }: {
      signal: AbortSignal
      volume: number
      onStart: () => void
      onTime: (timeMs: number) => void
      onEnd: () => void
    }
  ) {
    if (signal.aborted) throw new DOMException('Stream stopped.', 'AbortError')
    const context = this.context ?? new AudioContext()
    this.context = context
    await context.resume()
    const buffer = context.createBuffer(1, timeline.samples.length, timeline.sampleRate)
    buffer.copyToChannel(new Float32Array(timeline.samples), 0)
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = volume * timeline.gainScale
    source.connect(gain)
    gain.connect(context.destination)
    const startsAt = Math.max(context.currentTime + 0.035, this.scheduledUntil)
    this.scheduledUntil = startsAt + timeline.durationMs / 1000
    this.sources.add(source)
    let started = false
    let frame = 0
    const tick = () => {
      this.frames.delete(frame)
      if (signal.aborted) return
      const elapsedMs = (context.currentTime - startsAt) * 1000
      if (elapsedMs >= 0 && !started) {
        started = true
        onStart()
      }
      if (elapsedMs >= 0) onTime(Math.min(elapsedMs, timeline.durationMs))
      if (elapsedMs < timeline.durationMs) {
        frame = requestAnimationFrame(tick)
        this.frames.add(frame)
      }
    }
    const finished = new Promise<void>((resolve, reject) => {
      const abort = () => {
        try {
          source.stop()
        } catch {
          // The source may already have ended.
        }
        reject(new DOMException('Stream stopped.', 'AbortError'))
      }
      signal.addEventListener('abort', abort, { once: true })
      source.onended = () => {
        signal.removeEventListener('abort', abort)
        this.sources.delete(source)
        cancelAnimationFrame(frame)
        this.frames.delete(frame)
        if (!signal.aborted) {
          onTime(timeline.durationMs)
          onEnd()
          resolve()
        }
      }
    })
    source.start(startsAt)
    frame = requestAnimationFrame(tick)
    this.frames.add(frame)
    return { finished }
  }

  stop() {
    this.sources.forEach(source => {
      try {
        source.stop()
      } catch {
        // The source may already have ended.
      }
    })
    this.sources.clear()
    this.frames.forEach(frame => cancelAnimationFrame(frame))
    this.frames.clear()
    this.scheduledUntil = 0
    void this.context?.close().catch(() => undefined)
    this.context = null
  }
}
