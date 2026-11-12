import {
  createJevDirectedTalkDocument,
  segmentTalkDirectionBeats,
} from '@/features/talk/jevDirection'
import { compileTalkScript } from '@/features/talk/talkScript'

describe('Jev talk direction', () => {
  it('splits dialogue into short contextual beats at punctuation and word limits', () => {
    const beats = segmentTalkDirectionBeats(
      'Bonjour, ceci est un premier test assez long pour bouger. Et maintenant, surprise !'
    )

    expect(beats.map(beat => beat.text)).toEqual([
      'Bonjour, ceci est un premier test assez long',
      'pour bouger.',
      'Et maintenant, surprise !',
    ])
    expect(beats[1].startOffset).toBeGreaterThan(beats[0].startOffset)
  })

  it('turns Jev choices into expression cues without changing the spoken text', () => {
    const text = 'Bonjour tout le monde. Puis je souris.'
    const beats = segmentTalkDirectionBeats(text)
    const expressions = [
      { id: 'happy', label: 'joyful-wide' },
      { id: 'sad', label: 'skeptical-left' },
    ]
    const document = createJevDirectedTalkDocument(
      text,
      beats,
      [
        {
          beatId: beats[0].id,
          expressionId: 'happy',
          confidence: 0.9,
          movementId: null,
          movementConfidence: 0.8,
          intensity: 0.2,
        },
        {
          beatId: beats[1].id,
          expressionId: 'happy',
          confidence: 0.8,
          movementId: null,
          movementConfidence: 0.9,
          intensity: 0.2,
        },
      ],
      expressions
    )
    const compiled = compileTalkScript(document, {
      expressionIds: expressions.map(expression => expression.id),
      animationIds: [],
    })

    expect(compiled.text).toBe(text)
    expect(compiled.cues).toHaveLength(1)
    expect(compiled.cues[0]).toMatchObject({ kind: 'expression', targetId: 'happy', offset: 0 })
  })

  it('scales a semantic movement by Jev intensity and explicitly resets it', () => {
    const text = 'Viens voir. Maintenant reste tranquille.'
    const beats = segmentTalkDirectionBeats(text)
    const expressions = [
      { id: 'expression-neutral', label: 'neutral' },
      { id: 'happy', label: 'joyful-wide' },
    ]
    const document = createJevDirectedTalkDocument(
      text,
      beats,
      [
        {
          beatId: beats[0].id,
          expressionId: 'happy',
          confidence: 0.8,
          movementId: 'move-closer',
          movementConfidence: 0.9,
          intensity: 0.5,
        },
        {
          beatId: beats[1].id,
          expressionId: 'happy',
          confidence: 0.8,
          movementId: null,
          movementConfidence: 0.9,
          intensity: 0.2,
        },
      ],
      expressions
    )
    const compiled = compileTalkScript(document, {
      expressionIds: expressions.map(expression => expression.id),
      animationIds: [],
    })

    expect(compiled.cues).toHaveLength(3)
    expect(compiled.cues[1]).toMatchObject({
      kind: 'transform',
      transform: { tz: 55 },
      durationMs: 550,
    })
    expect(compiled.cues[2]).toMatchObject({
      kind: 'transform',
      transform: { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 },
    })
  })
})
