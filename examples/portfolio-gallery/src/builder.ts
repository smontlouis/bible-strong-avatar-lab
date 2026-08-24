import type { AvatarDefinition } from '@bible-strong/avatar-web'

// Shared avatar builder. Every character is expanded into a complete,
// schema-valid `AvatarDefinition` and rendered through the real
// @bible-strong/avatar-web engine.

export type Surface = {
  type: 'sphere' | 'mickey' | 'cursor' | 'cube' | 'capsule' | 'cylinder' | 'cone' | 'diamond'
  width: number
  height: number
  depth: number
  roundness: number
  morphRoundness?: number
  tipRoundness?: number
  baseRoundness?: number
}

export type NodeSurface = {
  type: 'sphere' | 'cube' | 'capsule' | 'cylinder' | 'cone' | 'diamond'
  width: number
  height: number
  depth: number
  roundness: number
  tipRoundness?: number
  baseRoundness?: number
}

export type BodyNode = {
  surface: NodeSurface
  position: [number, number, number]
  rotation: [number, number, number]
}

export type EyeShape = { w: number; h: number; y: number; angle: number; spacing: number }

export type CharacterConfig = {
  id: string
  name: string
  role: string
  surface: Surface
  body: string
  eyes: string
  eye?: Partial<EyeShape>
  nodes?: BodyNode[]
  // Which emote is this character's hero, played on hover in the gallery.
  signature?: EmoteKey
}

export type EmoteKey =
  | 'idle'
  | 'hello'
  | 'curious'
  | 'look-around'
  | 'excited'
  | 'surprise'
  | 'sleepy'
  | 'shy'

// Ordered emote repertoire every character can perform. `idle` is the resting
// loop; the rest are triggerable one-shot or looping emotes.
export const EMOTES: EmoteKey[] = [
  'idle',
  'hello',
  'curious',
  'look-around',
  'excited',
  'surprise',
  'sleepy',
  'shy',
]

export const EMOTE_LABELS: Record<EmoteKey, string> = {
  idle: 'Idle',
  hello: 'Wave',
  curious: 'Curious',
  'look-around': 'Look around',
  excited: 'Excited',
  surprise: 'Surprise',
  sleepy: 'Sleepy',
  shy: 'Shy',
}

export type Character = {
  id: string
  name: string
  role: string
  accent: string
  signature: EmoteKey
  definition: AvatarDefinition
}

export const sf = (
  type: Surface['type'],
  width: number,
  height: number,
  depth: number,
  roundness: number,
  extra: Partial<Surface> = {}
): Surface => ({ type, width, height, depth, roundness, ...extra })

export const nd = (
  surface: NodeSurface,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
): BodyNode => ({ surface, position, rotation })

export const ns = (
  type: NodeSurface['type'],
  width: number,
  height: number,
  depth: number,
  roundness: number,
  extra: Partial<NodeSurface> = {}
): NodeSurface => ({ type, width, height, depth, roundness, ...extra })

// --- Reusable node presets -------------------------------------------------

export const ears = (size: number, x: number, y: number, z = 24): BodyNode[] => [
  nd(ns('sphere', size, size, size, 1), [-x, y, z]),
  nd(ns('sphere', size, size, size, 1), [x, y, z]),
]

export const antenna = (topY: number): BodyNode[] => [
  nd(ns('cylinder', 16, 74, 16, 0.5), [0, topY, 0]),
  nd(ns('sphere', 46, 46, 46, 1), [0, topY - 58, 6]),
]

// A single soft, fully-rounded sphere lobe — the building block of blobs.
// Same body colour as the primary surface, so overlaps read as one organic mass.
export const lobe = (size: number, x: number, y: number, z = 18): BodyNode =>
  nd(ns('sphere', size, size, size, 1), [x, y, z])

// A rounded capsule lump for drips, tails and stretched bulges.
export const pod = (
  w: number,
  h: number,
  x: number,
  y: number,
  z = 12,
  rot: [number, number, number] = [0, 0, 0]
): BodyNode => nd(ns('capsule', w, h, Math.min(w, h), 1), [x, y, z], rot)

// A tapering, curving chain of soft lobes — a ghost's tail.
//
// Lobes are sampled along a quadratic Bezier from `from` to `to`, with the
// control point pushed `bow` units perpendicular to the chord (sign flips the
// curve). Because every lobe carries the primary body colour, the chain merges
// into one continuous wisp that tapers from `startSize` down to `endSize`.
export const wisp = (opts: {
  from: [number, number]
  to: [number, number]
  bow?: number
  startSize: number
  endSize: number
  count?: number
  z?: number
}): BodyNode[] => {
  const { from, to, bow = 0, startSize, endSize, count = 10, z = -8 } = opts
  const [x0, y0] = from
  const [x1, y1] = to
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const cx = (x0 + x1) / 2 + (-dy / len) * bow
  const cy = (y0 + y1) / 2 + (dx / len) * bow

  const nodes: BodyNode[] = []
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1)
    const mt = 1 - t
    const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1
    const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1
    // Slightly eased taper: holds volume near the body, thins fast at the tip.
    const size = startSize + (endSize - startSize) * Math.pow(t, 0.85)
    nodes.push(lobe(Math.round(size), Math.round(x), Math.round(y), z))
  }
  return nodes
}

// --- Expression + animation generation ------------------------------------

type EyeValue = { width: number; height: number; x: number; y: number; angle: number }

const eye = (w: number, h: number, x: number, y: number, angle: number): EyeValue => ({
  width: w,
  height: h,
  x,
  y,
  angle,
})

type MotionKind = { eyes: 'none' | 'microSaccades' | 'shake'; body: 'none' | 'slowDrift' | 'shake' }

const expression = (
  head: [number, number, number],
  left: EyeValue,
  right: EyeValue,
  spacing: number,
  motion: MotionKind,
  perspective = 1
) => ({
  head: { x: head[0], y: head[1], z: head[2] },
  eyes: { left, right, spacing },
  perspective,
  motion,
})

const alive: MotionKind = { eyes: 'microSaccades', body: 'slowDrift' }
const still: MotionKind = { eyes: 'none', body: 'none' }

const clampH = (h: number) => Math.max(h, 9)

export const buildDefinition = (c: CharacterConfig): AvatarDefinition => {
  const e: EyeShape = { w: 20, h: 50, y: -7, angle: 0, spacing: 35, ...c.eye }
  const { w, h, y, spacing: sp } = e

  // Symmetric-eye helper: same shape mirrored left/right with an optional
  // horizontal look offset and roll angle.
  const look = (
    head: [number, number, number],
    ew: number,
    eh: number,
    ex: number,
    ey: number,
    angle: number,
    motion: MotionKind,
    perspective = 1
  ) =>
    expression(head, eye(ew, eh, ex, ey, angle), eye(ew, eh, ex, ey, angle), sp, motion, perspective)

  const expressions = {
    // resting + gaze
    neutral: look([0, 0, 0], w, h, 0, y, 0, alive),
    'glance-left': look([1.5, 17, -6], w, h, -3, y, 0, still),
    'glance-right': look([1.5, -17, -6], w, h, 3, y, 0, still),
    'look-up': look([-15, 0, 0], w, clampH(h * 1.05), 0, y - 6, 0, still),
    'look-down': look([15, 2, 0], w, clampH(h * 0.82), 0, y + 6, 0, still),
    // head-roll tilts (curiosity / dizziness)
    'tilt-left': look([2, 7, 15], w, h, -2, y, -9, still),
    'tilt-right': look([2, -7, -15], w, h, 2, y, 9, still),
    // affect
    wide: look([-9, 0, 0], w * 1.22, clampH(h * 1.28), 0, y - 4, 0, still, 1.14),
    squint: look([7, 0, 0], w * 1.06, clampH(h * 0.3), 0, y + 4, 0, {
      eyes: 'none',
      body: 'slowDrift',
    }),
    shy: look([13, 12, 5], w * 0.9, clampH(h * 0.62), 0, y + 6, 0, still, 0.94),
    happy: expression(
      [-4, 0, 0],
      eye(w * 1.05, clampH(h * 0.46), 0, y - 4, -17),
      eye(w * 1.05, clampH(h * 0.46), 0, y - 4, 17),
      sp,
      still
    ),
    'big-happy': expression(
      [-9, 0, 0],
      eye(w * 1.12, clampH(h * 0.4), 0, y - 6, -23),
      eye(w * 1.12, clampH(h * 0.4), 0, y - 6, 23),
      sp,
      { eyes: 'none', body: 'shake' }
    ),
  }

  const expressionOrder = [
    'neutral',
    'glance-left',
    'glance-right',
    'look-up',
    'look-down',
    'tilt-left',
    'tilt-right',
    'wide',
    'squint',
    'shy',
    'happy',
    'big-happy',
  ]

  const blink = {
    enabled: true,
    initialDelayMs: 1200,
    minIntervalMs: 2600,
    maxIntervalMs: 5400,
    durationMs: 140,
  }
  const fastBlink = { ...blink, initialDelayMs: 400, minIntervalMs: 900, maxIntervalMs: 1900, durationMs: 110 }
  const slowBlink = { ...blink, initialDelayMs: 300, minIntervalMs: 1400, maxIntervalMs: 2800, durationMs: 300 }

  type Trans = 'spring' | 'smooth' | 'snappy'
  const step = (expression: string, holdMs: number, transitionMs: number, transition: Trans) => ({
    expression,
    holdMs,
    transitionMs,
    transition,
  })

  const animations = {
    idle: {
      playbackMode: 'loop' as const,
      steps: [
        step('neutral', 2400, 520, 'smooth'),
        step('glance-left', 1400, 560, 'smooth'),
        step('neutral', 1500, 520, 'smooth'),
        step('glance-right', 1400, 560, 'smooth'),
        step('look-up', 1300, 560, 'smooth'),
        step('neutral', 1800, 520, 'smooth'),
        step('happy', 1100, 460, 'spring'),
      ],
      blink,
      metadata: { label: `${c.name} at rest`, group: 'ensemble' },
    },
    hello: {
      playbackMode: 'loop' as const,
      steps: [
        step('happy', 620, 220, 'snappy'),
        step('neutral', 380, 220, 'snappy'),
        step('big-happy', 700, 240, 'snappy'),
        step('neutral', 360, 220, 'snappy'),
      ],
      blink: fastBlink,
      metadata: { label: `${c.name} waves`, group: 'ensemble' },
    },
    curious: {
      playbackMode: 'loop' as const,
      steps: [
        step('tilt-left', 1200, 520, 'spring'),
        step('look-up', 1100, 560, 'smooth'),
        step('tilt-right', 1200, 520, 'spring'),
        step('neutral', 900, 520, 'smooth'),
      ],
      blink,
      metadata: { label: `${c.name} tilts and wonders`, group: 'ensemble' },
    },
    'look-around': {
      playbackMode: 'loop' as const,
      steps: [
        step('glance-left', 820, 480, 'smooth'),
        step('look-up', 760, 480, 'smooth'),
        step('glance-right', 820, 480, 'smooth'),
        step('look-down', 760, 480, 'smooth'),
        step('neutral', 900, 480, 'smooth'),
      ],
      blink,
      metadata: { label: `${c.name} scans the room`, group: 'ensemble' },
    },
    excited: {
      playbackMode: 'pingPong' as const,
      steps: [
        step('big-happy', 340, 180, 'snappy'),
        step('wide', 300, 180, 'snappy'),
        step('happy', 320, 180, 'snappy'),
      ],
      blink: fastBlink,
      metadata: { label: `${c.name} bounces with joy`, group: 'ensemble' },
    },
    surprise: {
      playbackMode: 'once' as const,
      steps: [
        step('wide', 820, 150, 'snappy'),
        step('neutral', 1200, 460, 'spring'),
      ],
      blink,
      metadata: { label: `${c.name} gasps`, group: 'ensemble' },
    },
    sleepy: {
      playbackMode: 'loop' as const,
      steps: [
        step('squint', 2600, 640, 'smooth'),
        step('neutral', 700, 640, 'smooth'),
        step('squint', 3000, 720, 'smooth'),
        step('look-down', 1400, 680, 'smooth'),
      ],
      blink: slowBlink,
      metadata: { label: `${c.name} drifts off`, group: 'ensemble' },
    },
    shy: {
      playbackMode: 'loop' as const,
      steps: [
        step('shy', 1600, 560, 'smooth'),
        step('glance-left', 1000, 520, 'smooth'),
        step('shy', 1800, 560, 'smooth'),
      ],
      blink,
      metadata: { label: `${c.name} looks away`, group: 'ensemble' },
    },
  }

  const animationOrder = [
    'idle',
    'hello',
    'curious',
    'look-around',
    'excited',
    'surprise',
    'sleepy',
    'shy',
  ]

  const definition = {
    schema: 'bible-strong/avatar-definition' as const,
    schemaVersion: 1 as const,
    name: c.name,
    body: { primary: c.surface, nodes: c.nodes ?? [] },
    colors: { body: c.body, eyes: c.eyes },
    expressions,
    expressionOrder,
    animations,
    animationOrder,
  }
  return definition as unknown as AvatarDefinition
}

export const buildEnsemble = (configs: CharacterConfig[]): Character[] =>
  configs.map(c => ({
    id: c.id,
    name: c.name,
    role: c.role,
    accent: c.body,
    signature: c.signature ?? 'hello',
    definition: buildDefinition(c),
  }))
