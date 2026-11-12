import { clamp, radians, RADIUS } from '@/features/avatar/geometry'

export type FaceProjection = {
  x: number
  y: number
  width: number
  frameAspectRatio?: number
}
export type GazeCalibration = { x: number; y: number }

// Approximate pinhole camera, not a metric depth sensor. These are installation
// assumptions, not measured camera intrinsics or a measured visitor face size.
const focalX = 1 / (2 * Math.tan(radians(60) / 2))
const nominalFaceWidth = 0.16
// Artistic depth behind the display keeps the character looking outward rather
// than exaggerating camera-space movement across the flat screen.
const virtualDepth = 0.85
const degrees = (angle: number) => (angle * 180) / Math.PI
const finite = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback

export function estimateVisitorPosition(face: FaceProjection) {
  const width = clamp(finite(face.width, 0.2), 0.025, 0.8)
  const z = clamp((nominalFaceWidth * focalX) / width, 0.2, 5)
  const aspect = clamp(finite(face.frameAspectRatio, 4 / 3), 0.5, 3)
  return {
    x: ((clamp(finite(face.x, 0.5), 0, 1) - 0.5) * z) / focalX,
    y: ((clamp(finite(face.y, 0.5), 0, 1) - 0.5) * z) / (focalX * aspect),
    z,
  }
}

// Assumed physical width of the stand display, used to aim characters that stand
// away from the screen centre. An installation default, not a measurement.
export const ASSUMED_SCREEN_WIDTH_M = 1.2

/** `screenOffset` is where the character stands, in metres right of the screen centre. */
export function solveStandGaze(
  face: FaceProjection,
  mirror: boolean,
  calibration?: GazeCalibration,
  screenOffset = 0
) {
  const position = estimateVisitorPosition(face)
  const depth = position.z + virtualDepth
  const yaw = clamp(
    degrees(
      Math.atan2((position.x - (calibration?.x ?? 0)) * (mirror ? -1 : 1) - screenOffset, depth)
    ),
    -14,
    14
  )
  const pitch = clamp(degrees(Math.atan2(position.y - (calibration?.y ?? 0), depth)), -10, 10)
  // Head and eyes share one angular budget. Eye positions are canonical face
  // distances (radius 120), not degrees; adding two full rotations overshoots.
  const eyeYaw = clamp(yaw * 0.25, -2.2, 2.2)
  const eyePitch = clamp(pitch * 0.25, -1.8, 1.8)
  return {
    headY: yaw - eyeYaw,
    headX: -(pitch - eyePitch),
    eyeX: radians(eyeYaw) * RADIUS,
    eyeY: radians(eyePitch) * RADIUS,
    distance: position.z,
  }
}
