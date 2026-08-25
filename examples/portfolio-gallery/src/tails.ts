import type { AvatarDefinition } from '@bible-strong/avatar-web'

import { buildDefinition, sf, tail, type CharacterConfig } from './builder'

// Ghosts whose tail is ONE smooth volume.
//
// A single cone node does the work. `bury` sinks its wide, rounded base past
// the head's centre so no edge can ever show, and `morph` bends the profile
// convex so it leaves the sphere tangentially — a straight-sided cone meets the
// curve at a sharp inflection and reads as a map pin instead of a tail. Body and
// tail share one fill, so the result is a single continuous silhouette: no chain
// of spheres, no seam.
//
// Colour comes from Design System 01. Seven roles per mode; light is the tonal
// inverse of dark (L*light = 100 - L*dark), so every ghost is generated twice
// from identical geometry and the contrast relationships mirror exactly.

export const MODES = {
  dark: {
    bg: '#0b0b0b',
    tile: '#323232',
    ink: '#d4d4d4',
    inkMuted: '#909090',
    accent: '#ffffff',
    border: '#ffffff1f',
    tint: '#80808050',
  },
  light: {
    bg: '#f6f6f6',
    tile: '#c4c4c4',
    ink: '#262626',
    inkMuted: '#5e5e5e',
    accent: '#000000',
    border: '#0000001f',
    tint: '#80808050',
  },
} as const

export type ModeName = keyof typeof MODES

// Which colour role paints the ghost's body. Each is a different rung of the
// system's contrast ladder, and each mirrors across modes.
export type BodyRole = 'accent' | 'ink' | 'inkMuted'

const ROLE_LABEL: Record<BodyRole, string> = {
  accent: 'accent',
  ink: 'ink',
  inkMuted: 'ink-muted',
}

const GHOST_EYE = { w: 24, h: 28, y: -20, spacing: 40 }
const HEAD = sf('sphere', 186, 186, 186, 1)

type Shape = {
  id: string
  name: string
  note: string
  role: BodyRole
  angleDeg: number
  protrude: number
  width: number
  bury: number
  tip: number
  morph: number
}

const shapes: Shape[] = [
  {
    id: 'drop',
    name: 'Drop',
    note: 'Straight down, even taper',
    role: 'accent',
    angleDeg: 90,
    protrude: 46,
    width: 128,
    bury: 26,
    tip: 0.5,
    morph: 1.35,
  },
  {
    id: 'lean',
    name: 'Lean',
    note: 'Angled down and to the right',
    role: 'accent',
    angleDeg: 62,
    protrude: 48,
    width: 124,
    bury: 26,
    tip: 0.45,
    morph: 1.3,
  },
  {
    id: 'sweep',
    name: 'Sweep',
    note: 'Shallow angle, reaches further out',
    role: 'ink',
    angleDeg: 32,
    protrude: 56,
    width: 116,
    bury: 30,
    tip: 0.4,
    morph: 1.3,
  },
  {
    id: 'mirror',
    name: 'Mirror',
    note: 'Lean, flipped to the left',
    role: 'ink',
    angleDeg: 118,
    protrude: 48,
    width: 124,
    bury: 26,
    tip: 0.45,
    morph: 1.3,
  },
  {
    id: 'stub',
    name: 'Stub',
    note: 'Short and broad, barely clears the head',
    role: 'inkMuted',
    angleDeg: 90,
    protrude: 36,
    width: 116,
    bury: 22,
    tip: 0.6,
    morph: 1.4,
  },
  {
    id: 'taper',
    name: 'Taper',
    note: 'Longest reach, narrowest tip',
    role: 'accent',
    angleDeg: 70,
    protrude: 60,
    width: 106,
    bury: 34,
    tip: 0.3,
    morph: 1.35,
  },
  {
    id: 'teardrop',
    name: 'Teardrop',
    note: 'Maximum morph — a pure rounded droplet',
    role: 'ink',
    angleDeg: 90,
    protrude: 50,
    width: 134,
    bury: 24,
    tip: 0.55,
    morph: 1.8,
  },
  {
    id: 'slant',
    name: 'Slant',
    note: 'Almost horizontal, as if drifting sideways',
    role: 'inkMuted',
    angleDeg: 14,
    protrude: 52,
    width: 118,
    bury: 28,
    tip: 0.42,
    morph: 1.3,
  },
  {
    id: 'hook',
    name: 'Hook',
    note: 'Steeper left angle, tucked under the head',
    role: 'ink',
    angleDeg: 130,
    protrude: 50,
    width: 120,
    bury: 28,
    tip: 0.4,
    morph: 1.3,
  },
  {
    id: 'wide',
    name: 'Wide',
    note: 'Broadest base, gentlest taper',
    role: 'accent',
    angleDeg: 90,
    protrude: 44,
    width: 150,
    bury: 22,
    tip: 0.6,
    morph: 1.5,
  },
]

export type GhostVariant = {
  mode: ModeName
  body: string
  eyes: string
  tile: string
  definition: AvatarDefinition
}

export type GhostPair = {
  id: string
  name: string
  note: string
  role: BodyRole
  roleLabel: string
  // Same geometry, one definition per mode.
  variants: GhostVariant[]
}

export const ghostPairs: GhostPair[] = shapes.map(shape => {
  const variants = (Object.keys(MODES) as ModeName[]).map((mode): GhostVariant => {
    const palette = MODES[mode]
    const body = palette[shape.role]
    const config: CharacterConfig = {
      id: `${shape.id}-${mode}`,
      name: shape.name,
      role: shape.note,
      surface: HEAD,
      body,
      // Eyes take the mode's background, so they read as cut-outs in both modes.
      eyes: palette.bg,
      eye: GHOST_EYE,
      nodes: [
        tail({
          angleDeg: shape.angleDeg,
          protrude: shape.protrude,
          width: shape.width,
          bury: shape.bury,
          tip: shape.tip,
          morph: shape.morph,
        }),
      ],
      signature: 'curious',
    }
    return {
      mode,
      body,
      eyes: palette.bg,
      tile: palette.tile,
      definition: buildDefinition(config),
    }
  })

  return {
    id: shape.id,
    name: shape.name,
    note: shape.note,
    role: shape.role,
    roleLabel: ROLE_LABEL[shape.role],
    variants,
  }
})
