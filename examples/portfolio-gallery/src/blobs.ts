import { buildEnsemble, lobe, pod, sf, type Character, type CharacterConfig } from './builder'

// Ten organic "blob" characters. No angular primitives — only fully-rounded
// spheres, capsules and cylinders. Creative silhouettes come from overlapping
// same-colour soft lobes (kept clear of the face so the eyes stay readable),
// which merge into one lumpy, amoeba-like mass. Same portfolio palette.

const ink = '#2a2f3a'
const cream = '#f4f1ea'

const configs: CharacterConfig[] = [
  {
    id: 'wobble',
    name: 'Wobble',
    role: 'Lumpy · Blob',
    surface: sf('sphere', 200, 200, 200, 1),
    body: '#e65f2e',
    eyes: ink,
    eye: { w: 24, h: 44, y: -6, spacing: 40 },
    nodes: [
      lobe(96, -92, -58, -8),
      lobe(90, 96, -50, -8),
      lobe(92, -88, 64, -8),
      lobe(86, 92, 72, -8),
    ],
  },
  {
    id: 'puddle',
    name: 'Puddle',
    role: 'Amoeba · Blob',
    surface: sf('capsule', 264, 172, 200, 1),
    body: '#7aaee9',
    eyes: '#213040',
    eye: { w: 22, h: 34, y: -2, spacing: 46 },
    nodes: [
      lobe(84, -128, 6, -8),
      lobe(78, 126, -8, -8),
      lobe(64, -48, -72, -8),
      lobe(60, 58, -74, -8),
      lobe(70, 10, 86, -8),
    ],
  },
  {
    id: 'peanut',
    name: 'Peanut',
    role: 'Nesting · Blob',
    surface: sf('sphere', 168, 168, 168, 1),
    body: '#e98d34',
    eyes: ink,
    eye: { w: 22, h: 40, y: -10, spacing: 38 },
    nodes: [lobe(168, 0, 128, -10), lobe(60, -96, 120, -6), lobe(60, 96, 120, -6)],
  },
  {
    id: 'sprout',
    name: 'Sprout',
    role: 'Budding · Blob',
    surface: sf('sphere', 210, 210, 210, 1),
    body: '#8fd3b6',
    eyes: '#1f463a',
    eye: { w: 22, h: 40, y: 0, spacing: 36 },
    nodes: [lobe(64, 0, -120, 10), lobe(40, -64, -118, 6), lobe(40, 64, -118, 6)],
  },
  {
    id: 'clover',
    name: 'Clover',
    role: 'Cluster · Blob',
    surface: sf('sphere', 150, 150, 150, 1),
    body: '#e88aa0',
    eyes: '#3a2f3a',
    eye: { w: 20, h: 38, y: -14, spacing: 40 },
    nodes: [lobe(150, -92, 66, -6), lobe(150, 92, 66, -6), lobe(120, 0, -96, -6)],
  },
  {
    id: 'bean',
    name: 'Bean',
    role: 'Kidney · Blob',
    surface: sf('capsule', 196, 252, 196, 1),
    body: '#8a6bb0',
    eyes: cream,
    eye: { w: 20, h: 46, y: -6, spacing: 30 },
    nodes: [lobe(120, 74, 86, -8), lobe(96, -70, -92, -8)],
  },
  {
    id: 'cloud',
    name: 'Cloud',
    role: 'Nimbus · Blob',
    surface: sf('sphere', 150, 150, 150, 1),
    body: '#a9c8ef',
    eyes: '#213040',
    eye: { w: 20, h: 30, y: -6, spacing: 40 },
    nodes: [
      lobe(118, -118, 26, -8),
      lobe(118, 118, 26, -8),
      lobe(96, -58, -38, -8),
      lobe(96, 62, -42, -8),
      lobe(88, 0, 60, -8),
    ],
  },
  {
    id: 'dew',
    name: 'Dew',
    role: 'Droplet · Blob',
    surface: sf('sphere', 196, 196, 196, 1),
    body: '#4f8fe8',
    eyes: cream,
    eye: { w: 18, h: 42, y: -8, spacing: 30 },
    nodes: [pod(120, 150, 0, 120, -10), lobe(50, -40, -96, 8)],
  },
  {
    id: 'ripple',
    name: 'Ripple',
    role: 'Caterpillar · Blob',
    surface: sf('sphere', 150, 150, 150, 1),
    body: '#3fb8a6',
    eyes: '#123029',
    eye: { w: 20, h: 36, y: -4, spacing: 40 },
    nodes: [lobe(140, -118, 4, -8), lobe(140, 118, 4, -8), lobe(70, 0, -92, -8)],
  },
  {
    id: 'lumpy',
    name: 'Lumpy',
    role: 'Cobble · Blob',
    surface: sf('cylinder', 208, 196, 208, 1),
    body: '#c96a4a',
    eyes: cream,
    eye: { w: 22, h: 40, y: -4, spacing: 36 },
    nodes: [
      lobe(80, -108, -6, -8),
      lobe(80, 108, -12, -8),
      lobe(70, 0, -108, -8),
      lobe(64, -70, 86, -8),
      lobe(64, 72, 88, -8),
    ],
  },
]

export const blobs: Character[] = buildEnsemble(configs)
