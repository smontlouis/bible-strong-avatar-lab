import type { AvatarDefinition } from '@bible-strong/avatar-web'

import { arms, buildDefinition, sf, surfaceRadius, tail, type CharacterConfig } from './builder'

export const HEADER_MODES = {
  light: {
    page: '#f6f6f6',
    ink: '#262626',
    muted: '#5e5e5e',
    project: '#c4c4c4',
    border: '#0000001f',
    body: '#262626',
    eyes: '#d4d4d4',
  },
  dark: {
    page: '#0b0b0b',
    ink: '#d4d4d4',
    muted: '#909090',
    project: '#323232',
    border: '#ffffff1f',
    body: '#d4d4d4',
    eyes: '#262626',
  },
} as const

export type HeaderMode = keyof typeof HEADER_MODES

const HEAD_WIDTH = 184
const HEAD_HEIGHT = 190
const ARM_ANGLE = 28
const TAIL_ANGLE = 90

export type DavebotHeaderVariant = {
  mode: HeaderMode
  definition: AvatarDefinition
}

export const davebotHeaderVariants: DavebotHeaderVariant[] = (
  Object.keys(HEADER_MODES) as HeaderMode[]
).map((mode): DavebotHeaderVariant => {
  const palette = HEADER_MODES[mode]
  const config: CharacterConfig = {
    id: `davebot-header-${mode}`,
    name: 'Davebot',
    role: 'Davebot portfolio guide',
    surface: sf('sphere', HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH, 1),
    body: palette.body,
    eyes: palette.eyes,
    eye: { w: 36, h: 40, y: -16, spacing: 48 },
    nodes: [
      tail({
        angleDeg: TAIL_ANGLE,
        protrude: 44,
        width: 120,
        morph: 1.4,
        tip: 0.5,
        depth: -100,
        bodyRadius: surfaceRadius(HEAD_WIDTH, HEAD_HEIGHT, TAIL_ANGLE),
      }),
      ...arms({
        angleDeg: ARM_ANGLE,
        protrude: 28,
        width: 44,
        depth: -36,
        bodyRadius: surfaceRadius(HEAD_WIDTH, HEAD_HEIGHT, ARM_ANGLE),
      }),
    ],
    signature: 'curious',
  }

  return { mode, definition: buildDefinition(config) }
})
