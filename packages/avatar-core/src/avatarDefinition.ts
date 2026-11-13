import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import avatarDefinitionSchema from './avatarDefinition.schema.json'
import type { SurfaceType } from './surfaces'

export type SemanticKey = string
export type ExpressionKey = SemanticKey
export type AnimationKey = SemanticKey
export type HexColor = `#${string}`

export type AvatarColorsDefinition = {
  body: HexColor
  eyes: HexColor
}

export type SurfaceDefinition<TType extends SurfaceType = SurfaceType> = {
  type: TType
  width: number
  height: number
  depth: number
  roundness: number
  morphRoundness?: number
  tipRoundness?: number
  baseRoundness?: number
  topScale?: number
  bottomScale?: number
}

export type BodyNodeSurfaceType = Exclude<SurfaceType, 'mickey' | 'cursor'>
export type PrimarySurfaceDefinition = SurfaceDefinition<SurfaceType>
export type BodyNodeSurfaceDefinition = SurfaceDefinition<BodyNodeSurfaceType>

export type AvatarBodyNodeDefinition = {
  color?: HexColor
  /** `false` for a static node, which does not turn with the head. Absent means `true`. */
  followsHead?: boolean
  surface: BodyNodeSurfaceDefinition
  position: [number, number, number]
  rotation: [number, number, number]
}

export type AvatarBodyDefinition = {
  primary: PrimarySurfaceDefinition
  nodes: AvatarBodyNodeDefinition[]
}

export type AvatarStyleDefinition = {
  outline?: {
    enabled: boolean
    color: HexColor
    width: number
    opacity: number
  }
}

export type AvatarExpressionDefinition = {
  head: { x: number; y: number; z: number }
  position?: { x: number; y: number; z: number }
  eyes: {
    left: { width: number; height: number; x: number; y: number; angle: number }
    right: { width: number; height: number; x: number; y: number; angle: number }
    spacing: number
    shape?: 'rounded' | 'ellipse'
    roundness?: number
  }
  nose?: {
    enabled: boolean
    shape: 'ellipse' | 'inverted-triangle' | 'rounded'
    roundness?: number
    width: number
    height: number
    x: number
    y: number
    angle: number
  }
  mouth?: {
    enabled: boolean
    shape: 'curve' | 'ellipse' | 'rounded' | 'rounded-triangle'
    curve: number
    width: number
    height: number
    x: number
    y: number
    angle: number
  }
  perspective: number
  blinking?: boolean
  motion: {
    eyes: 'none' | 'microSaccades' | 'shake'
    body: 'none' | 'slowDrift' | 'shake'
  }
  colors?: Partial<AvatarColorsDefinition>
}

export type AvatarAnimationStepDefinition = {
  expression: ExpressionKey
  holdMs: number
  transitionMs: number
  transition: 'spring' | 'smooth' | 'snappy'
}

export type AvatarAnimationDefinition = {
  playbackMode: 'loop' | 'once' | 'pingPong'
  steps: AvatarAnimationStepDefinition[]
  blink: {
    enabled: boolean
    initialDelayMs: number
    minIntervalMs: number
    maxIntervalMs: number
    durationMs: number
  }
  metadata?: {
    label?: string
    description?: string
    group?: string
  }
}

export type AvatarDefinition = {
  schema: 'bible-strong/avatar-definition'
  schemaVersion: 1
  name?: string
  body: AvatarBodyDefinition
  colors: AvatarColorsDefinition
  style?: AvatarStyleDefinition
  expressions: Record<ExpressionKey, AvatarExpressionDefinition>
  expressionOrder: ExpressionKey[]
  animations: Record<AnimationKey, AvatarAnimationDefinition>
  animationOrder: AnimationKey[]
  /** @deprecated Accepted for pre-release JSON compatibility; it no longer adds animations. */
  standardAnimationSet?: 1
}

export type AvatarDefinitionError = {
  path: string
  code: string
  message: string
}

export type ValidationResult<T> =
  { ok: true; value: Readonly<T> } | { ok: false; errors: readonly AvatarDefinitionError[] }

// Compiled on first use: only a file of the first version is checked against it.
let compiled: ValidateFunction<AvatarDefinition> | undefined
const definitionSchema = () =>
  (compiled ??= new Ajv2020({ allErrors: true, strict: true }).compile<AvatarDefinition>(
    avatarDefinitionSchema
  ))

const escapePointer = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1')
const childPointer = (path: string, segment: string | number) =>
  `${path}/${escapePointer(String(segment))}`
const schemaErrorPath = (error: ErrorObject) => {
  const propertyName = (error as ErrorObject & { propertyName?: string }).propertyName
  if (propertyName !== undefined) return childPointer(error.instancePath, propertyName)
  if (error.keyword === 'required') {
    return childPointer(error.instancePath, String(error.params.missingProperty))
  }
  if (error.keyword === 'additionalProperties') {
    return childPointer(error.instancePath, String(error.params.additionalProperty))
  }
  if (error.keyword === 'propertyNames') {
    return childPointer(error.instancePath, String(error.params.propertyName))
  }
  return error.instancePath
}

const schemaErrorCode = (error: ErrorObject) => {
  if (error.instancePath === '/schemaVersion' && error.keyword === 'const') {
    return 'unsupported_version'
  }
  return error.keyword
}

const schemaErrors = (errors: ErrorObject[] | null | undefined): AvatarDefinitionError[] =>
  (errors ?? []).map(error => ({
    path: schemaErrorPath(error),
    code: schemaErrorCode(error),
    message: error.message ?? 'Invalid avatar definition',
  }))

const inspectMaterializedValue = (value: unknown): AvatarDefinitionError[] => {
  const errors: AvatarDefinitionError[] = []
  const ancestors = new WeakSet<object>()

  const visit = (current: unknown, path: string) => {
    if (typeof current === 'number' && !Number.isFinite(current)) {
      errors.push({ path, code: 'non_finite_number', message: 'Number must be finite' })
      return
    }
    if (current === null || typeof current !== 'object') return
    if (ancestors.has(current)) {
      errors.push({ path, code: 'cyclic_value', message: 'Avatar definition must not be cyclic' })
      return
    }
    ancestors.add(current)
    if (!Array.isArray(current)) {
      const prototype = Object.getPrototypeOf(current)
      if (prototype !== Object.prototype && prototype !== null) {
        errors.push({ path, code: 'non_plain_object', message: 'Expected a plain object' })
        ancestors.delete(current)
        return
      }
    }
    Object.entries(current).forEach(([key, child]) => visit(child, childPointer(path, key)))
    ancestors.delete(current)
  }

  visit(value, '')
  return errors
}

const semanticErrors = (definition: AvatarDefinition): AvatarDefinitionError[] => {
  const errors: AvatarDefinitionError[] = []
  const expressionKeys = Object.keys(definition.expressions)
  const animationKeys = Object.keys(definition.animations)

  const checkCompleteOrder = (
    order: string[],
    keys: string[],
    path: '/expressionOrder' | '/animationOrder'
  ) => {
    const ordered = new Set(order)
    const knownKeys = new Set(keys)
    keys.forEach(key => {
      if (!ordered.has(key)) {
        errors.push({
          path,
          code: 'incomplete_order',
          message: `Order is missing key '${key}'`,
        })
      }
    })
    order.forEach((key, index) => {
      if (!knownKeys.has(key)) {
        errors.push({
          path: childPointer(path, index),
          code: 'unknown_order_key',
          message: `Unknown key '${key}'`,
        })
      }
    })
  }

  checkCompleteOrder(definition.expressionOrder, expressionKeys, '/expressionOrder')
  checkCompleteOrder(definition.animationOrder, animationKeys, '/animationOrder')
  if (definition.expressionOrder[0] !== 'neutral') {
    errors.push({
      path: '/expressionOrder/0',
      code: 'neutral_not_first',
      message: "'neutral' must be the first expression-order entry",
    })
  }
  Object.entries(definition.animations).forEach(([animationKey, animation]) => {
    if (animation.blink.minIntervalMs > animation.blink.maxIntervalMs) {
      errors.push({
        path: `/animations/${escapePointer(animationKey)}/blink/minIntervalMs`,
        code: 'invalid_interval_range',
        message: 'minIntervalMs must be less than or equal to maxIntervalMs',
      })
    }
    animation.steps.forEach((step, index) => {
      if (!(step.expression in definition.expressions)) {
        errors.push({
          path: `/animations/${escapePointer(animationKey)}/steps/${index}/expression`,
          code: 'unknown_expression',
          message: `Unknown expression '${step.expression}'`,
        })
      }
    })
  })
  return errors
}

const cloneAndFreeze = <T>(value: T): Readonly<T> => {
  if (value === null || typeof value !== 'object') return value
  const clone: unknown = Array.isArray(value)
    ? value.map(item => cloneAndFreeze(item))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAndFreeze(item)]))
  return Object.freeze(clone) as Readonly<T>
}

export const validateAvatarDefinition = (value: unknown): ValidationResult<AvatarDefinition> => {
  const structuralErrors = inspectMaterializedValue(value)
  if (structuralErrors.length) return { ok: false, errors: structuralErrors }
  const validateSchema = definitionSchema()
  if (!validateSchema(value)) return { ok: false, errors: schemaErrors(validateSchema.errors) }
  const errors = semanticErrors(value)
  return errors.length ? { ok: false, errors } : { ok: true, value: cloneAndFreeze(value) }
}
