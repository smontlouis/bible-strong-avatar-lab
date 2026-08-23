import { buildEnsemble, lobe, sf, type Character, type CharacterConfig } from './builder'

// A curated cast for the emote playground. Each character is assigned a
// distinct "signature" hero emote so the ensemble reads as individuals, not
// palette swaps. Four are new personalities built around an extreme eye trait.

const ink = '#2a2f3a'
const cream = '#f4f1ea'

const configs: CharacterConfig[] = [
  {
    id: 'pip',
    name: 'Pip',
    role: 'Curious · Sphere',
    surface: sf('sphere', 236, 236, 236, 1),
    body: '#e65f2e',
    eyes: ink,
    eye: { w: 26, h: 46, y: -6, spacing: 40 },
    signature: 'curious',
  },
  {
    id: 'juno',
    name: 'Juno',
    role: 'Bright · Sphere',
    surface: sf('sphere', 236, 236, 236, 1),
    body: '#3fb8a6',
    eyes: '#123029',
    eye: { w: 28, h: 34, y: -5, spacing: 42 },
    signature: 'excited',
  },
  {
    id: 'willow',
    name: 'Willow',
    role: 'Gentle · Capsule',
    surface: sf('capsule', 204, 252, 204, 1),
    body: '#8a6bb0',
    eyes: cream,
    eye: { w: 20, h: 50, spacing: 30 },
    signature: 'shy',
  },
  {
    id: 'sol',
    name: 'Sol',
    role: 'Warm · Mickey',
    surface: sf('mickey', 232, 222, 222, 1),
    body: '#e98d34',
    eyes: ink,
    eye: { w: 20, h: 48, spacing: 34 },
    signature: 'look-around',
  },
  {
    id: 'wobble',
    name: 'Wobble',
    role: 'Lumpy · Blob',
    surface: sf('sphere', 200, 200, 200, 1),
    body: '#e65f2e',
    eyes: ink,
    eye: { w: 24, h: 44, y: -6, spacing: 40 },
    nodes: [lobe(96, -92, -58, -8), lobe(90, 96, -50, -8), lobe(92, -88, 64, -8), lobe(86, 92, 72, -8)],
    signature: 'hello',
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
    signature: 'sleepy',
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
    signature: 'curious',
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
    signature: 'look-around',
  },
  // --- New personalities, each built around one extreme eye trait ----------
  {
    id: 'sage',
    name: 'Sage',
    role: 'Half-lidded · Capsule',
    surface: sf('capsule', 212, 244, 212, 1),
    body: '#5b6b7d',
    eyes: cream,
    eye: { w: 26, h: 18, y: -2, spacing: 40 }, // wide, low lids → drowsy wisdom
    signature: 'sleepy',
  },
  {
    id: 'zap',
    name: 'Zap',
    role: 'Saucer-eyed · Sphere',
    surface: sf('sphere', 232, 232, 232, 1),
    body: '#f04e23',
    eyes: '#1a1414',
    eye: { w: 40, h: 58, y: -4, spacing: 52 }, // huge eyes → hyper
    signature: 'excited',
  },
  {
    id: 'momo',
    name: 'Momo',
    role: 'Pin-dot · Sphere',
    surface: sf('sphere', 214, 214, 214, 1),
    body: '#e88aa0',
    eyes: '#3a2f3a',
    eye: { w: 12, h: 16, y: -2, spacing: 22 }, // tiny close-set → bashful
    signature: 'shy',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    role: 'Wide-set · Mickey',
    surface: sf('mickey', 238, 226, 226, 1),
    body: '#b3bdf2',
    eyes: '#2a2f4a',
    eye: { w: 22, h: 44, y: -4, spacing: 66 }, // far-apart eyes → dreamy
    signature: 'curious',
  },
]

export const showcase: Character[] = buildEnsemble(configs)
