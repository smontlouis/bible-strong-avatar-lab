import { faceNames, faces } from '../faces'
import { clips } from '../catalogue'
import {
  characterFromLegacyDefinition,
  renderCharacterFrame,
  type AvatarCharacter,
} from '../character'
import {
  advancePlayer,
  createAvatarPlayer,
  playClip,
  playerFrame,
  type PlayerFrame,
} from '../player'
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
      perspective: 0,
      motion: { eyes: 'none', body: 'none' },
    },
  },
  expressionOrder: ['neutral'],
  animations: {},
  animationOrder: [],
}

const box = (path: string) => {
  const numbers = (path.match(/-?\d+\.?\d*/g) ?? []).map(Number)
  const xs = numbers.filter((_, index) => index % 2 === 0)
  const ys = numbers.filter((_, index) => index % 2 === 1)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

const resting = (): PlayerFrame => playerFrame(createAvatarPlayer())

describe('characters', () => {
  const character: AvatarCharacter = characterFromLegacyDefinition(legacy)

  it('gives every character the standard eyes, at the height its own were', () => {
    expect(character.face.eyes).toEqual({ width: 1, height: 1, gap: 1, shiftY: -0.1 })
    const small = characterFromLegacyDefinition({
      ...legacy,
      expressions: {
        neutral: {
          ...legacy.expressions.neutral,
          eyes: {
            left: { width: 12, height: 30, x: 0, y: -12, angle: 0 },
            right: { width: 12, height: 30, x: 0, y: -12, angle: 0 },
            spacing: 30,
          },
        },
      },
    })
    expect(small.face.eyes).toEqual(character.face.eyes)
  })

  it('draws the standard eyes at rest: two upright bars, level, each side of the middle', () => {
    const scene = renderCharacterFrame(character, resting())
    const left = box(scene.geometry.leftPath)
    const right = box(scene.geometry.rightPath)
    expect(left.maxX).toBeLessThan(0)
    expect(right.minX).toBeGreaterThan(0)
    // The eye is wrapped on the head: its outer half is seen slightly from the side, so its
    // middle on the screen is a little inside its place on the head.
    expect((left.minX + left.maxX) / 2).toBeGreaterThan(-0.31535 * 120)
    expect((left.minX + left.maxX) / 2).toBeLessThan(-0.29 * 120)
    expect(left.maxY - left.minY).toBeGreaterThan(0.54 * 120)
    expect(left.maxY - left.minY).toBeLessThan(0.575 * 120)
    // Shifted up by a tenth of the radius.
    expect((left.minY + left.maxY) / 2).toBeCloseTo(-12, 0)
    expect(scene.transform).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('turns the face to the right of the screen for a positive turn about y', () => {
    const frame = { ...resting(), rotation: [0, 30, 0] as [number, number, number] }
    const scene = renderCharacterFrame(character, frame)
    const rest = renderCharacterFrame(character, resting())
    expect(box(scene.geometry.rightPath).maxX).toBeGreaterThan(box(rest.geometry.rightPath).maxX)
    expect(box(scene.geometry.leftPath).minX).toBeGreaterThan(box(rest.geometry.leftPath).minX)
  })

  it('makes the face look down for a positive turn about x', () => {
    const frame = { ...resting(), rotation: [25, 0, 0] as [number, number, number] }
    const scene = renderCharacterFrame(character, frame)
    const rest = renderCharacterFrame(character, resting())
    expect(box(scene.geometry.leftPath).maxY).toBeGreaterThan(box(rest.geometry.leftPath).maxY)
  })

  it('rolls anticlockwise for a positive turn about z: the right eye rises', () => {
    const frame = { ...resting(), rotation: [0, 0, 20] as [number, number, number] }
    const scene = renderCharacterFrame(character, frame)
    const left = box(scene.geometry.leftPath)
    const right = box(scene.geometry.rightPath)
    expect((right.minY + right.maxY) / 2).toBeLessThan((left.minY + left.maxY) / 2)
  })

  it('moves the drawing up for a positive move along y, and sizes it with the zoom', () => {
    const scene = renderCharacterFrame(character, {
      ...resting(),
      position: [0.5, 0.25],
      zoom: 1.2,
    })
    expect(scene.transform).toEqual([2, 0, 0, 2, 120, -60])
  })

  it('keeps the base of the body in place when a stretch is anchored there', () => {
    const scene = renderCharacterFrame(character, {
      ...resting(),
      squash: [1.1, 0.8],
      squashAnchor: -1,
    })
    // The base is 120 below the middle: stretched to 96, then moved down by 24.
    expect(scene.transform[3] * 120 + scene.transform[5]).toBeCloseTo(120, 6)
  })

  it('never lets the two eyes touch, whatever the face and however close the eyes are set', () => {
    for (const gap of [1, 0.7, 0.45]) {
      const close: AvatarCharacter = {
        ...character,
        face: { ...character.face, eyes: { ...character.face.eyes, gap } },
      }
      for (const name of faceNames) {
        const frame = { ...resting(), face: name, eyes: faces[name].eyes }
        const scene = renderCharacterFrame(close, frame)
        const left = box(scene.geometry.leftPath)
        const right = box(scene.geometry.rightPath)
        expect(left.maxX).toBeLessThan(-1)
        expect(right.minX).toBeGreaterThan(1)
      }
    }
  })

  it('draws every clip of the catalogue on the character without a broken path', () => {
    for (const clip of Object.values(clips)) {
      const player = createAvatarPlayer()
      playClip(player, clip)
      for (let step = 0; step < 120; step += 1) {
        advancePlayer(player, clip.duration / 120)
        const scene = renderCharacterFrame(character, playerFrame(player))
        expect(scene.geometry.headPath).not.toContain('NaN')
        expect(scene.geometry.leftPath).not.toContain('NaN')
        expect(scene.transform.every(Number.isFinite)).toBe(true)
      }
    }
  })
})
