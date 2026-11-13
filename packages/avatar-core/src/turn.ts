import { multiplyQuaternions, quaternionFromAxisAngle, type Quaternion } from './geometry'

const RADIANS = Math.PI / 180

/**
 * The turn of the head for a clip's rotation. A clip counts its angles on a screen whose
 * vertical axis points up: about x the face looks down, about y it turns to the right of the
 * screen, about z it rolls anticlockwise. The x turn is made first, then y, then z.
 */
export const clipOrientation = (rotation: readonly [number, number, number]): Quaternion =>
  multiplyQuaternions(
    quaternionFromAxisAngle([0, 0, 1], -rotation[2] * RADIANS),
    multiplyQuaternions(
      quaternionFromAxisAngle([0, 1, 0], rotation[1] * RADIANS),
      quaternionFromAxisAngle([1, 0, 0], -rotation[0] * RADIANS)
    )
  )

/** The whole turn of a frame: its rotation, laid over the turn it gives whole, if any. */
export const frameOrientation = (frame: {
  rotation: readonly [number, number, number]
  orientation?: Quaternion
}): Quaternion =>
  frame.orientation
    ? multiplyQuaternions(clipOrientation(frame.rotation), frame.orientation)
    : clipOrientation(frame.rotation)
