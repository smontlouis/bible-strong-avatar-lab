import { Schema } from '@tiptap/pm/model'

import {
  nearestTalkCueDropPosition,
  talkCueDropPositions,
  talkCueInsertionAfterMove,
} from '@/features/talk/talkCueDrag'

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
    avatarCue: { atom: true, group: 'inline', inline: true },
  },
})

describe('Talk Mode cue dragging', () => {
  it('offers only paragraph edges and positions following spaces', () => {
    const document = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Bonjour tout le monde')]),
    ])

    expect(talkCueDropPositions(document, 7)).toEqual([1, 9, 14, 17, 22])
  })

  it('snaps a drop inside a word to the nearest word boundary', () => {
    const document = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Bonjour tout le monde')]),
    ])

    expect(nearestTalkCueDropPosition(document, 7)).toBe(9)
    expect(nearestTalkCueDropPosition(document, 15)).toBe(14)
  })

  it('keeps the chosen boundary stable when the original cue is removed', () => {
    expect(talkCueInsertionAfterMove(4, 1, 12)).toBe(11)
    expect(talkCueInsertionAfterMove(12, 1, 4)).toBe(4)
  })
})
