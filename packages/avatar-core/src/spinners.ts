// Spinners. While it waits, an avatar can turn into a sign of what it is doing: its body
// gathers into a small disc, and marks are drawn around it. Each pattern is a rule that gives
// the marks and what the disc does at a time; none of them keeps anything from one moment to
// the next.
//
// Lengths are in body radii, from the middle of the view: across to the right, and down.

export const spinnerPatterns = [
  'dots',
  'orbit',
  'radar',
  'progress',
  'gather',
  'wave',
  'send',
  'receive',
  'dock',
  'ball',
  'pencil',
  'bang',
  'standby',
] as const
export type SpinnerPattern = (typeof spinnerPatterns)[number]

/** What a state asks the body to turn into, and the pattern that draws it. */
export const spinnerOfMode: Readonly<Record<string, SpinnerPattern>> = {
  thinking: 'dots',
  orbit: 'orbit',
  radar: 'radar',
  progress: 'progress',
  spawning: 'gather',
  dictating: 'wave',
  sending: 'send',
  receiving: 'receive',
  uploading: 'dock',
  bouncing: 'ball',
  writing: 'pencil',
  alerting: 'bang',
  'powering-down': 'standby',
}

/**
 * How long a pattern shows before the avatar comes back for a moment, in seconds. Patterns
 * that are not listed show for as long as they are asked for.
 */
export const spinnerShotSeconds: Partial<Record<SpinnerPattern, number>> = {
  progress: 2.5,
  gather: 2,
}
/** How long the avatar comes back between two shots of such a pattern. */
export const SPINNER_PAUSE_SECONDS = 1.5

export type SpinnerMark =
  | { kind: 'disc'; x: number; y: number; radius: number; opacity: number }
  | {
      kind: 'ring'
      x: number
      y: number
      radius: number
      width: number
      opacity: number
      /** The share of the ring that is drawn, clockwise from the top. A whole ring if absent. */
      share?: number
    }
  | { kind: 'line'; points: [number, number][]; width: number; opacity: number }
  | {
      /** A bar with round ends, wider at one end than at the other. */
      kind: 'bar'
      x: number
      y: number
      /** Width at the top, then at the bottom, and height. */
      top: number
      bottom: number
      height: number
      /** Turned by this angle, in degrees, about a point. */
      turn: number
      about: [number, number]
      scale: number
      opacity: number
    }

/** What the disc the body has become does. */
export type SpinnerCore = {
  /** The disc's radius. */
  radius: number
  /** Moved across and down. */
  x: number
  y: number
  /** Turned, in degrees. */
  turn: number
  opacity: number
  /** A drop with its tip down instead of a disc: the tip of a pencil. */
  drop: boolean
}

export type SpinnerDrawing = { core: SpinnerCore; marks: SpinnerMark[] }

// The patterns were drawn on a sheet where the body's radius is this long.
const UNIT = 114.2705
const units = (length: number) => length / UNIT

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value))
const out = (value: number) => 1 - (1 - value) ** 3
const back = (value: number) => 1 + 2.70158 * (value - 1) ** 3 + 1.70158 * (value - 1) ** 2
const fract = (value: number) => value - Math.floor(value)
const smoothstep = (value: number) => {
  const clamped = clamp(value)
  return clamped * clamped * (3 - 2 * clamped)
}
const inOut = (value: number) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2)

const coreRadii: Record<SpinnerPattern, number> = {
  dots: 22,
  orbit: 19,
  radar: 19,
  progress: 19,
  gather: 19,
  wave: 16,
  send: 20,
  receive: 20,
  dock: 20,
  ball: 18,
  pencil: 17,
  bang: 13,
  standby: 13,
}

/** A number from 0 to 1 that is always the same for the same whole number. */
const randomOf = (index: number) => {
  const seed = (index + 1831565813) | 0
  let value = Math.imul(seed ^ (seed >>> 15), seed | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

const PENCIL_PERIOD = 2.5
const PENCIL_WRITES = 0.68
const INK_STEPS = 48

/** Where the pencil's tip is at a share of its writing, across and down, with its wiggle. */
const writingAt = (share: number): [number, number, number] => {
  const wiggle = 3.2 * Math.sin(24 * share) * clamp(share / 0.08) * clamp((1 - share) / 0.08)
  return [-54 + 118 * smoothstep(share), 26, wiggle]
}

/**
 * What a pattern draws. `weight` is how much of the pattern is there, from 0 to 1; `time` is
 * how long it has been showing, and `shot` how long its current shot has, in seconds.
 */
export const drawSpinner = (
  pattern: SpinnerPattern,
  weight: number,
  time: number,
  shot: number
): SpinnerDrawing => {
  const core: SpinnerCore = {
    radius: units(coreRadii[pattern]),
    x: 0,
    y: 0,
    turn: 0,
    opacity: 1,
    drop: false,
  }
  const marks: SpinnerMark[] = []
  const shown = out(weight)
  const disc = (x: number, y: number, radius: number, opacity: number) => {
    if (opacity > 0.004 && radius > 0) {
      marks.push({ kind: 'disc', x: units(x), y: units(y), radius: units(radius), opacity })
    }
  }
  const ring = (radius: number, width: number, opacity: number, share?: number) => {
    if (opacity > 0.004 && width > 0) {
      marks.push({
        kind: 'ring',
        x: 0,
        y: 0,
        radius: units(radius),
        width: units(width),
        opacity,
        ...(share === undefined ? {} : { share }),
      })
    }
  }

  switch (pattern) {
    case 'dots': {
      // Three dots in a row, the middle one being the body: a wave runs along them.
      const phase = fract(time / 1.4 + 0.119)
      const swellOf = (slot: number) => {
        const apart = Math.abs(phase - slot / 3)
        return Math.exp(-(Math.min(apart, 1 - apart) ** 2) / 0.045)
      }
      const sides: [number, number, number][] = [
        [-1, 0, weight],
        [1, 2, clamp((weight - 0.12) / 0.88)],
      ]
      for (const [side, slot, arrived] of sides) {
        const swell = swellOf(slot)
        disc(
          side * 62 * back(arrived),
          -9 * swell * weight,
          22 * out(arrived) * (0.84 + 0.22 * swell) * 1.02,
          out(arrived) * (0.5 + 0.5 * swell)
        )
      }
      const swell = swellOf(1)
      core.radius *= 1 + (0.84 + 0.22 * swell - 1) * weight
      core.y = units(-9 * swell * weight) * weight
      core.opacity = 1 + (0.5 + 0.5 * swell - 1) * weight
      break
    }
    case 'orbit': {
      const reach = 52 * back(weight)
      for (let index = 0; index < 5; index += 1) {
        const angle = 1.7 * time + (index * Math.PI * 2) / 5
        const near = Math.cos(angle)
        disc(
          reach * Math.sin(angle),
          -0.42 * reach * near,
          Math.max(12 * (0.5 + 0.5 * clamp(near)) * shown, 0.3),
          clamp((near + 0.4) / 0.6, 0.18, 1) * shown
        )
      }
      break
    }
    case 'radar': {
      for (let index = 0; index < 3; index += 1) {
        const spread = fract(time / 1.3 + index / 3)
        ring(19 + (104 - 19) * spread, 3.4 * (1 - 0.55 * spread), shown * (1 - spread) * 0.9)
      }
      break
    }
    case 'progress': {
      const radius = 62 * back(weight)
      ring(radius, 5, 0.16 * shown)
      ring(radius, 5, shown, clamp(shot / 2.5 / 0.85))
      break
    }
    case 'gather': {
      for (let index = 0; index < 5; index += 1) {
        const arrived = clamp((shot / 2 - index * 0.09) / 0.62)
        if (arrived >= 1) continue
        const eased = out(arrived)
        const angle = 2.4 * index + 2.2 * arrived
        const distance = 96 * (1 - eased)
        disc(
          distance * Math.cos(angle),
          0.8 * distance * Math.sin(angle),
          9 * (0.5 + 0.5 * eased) * shown,
          shown * clamp(5 * arrived) * (1 - 0.25 * eased)
        )
      }
      break
    }
    case 'wave': {
      const milliseconds = 1000 * time
      for (const slot of [-2, -1, 1, 2]) {
        const far = Math.abs(slot)
        const arrived = clamp((weight - 0.1 * far) / (1 - 0.1 * far))
        const level =
          (0.42 +
            0.29 * Math.sin(0.0021 * milliseconds) * Math.sin(0.0034 * milliseconds) +
            0.29 * Math.sin(0.0013 * milliseconds + 1.7)) *
          (0.55 + 0.45 * Math.sin(0.012 * milliseconds - 1.05 * far))
        disc(
          44 * slot * back(arrived),
          -6 * clamp(level) * arrived,
          (7 + 9 * clamp(level, 0.08, 1)) * out(arrived),
          arrived
        )
      }
      break
    }
    case 'send': {
      const cycle = fract(time / 1.5)
      const towards: [number, number] = [0.74, -0.62]
      const flight = (delay: number) => {
        const started = clamp((cycle - 0.18 - delay) / 0.55)
        return started * started * (0.4 + 0.6 * started)
      }
      const packet = flight(0)
      disc(
        towards[0] * 108 * packet,
        towards[1] * 108 * packet,
        10 * (1 - 0.55 * packet) * shown,
        shown * (1 - packet * packet)
      )
      const streak = flight(0.26)
      if (cycle > 0.18 + 0.26) {
        disc(
          towards[0] * 108 * streak,
          towards[1] * 108 * streak,
          5 * (1 - 0.6 * streak),
          0.3 * shown * (1 - streak)
        )
      }
      const launched = clamp((cycle - 0.18) / 0.3)
      if (cycle > 0.18)
        ring(20 + 34 * out(launched), 2.8 * (1 - launched), 0.8 * shown * (1 - launched))
      if (cycle < 0.18) core.radius *= 1 - 0.06 * Math.sin((Math.PI * cycle) / 0.18) * weight
      else if (cycle < 0.42) {
        core.radius *= 1 + 0.05 * Math.sin((Math.PI * (cycle - 0.18)) / 0.24) * weight
      }
      break
    }
    case 'receive': {
      const turn = time / 1.7
      const cycle = fract(turn)
      const angle = -1.25 * Math.PI + randomOf(Math.floor(turn)) * 1.5 * Math.PI
      const coming = clamp(cycle / 0.6)
      const eased = out(coming)
      const distance = 108 * (1 - eased)
      const bow = 18 * Math.sin(Math.PI * coming) * (1 - 0.7 * eased)
      disc(
        Math.cos(angle) * distance - Math.sin(angle) * bow,
        Math.sin(angle) * distance + Math.cos(angle) * bow,
        3.5 + 6.5 * eased,
        shown * clamp(3.5 * coming) * (0.3 + 0.7 * eased)
      )
      const taken = clamp((cycle - 0.58) / 0.32)
      if (cycle > 0.58) ring(20 + 26 * out(taken), 2.8 * (1 - taken), 0.8 * shown * (1 - taken))
      core.radius *= 1 + 0.11 * Math.sin(Math.PI * clamp((cycle - 0.58) / 0.34)) * weight
      break
    }
    case 'dock': {
      for (let index = 0; index < 2; index += 1) {
        const arrived = clamp((time - (0.2 + 1.3 * index)) / 0.9)
        const eased = out(arrived)
        const fromX = -120 + 30 * index
        const fromY = 95
        const toX = 42 * Math.sin(1.1 * time + index * Math.PI)
        const toY = 21 * Math.cos(1.1 * time + index * Math.PI) + 2 * Math.sin(3 * time + index)
        disc(
          fromX + (toX - fromX) * eased,
          fromY + (toY - fromY) * eased,
          (7 + 3 * eased) * shown,
          shown * clamp(4 * arrived)
        )
      }
      break
    }
    case 'ball': {
      // The body falls, then bounces without end.
      const fall = 0.2719
      const height =
        time < fall
          ? 541.1 * time * time
          : 40 - 208 * fract((time - fall) / 0.62) * (1 - fract((time - fall) / 0.62))
      core.y = units(height) * weight
      break
    }
    case 'pencil': {
      // The body is the tip of a pencil that writes a line, then comes back to its start.
      const phase = fract(time / PENCIL_PERIOD)
      const sway = Math.sin(0.6 * time)
      let x: number
      let y: number
      let wiggle = 0
      let turn: number
      let inkFrom = 0
      let inkTo: number
      if (phase < PENCIL_WRITES) {
        const share = phase / PENCIL_WRITES
        ;[x, y, wiggle] = writingAt(share)
        turn = 17 + sway
        inkTo = share
      } else {
        const share = inOut((phase - PENCIL_WRITES) / (1 - PENCIL_WRITES))
        x = 64 - 118 * share
        y = 26 - 20 * Math.sin(Math.PI * share)
        turn = 17 - 2 * Math.sin(Math.PI * share) + sway
        inkTo = 1
        // The line is rubbed out from its start while the pencil comes back.
        inkFrom = clamp(((phase - PENCIL_WRITES) * PENCIL_PERIOD * 120) / 64)
      }
      core.drop = true
      core.x = units(x) * weight
      core.y = units(y + 0.5 * wiggle) * weight
      core.turn = turn * weight
      const points: [number, number][] = []
      for (let step = 0; step <= INK_STEPS; step += 1) {
        const share = inkFrom + ((inkTo - inkFrom) * step) / INK_STEPS
        const [inkX, inkY, inkWiggle] = writingAt(share)
        points.push([units(inkX), units(inkY + inkWiggle + 19)])
      }
      const ink = clamp(1.2 * weight)
      if (inkTo > inkFrom && ink > 0.004) {
        marks.push({ kind: 'line', points, width: units(6), opacity: ink })
      }
      // The shaft, behind the tip, along the pencil.
      const along = ((turn - 90) * Math.PI) / 180
      const shaft = clamp(1.6 * weight - 0.3)
      if (shaft > 0.004) {
        marks.push({
          kind: 'bar',
          x: core.x + units(68 * Math.cos(along)) * weight,
          y: core.y + units(68 * Math.sin(along)) * weight,
          top: units(30),
          bottom: units(30),
          height: units(88),
          turn: turn * weight,
          about: [
            core.x + units(68 * Math.cos(along)) * weight,
            core.y + units(68 * Math.sin(along)) * weight,
          ],
          scale: shown,
          opacity: shaft,
        })
      }
      break
    }
    case 'bang': {
      // An exclamation mark: the body is its dot, and its bar shakes.
      const since = time % 2.2
      const shake = Math.exp(-5.5 * since)
      core.y = units(58) * weight
      core.radius *= 1 + 0.04 * shake * weight
      const opacity = clamp(1.5 * weight - 0.2)
      if (opacity > 0.004) {
        marks.push({
          kind: 'bar',
          x: 0,
          // The bar comes down from above to stand over its dot.
          y: -units(22 + 70 * (1 - out(clamp(1.1 * weight)))),
          top: units(30),
          bottom: units(17),
          height: units(96),
          turn: 2.2 * Math.sin(42 * time) * shake,
          about: [0, -units(74)],
          scale: clamp(1.2 * weight),
          opacity,
        })
      }
      break
    }
    case 'standby': {
      const breath = 0.5 + 0.5 * Math.sin(1.6 * time)
      disc(0, 0, 26 + 7 * breath, shown * (0.06 + 0.1 * breath))
      core.opacity = 1 - (0.28 + 0.2 * Math.sin(1.6 * time)) * weight
      break
    }
  }
  return { core, marks }
}
