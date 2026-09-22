export type StreamBeatStatus =
  'receiving' | 'directing' | 'synthesizing' | 'queued' | 'playing' | 'played' | 'error'

export const tokenizeSimulatedStream = (text: string) => text.match(/\S+\s*/gu) ?? []

export const shouldCompleteStreamBeat = (text: string) => {
  const tokens = text.trim().split(/\s+/u).filter(Boolean)
  const last = tokens.at(-1) ?? ''
  return /[.!?…;:]$/u.test(last) || tokens.length >= 8 || (tokens.length >= 4 && /,$/u.test(last))
}

export const waitForStreamToken = (durationMs: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Stream stopped.', 'AbortError'))
      return
    }
    const finish = () => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    const timeout = window.setTimeout(finish, durationMs)
    const abort = () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Stream stopped.', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
  })
