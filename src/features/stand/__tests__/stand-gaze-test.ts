import { describe, expect, it } from 'vitest'
import { RADIUS } from '@/features/avatar/geometry'
import { estimateVisitorPosition, solveStandGaze } from '../standGaze'

const face = { x: 0.6, y: 0.5, width: 0.2, frameAspectRatio: 4 / 3 }
const totalYaw = (gaze: ReturnType<typeof solveStandGaze>) =>
  gaze.headY + ((gaze.eyeX / RADIUS) * 180) / Math.PI

describe('distance-aware stand gaze', () => {
  it('keeps small lateral offsets subtle without double-counting head and eyes', () => {
    const gaze = solveStandGaze(face, false)
    expect(totalYaw(gaze)).toBeGreaterThan(0)
    expect(totalYaw(gaze)).toBeLessThan(4)
    expect(gaze.headY).toBeLessThan(3)
    expect(gaze.eyeX).toBeLessThan(2)
    expect(gaze.headX).toBeCloseTo(0)
    expect(gaze.eyeY).toBeCloseTo(0)
  })
  it('infers less distance from a larger face and attenuates close camera-space motion', () => {
    const near = solveStandGaze({ ...face, width: 0.4 }, false)
    const far = solveStandGaze({ ...face, width: 0.1 }, false)
    expect(near.distance * 4).toBeCloseTo(far.distance)
    expect(totalYaw(near)).toBeLessThan(totalYaw(far))
  })
  it('looks less sideways when the same physical lateral offset is farther away', () => {
    const near = { ...face, x: 0.7, width: 0.3 }
    const far = { ...face, x: 0.6, width: 0.15 }
    expect(estimateVisitorPosition(near).x).toBeCloseTo(estimateVisitorPosition(far).x)
    expect(totalYaw(solveStandGaze(near, false))).toBeGreaterThan(
      totalYaw(solveStandGaze(far, false))
    )
  })
  it('calibrates camera offset in space, keeping the center when depth changes', () => {
    const reference = { ...face, x: 0.56, y: 0.42 }
    const origin = estimateVisitorPosition(reference)
    const centered = solveStandGaze(reference, false, origin)
    expect(totalYaw(centered)).toBeCloseTo(0)
    expect(centered.headX).toBeCloseTo(0)
    const further = solveStandGaze({ ...reference, x: 0.53, y: 0.46, width: 0.1 }, false, origin)
    expect(totalYaw(further)).toBeCloseTo(0)
    expect(further.headX).toBeCloseTo(0)
    const shifted = solveStandGaze({ ...reference, x: 0.66 }, false, origin)
    const mirrored = solveStandGaze({ ...reference, x: 0.66 }, true, origin)
    expect(mirrored.headY).toBeCloseTo(-shifted.headY)
    expect(mirrored.eyeX).toBeCloseTo(-shifted.eyeX)
  })
  it('accounts for video aspect ratio when aiming vertically', () => {
    const wide = solveStandGaze({ ...face, y: 0.7, frameAspectRatio: 16 / 9 }, false)
    const square = solveStandGaze({ ...face, y: 0.7, frameAspectRatio: 1 }, false)
    expect(Math.abs(wide.headX)).toBeLessThan(Math.abs(square.headX))
    expect(wide.eyeY).toBeGreaterThan(0)
  })
  it('bounds extreme inputs and remains finite on invalid detections', () => {
    for (const input of [
      { x: 0, y: 0, width: 0 },
      { x: 1, y: 1, width: 1 },
      { x: NaN, y: Infinity, width: NaN, frameAspectRatio: 0 },
    ]) {
      const gaze = solveStandGaze(input, false)
      expect(Object.values(gaze).every(Number.isFinite)).toBe(true)
      expect(Math.abs(totalYaw(gaze))).toBeLessThanOrEqual(14.00001)
      expect(Math.abs(gaze.eyeX)).toBeLessThan(4.7)
      expect(Math.abs(gaze.eyeY)).toBeLessThan(3.8)
    }
  })
})
