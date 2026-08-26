import { expressionFields, type Expression } from './geometry'

export type EyeSide = 'Left' | 'Right'
export type EyeLinks = { width: boolean; height: boolean; size: boolean; position?: boolean }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const opposite = (side: EyeSide): EyeSide => (side === 'Left' ? 'Right' : 'Left')

export const updateEyeDimension = (
  expression: Expression,
  side: EyeSide,
  dimension: 'width' | 'height',
  value: number,
  linked: boolean
) => {
  const field = `${dimension}${side}` as 'widthLeft' | 'widthRight' | 'heightLeft' | 'heightRight'
  const otherField = `${dimension}${opposite(side)}` as typeof field
  const nextValue = clamp(value, 10, 100)
  return {
    ...expression,
    [field]: nextValue,
    ...(linked ? { [otherField]: nextValue } : {}),
  }
}

export const scaleEye = (
  expression: Expression,
  side: EyeSide,
  targetSize: number,
  linked: boolean
) => {
  const widthField = `width${side}` as 'widthLeft' | 'widthRight'
  const heightField = `height${side}` as 'heightLeft' | 'heightRight'
  const factor = targetSize / Math.max(expression[widthField], expression[heightField], 1)
  const next: Expression = {
    ...expression,
    [widthField]: clamp(expression[widthField] * factor, 10, 110),
    [heightField]: clamp(expression[heightField] * factor, 10, 110),
  }
  if (!linked) return next
  const otherSide = opposite(side)
  const otherWidth = `width${otherSide}` as 'widthLeft' | 'widthRight'
  const otherHeight = `height${otherSide}` as 'heightLeft' | 'heightRight'
  next[otherWidth] = clamp(expression[otherWidth] * factor, 10, 110)
  next[otherHeight] = clamp(expression[otherHeight] * factor, 10, 110)
  return next
}

export const updateEyePosition = (
  expression: Expression,
  side: EyeSide,
  axis: 'X' | 'Y',
  value: number,
  linked: boolean
) => {
  const field = `position${axis}${side}` as
    'positionXLeft' | 'positionXRight' | 'positionYLeft' | 'positionYRight'
  const otherField = `position${axis}${opposite(side)}` as typeof field
  return { ...expression, [field]: value, ...(linked ? { [otherField]: value } : {}) }
}

const mouthShapeGeometryFieldSet = new Set<string>(['mouthCurve', 'mouthWidth', 'mouthHeight'])

export const blendExpressionTransitionTarget = (
  from: Expression,
  to: Expression,
  progress: number,
  snapMouthGeometry: boolean
): Expression => {
  const blended = { ...to }
  expressionFields.forEach(field => {
    blended[field] =
      snapMouthGeometry && mouthShapeGeometryFieldSet.has(field)
        ? to[field]
        : from[field] + (to[field] - from[field]) * progress
  })
  if (snapMouthGeometry) blended.mouthShape = to.mouthShape
  return blended
}
