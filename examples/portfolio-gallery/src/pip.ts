import { buildDefinition, sf, type Character, type CharacterConfig } from './builder'

// Ten variations of Pip in the monochrome system actually used on Page 3 of the
// Paper file "ditto - aug 23" (WORK1 / COMMUNITY1 / PLAY1 / ABOUT1, Dark + Light).
//
// Verified grounds, read from the artboards themselves:
//   dark artboards  backgroundColor #0A0A0A
//   light artboards backgroundColor #F6F6F6
//
// Values in use on the page (Paper "Selection colors"), darkest to lightest:
//   #000000 #0A0A0A #141414 #2A2A2A #4D4D4D
//   #7A7A7A (the workhorse — by far the most-used) #9E9E9E #A8A8A8
//   #B2B2B2 #B5B5B5 #BCBCBC #C0C0C0
//   #E0E0E0 #F2F2F2 #F6F6F6 #FFFFFF
//
// Pip's geometry is held constant, so with hue removed the only variable left
// is value. Each card is one rung of the ramp: five on the light ground, five
// on the dark ground.

const PIP_SURFACE = sf('sphere', 236, 236, 236, 1)
const PIP_EYE = { w: 26, h: 46, y: -6, spacing: 40 }

export type PipMode = 'light' | 'dark'

export type PipVariant = Character & { ground: string; mode: PipMode; note: string }

type Recipe = {
  id: string
  name: string
  body: string
  eyes: string
  ground: string
  mode: PipMode
  note: string
}

const recipes: Recipe[] = [
  // --- Light ground -------------------------------------------------------
  {
    id: 'ink',
    name: 'Ink',
    body: '#000000',
    eyes: '#f6f6f6',
    ground: '#f6f6f6',
    mode: 'light',
    note: 'Eyes match the ground — they read as cut-outs.',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    body: '#2a2a2a',
    eyes: '#f2f2f2',
    ground: '#ffffff',
    mode: 'light',
    note: 'Softer than pure black, still fully legible.',
  },
  {
    id: 'slate',
    name: 'Slate',
    body: '#4d4d4d',
    eyes: '#ffffff',
    ground: '#f6f6f6',
    mode: 'light',
    note: 'Mid-dark body; the safest all-round light-mode pick.',
  },
  {
    id: 'gray',
    name: 'Gray',
    body: '#7a7a7a',
    eyes: '#141414',
    ground: '#ffffff',
    mode: 'light',
    note: 'The page workhorse. Eye value flips dark here to hold contrast.',
  },
  {
    id: 'silver',
    name: 'Silver',
    body: '#b5b5b5',
    eyes: '#141414',
    ground: '#f6f6f6',
    mode: 'light',
    note: 'Recedes into the page — good for an ambient or disabled state.',
  },
  // --- Dark ground -------------------------------------------------------
  {
    id: 'paper',
    name: 'Paper',
    body: '#ffffff',
    eyes: '#0a0a0a',
    ground: '#0a0a0a',
    mode: 'dark',
    note: 'The Ink card inverted; eyes again match the ground.',
  },
  {
    id: 'bone',
    name: 'Bone',
    body: '#f2f2f2',
    eyes: '#141414',
    ground: '#000000',
    mode: 'dark',
    note: 'Off-white on true black — maximum weight without pure white.',
  },
  {
    id: 'mist',
    name: 'Mist',
    body: '#e0e0e0',
    eyes: '#2a2a2a',
    ground: '#141414',
    mode: 'dark',
    note: 'Slightly dimmed body; sits back from Bone.',
  },
  {
    id: 'ash',
    name: 'Ash',
    body: '#a8a8a8',
    eyes: '#0a0a0a',
    ground: '#0a0a0a',
    mode: 'dark',
    note: 'Mid-gray on dark; the dark-mode equivalent of Slate.',
  },
  {
    id: 'shadow',
    name: 'Shadow',
    body: '#4d4d4d',
    eyes: '#bcbcbc',
    ground: '#000000',
    mode: 'dark',
    note: 'The quiet extreme — body barely separates from the ground.',
  },
]

export const pipVariants: PipVariant[] = recipes.map(r => {
  const role = `BODY ${r.body.toUpperCase()} · EYES ${r.eyes.toUpperCase()}`
  const config: CharacterConfig = {
    id: r.id,
    name: r.name,
    role,
    surface: PIP_SURFACE,
    body: r.body,
    eyes: r.eyes,
    eye: PIP_EYE,
    signature: 'curious', // Pip's own signature emote, held constant.
  }
  return {
    id: r.id,
    name: r.name,
    role,
    accent: r.body,
    signature: 'curious',
    definition: buildDefinition(config),
    ground: r.ground,
    mode: r.mode,
    note: r.note,
  }
})
