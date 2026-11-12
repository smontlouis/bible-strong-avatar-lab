import { describe, expect, it } from 'vitest'
import { defaultExpression } from '@/features/avatar/presets'
import { poseFromExpression, renderAvatar } from '@/features/avatar/geometry'
import { surfacePresets } from '@/features/avatar/surfaces'
import {
  createStandDirector,
  createWaveDetector,
  type ObservedHand,
  type Visitor,
} from '../standDirector'

const visitor: Visitor = { x: 0.5, y: 0.4, width: 0.18, height: 0.24 }
const settings = { mirror: false, proximity: 2.2, reducedMotion: false }
const hand = (x: number): ObservedHand => ({ x, y: 0.35, side: 'Left', open: true })
const sample = (director: ReturnType<typeof createStandDirector>, at: number) =>
  director.sample(at, defaultExpression, settings)
const waveAt = (director: ReturnType<typeof createStandDirector>, start: number) => {
  ;[0.57, 0.64, 0.7, 0.63, 0.57, 0.64, 0.7].forEach((x, index) => {
    director.observe({ timestamp: start + index * 100, faces: [visitor], hands: [hand(x)] })
  })
}

describe('stand attention and personality', () => {
  it('calibrates only a currently tracked visitor and keeps that reference across visitors', () => {
    const director = createStandDirector()
    expect(director.calibrateGaze(0)).toBe(false)
    const reference = { ...visitor, x: 0.6, y: 0.45 }
    director.observe({ timestamp: 100, faces: [reference], hands: [] })
    expect(director.calibrateGaze(150)).toBe(true)
    expect(sample(director, 150).expression.headY).toBeCloseTo(0)
    expect(sample(director, 150).expression.headX).toBeCloseTo(0)
    expect(director.calibrateGaze(800)).toBe(false)
    director.observe({ timestamp: 2000, faces: [reference], hands: [] })
    expect(sample(director, 2000).expression.headY).toBeCloseTo(0)
  })
  it('produces finite geometry while idle and before the first greeting', () => {
    const director = createStandDirector()
    for (const at of [0, 80, 4300, 8600]) {
      const pose = sample(director, at)
      expect(
        [
          pose.x,
          pose.y,
          pose.scale,
          ...Object.values(pose.expression).filter(value => typeof value === 'number'),
        ].every(Number.isFinite)
      ).toBe(true)
      const geometry = renderAvatar(
        poseFromExpression(pose.expression),
        surfacePresets.sphere,
        pose.blink
      )
      expect(JSON.stringify(geometry)).not.toContain('NaN')
    }
    director.observe({ timestamp: 9000, faces: [visitor], hands: [] })
    expect(Number.isFinite(sample(director, 9050).expression.headZ)).toBe(true)
  })
  it('starts wary, becomes curious, then playful after a real wave', () => {
    const director = createStandDirector()
    expect(sample(director, 0).mood).toBe('idle')
    for (let at = 100; at <= 3200; at += 100)
      director.observe({ timestamp: at, faces: [visitor], hands: [] })
    expect(sample(director, 3200).mood).toBe('curious')
    waveAt(director, 3300)
    expect(sample(director, 3900).mood).toBe('greeting')
    for (let at = 4000; at <= 6000; at += 100)
      director.observe({ timestamp: at, faces: [visitor], hands: [] })
    expect(sample(director, 6000).mood).toBe('playful')
  })

  it('keeps attention despite detection order and a larger newcomer', () => {
    const director = createStandDirector()
    const left = { ...visitor, x: 0.25 }
    const right = { ...visitor, x: 0.8, width: 0.35 }
    director.observe({ timestamp: 100, faces: [left], hands: [] })
    director.observe({ timestamp: 200, faces: [right, left], hands: [] })
    expect(sample(director, 200).expression.headY).toBeLessThan(0)
    director.observe({ timestamp: 300, faces: [right], hands: [] })
    expect(sample(director, 300).expression.headY).toBeLessThan(0)
    director.observe({ timestamp: 1800, faces: [right], hands: [] })
    expect(sample(director, 1800).expression.headY).toBeGreaterThan(0)
    expect(sample(director, 1800).mood).toBe('wary')
  })

  it('holds through brief occlusion and resets friendship for the next visitor', () => {
    const director = createStandDirector()
    waveAt(director, 100)
    director.observe({ timestamp: 800, faces: [], hands: [] })
    expect(sample(director, 1000).mood).toBe('greeting')
    // The friend walked away: a goodbye wave, then the attract loop.
    expect(sample(director, 2400).cue).toBe('farewell')
    expect(sample(director, 2400).mood).toBe('greeting')
    expect(sample(director, 4700).mood).toBe('idle')
    expect(sample(director, 4700).cue).toBe('idle')
    director.observe({ timestamp: 4800, faces: [visitor], hands: [] })
    expect(sample(director, 4800).mood).toBe('wary')
  })

  it('does not wave goodbye to a visitor who never broke the ice', () => {
    const director = createStandDirector()
    director.observe({ timestamp: 100, faces: [visitor], hands: [] })
    sample(director, 100)
    expect(sample(director, 2000).cue).toBe('idle')
    expect(sample(director, 2000).mood).toBe('idle')
  })

  it('shows wave progress before the greeting fires', () => {
    const director = createStandDirector()
    for (let at = 100; at <= 2600; at += 250)
      director.observe({ timestamp: at, faces: [visitor], hands: [] })
    ;[0.57, 0.64, 0.7, 0.63].forEach((x, index) => {
      director.observe({ timestamp: 2700 + index * 100, faces: [visitor], hands: [hand(x)] })
    })
    const frame = sample(director, 3000)
    expect(frame.cue).toBe('wave')
    expect(frame.progress).toBeGreaterThan(0.3)
    expect(frame.progress).toBeLessThan(1)
    expect(sample(director, 3600).progress).toBe(0)
  })

  it('exposes the discovered gestures and presence for the stand interface', () => {
    const director = createStandDirector()
    waveAt(director, 100)
    const frame = sample(director, 800)
    expect(frame.present).toBe(true)
    expect(frame.friendly).toBe(true)
    expect(frame.discovered).toEqual(['wave'])
    expect(frame.visitorId).toBe(1)
  })

  it('ignores a wave beside another visitor', () => {
    const director = createStandDirector()
    const other = { ...visitor, x: 0.85, width: 0.12 }
    ;[0.76, 0.84, 0.92, 0.84, 0.76, 0.84, 0.92].forEach((x, index) => {
      director.observe({ timestamp: 100 + index * 100, faces: [visitor, other], hands: [hand(x)] })
    })
    expect(sample(director, 700).mood).toBe('wary')
  })

  it('does not restart the greeting during its cooldown', () => {
    const director = createStandDirector()
    waveAt(director, 100)
    waveAt(director, 800)
    for (let at = 1500; at <= 3000; at += 100)
      director.observe({ timestamp: at, faces: [visitor], hands: [] })
    expect(sample(director, 3000).mood).toBe('playful')
    for (let at = 3100; at <= 5500; at += 100)
      director.observe({ timestamp: at, faces: [visitor], hands: [] })
    waveAt(director, 5600)
    expect(sample(director, 6200).mood).toBe('greeting')
  })

  it('approaches smoothly in bounded range and supports mirror and reduced motion', () => {
    const director = createStandDirector()
    director.observe({ timestamp: 100, faces: [{ ...visitor, x: 0.7, width: 0.5 }], hands: [] })
    const pose = sample(director, 200)
    const mirrored = director.sample(200, defaultExpression, {
      ...settings,
      mirror: true,
      reducedMotion: true,
    })
    expect(pose.scale).toBeGreaterThan(1.08)
    expect(pose.scale).toBeLessThanOrEqual(1.14)
    expect(mirrored.expression.headY).toBe(-pose.expression.headY)
    expect(mirrored.x).toBeCloseTo(0)
    expect(mirrored.y).toBeCloseTo(0)
    expect(defaultExpression.headY).toBe(0)
  })

  it('ignores stale frames', () => {
    const director = createStandDirector()
    director.observe({ timestamp: 200, faces: [visitor], hands: [] })
    director.observe({ timestamp: 100, faces: [{ ...visitor, x: 0.9 }], hands: [] })
    expect(sample(director, 300).expression.headY).toBe(0)
  })

  it('already leans in at two metres and grows gently as the visitor approaches', () => {
    const scales = [2, 1.5, 1, 0.65].map(metres => {
      const director = createStandDirector()
      const distant = { ...visitor, width: 0.16 / (2 * Math.tan(Math.PI / 6)) / metres }
      for (let at = 100; at <= 4000; at += 100)
        director.observe({ timestamp: at, faces: [distant], hands: [] })
      return sample(director, 4000).scale
    })
    expect(scales[0]).toBeGreaterThan(1)
    expect(scales).toEqual([...scales].sort((a, b) => a - b))
    expect(scales.at(-1)).toBeCloseTo(1.14)
  })

  it('only responds to facial signals and thumbs-up from the tracked visitor', () => {
    const director = createStandDirector()
    const other = {
      ...visitor,
      x: 0.85,
      width: 0.12,
      signals: { mouthSmileLeft: 0.9, mouthSmileRight: 0.9 },
    }
    for (let at = 100; at <= 1000; at += 100)
      director.observe({
        timestamp: at,
        faces: [visitor, other],
        hands: [{ ...hand(0.82), open: false, gesture: 'Thumb_Up', confidence: 0.95 }],
      })
    expect(sample(director, 1000).mood).toBe('wary')
    for (let at = 1100; at <= 1800; at += 100)
      director.observe({
        timestamp: at,
        faces: [visitor, other],
        hands: [{ ...hand(0.55), y: 0.65, open: false, gesture: 'Thumb_Up', confidence: 0.95 }],
      })
    expect(sample(director, 1800).cue).toBe('thumbs-up-reply')
  })
})

describe('temporal wave detection', () => {
  it('rejects a stationary palm, jitter and a single sweep', () => {
    for (const positions of [
      Array(20).fill(0.5),
      [0.5, 0.51, 0.49, 0.5, 0.51, 0.49],
      [0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
    ]) {
      const detector = createWaveDetector()
      positions.forEach((x, index) =>
        expect(detector.observe(hand(x), index * 100, 0.04)).toBe(false)
      )
    }
  })
  it('does not stitch movements across a tracking gap or two hands', () => {
    const detector = createWaveDetector()
    ;[0.5, 0.6, 0.5].forEach((x, index) => detector.observe(hand(x), index * 100, 0.04))
    expect(detector.observe(hand(0.6), 900, 0.04)).toBe(false)
    expect(detector.observe({ ...hand(0.5), side: 'Right' }, 1000, 0.04)).toBe(false)
    expect(detector.observe(hand(0.6), 1100, 0.04)).toBe(false)
  })
})
