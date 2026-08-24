import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'
import avatarDefinitionSchema from './avatarDefinition.schema.json'
import type { SurfaceType } from './surfaces'

export const AVATAR_DEFINITION_MAX_BYTES = 262_144
export const AVATAR_DEFINITION_MAX_DEPTH = 32
const MAX_JSON_STRING_LENGTH = 512
export const SEMANTIC_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

export type SemanticKeyIssueCode =
  'missing_semantic_key' | 'invalid_semantic_key' | 'reserved_semantic_key'

export const getSemanticKeyIssue = (
  semanticKey: string | undefined,
  kind: 'expression' | 'animation'
): SemanticKeyIssueCode | undefined => {
  if (!semanticKey) return 'missing_semantic_key'
  if (!SEMANTIC_KEY_PATTERN.test(semanticKey) || semanticKey.length > 64) {
    return 'invalid_semantic_key'
  }
  if (kind === 'expression' && semanticKey === 'neutral') return 'reserved_semantic_key'
  return undefined
}

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
}

export type BodyNodeSurfaceType = Exclude<SurfaceType, 'mickey' | 'cursor' | 'ghost'>
export type PrimarySurfaceDefinition = SurfaceDefinition<SurfaceType>
export type BodyNodeSurfaceDefinition = SurfaceDefinition<BodyNodeSurfaceType>

export type AvatarBodyNodeDefinition = {
  layer?: 'auto' | 'front' | 'back'
  surface: BodyNodeSurfaceDefinition
  position: [number, number, number]
  rotation: [number, number, number]
}

export type AvatarBodyDefinition = {
  primary: PrimarySurfaceDefinition
  nodes: AvatarBodyNodeDefinition[]
}

export type AvatarExpressionDefinition = {
  head: { x: number; y: number; z: number }
  eyes: {
    left: { width: number; height: number; x: number; y: number; angle: number }
    right: { width: number; height: number; x: number; y: number; angle: number }
    spacing: number
  }
  perspective: number
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

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateSchema = ajv.compile<AvatarDefinition>(avatarDefinitionSchema)

const escapePointer = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1')
const childPointer = (path: string, segment: string | number) =>
  `${path}/${escapePointer(String(segment))}`
const stringLength = (value: string) => [...value].length

const stringLimitAt = (path: string) => {
  if (
    /^\/(?:expressionOrder|animationOrder)\/\d+$/.test(path) ||
    /^\/animations\/[^/]+\/steps\/\d+\/expression$/.test(path) ||
    /^\/animations\/[^/]+\/metadata\/group$/.test(path)
  ) {
    return 64
  }
  if (path === '/name' || /^\/animations\/[^/]+\/metadata\/label$/.test(path)) return 120
  return MAX_JSON_STRING_LENGTH
}

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
  if (!validateSchema(value)) return { ok: false, errors: schemaErrors(validateSchema.errors) }
  const errors = semanticErrors(value)
  return errors.length ? { ok: false, errors } : { ok: true, value: cloneAndFreeze(value) }
}

class JsonTextError extends Error {
  constructor(
    readonly path: string,
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

class BoundedJsonParser {
  private index = 0

  constructor(private readonly source: string) {}

  parse(): unknown {
    this.skipWhitespace()
    const value = this.parseValue('', 1)
    this.skipWhitespace()
    if (this.index !== this.source.length)
      this.fail('', 'invalid_json', 'Unexpected trailing input')
    return value
  }

  private fail(path: string, code: string, message: string): never {
    throw new JsonTextError(path, code, `${message} at character ${this.index}`)
  }

  private skipWhitespace() {
    while (
      (this.source[this.index] === ' ' ||
        this.source[this.index] === '\n' ||
        this.source[this.index] === '\r' ||
        this.source[this.index] === '\t') &&
      this.index < this.source.length
    ) {
      this.index += 1
    }
  }

  private parseValue(path: string, depth: number): unknown {
    this.skipWhitespace()
    const character = this.source[this.index]
    if (character === '{' || character === '[') {
      if (depth > AVATAR_DEFINITION_MAX_DEPTH) {
        this.fail(path, 'max_depth', `JSON nesting depth exceeds ${AVATAR_DEFINITION_MAX_DEPTH}`)
      }
      return character === '{' ? this.parseObject(path, depth) : this.parseArray(path, depth)
    }
    if (character === '"') return this.parseString(path)
    if (character === '-' || (character >= '0' && character <= '9')) return this.parseNumber(path)
    if (this.source.startsWith('true', this.index)) return this.parseLiteral('true', true)
    if (this.source.startsWith('false', this.index)) return this.parseLiteral('false', false)
    if (this.source.startsWith('null', this.index)) return this.parseLiteral('null', null)
    this.fail(path, 'invalid_json', 'Expected a JSON value')
  }

  private parseObject(path: string, depth: number) {
    this.index += 1
    this.skipWhitespace()
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    const keys = new Set<string>()
    if (this.source[this.index] === '}') {
      this.index += 1
      return result
    }
    while (this.index < this.source.length) {
      if (this.source[this.index] !== '"') this.fail(path, 'invalid_json', 'Expected an object key')
      const key = this.parseString(path)
      const keyPath = childPointer(path, key)
      if ((path === '/expressions' || path === '/animations') && stringLength(key) > 64) {
        this.fail(keyPath, 'string_too_long', 'Semantic key exceeds 64 characters')
      }
      if (keys.has(key)) this.fail(keyPath, 'duplicate_key', `Duplicate object member '${key}'`)
      keys.add(key)
      this.skipWhitespace()
      if (this.source[this.index] !== ':') this.fail(keyPath, 'invalid_json', "Expected ':'")
      this.index += 1
      result[key] = this.parseValue(keyPath, depth + 1)
      this.skipWhitespace()
      const separator = this.source[this.index]
      if (separator === '}') {
        this.index += 1
        return result
      }
      if (separator !== ',') this.fail(path, 'invalid_json', "Expected ',' or '}'")
      this.index += 1
      this.skipWhitespace()
    }
    this.fail(path, 'invalid_json', 'Unterminated object')
  }

  private parseArray(path: string, depth: number) {
    this.index += 1
    this.skipWhitespace()
    const result: unknown[] = []
    if (this.source[this.index] === ']') {
      this.index += 1
      return result
    }
    while (this.index < this.source.length) {
      result.push(this.parseValue(childPointer(path, result.length), depth + 1))
      this.skipWhitespace()
      const separator = this.source[this.index]
      if (separator === ']') {
        this.index += 1
        return result
      }
      if (separator !== ',') this.fail(path, 'invalid_json', "Expected ',' or ']'")
      this.index += 1
    }
    this.fail(path, 'invalid_json', 'Unterminated array')
  }

  private parseString(path: string): string {
    const start = this.index
    this.index += 1
    let escaped = false
    while (this.index < this.source.length) {
      const character = this.source[this.index]
      if (!escaped && character === '"') {
        this.index += 1
        let value: string
        try {
          value = JSON.parse(this.source.slice(start, this.index)) as string
        } catch {
          this.fail(path, 'invalid_json', 'Invalid JSON string')
        }
        const limit = stringLimitAt(path)
        if (stringLength(value) > limit) {
          this.fail(path, 'string_too_long', `JSON string exceeds ${limit} characters`)
        }
        return value
      }
      if (!escaped && character.charCodeAt(0) < 0x20) {
        this.fail(path, 'invalid_json', 'Unescaped control character')
      }
      if (!escaped && character === '\\') escaped = true
      else escaped = false
      this.index += 1
      if (this.index - start > MAX_JSON_STRING_LENGTH * 12 + 2) {
        this.fail(
          path,
          'string_too_long',
          `JSON string exceeds ${MAX_JSON_STRING_LENGTH} characters`
        )
      }
    }
    this.fail(path, 'invalid_json', 'Unterminated string')
  }

  private parseNumber(path: string): number {
    const remaining = this.source.slice(this.index)
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(remaining)
    if (!match) this.fail(path, 'invalid_json', 'Invalid number')
    this.index += match[0].length
    const number = Number(match[0])
    if (!Number.isFinite(number)) this.fail(path, 'non_finite_number', 'Number must be finite')
    return number
  }

  private parseLiteral<T>(source: string, value: T): T {
    this.index += source.length
    return value
  }
}

export const parseAvatarDefinition = (text: string): ValidationResult<AvatarDefinition> => {
  if (new TextEncoder().encode(text).byteLength > AVATAR_DEFINITION_MAX_BYTES) {
    return {
      ok: false,
      errors: [
        {
          path: '',
          code: 'max_bytes',
          message: `JSON input exceeds ${AVATAR_DEFINITION_MAX_BYTES} UTF-8 bytes`,
        },
      ],
    }
  }
  try {
    return validateAvatarDefinition(new BoundedJsonParser(text).parse())
  } catch (error) {
    if (error instanceof JsonTextError) {
      return {
        ok: false,
        errors: [{ path: error.path, code: error.code, message: error.message }],
      }
    }
    return {
      ok: false,
      errors: [{ path: '', code: 'invalid_json', message: 'Invalid JSON input' }],
    }
  }
}

export const avatarDefinitionFileName = (name: string) => {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'avatar'
  return `${base}.avatar.json`
}
