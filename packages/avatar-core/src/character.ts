import type {
  AvatarBodyDefinition,
  AvatarColorsDefinition,
  AvatarDefinition,
  AvatarExpressionDefinition,
  AvatarStyleDefinition,
} from './avatarDefinition'
import { eyeOutline, eyePointOnFace, eyeReach } from './faces'
import {
  multiplyQuaternions,
  quaternionFromAxisAngle,
  renderAvatar,
  type AvatarPose,
  type EyeOutline,
} from './geometry'
import { REST_ZOOM, type PlayerFrame } from './player'
import { bodyFromDefinition, expressionFromDefinition, type AvatarScene } from './scene'

// A character is what an avatar is, apart from what it does: its body, its colours, and the
// build of its face. What it does (clips, faces, states) is the same for every character.

export type CharacterFace = {
  /**
   * The build of the eyes against the standard face: 1 is the standard width, height and gap.
   * `shiftY` moves them down, in head radii.
   */
  eyes: { width: number; height: number; gap: number; shiftY: number }
  nose?: AvatarExpressionDefinition['nose']
  mouth?: AvatarExpressionDefinition['mouth']
  perspective: number
}

export type AvatarCharacter = {
  name?: string
  body: AvatarBodyDefinition
  colors: AvatarColorsDefinition
  style?: AvatarStyleDefinition
  face: CharacterFace
}

// The standard face, in head radii: the size of the neutral eye, and half the gap between the
// two eyes.
const STANDARD_EYE_WIDTH = 0.26
const STANDARD_EYE_HEIGHT = 0.57
const STANDARD_EYE_REACH = 0.31535
// How close the eyes may be set for their width, against the standard face.
const CLOSEST_EYE_GAP = 0.92
// The least room each eye leaves between itself and the middle of the face, in head radii.
const EYE_CLEARANCE = 0.02

/** The radius the face is measured in: the head's, or the smaller one when it is not round. */
const faceRadius = (character: Readonly<AvatarCharacter>) =>
  Math.min(character.body.primary.width, character.body.primary.height) / 2

/** The radius a move of the body is measured in. */
const bodyRadius = (character: Readonly<AvatarCharacter>) =>
  (character.body.primary.width + character.body.primary.height) / 4

/**
 * The character of an avatar of the first format. Its body, colours, nose and mouth are kept,
 * and its eyes keep their size and place. Its expressions and animations are not: a character
 * plays the standard clips.
 */
export const characterFromLegacyDefinition = (
  definition: Readonly<AvatarDefinition>
): AvatarCharacter => {
  const neutral = definition.expressions.neutral
  const radius = Math.min(definition.body.primary.width, definition.body.primary.height) / 2
  const { left, right, spacing } = neutral.eyes
  const width = (left.width + right.width) / 2 / (STANDARD_EYE_WIDTH * radius)
  // The standard faces are drawn for eyes set apart as the standard ones are: the wide ones,
  // such as `calm`, would run into each other on eyes set closer than that for their width.
  const gap = Math.max(
    (spacing + right.x - left.x) / (2 * STANDARD_EYE_REACH * radius),
    CLOSEST_EYE_GAP * width
  )
  return {
    ...(definition.name ? { name: definition.name } : {}),
    body: definition.body,
    colors: definition.colors,
    ...(definition.style ? { style: definition.style } : {}),
    face: {
      eyes: {
        width,
        height: (left.height + right.height) / 2 / (STANDARD_EYE_HEIGHT * radius),
        gap,
        shiftY: (left.y + right.y) / 2 / radius,
      },
      ...(neutral.nose ? { nose: neutral.nose } : {}),
      ...(neutral.mouth ? { mouth: neutral.mouth } : {}),
      perspective: neutral.perspective,
    },
  }
}

const RADIANS = Math.PI / 180

/**
 * The turn of the head for a clip's rotation. A clip counts its angles on a screen whose
 * vertical axis points up: about x the face looks down, about y it turns to the right of the
 * screen, about z it rolls anticlockwise. The x turn is made first, then y, then z.
 */
const orientationOf = (rotation: readonly [number, number, number]) =>
  multiplyQuaternions(
    quaternionFromAxisAngle([0, 0, 1], -rotation[2] * RADIANS),
    multiplyQuaternions(
      quaternionFromAxisAngle([0, 1, 0], rotation[1] * RADIANS),
      quaternionFromAxisAngle([1, 0, 0], -rotation[0] * RADIANS)
    )
  )

/** An affine transform as SVG writes it: `matrix(a b c d e f)`. */
export type SceneTransform = [number, number, number, number, number, number]

export type CharacterScene = AvatarScene & {
  /**
   * How the whole drawing is moved, sized and stretched about the middle of the view. A clip
   * moves the body after it is drawn: the move does not change how the head is seen.
   */
  transform: SceneTransform
}

const sceneTransform = (
  character: Readonly<AvatarCharacter>,
  frame: Readonly<PlayerFrame>
): SceneTransform => {
  const size = frame.zoom / REST_ZOOM
  const radius = bodyRadius(character)
  // A stretch leaves one point of the body in place: its middle, or its base.
  const anchored = -frame.squashAnchor * (1 - frame.squash[1]) * (character.body.primary.height / 2)
  return [
    size * frame.squash[0],
    0,
    0,
    size * frame.squash[1],
    size * frame.position[0] * radius || 0,
    size * (-frame.position[1] * radius + anchored) || 0,
  ]
}

const eyeOutlineOnFace = (
  character: Readonly<AvatarCharacter>,
  frame: Readonly<PlayerFrame>,
  index: 0 | 1
): EyeOutline => {
  const build = character.face.eyes
  const radius = faceRadius(character)
  const side = index === 0 ? -1 : 1
  const outline = eyeOutline(frame.eyes[index], frame.eyeScales[index], frame.lids)
  // The two eyes never touch. A face that leans its eyes inward, or a character whose eyes are
  // set close, would bring them together: an eye that comes too near the middle of the face is
  // moved outward, whole, by what it lacks.
  let innermost = Infinity
  for (const point of outline) innermost = Math.min(innermost, point[0] * build.width)
  const clear = Math.max(0, EYE_CLEARANCE - (eyeReach(build.gap) + innermost))
  return outline.map(([outward, up]) => {
    const [x, y] = eyePointOnFace(side, outward * build.width + clear, up * build.height, build.gap)
    return [x * radius, (y + build.shiftY) * radius] as const
  })
}

/** Draw a character as the player has it now. */
export const renderCharacterFrame = (
  character: Readonly<AvatarCharacter>,
  frame: Readonly<PlayerFrame>
): CharacterScene => {
  const body = bodyFromDefinition(character.body)
  const pose: AvatarPose = {
    // The pose only carries what the face is built of: where the head is and how it is turned
    // come from the frame.
    expression: expressionFromDefinition('frame', {
      head: { x: 0, y: 0, z: 0 },
      eyes: {
        left: { width: 0, height: 0, x: 0, y: 0, angle: 0 },
        right: { width: 0, height: 0, x: 0, y: 0, angle: 0 },
        spacing: 0,
      },
      ...(character.face.nose ? { nose: character.face.nose } : {}),
      ...(character.face.mouth ? { mouth: character.face.mouth } : {}),
      perspective: character.face.perspective,
      motion: { eyes: 'none', body: 'none' },
    }),
    orientation: orientationOf(frame.rotation),
  }
  const bodyColor = character.colors.body
  const geometry = renderAvatar(pose, body.primary, 1, {
    bodyNodes: body.nodes,
    includeWire: false,
    nodeOcclusion: 'mask',
    bodyColor,
    eyeOutlines: {
      left: eyeOutlineOnFace(character, frame, 0),
      right: eyeOutlineOnFace(character, frame, 1),
    },
  })
  const nodeColors = new Map(body.nodes.map(node => [node.id, node.color ?? bodyColor]))
  return {
    geometry,
    colors: { body: bodyColor, eyes: character.colors.eyes },
    bodyColors: {
      back: geometry.backNodeIds.map(id => (id ? (nodeColors.get(id) ?? bodyColor) : bodyColor)),
      front: geometry.frontNodeIds.map(id => (id ? (nodeColors.get(id) ?? bodyColor) : bodyColor)),
    },
    transform: sceneTransform(character, frame),
  }
}
