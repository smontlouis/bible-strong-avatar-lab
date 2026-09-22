import { describe, expect, it } from 'vitest'
import { cameraContentRect, freshObservation } from '../diagnosticProjection'
import { createStandDirector, type StandObservation } from '../standDirector'
import { solveStandGaze } from '../standGaze'

const observation: StandObservation = {
  timestamp: 100,
  faces: [{ x: 0.6, y: 0.5, width: 0.2, height: 0.3 }],
  hands: [],
}

describe('camera diagnostics', () => {
  it('aligns a wide camera feed and its landmarks with the same letterboxing', () => {
    expect(cameraContentRect(640, 480, 1280, 720)).toEqual({ x: 0, y: 60, width: 640, height: 360 })
    expect(cameraContentRect(640, 480, 480, 640)).toEqual({ x: 140, y: 0, width: 360, height: 480 })
    expect(cameraContentRect(640, 480, 640, 480)).toEqual({ x: 0, y: 0, width: 640, height: 480 })
  })
  it('hides stale data and stops showing measurements when the camera stops', () => {
    expect(freshObservation(observation, 200, true)).toBe(observation)
    expect(freshObservation(observation, 1200, true)).toBeNull()
    expect(freshObservation(observation, 200, false)).toBeNull()
    expect(freshObservation(null, 200, true)).toBeNull()
  })
  it('reports the exact selected visitor and the gaze solver used by playback', () => {
    const director = createStandDirector()
    director.observe(observation)
    const state = director.inspect(200, true)
    expect(state.target).toBe(observation.faces[0])
    expect(state.gaze).toEqual(solveStandGaze(observation.faces[0], true))
    expect(state.visible).toBe(true)
    expect(state.calibrated).toBe(false)
    director.calibrateGaze(200)
    expect(director.inspect(200, true).calibrated).toBe(true)
    expect(director.inspect(200, true).gaze?.headY).toBeCloseTo(0)
    expect(director.inspect(500, true).visible).toBe(false)
    expect(director.inspect(1600, true).target).toBeNull()
    expect(director.inspect(1600, true).gaze).toBeNull()
  })
})
