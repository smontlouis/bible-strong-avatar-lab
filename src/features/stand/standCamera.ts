import type { StandObservation } from './standDirector'
import type { VisionRequest, VisionResponse } from './standVision.worker'

export type CameraStatus = 'loading' | 'running' | 'denied' | 'unavailable' | 'failed'

/** Owns one camera session, including pending permission requests and in-flight bitmaps. */
export function startStandCamera(
  video: HTMLVideoElement,
  observe: (observation: StandObservation) => void,
  status: (status: CameraStatus) => void
) {
  let disposed = false
  let stream: MediaStream | null = null
  let worker: Worker | null = null
  let frame = 0
  let busy = false
  let ready = false
  let previousFrame = -Infinity
  let previousVideoTime = -1
  let watchdog: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    disposed = true
    clearTimeout(watchdog)
    cancelAnimationFrame(frame)
    worker?.terminate()
    stream?.getTracks().forEach(track => track.stop())
    video.srcObject = null
  }
  const fail = (reason: CameraStatus) => {
    if (disposed) return
    stop()
    status(reason)
  }
  const armWatchdog = (timeout: number) => {
    clearTimeout(watchdog)
    watchdog = setTimeout(() => fail('failed'), timeout)
  }
  const tick = (at: number) => {
    if (disposed) return
    frame = requestAnimationFrame(tick)
    if (
      document.hidden ||
      !ready ||
      busy ||
      video.readyState < 2 ||
      at - previousFrame < 66 ||
      video.currentTime === previousVideoTime
    )
      return
    busy = true
    previousFrame = at
    previousVideoTime = video.currentTime
    armWatchdog(15000)
    void createImageBitmap(video)
      .then(image => {
        if (disposed) {
          image.close()
          return
        }
        try {
          worker!.postMessage({ type: 'frame', image, timestamp: at } satisfies VisionRequest, [
            image,
          ])
        } catch {
          image.close()
          fail('failed')
        }
      })
      .catch(() => fail('failed'))
  }
  const start = async () => {
    status('loading')
    if (!navigator.mediaDevices?.getUserMedia) {
      fail('unavailable')
      return
    }
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      })
      if (disposed) {
        acquired.getTracks().forEach(track => track.stop())
        return
      }
      stream = acquired
      stream
        .getVideoTracks()
        .forEach(track => track.addEventListener('ended', () => fail('unavailable')))
      video.srcObject = stream
      armWatchdog(60000)
      await video.play()
      if (disposed) return
      worker = new Worker(new URL('./standVision.worker.ts', import.meta.url), { type: 'module' })
      worker.addEventListener('error', () => fail('failed'))
      worker.addEventListener('message', (event: MessageEvent<VisionResponse>) => {
        if (disposed) return
        clearTimeout(watchdog)
        if (event.data.type === 'error') {
          fail('failed')
        } else if (event.data.type === 'ready') {
          ready = true
          status('running')
          frame = requestAnimationFrame(tick)
        } else {
          busy = false
          observe(event.data.observation)
        }
      })
      worker.postMessage({ type: 'initialize' } satisfies VisionRequest)
    } catch (error) {
      fail(
        error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable'
      )
    }
  }
  void start()
  return stop
}
