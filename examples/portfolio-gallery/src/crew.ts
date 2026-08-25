import type { AvatarDefinition } from '@bible-strong/avatar-web'

import { arms, buildDefinition, sf, surfaceRadius, tail, type CharacterConfig } from './builder'

// Sixteen ghosts, each with different proportions from every other.
//
// Three things change per variant and nothing is shared but the colour system:
// the head's width-to-height ratio, the eye scale and set, and the reach of the
// arms and tail. Every measurement is expressed against that variant's own head
// width, so a small ghost with long arms and a large ghost with short arms stay
// legibly different rather than converging on one silhouette.
//
// The tail sits well behind the body. The engine files a node in `backPaths`
// only while its rotated depth stays under its own radius, so a shallow depth
// flips front-to-back as the head tilts; these depths pin it behind for every
// pose, and the helper compensates for the perspective shrink that recession
// causes.

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
export type BodyRole = 'accent' | 'ink' | 'inkMuted'
type EyeColorRole = 'background' | 'inverseInk'

const INVERSE_INK: Record<ModeName, string> = {
  light: MODES.dark.ink,
  dark: MODES.light.ink,
}

const ROLE_LABEL: Record<BodyRole, string> = {
  accent: 'accent',
  ink: 'ink',
  inkMuted: 'ink-muted',
}

type Proportions = {
  id: string
  name: string
  note: string
  role: BodyRole
  eyeColor?: EyeColorRole
  headW: number
  headH: number
  eyeW: number
  eyeH: number
  eyeY: number
  eyeSpacing: number
  armAngle: number
  armProtrude: number
  armWidth: number
  tailAngle: number
  tailProtrude: number
  tailWidth: number
  tailMorph: number
  tailTip: number
  tailDepth: number
}

const crew: Proportions[] = [
  {
    id: 'round',
    name: 'Round',
    note: 'The baseline: equal width and height',
    role: 'accent',
    headW: 186,
    headH: 186,
    eyeW: 24,
    eyeH: 28,
    eyeY: -20,
    eyeSpacing: 40,
    armAngle: 26,
    armProtrude: 30,
    armWidth: 44,
    tailAngle: 90,
    tailProtrude: 48,
    tailWidth: 124,
    tailMorph: 1.35,
    tailTip: 0.5,
    tailDepth: -90,
  },
  {
    id: 'tall',
    name: 'Tall',
    note: 'Narrow and upright, eyes carried high',
    role: 'ink',
    headW: 162,
    headH: 208,
    eyeW: 22,
    eyeH: 30,
    eyeY: -30,
    eyeSpacing: 36,
    armAngle: 22,
    armProtrude: 28,
    armWidth: 40,
    tailAngle: 90,
    tailProtrude: 44,
    tailWidth: 112,
    tailMorph: 1.35,
    tailTip: 0.45,
    tailDepth: -100,
  },
  {
    id: 'wide',
    name: 'Wide',
    note: 'Broad and low, arms set far out',
    role: 'ink',
    headW: 210,
    headH: 168,
    eyeW: 26,
    eyeH: 26,
    eyeY: -14,
    eyeSpacing: 48,
    armAngle: 32,
    armProtrude: 32,
    armWidth: 48,
    tailAngle: 90,
    tailProtrude: 40,
    tailWidth: 132,
    tailMorph: 1.4,
    tailTip: 0.55,
    tailDepth: -90,
  },
  {
    id: 'petite',
    name: 'Petite',
    note: 'Smallest of the crew, everything scaled down',
    role: 'inkMuted',
    headW: 150,
    headH: 154,
    eyeW: 20,
    eyeH: 24,
    eyeY: -16,
    eyeSpacing: 32,
    armAngle: 24,
    armProtrude: 24,
    armWidth: 36,
    tailAngle: 86,
    tailProtrude: 40,
    tailWidth: 100,
    tailMorph: 1.3,
    tailTip: 0.45,
    tailDepth: -80,
  },
  {
    id: 'giant',
    name: 'Giant',
    note: 'Largest body, longest reach in every direction',
    role: 'accent',
    headW: 208,
    headH: 206,
    eyeW: 30,
    eyeH: 34,
    eyeY: -22,
    eyeSpacing: 50,
    armAngle: 28,
    armProtrude: 36,
    armWidth: 54,
    tailAngle: 92,
    tailProtrude: 54,
    tailWidth: 142,
    tailMorph: 1.4,
    tailTip: 0.5,
    tailDepth: -110,
  },
  {
    id: 'egg',
    name: 'Egg',
    note: 'Tapered upward, eyes near the crown',
    role: 'ink',
    headW: 170,
    headH: 198,
    eyeW: 22,
    eyeH: 28,
    eyeY: -34,
    eyeSpacing: 36,
    armAngle: 20,
    armProtrude: 26,
    armWidth: 40,
    tailAngle: 88,
    tailProtrude: 46,
    tailWidth: 114,
    tailMorph: 1.5,
    tailTip: 0.5,
    tailDepth: -95,
  },
  {
    id: 'squat',
    name: 'Squat',
    note: 'Flattened, with the widest droop to the arms',
    role: 'inkMuted',
    headW: 202,
    headH: 160,
    eyeW: 26,
    eyeH: 24,
    eyeY: -10,
    eyeSpacing: 46,
    armAngle: 38,
    armProtrude: 30,
    armWidth: 50,
    tailAngle: 94,
    tailProtrude: 36,
    tailWidth: 128,
    tailMorph: 1.45,
    tailTip: 0.6,
    tailDepth: -85,
  },
  {
    id: 'longarm',
    name: 'Longarm',
    note: 'Modest body, arms reaching nearly straight out',
    role: 'accent',
    headW: 172,
    headH: 178,
    eyeW: 23,
    eyeH: 27,
    eyeY: -18,
    eyeSpacing: 38,
    armAngle: 12,
    armProtrude: 56,
    armWidth: 34,
    tailAngle: 90,
    tailProtrude: 42,
    tailWidth: 112,
    tailMorph: 1.35,
    tailTip: 0.45,
    tailDepth: -95,
  },
  {
    id: 'stubarm',
    name: 'Stubarm',
    note: 'Heavy body, arms barely clearing it',
    role: 'ink',
    headW: 198,
    headH: 192,
    eyeW: 27,
    eyeH: 29,
    eyeY: -20,
    eyeSpacing: 46,
    armAngle: 42,
    armProtrude: 16,
    armWidth: 54,
    tailAngle: 90,
    tailProtrude: 46,
    tailWidth: 132,
    tailMorph: 1.35,
    tailTip: 0.5,
    tailDepth: -100,
  },
  {
    id: 'highset',
    name: 'Highset',
    note: 'Eyes pushed to the very top of a tall head',
    role: 'inkMuted',
    headW: 168,
    headH: 202,
    eyeW: 22,
    eyeH: 26,
    eyeY: -42,
    eyeSpacing: 34,
    armAngle: 24,
    armProtrude: 30,
    armWidth: 38,
    tailAngle: 92,
    tailProtrude: 48,
    tailWidth: 110,
    tailMorph: 1.3,
    tailTip: 0.45,
    tailDepth: -105,
  },
  {
    id: 'lowset',
    name: 'Lowset',
    note: 'Eyes near the middle of a broad head',
    role: 'accent',
    headW: 200,
    headH: 176,
    eyeW: 26,
    eyeH: 28,
    eyeY: -4,
    eyeSpacing: 48,
    armAngle: 34,
    armProtrude: 28,
    armWidth: 50,
    tailAngle: 88,
    tailProtrude: 42,
    tailWidth: 130,
    tailMorph: 1.45,
    tailTip: 0.55,
    tailDepth: -90,
  },
  {
    id: 'wideset',
    name: 'Wideset',
    note: 'Widest eye spacing relative to the head',
    role: 'ink',
    headW: 194,
    headH: 182,
    eyeW: 24,
    eyeH: 28,
    eyeY: -18,
    eyeSpacing: 60,
    armAngle: 30,
    armProtrude: 30,
    armWidth: 46,
    tailAngle: 90,
    tailProtrude: 44,
    tailWidth: 124,
    tailMorph: 1.35,
    tailTip: 0.5,
    tailDepth: -95,
  },
  {
    id: 'closeset',
    name: 'Closeset',
    note: 'Narrowest eye spacing of the crew',
    role: 'inkMuted',
    headW: 180,
    headH: 188,
    eyeW: 24,
    eyeH: 28,
    eyeY: -20,
    eyeSpacing: 26,
    armAngle: 26,
    armProtrude: 28,
    armWidth: 42,
    tailAngle: 90,
    tailProtrude: 46,
    tailWidth: 118,
    tailMorph: 1.35,
    tailTip: 0.5,
    tailDepth: -95,
  },
  {
    id: 'davebot',
    name: 'Davebot',
    note: 'Davebot — largest eyes, filling much of the face',
    role: 'ink',
    eyeColor: 'inverseInk',
    headW: 184,
    headH: 190,
    eyeW: 36,
    eyeH: 40,
    eyeY: -16,
    eyeSpacing: 48,
    armAngle: 28,
    armProtrude: 28,
    armWidth: 44,
    tailAngle: 90,
    tailProtrude: 44,
    tailWidth: 120,
    tailMorph: 1.4,
    tailTip: 0.5,
    tailDepth: -90,
  },
  {
    id: 'pinhole',
    name: 'Pinhole',
    note: 'Smallest eyes, set in a plain round head',
    role: 'ink',
    headW: 190,
    headH: 186,
    eyeW: 14,
    eyeH: 16,
    eyeY: -22,
    eyeSpacing: 38,
    armAngle: 26,
    armProtrude: 30,
    armWidth: 44,
    tailAngle: 90,
    tailProtrude: 46,
    tailWidth: 124,
    tailMorph: 1.35,
    tailTip: 0.5,
    tailDepth: -90,
  },
  {
    id: 'deepset',
    name: 'Deepset',
    note: 'Tail pushed furthest back, so it recedes most',
    role: 'ink',
    headW: 188,
    headH: 184,
    eyeW: 25,
    eyeH: 29,
    eyeY: -20,
    eyeSpacing: 42,
    armAngle: 26,
    armProtrude: 32,
    armWidth: 46,
    tailAngle: 90,
    tailProtrude: 58,
    tailWidth: 130,
    tailMorph: 1.35,
    tailTip: 0.5,
    tailDepth: -170,
  },
]

export type CrewVariant = {
  mode: ModeName
  body: string
  tile: string
  definition: AvatarDefinition
}

export type CrewMember = {
  id: string
  name: string
  note: string
  roleLabel: string
  // Derived from the geometry rather than written by hand, so the printed
  // proportions cannot drift away from what actually renders.
  ratio: string
  metrics: string
  variants: CrewVariant[]
}

export const crewMembers: CrewMember[] = crew.map(p => {
  const variants = (Object.keys(MODES) as ModeName[]).map((mode): CrewVariant => {
    const palette = MODES[mode]
    const body = palette[p.role]
    const config: CharacterConfig = {
      id: `${p.id}-${mode}`,
      name: p.name,
      role: p.note,
      surface: sf('sphere', p.headW, p.headH, p.headW, 1),
      body,
      // Davebot uses the opposite mode's ink for his eyes; the other crew
      // members keep background-colour cut-outs.
      eyes: p.eyeColor === 'inverseInk' ? INVERSE_INK[mode] : palette.bg,
      eye: { w: p.eyeW, h: p.eyeH, y: p.eyeY, spacing: p.eyeSpacing },
      nodes: [
        tail({
          angleDeg: p.tailAngle,
          protrude: p.tailProtrude,
          width: p.tailWidth,
          morph: p.tailMorph,
          tip: p.tailTip,
          depth: p.tailDepth,
          bodyRadius: surfaceRadius(p.headW, p.headH, p.tailAngle),
        }),
        ...arms({
          angleDeg: p.armAngle,
          protrude: p.armProtrude,
          width: p.armWidth,
          bodyRadius: surfaceRadius(p.headW, p.headH, p.armAngle),
        }),
      ],
      signature: 'curious',
    }
    return { mode, body, tile: palette.tile, definition: buildDefinition(config) }
  })

  const frac = (value: number) => (value / p.headW).toFixed(2)
  return {
    id: p.id,
    name: p.name,
    note: p.note,
    roleLabel: ROLE_LABEL[p.role],
    ratio: `${(p.headW / p.headH).toFixed(2)}:1`,
    metrics: `${p.headW}\u00d7${p.headH} · eye-set ${frac(p.eyeSpacing)} · eye ${frac(p.eyeW)} · arms ${frac(p.armProtrude)} · tail ${frac(p.tailProtrude)} @ ${p.tailDepth}`,
    variants,
  }
})
