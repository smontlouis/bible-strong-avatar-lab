import { surfaceLabels, surfacePresets, type SurfaceConfig, type SurfaceType } from './surfaces'

export type BodyVector = readonly [number, number, number]

export type BodyNode = {
  id: string
  name: string
  surface: SurfaceConfig
  position: BodyVector
  rotation: BodyVector
  /** Optional independent color; when omitted the node inherits the body color. */
  color?: string
}

export type AvatarBody = {
  primary: SurfaceConfig
  nodes: BodyNode[]
}

export const bodyPrimitiveTypes = [
  'sphere',
  'cube',
  'capsule',
  'cylinder',
  'cone',
  'diamond',
] as const

export const MAX_BODY_NODES = 16

const allSurfaceTypes = Object.keys(surfacePresets) as SurfaceType[]
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const vector = (value: unknown): value is BodyVector =>
  Array.isArray(value) && value.length === 3 && value.every(finite)
const hexColor = /^#[0-9a-f]{6}$/i

export const parseSurfaceConfig = (value: unknown, fallback: SurfaceConfig): SurfaceConfig => {
  if (!value || typeof value !== 'object') return { ...fallback }
  const candidate = value as Partial<SurfaceConfig>
  const type =
    candidate.type && allSurfaceTypes.includes(candidate.type) ? candidate.type : fallback.type
  const preset = surfacePresets[type]
  const numericFields = ['width', 'height', 'depth', 'roundness'] as const
  if (numericFields.some(field => !finite(candidate[field]))) return { ...fallback }
  if (candidate.morphRoundness !== undefined && !finite(candidate.morphRoundness))
    return { ...fallback }
  if (candidate.tipRoundness !== undefined && !finite(candidate.tipRoundness))
    return { ...fallback }
  if (candidate.baseRoundness !== undefined && !finite(candidate.baseRoundness))
    return { ...fallback }
  return { ...preset, ...candidate, type }
}

export const parseAvatarBody = (value: unknown, fallbackPrimary: SurfaceConfig): AvatarBody => {
  if (!value || typeof value !== 'object') return { primary: fallbackPrimary, nodes: [] }
  const candidate = value as Partial<AvatarBody>
  const primary = parseSurfaceConfig(candidate.primary, fallbackPrimary)
  const seenIds = new Set<string>()
  const nodes = Array.isArray(candidate.nodes)
    ? candidate.nodes
        .filter((node): node is BodyNode => {
          if (!node || typeof node !== 'object') return false
          const surface = (node as BodyNode).surface
          const id = (node as BodyNode).id
          if (id === 'primary' || seenIds.has(id)) return false
          const valid = Boolean(
            typeof (node as BodyNode).id === 'string' &&
            id &&
            typeof (node as BodyNode).name === 'string' &&
            surface &&
            bodyPrimitiveTypes.includes(surface.type as (typeof bodyPrimitiveTypes)[number]) &&
            finite(surface.width) &&
            finite(surface.height) &&
            finite(surface.depth) &&
            finite(surface.roundness) &&
            vector((node as BodyNode).position) &&
            vector((node as BodyNode).rotation)
          )
          if (valid) seenIds.add(id)
          return valid
        })
        .slice(0, MAX_BODY_NODES)
        .map(node => {
          const parsed: BodyNode = {
            ...node,
            surface: parseSurfaceConfig(node.surface, surfacePresets[node.surface.type]),
          }
          const color = (node as BodyNode).color
          if (typeof color === 'string' && hexColor.test(color)) parsed.color = color
          else delete parsed.color
          return parsed
        })
    : []
  return { primary, nodes }
}

export const createBodyNode = (
  type: (typeof bodyPrimitiveTypes)[number],
  index: number
): BodyNode => {
  const preset = surfacePresets[type]
  const scale = 0.34
  const side = index % 2 === 0 ? -1 : 1
  return {
    id: `shape-${crypto.randomUUID()}`,
    name: `${surfaceLabels[type]} ${index + 1}`,
    surface: {
      ...preset,
      width: preset.width * scale,
      height: preset.height * scale,
      depth: preset.depth * scale,
    },
    position: [side * 82, -72, -18],
    rotation: [0, 0, 0],
  }
}

export const duplicateBodyNode = (source: BodyNode): BodyNode => ({
  ...source,
  id: `shape-${crypto.randomUUID()}`,
  name: `${source.name} copie`,
  surface: { ...source.surface },
  position: [source.position[0] + 14, source.position[1] + 14, source.position[2]],
  rotation: [...source.rotation],
})
