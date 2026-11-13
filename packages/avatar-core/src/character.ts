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
import type { EngineFrame, SpinnerFrame } from './engine'
import { REST_ZOOM, type PlayerFrame } from './player'
import type { SpinnerMark } from './spinners'
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
 * and its eyes stay at the height they were on the face. Their size and gap are not kept: the
 * standard faces are drawn for the standard eyes, and look stretched on any others. Its
 * expressions and animations are not kept either: a character plays the standard clips.
 */
export const characterFromLegacyDefinition = (
  definition: Readonly<AvatarDefinition>
): AvatarCharacter => {
  const neutral = definition.expressions.neutral
  const radius = Math.min(definition.body.primary.width, definition.body.primary.height) / 2
  const { left, right } = neutral.eyes
  return {
    ...(definition.name ? { name: definition.name } : {}),
    body: definition.body,
    colors: definition.colors,
    ...(definition.style ? { style: definition.style } : {}),
    face: {
      eyes: { width: 1, height: 1, gap: 1, shiftY: (left.y + right.y) / 2 / radius },
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

/** One mark of a spinner: filled, or drawn as a line of a given width with round ends. */
export type SpinnerPath = { d: string; opacity: number; strokeWidth?: number }

export type SpinnerScene = {
  /** The marks around the body, drawn under it in the body's colour. They are not moved. */
  marks: SpinnerPath[]
  /**
   * How round the body has become, from 0 to 1. A renderer fades the body's parts and its face
   * by it and draws `disc`, in the body's colour, over the head with this opacity; at 1 the
   * head itself is no longer drawn.
   */
  round: number
  /** The shape the body becomes, moved with the body: a disc, or a drop for a pencil's tip. */
  disc: string
  /** The opacity of the body as a whole. */
  opacity: number
}

export type CharacterScene = AvatarScene & {
  /**
   * How the whole drawing is moved, sized and stretched about the middle of the view. A clip
   * moves the body after it is drawn: the move does not change how the head is seen.
   */
  transform: SceneTransform
  /** What the body has turned into, when it has. */
  spinner: SpinnerScene | null
}

const number = (value: number) => value.toFixed(2)

const circlePath = (x: number, y: number, radius: number) =>
  `M${number(x - radius)} ${number(y)}A${number(radius)} ${number(radius)} 0 1 0 ${number(x + radius)} ${number(y)}` +
  `A${number(radius)} ${number(radius)} 0 1 0 ${number(x - radius)} ${number(y)}Z`

// A drop is a disc this large for the body, with a tip at the body's edge, below.
const DROP_DISC = 0.77

const dropPath = (radius: number) => {
  const disc = radius * DROP_DISC
  const lean = Math.acos(disc / radius)
  const x = disc * Math.sin(lean)
  const y = disc * Math.cos(lean)
  return `M0 ${number(radius)}L${number(x)} ${number(y)}A${number(disc)} ${number(disc)} 0 1 0 ${number(-x)} ${number(y)}Z`
}

const BAR_END_STEPS = 10

const markPath = (mark: Readonly<SpinnerMark>, unit: number): SpinnerPath | null => {
  if (mark.kind === 'disc') {
    return {
      d: circlePath(mark.x * unit, mark.y * unit, mark.radius * unit),
      opacity: mark.opacity,
    }
  }
  if (mark.kind === 'ring') {
    const radius = mark.radius * unit
    const stroke = { opacity: mark.opacity, strokeWidth: mark.width * unit }
    if (mark.share === undefined || mark.share >= 0.999) {
      return { d: circlePath(mark.x * unit, mark.y * unit, radius), ...stroke }
    }
    if (mark.share <= 0.001) return null
    const angle = mark.share * Math.PI * 2
    return {
      d:
        `M${number(mark.x * unit)} ${number(mark.y * unit - radius)}` +
        `A${number(radius)} ${number(radius)} 0 ${mark.share > 0.5 ? 1 : 0} 1 ` +
        `${number(mark.x * unit + radius * Math.sin(angle))} ${number(mark.y * unit - radius * Math.cos(angle))}`,
      ...stroke,
    }
  }
  if (mark.kind === 'line') {
    return {
      d: mark.points
        .map(([x, y], index) => `${index ? 'L' : 'M'}${number(x * unit)} ${number(y * unit)}`)
        .join(''),
      opacity: mark.opacity,
      strokeWidth: mark.width * unit,
    }
  }
  // A bar: two round ends of two sizes, joined by straight sides.
  const top = mark.top / 2
  const bottom = mark.bottom / 2
  const reach = mark.height / 2
  const outline: [number, number][] = []
  for (let step = 0; step <= BAR_END_STEPS; step += 1) {
    const angle = Math.PI + (step / BAR_END_STEPS) * Math.PI
    outline.push([top * Math.cos(angle), -reach + top + top * Math.sin(angle)])
  }
  for (let step = 0; step <= BAR_END_STEPS; step += 1) {
    const angle = (step / BAR_END_STEPS) * Math.PI
    outline.push([bottom * Math.cos(angle), reach - bottom + bottom * Math.sin(angle)])
  }
  const turn = (mark.turn * Math.PI) / 180
  const cosine = Math.cos(turn)
  const sine = Math.sin(turn)
  return {
    d:
      outline
        .map(([localX, localY], index) => {
          const x = mark.x + localX * mark.scale - mark.about[0]
          const y = mark.y + localY * mark.scale - mark.about[1]
          const turnedX = mark.about[0] + x * cosine - y * sine
          const turnedY = mark.about[1] + x * sine + y * cosine
          return `${index ? 'L' : 'M'}${number(turnedX * unit)} ${number(turnedY * unit)}`
        })
        .join('') + 'Z',
    opacity: mark.opacity,
  }
}

const spinnerScene = (
  character: Readonly<AvatarCharacter>,
  spinner: Readonly<SpinnerFrame>
): SpinnerScene => {
  const radius = bodyRadius(character)
  return {
    marks: spinner.marks.flatMap(mark => markPath(mark, radius) ?? []),
    round: spinner.round,
    disc: spinner.core.drop ? dropPath(radius) : circlePath(0, 0, radius),
    opacity: spinner.core.opacity,
  }
}

const sceneTransform = (
  character: Readonly<AvatarCharacter>,
  frame: Readonly<PlayerFrame & { spinner?: SpinnerFrame | null }>
): SceneTransform => {
  const radius = bodyRadius(character)
  const spinner = frame.spinner
  if (spinner) {
    // The body shrinks to the disc of the spinner, wherever the pattern puts it and however
    // it turns it. What is left of the clip's own move is still there.
    const left = 1 - spinner.amount
    const size = (frame.zoom / REST_ZOOM) * left + spinner.core.radius * spinner.amount
    const turn = (spinner.core.turn * Math.PI) / 180
    const base = frame.zoom / REST_ZOOM
    return [
      size * frame.squash[0] * Math.cos(turn),
      size * frame.squash[0] * Math.sin(turn),
      -size * frame.squash[1] * Math.sin(turn),
      size * frame.squash[1] * Math.cos(turn),
      (base * frame.position[0] + spinner.core.x) * radius || 0,
      (-base * frame.position[1] + spinner.core.y) * radius || 0,
    ]
  }
  const size = frame.zoom / REST_ZOOM
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

// How far the corners of a mouth go up for a face that smiles, and down for one that does not.
const SMILING_CURVE = 85
const FROWNING_CURVE = -70

/** The character's mouth as a face asks for it: only a mouth drawn as a line can bend. */
const mouthFor = (
  mouth: NonNullable<CharacterFace['mouth']>,
  smile: number
): NonNullable<CharacterFace['mouth']> => {
  if (mouth.shape !== 'curve' || smile === 0) return mouth
  const towards = smile > 0 ? SMILING_CURVE : FROWNING_CURVE
  return { ...mouth, curve: mouth.curve + (towards - mouth.curve) * Math.abs(smile) }
}

/** Draw a character as the player has it now. */
export const renderCharacterFrame = (
  character: Readonly<AvatarCharacter>,
  frame: Readonly<PlayerFrame> | Readonly<EngineFrame>
): CharacterScene => {
  const spinner = 'spinner' in frame ? frame.spinner : null
  // Halfway to a spinner the body has no face left.
  const faceless = spinner !== null && spinner.amount >= 0.5
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
      ...(character.face.mouth ? { mouth: mouthFor(character.face.mouth, frame.smile) } : {}),
      perspective: character.face.perspective,
      motion: { eyes: 'none', body: 'none' },
    }),
    orientation:
      ('orientation' in frame ? frame.orientation : undefined) ?? orientationOf(frame.rotation),
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
  if (faceless) {
    geometry.leftVisible = false
    geometry.rightVisible = false
    geometry.nosePath = ''
    geometry.mouthPath = ''
  }
  return {
    geometry,
    colors: { body: bodyColor, eyes: character.colors.eyes },
    bodyColors: {
      back: geometry.backNodeIds.map(id => (id ? (nodeColors.get(id) ?? bodyColor) : bodyColor)),
      front: geometry.frontNodeIds.map(id => (id ? (nodeColors.get(id) ?? bodyColor) : bodyColor)),
    },
    transform: sceneTransform(character, frame),
    spinner: spinner ? spinnerScene(character, spinner) : null,
  }
}
