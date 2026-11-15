import type { ClipEase } from '@bible-strong/avatar-core'

// The curves offered for the passage from a key to the next. Each is a cubic Bézier from (0, 0)
// to (1, 1), as CSS writes them; the families are those of easings.net. Back overshoots: its
// curve leaves 0…1, and the value goes past its target before it settles.

export type EasePreset = { id: string; label: string; ease: ClipEase }

export const LINEAR_EASE: ClipEase = [0, 0, 1, 1]
/** What a new key starts with: the curve most of the catalogue's keys use. */
export const DEFAULT_EASE: ClipEase = [0.42, 0, 0.58, 1]

export const basicEases: EasePreset[] = [
  { id: 'linear', label: 'Linéaire', ease: LINEAR_EASE },
  { id: 'ease', label: 'Ease', ease: [0.25, 0.1, 0.25, 1] },
  { id: 'ease-in', label: 'Ease in', ease: [0.42, 0, 1, 1] },
  { id: 'ease-out', label: 'Ease out', ease: [0, 0, 0.58, 1] },
  { id: 'ease-in-out', label: 'Ease in-out', ease: DEFAULT_EASE },
]

export type EaseFamily = { name: string; in: ClipEase; out: ClipEase; inOut: ClipEase }

export const easeFamilies: EaseFamily[] = [
  { name: 'Sine', in: [0.12, 0, 0.39, 0], out: [0.61, 1, 0.88, 1], inOut: [0.37, 0, 0.63, 1] },
  { name: 'Quad', in: [0.11, 0, 0.5, 0], out: [0.5, 1, 0.89, 1], inOut: [0.45, 0, 0.55, 1] },
  { name: 'Cubic', in: [0.32, 0, 0.67, 0], out: [0.33, 1, 0.68, 1], inOut: [0.65, 0, 0.35, 1] },
  { name: 'Quart', in: [0.5, 0, 0.75, 0], out: [0.25, 1, 0.5, 1], inOut: [0.76, 0, 0.24, 1] },
  { name: 'Quint', in: [0.64, 0, 0.78, 0], out: [0.22, 1, 0.36, 1], inOut: [0.83, 0, 0.17, 1] },
  { name: 'Expo', in: [0.7, 0, 0.84, 0], out: [0.16, 1, 0.3, 1], inOut: [0.87, 0, 0.13, 1] },
  { name: 'Circ', in: [0.55, 0, 1, 0.45], out: [0, 0.55, 0.45, 1], inOut: [0.85, 0, 0.15, 1] },
  {
    name: 'Back',
    in: [0.36, 0, 0.66, -0.56],
    out: [0.34, 1.56, 0.64, 1],
    inOut: [0.68, -0.6, 0.32, 1.6],
  },
]

export const easeDirections = ['in', 'out', 'inOut'] as const
export type EaseDirection = (typeof easeDirections)[number]

export const easePresets: EasePreset[] = [
  ...basicEases,
  ...easeFamilies.flatMap(family =>
    easeDirections.map(direction => ({
      id: `${family.name.toLowerCase()}-${direction === 'inOut' ? 'in-out' : direction}`,
      label: `${family.name} ${direction === 'inOut' ? 'in-out' : direction}`,
      ease: family[direction],
    }))
  ),
]

const SAME = 1e-4

export const sameEase = (left: ClipEase, right: ClipEase) =>
  left.every((value, index) => Math.abs(value - right[index]) < SAME)

/** The preset a curve is, or `undefined` for a curve drawn by hand. */
export const presetOfEase = (ease: ClipEase) =>
  easePresets.find(preset => sameEase(preset.ease, ease))

/** The lowest and highest a curve's control points may be dragged to. */
export const EASE_Y_MIN = -1
export const EASE_Y_MAX = 2

/** A curve as it may be stored: its times within 0…1, its values within reason. */
export const boundedEase = (ease: readonly number[]): ClipEase => {
  const round = (value: number) => Math.round(value * 10000) / 10000
  const time = (value: number) => round(Math.max(0, Math.min(1, value)))
  const value = (amount: number) => round(Math.max(EASE_Y_MIN, Math.min(EASE_Y_MAX, amount)))
  return [time(ease[0]), value(ease[1]), time(ease[2]), value(ease[3])]
}
