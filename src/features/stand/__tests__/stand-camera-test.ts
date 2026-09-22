// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startStandCamera } from '../standCamera'

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

describe('stand camera lifetime', () => {
  let stopTrack: ReturnType<typeof vi.fn>
  let track: EventTarget & { stop: ReturnType<typeof vi.fn> }
  let stream: MediaStream
  let video: HTMLVideoElement
  let getUserMedia: ReturnType<typeof vi.fn>
  let worker: EventTarget & {
    postMessage: ReturnType<typeof vi.fn>
    terminate: ReturnType<typeof vi.fn>
  }
  let tick: FrameRequestCallback

  beforeEach(() => {
    vi.useFakeTimers()
    stopTrack = vi.fn()
    track = Object.assign(new EventTarget(), { stop: stopTrack })
    stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
    getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    worker = Object.assign(new EventTarget(), { postMessage: vi.fn(), terminate: vi.fn() })
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker
        }
      }
    )
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        tick = callback
        return 1
      })
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    video = document.createElement('video')
    video.play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(video, 'readyState', { value: 4 })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stops a stream granted after the mode was already closed', async () => {
    let grant!: (stream: MediaStream) => void
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>(resolve => {
        grant = resolve
      })
    )
    const status = vi.fn()
    const stop = startStandCamera(video, vi.fn(), status)
    stop()
    grant(stream)
    await flush()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
    expect(status.mock.calls).toEqual([['loading']])
  })

  it('terminates inference and closes the camera on exit', async () => {
    const stop = startStandCamera(video, vi.fn(), vi.fn())
    await flush()
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'initialize' })
    stop()
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports permission denial without starting a worker', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    const status = vi.fn()
    startStandCamera(video, vi.fn(), status)
    await flush()
    expect(status).toHaveBeenLastCalledWith('denied')
    expect(worker.postMessage).not.toHaveBeenCalled()
  })

  it('cleans up after model initialization times out', async () => {
    const status = vi.fn()
    startStandCamera(video, vi.fn(), status)
    await flush()
    vi.advanceTimersByTime(60000)
    expect(status).toHaveBeenLastCalledWith('failed')
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('closes an in-flight bitmap if the session ends before it resolves', async () => {
    let resolveImage!: (image: ImageBitmap) => void
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(
        () =>
          new Promise<ImageBitmap>(resolve => {
            resolveImage = resolve
          })
      )
    )
    const stop = startStandCamera(video, vi.fn(), vi.fn())
    await flush()
    worker.dispatchEvent(new MessageEvent('message', { data: { type: 'ready' } }))
    tick(100)
    stop()
    const image = { close: vi.fn() } as unknown as ImageBitmap
    resolveImage(image)
    await flush()
    expect(image.close).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
  })

  it('allows only one frame in flight and stops on camera disconnection', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const status = vi.fn()
    startStandCamera(video, vi.fn(), status)
    await flush()
    worker.dispatchEvent(new MessageEvent('message', { data: { type: 'ready' } }))
    tick(100)
    await flush()
    video.currentTime = 1
    tick(200)
    expect(createImageBitmap).toHaveBeenCalledTimes(1)
    track.dispatchEvent(new Event('ended'))
    expect(status).toHaveBeenLastCalledWith('unavailable')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
