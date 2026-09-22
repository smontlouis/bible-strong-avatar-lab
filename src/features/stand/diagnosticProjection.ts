import type { StandObservation } from './standDirector'

// Same contain-fit transform for video and overlays, including letterboxing.
export function cameraContentRect(
  width: number,
  height: number,
  frameWidth: number,
  frameHeight: number
) {
  const scale = Math.min(width / Math.max(1, frameWidth), height / Math.max(1, frameHeight))
  const w = frameWidth * scale,
    h = frameHeight * scale
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h }
}

export function freshObservation(
  observation: StandObservation | null,
  now: number,
  running: boolean
) {
  return running && observation && now - observation.timestamp <= 1000 ? observation : null
}
