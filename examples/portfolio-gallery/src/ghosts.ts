import {
  buildDefinition,
  lobe,
  nd,
  ns,
  sf,
  wisp,
  type BodyNode,
  type Character,
  type CharacterConfig,
  type EmoteKey,
  type Surface,
} from './builder'

// Ten ghosts, built from Pip. Each keeps the same round head and round eyes and
// stays inside the Page 3 monochrome system; the variable on this page is the
// TAIL. Tails are `wisp` chains — tapering lobes swept along a Bezier — so they
// merge with the body into one continuous silhouette.
//
// Reference cues taken from the sketch: round body, round eyes set high, two
// small arm nubs, and a wavy tail trailing off to one side. Two ghosts also wear
// a wide flat cone as a straw hat, a direct nod to the drawing.

const GHOST_EYE = { w: 24, h: 28, y: -18, spacing: 40 }

// Two small arm nubs at mid-height, as in the sketch.
const arms = (size: number, x: number, y: number): BodyNode[] => [
  lobe(size, -x, y, -6),
  lobe(size, x, y, -6),
]

// A wide, almost flat cone reads as a conical straw hat.
const strawHat = (width: number, y: number): BodyNode =>
  nd(ns('cone', width, 70, width, 0.9, { baseRoundness: 1, tipRoundness: 0.55 }), [0, y, 8])

type Ghost = {
  id: string
  name: string
  tail: string
  body: string
  eyes: string
  ground: string
  mode: 'light' | 'dark'
  signature: EmoteKey
  surface: Surface
  nodes: BodyNode[]
}

export type GhostVariant = Character & {
  ground: string
  mode: 'light' | 'dark'
  tail: string
}

const ghostList: Ghost[] = [
  {
    id: 'trail',
    name: 'Trail',
    tail: 'One long sweep, bowed out to the right',
    body: '#0a0a0a',
    eyes: '#f6f6f6',
    ground: '#f6f6f6',
    mode: 'light',
    signature: 'curious',
    surface: sf('sphere', 186, 186, 186, 1),
    nodes: [
      ...arms(52, 92, 26),
      ...wisp({ from: [20, 84], to: [150, 130], bow: 54, startSize: 78, endSize: 20, count: 13 }),
    ],
  },
  {
    id: 'curl',
    name: 'Curl',
    tail: 'Sweeps out, then hooks back up at the tip',
    body: '#2a2a2a',
    eyes: '#f2f2f2',
    ground: '#ffffff',
    mode: 'light',
    signature: 'hello',
    surface: sf('sphere', 190, 190, 190, 1),
    nodes: [
      ...arms(52, 94, 26),
      ...wisp({ from: [10, 88], to: [110, 120], bow: 40, startSize: 80, endSize: 46, count: 7 }),
      ...wisp({ from: [110, 120], to: [150, 58], bow: 40, startSize: 44, endSize: 24, count: 7 }),
    ],
  },
  {
    id: 'sliver',
    name: 'Sliver',
    tail: 'Short and shy, barely leaves the body',
    body: '#4d4d4d',
    eyes: '#ffffff',
    ground: '#f6f6f6',
    mode: 'light',
    signature: 'shy',
    surface: sf('capsule', 176, 212, 176, 1),
    nodes: [
      ...wisp({ from: [0, 100], to: [92, 138], bow: 30, startSize: 66, endSize: 20, count: 10 }),
    ],
  },
  {
    id: 'comet',
    name: 'Comet',
    tail: 'Long and nearly straight, low bow',
    body: '#7a7a7a',
    eyes: '#141414',
    ground: '#ffffff',
    mode: 'light',
    signature: 'excited',
    surface: sf('sphere', 180, 180, 180, 1),
    nodes: [
      ...arms(48, 90, 24),
      ...wisp({ from: [16, 80], to: [176, 108], bow: 18, startSize: 74, endSize: 22, count: 13 }),
    ],
  },
  {
    id: 'drift',
    name: 'Drift',
    tail: 'Mirrored — trails off to the left',
    body: '#b5b5b5',
    eyes: '#141414',
    ground: '#f6f6f6',
    mode: 'light',
    signature: 'sleepy',
    surface: sf('sphere', 186, 186, 186, 1),
    nodes: [
      ...arms(52, 92, 26),
      ...wisp({
        from: [-20, 86],
        to: [-150, 126],
        bow: -54,
        startSize: 76,
        endSize: 20,
        count: 13,
      }),
    ],
  },
  {
    id: 'ribbon',
    name: 'Ribbon',
    tail: 'Two opposed bows — a full S-curve',
    body: '#ffffff',
    eyes: '#0a0a0a',
    ground: '#0a0a0a',
    mode: 'dark',
    signature: 'look-around',
    surface: sf('sphere', 184, 184, 184, 1),
    nodes: [
      ...arms(50, 91, 25),
      ...wisp({ from: [8, 84], to: [96, 116], bow: 44, startSize: 76, endSize: 48, count: 7 }),
      ...wisp({ from: [96, 116], to: [164, 146], bow: -44, startSize: 46, endSize: 26, count: 7 }),
    ],
  },
  {
    id: 'coil',
    name: 'Coil',
    tail: 'Tight curl that loops back over itself',
    body: '#f2f2f2',
    eyes: '#141414',
    ground: '#000000',
    mode: 'dark',
    signature: 'curious',
    surface: sf('sphere', 188, 188, 188, 1),
    nodes: [
      ...arms(52, 93, 26),
      ...wisp({ from: [10, 86], to: [120, 112], bow: 30, startSize: 78, endSize: 48, count: 7 }),
      ...wisp({ from: [120, 112], to: [126, 44], bow: 54, startSize: 46, endSize: 26, count: 7 }),
    ],
  },
  {
    id: 'kasa',
    name: 'Kasa',
    tail: 'Sketch homage — straw hat over a bowed tail',
    body: '#e0e0e0',
    eyes: '#2a2a2a',
    ground: '#141414',
    mode: 'dark',
    signature: 'hello',
    surface: sf('sphere', 182, 182, 182, 1),
    nodes: [
      strawHat(252, -116),
      ...arms(50, 90, 28),
      ...wisp({ from: [14, 80], to: [142, 120], bow: 46, startSize: 72, endSize: 20, count: 12 }),
    ],
  },
  {
    id: 'twin',
    name: 'Twin',
    tail: 'Two tails, one either side',
    body: '#a8a8a8',
    eyes: '#0a0a0a',
    ground: '#0a0a0a',
    mode: 'dark',
    signature: 'excited',
    surface: sf('sphere', 186, 186, 186, 1),
    nodes: [
      ...wisp({
        from: [-16, 88],
        to: [-112, 122],
        bow: -44,
        startSize: 62,
        endSize: 26,
        count: 8,
      }),
      ...wisp({ from: [26, 88], to: [122, 122], bow: 44, startSize: 62, endSize: 26, count: 8 }),
    ],
  },
  {
    id: 'puff',
    name: 'Puff',
    tail: 'Stubby and thick — almost no taper',
    body: '#4d4d4d',
    eyes: '#bcbcbc',
    ground: '#000000',
    mode: 'dark',
    signature: 'surprise',
    surface: sf('sphere', 196, 196, 196, 1),
    nodes: [
      ...arms(54, 96, 28),
      ...wisp({ from: [0, 92], to: [86, 124], bow: 26, startSize: 90, endSize: 34, count: 7 }),
    ],
  },
]

export const ghosts: GhostVariant[] = ghostList.map(g => {
  const role = `BODY ${g.body.toUpperCase()} · EYES ${g.eyes.toUpperCase()}`
  const config: CharacterConfig = {
    id: g.id,
    name: g.name,
    role,
    surface: g.surface,
    body: g.body,
    eyes: g.eyes,
    eye: GHOST_EYE,
    nodes: g.nodes,
    signature: g.signature,
  }
  return {
    id: g.id,
    name: g.name,
    role,
    accent: g.body,
    signature: g.signature,
    definition: buildDefinition(config),
    ground: g.ground,
    mode: g.mode,
    tail: g.tail,
  }
})
