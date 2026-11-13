import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js'

import {
  validateAvatarDefinition,
  type AvatarDefinitionError,
  type ValidationResult,
} from './avatarDefinition'
import avatarDefinitionSchema from './avatarDefinition.schema.json'
import { characterFromLegacyDefinition, type AvatarCharacter } from './character'

// A character as a file holds it: what the Studio exports, and what an app gives a renderer.
// The parts of the body, the colours, the outline, the nose and the mouth are those of the first
// format, so their rules are taken from its schema.

const LEGACY_SCHEMA = 'bible-strong/avatar-definition'

const characterSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://avatars.bible-strong.app/schema/avatar-character.json',
  title: 'Bible Strong avatar character',
  type: 'object',
  additionalProperties: false,
  required: ['body', 'colors', 'face'],
  properties: {
    name: { type: 'string', maxLength: 120 },
    body: { $ref: '#/$defs/body' },
    colors: { $ref: '#/$defs/colors' },
    style: { $ref: '#/$defs/style' },
    face: {
      type: 'object',
      additionalProperties: false,
      required: ['eyes', 'perspective'],
      properties: {
        eyes: {
          type: 'object',
          additionalProperties: false,
          required: ['width', 'height', 'gap', 'shiftY'],
          properties: {
            width: { type: 'number', minimum: 0.1, maximum: 4 },
            height: { type: 'number', minimum: 0.1, maximum: 4 },
            gap: { type: 'number', minimum: 0, maximum: 4 },
            shiftY: { type: 'number', minimum: -1, maximum: 1 },
          },
        },
        nose: { $ref: '#/$defs/nose' },
        mouth: { $ref: '#/$defs/mouth' },
        perspective: { type: 'number', minimum: 0, maximum: 10 },
      },
    },
  },
  $defs: avatarDefinitionSchema.$defs,
} as const

// Compiled on first use: a renderer that is given a checked character never pays for it.
let compiled: ValidateFunction<AvatarCharacter> | undefined
const validateSchema = () =>
  (compiled ??= new Ajv2020({ allErrors: true, strict: true }).compile<AvatarCharacter>(
    characterSchema
  ))

const pointer = (path: string, segment: unknown) =>
  `${path}/${String(segment).replaceAll('~', '~0').replaceAll('/', '~1')}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Whether a value is a character as the Studio exports it. */
export const validateCharacter = (value: unknown): ValidationResult<AvatarCharacter> => {
  const validate = validateSchema()
  // A copy, through JSON: React Native has no `structuredClone` everywhere.
  if (validate(value)) {
    return { ok: true, value: JSON.parse(JSON.stringify(value)) as AvatarCharacter }
  }
  const errors: AvatarDefinitionError[] = (validate.errors ?? []).map(error => ({
    path:
      error.keyword === 'required'
        ? pointer(error.instancePath, error.params.missingProperty)
        : error.keyword === 'additionalProperties'
          ? pointer(error.instancePath, error.params.additionalProperty)
          : error.instancePath,
    code: error.keyword,
    message: error.message ?? 'Invalid avatar character',
  }))
  return { ok: false, errors }
}

/**
 * The character of a file: a character exported by the Studio, or an `.avatar.json` of the first
 * format, of which only the character is kept.
 */
export const readCharacter = (value: unknown): ValidationResult<AvatarCharacter> => {
  if (isRecord(value) && value.schema === LEGACY_SCHEMA) {
    const definition = validateAvatarDefinition(value)
    return definition.ok
      ? { ok: true, value: characterFromLegacyDefinition(definition.value) }
      : definition
  }
  return validateCharacter(value)
}

/** The character of a file, or an error that says what is wrong with it. */
export const characterOf = (value: unknown): AvatarCharacter => {
  const result = readCharacter(value)
  if (result.ok) return result.value as AvatarCharacter
  const first = result.errors[0]
  throw new Error(
    first
      ? `Invalid avatar character${first.path ? ` at ${first.path}` : ''}: ${first.message}`
      : 'Invalid avatar character.'
  )
}
