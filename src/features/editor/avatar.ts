import {
  characterFromLegacyDefinition,
  parseAvatarBody,
  surfacePresets,
  validateAvatarDefinition,
  type AvatarBody,
  type AvatarCharacter,
} from '@bible-strong/avatar-core'

// An avatar as the Studio keeps it: a character with a name and a place in the library. What
// it does (clips, faces, states) is the same for every avatar and is not kept here.

export type AvatarColors = { body: string; eyes: string }
export type AvatarOutlineStyle = { enabled: boolean; color: string; width: number; opacity: number }
export type AvatarRenderStyle = { type: 'vector'; outline?: AvatarOutlineStyle }

const noseShapes = ['inverted-triangle', 'ellipse', 'rounded'] as const
const mouthShapes = ['curve', 'ellipse', 'rounded', 'rounded-triangle'] as const

/** The features of the face that belong to the avatar. Lengths are in units of the drawing. */
export type AvatarFeatures = {
  positionYLeft: number
  positionYRight: number
  /** The size of the eyes against the standard ones: width and height together. */
  eyeScale: number
  /** The distance between the eyes against the standard one. */
  eyeGap: number
  noseEnabled: boolean
  noseShape: (typeof noseShapes)[number]
  noseRoundness: number
  noseWidth: number
  noseHeight: number
  noseX: number
  noseY: number
  noseAngle: number
  mouthEnabled: boolean
  mouthShape: (typeof mouthShapes)[number]
  mouthCurve: number
  mouthWidth: number
  mouthHeight: number
  mouthX: number
  mouthY: number
  mouthAngle: number
}

export type StudioAvatar = {
  id: string
  name: string
  body: AvatarBody
  colors: AvatarColors
  // Named `eyes` in the stored document since the first version of the Studio.
  eyes: AvatarFeatures
  renderStyle: AvatarRenderStyle
}

export type AvatarLibrary = { activeAvatarId: string; avatars: StudioAvatar[] }

export const defaultAvatarColors: AvatarColors = { body: '#5b7fe5', eyes: '#111316' }
export const defaultAvatarOutlineStyle: AvatarOutlineStyle = {
  enabled: false,
  color: '#111316',
  width: 6,
  opacity: 1,
}
export const defaultAvatarFeatures: AvatarFeatures = {
  positionYLeft: -7,
  positionYRight: -7,
  eyeScale: 1,
  eyeGap: 1,
  noseEnabled: false,
  noseShape: 'inverted-triangle',
  noseRoundness: 50,
  noseWidth: 14,
  noseHeight: 11,
  noseX: 0,
  noseY: 22,
  noseAngle: 0,
  mouthEnabled: false,
  mouthShape: 'curve',
  mouthCurve: 45,
  mouthWidth: 20,
  mouthHeight: 6,
  mouthX: 0,
  mouthY: 35,
  mouthAngle: 0,
}

const hexColor = /^#[0-9a-f]{6}$/i
const colorOr = (value: unknown, fallback: string) =>
  typeof value === 'string' && hexColor.test(value) ? value : fallback
const numberOr = (value: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

const parseColors = (value: unknown): AvatarColors => {
  const candidate = value as Partial<AvatarColors> | null
  return {
    body: colorOr(candidate?.body, defaultAvatarColors.body),
    eyes: colorOr(candidate?.eyes, defaultAvatarColors.eyes),
  }
}

const parseRenderStyle = (value: unknown): AvatarRenderStyle => {
  const outline = (value as Partial<AvatarRenderStyle> | null)?.outline
  if (!outline || typeof outline !== 'object') return { type: 'vector' }
  return {
    type: 'vector',
    outline: {
      enabled: outline.enabled === true,
      color: colorOr(outline.color, defaultAvatarOutlineStyle.color),
      width: numberOr(outline.width, defaultAvatarOutlineStyle.width, 0, 24),
      opacity: numberOr(outline.opacity, defaultAvatarOutlineStyle.opacity, 0, 1),
    },
  }
}

// How far the size and the gap of the eyes may go from the standard ones.
export const EYE_BUILD_MIN = 0.6
export const EYE_BUILD_MAX = 1.6

const parseFeatures = (value: unknown): AvatarFeatures => {
  const candidate = (value ?? {}) as Record<string, unknown>
  const parsed = { ...defaultAvatarFeatures } as Record<string, unknown>
  Object.entries(defaultAvatarFeatures).forEach(([field, fallback]) => {
    const stored = candidate[field]
    if (typeof fallback === 'number') parsed[field] = numberOr(stored, fallback)
    else if (typeof fallback === 'boolean') parsed[field] = stored === true
  })
  const features = parsed as AvatarFeatures
  features.eyeScale = numberOr(candidate.eyeScale, 1, EYE_BUILD_MIN, EYE_BUILD_MAX)
  features.eyeGap = numberOr(candidate.eyeGap, 1, EYE_BUILD_MIN, EYE_BUILD_MAX)
  if (noseShapes.includes(candidate.noseShape as never)) {
    features.noseShape = candidate.noseShape as AvatarFeatures['noseShape']
  }
  if (mouthShapes.includes(candidate.mouthShape as never)) {
    features.mouthShape = candidate.mouthShape as AvatarFeatures['mouthShape']
  }
  return features
}

const newAvatarId = () => `avatar-${crypto.randomUUID()}`

export const createAvatar = (name: string): StudioAvatar => ({
  id: newAvatarId(),
  name: name.trim() || 'Nouvel avatar',
  body: { primary: { ...surfacePresets.sphere }, nodes: [] },
  colors: { ...defaultAvatarColors },
  eyes: { ...defaultAvatarFeatures },
  renderStyle: { type: 'vector' },
})

/** A library read from storage or from a file. Anything it does not hold right is left out. */
export const parseAvatarLibrary = (value: unknown, fallback: AvatarLibrary): AvatarLibrary => {
  const parsed = value as Partial<AvatarLibrary> | null
  if (!parsed || !Array.isArray(parsed.avatars)) return fallback
  const seenIds = new Set<string>()
  const avatars = parsed.avatars.flatMap((avatar): StudioAvatar[] => {
    if (!avatar || typeof avatar.id !== 'string' || typeof avatar.name !== 'string') return []
    if (seenIds.has(avatar.id)) return []
    seenIds.add(avatar.id)
    return [
      {
        id: avatar.id,
        name: avatar.name,
        body: parseAvatarBody(avatar.body, surfacePresets.sphere),
        colors: parseColors(avatar.colors),
        eyes: parseFeatures(avatar.eyes),
        renderStyle: parseRenderStyle(avatar.renderStyle),
      },
    ]
  })
  if (!avatars.length) return fallback
  const activeAvatarId = avatars.some(avatar => avatar.id === parsed.activeAvatarId)
    ? parsed.activeAvatarId!
    : avatars[0].id
  return { activeAvatarId, avatars }
}

/** The radius the face is measured in: the head's, or the smaller one when it is not round. */
const faceRadius = (body: Pick<AvatarBody, 'primary'>) =>
  Math.min(body.primary.width, body.primary.height) / 2

/** The character of an avatar: what the renderers draw and what an export holds. */
export const characterOfAvatar = (avatar: StudioAvatar): AvatarCharacter => {
  const features = avatar.eyes
  const outline = avatar.renderStyle.outline
  return {
    ...(avatar.name ? { name: avatar.name } : {}),
    body: {
      primary: avatar.body.primary,
      nodes: avatar.body.nodes.map(node => ({
        ...(node.color ? { color: node.color } : {}),
        ...(node.followsHead === false ? { followsHead: false } : {}),
        surface: node.surface,
        position: node.position,
        rotation: node.rotation,
      })),
    },
    colors: avatar.colors,
    ...(outline ? { style: { outline } } : {}),
    face: {
      eyes: {
        width: features.eyeScale,
        height: features.eyeScale,
        gap: features.eyeGap,
        shiftY: (features.positionYLeft + features.positionYRight) / 2 / faceRadius(avatar.body),
      },
      nose: {
        enabled: features.noseEnabled,
        shape: features.noseShape,
        roundness: features.noseRoundness,
        width: features.noseWidth,
        height: features.noseHeight,
        x: features.noseX,
        y: features.noseY,
        angle: features.noseAngle,
      },
      mouth: {
        enabled: features.mouthEnabled,
        shape: features.mouthShape,
        curve: features.mouthCurve,
        width: features.mouthWidth,
        height: features.mouthHeight,
        x: features.mouthX,
        y: features.mouthY,
        angle: features.mouthAngle,
      },
      perspective: 1,
    },
  } as AvatarCharacter
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * An avatar read from a file: a character saved by this Studio, or an `.avatar.json` of the
 * first version, of which only the character is kept.
 */
export const avatarFromSource = (source: string): StudioAvatar => {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error('Invalid avatar file')
  }
  if (!isRecord(value)) throw new Error('Invalid avatar file')
  let character: AvatarCharacter
  if (value.schema === 'bible-strong/avatar-definition') {
    const definition = validateAvatarDefinition(value)
    if (!definition.ok) throw new Error('Invalid avatar file')
    character = characterFromLegacyDefinition(definition.value)
  } else {
    if (!isRecord(value.body) || !isRecord(value.body.primary) || !isRecord(value.face)) {
      throw new Error('Invalid avatar file')
    }
    character = value as unknown as AvatarCharacter
  }
  const nodes = Array.isArray(character.body.nodes) ? character.body.nodes : []
  const body = parseAvatarBody(
    {
      primary: character.body.primary,
      // A character's parts have no name of their own: the Studio gives them one.
      nodes: nodes.map((node, index) => ({
        id: `node-${crypto.randomUUID()}`,
        name: `${node.surface?.type ?? 'part'} ${index + 1}`,
        ...node,
      })),
    },
    surfacePresets.sphere
  )
  const face = character.face
  const shiftY = numberOr(face.eyes?.shiftY, 0) * faceRadius(body)
  const nose = (face.nose ?? {}) as Record<string, unknown>
  const mouth = (face.mouth ?? {}) as Record<string, unknown>
  return {
    id: newAvatarId(),
    name: typeof character.name === 'string' && character.name ? character.name : 'Avatar',
    body,
    colors: parseColors(character.colors),
    eyes: parseFeatures({
      positionYLeft: shiftY,
      positionYRight: shiftY,
      eyeScale: face.eyes?.width,
      eyeGap: face.eyes?.gap,
      noseEnabled: nose.enabled,
      noseShape: nose.shape,
      noseRoundness: nose.roundness,
      noseWidth: nose.width,
      noseHeight: nose.height,
      noseX: nose.x,
      noseY: nose.y,
      noseAngle: nose.angle,
      mouthEnabled: mouth.enabled,
      mouthShape: mouth.shape,
      mouthCurve: mouth.curve,
      mouthWidth: mouth.width,
      mouthHeight: mouth.height,
      mouthX: mouth.x,
      mouthY: mouth.y,
      mouthAngle: mouth.angle,
    }),
    renderStyle: parseRenderStyle(character.style),
  }
}
