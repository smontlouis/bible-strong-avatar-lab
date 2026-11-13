import { characterFromLegacyDefinition, type AvatarCharacter } from '../character'
import { characterOf, readCharacter, validateCharacter } from '../characterFile'
import type { AvatarDefinition } from '../avatarDefinition'

const legacy: AvatarDefinition = {
  schema: 'bible-strong/avatar-definition',
  schemaVersion: 1,
  name: 'Ball',
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [],
  },
  colors: { body: '#5b7fe5', eyes: '#17191d' },
  expressions: {
    neutral: {
      head: { x: 0, y: 0, z: 0 },
      eyes: {
        left: { width: 31.2, height: 68.4, x: 0, y: -12, angle: 0 },
        right: { width: 31.2, height: 68.4, x: 0, y: -12, angle: 0 },
        spacing: 75.684,
      },
      perspective: 1,
      motion: { eyes: 'none', body: 'none' },
    },
  },
  expressionOrder: ['neutral'],
  animations: {},
  animationOrder: [],
}

const character: AvatarCharacter = {
  name: 'Strobi',
  body: {
    primary: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
    nodes: [],
  },
  colors: { body: '#5b7fe5', eyes: '#17191d' },
  style: { outline: { enabled: true, color: '#111111', width: 4, opacity: 1 } },
  face: {
    eyes: { width: 1.2, height: 1.2, gap: 0.9, shiftY: -0.1 },
    mouth: {
      enabled: true,
      shape: 'curve',
      curve: 0.4,
      width: 30,
      height: 8,
      x: 0,
      y: 40,
      angle: 0,
    },
    perspective: 1,
  },
}

describe('character files', () => {
  it('reads a character as the Studio exports it, as a copy', () => {
    const result = validateCharacter(character)
    expect(result).toEqual({ ok: true, value: character })
    if (result.ok) expect(result.value).not.toBe(character)
  })

  it('accepts a flat face: a perspective of zero', () => {
    const flat = { ...character, face: { ...character.face, perspective: 0 } }
    expect(validateCharacter(flat).ok).toBe(true)
  })

  it('says where a character is wrong', () => {
    const result = validateCharacter({ ...character, face: { perspective: 1 } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatchObject({ path: '/face/eyes', code: 'required' })
    const extra = validateCharacter({ ...character, expressions: {} })
    expect(extra.ok).toBe(false)
    if (!extra.ok) expect(extra.errors[0].path).toBe('/expressions')
  })

  it('keeps only the character of a file of the first format', () => {
    expect(readCharacter(legacy)).toEqual({
      ok: true,
      value: characterFromLegacyDefinition(legacy),
    })
    const broken = readCharacter({ ...legacy, expressions: {} })
    expect(broken.ok).toBe(false)
  })

  it('throws with the first fault when asked for the character outright', () => {
    expect(characterOf(character)).toEqual(character)
    expect(() => characterOf({ body: {} })).toThrow(/Invalid avatar character at \/colors/)
  })
})
