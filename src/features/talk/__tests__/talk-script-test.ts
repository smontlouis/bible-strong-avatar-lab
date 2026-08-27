import {
  compileTalkScript,
  createTalkScriptDocument,
  formatTalkTransformLabel,
  getTalkScriptStorageKey,
  loadTalkScriptDocument,
  nextTalkCueIndex,
  normalizeTalkScriptSpacing,
  parseTalkTag,
  persistTalkScriptDocument,
  serializeTalkScript,
  type TalkScriptDocument,
} from '@/features/talk/talkScript'

describe('Talk Mode script', () => {
  it('creates a plain editable document', () => {
    expect(compileTalkScript(createTalkScriptDocument('Bonjour !'))).toEqual({
      text: 'Bonjour !',
      cues: [],
    })
  })

  it('removes avatar cues from speech and keeps their exact character offsets', () => {
    const document: TalkScriptDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'avatarCue',
              attrs: { kind: 'expression', targetId: 'happy', label: 'happy' },
            },
            { type: 'text', text: 'Bonjour ' },
            {
              type: 'avatarCue',
              attrs: { kind: 'animation', targetId: 'wave', label: 'wave' },
            },
            { type: 'text', text: 'tout le monde.' },
          ],
        },
      ],
    }

    expect(compileTalkScript(document)).toEqual({
      text: 'Bonjour tout le monde.',
      cues: [
        { kind: 'expression', targetId: 'happy', label: 'happy', offset: 0 },
        { kind: 'animation', targetId: 'wave', label: 'wave', offset: 8 },
      ],
    })
  })

  it('compiles expression durations and partial transform cues', () => {
    const document: TalkScriptDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'avatarCue',
              attrs: {
                kind: 'expression',
                targetId: 'happy',
                label: 'happy',
                durationMs: 800,
              },
            },
            { type: 'text', text: 'Bonjour ' },
            {
              type: 'avatarCue',
              attrs: {
                kind: 'transform',
                label: 'custom transform',
                tx: 20,
                tz: 80,
                ry: 15,
                durationMs: 650,
              },
            },
            { type: 'text', text: 'ici.' },
          ],
        },
      ],
    }

    expect(compileTalkScript(document)).toEqual({
      text: 'Bonjour ici.',
      cues: [
        {
          kind: 'expression',
          targetId: 'happy',
          label: 'happy',
          durationMs: 800,
          offset: 0,
        },
        {
          kind: 'transform',
          transform: { tx: 20, tz: 80, ry: 15 },
          label: 'custom transform',
          durationMs: 650,
          offset: 8,
        },
      ],
    })
  })

  it('serializes the complete editable dialogue with bracket tags', () => {
    const document: TalkScriptDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bonjour ' },
            {
              type: 'avatarCue',
              attrs: { kind: 'expression', targetId: 'happy', label: 'happy', durationMs: 800 },
            },
            { type: 'text', text: ' ici ' },
            {
              type: 'avatarCue',
              attrs: { kind: 'transform', tx: 20, ry: -15, durationMs: 650 },
            },
          ],
        },
      ],
    }

    expect(serializeTalkScript(document)).toBe(
      'Bonjour [happy duration=800ms] ici [transform tx=20 ry=-15 duration=650ms]'
    )
  })

  it('keeps exactly one space around tags in copied dialogue', () => {
    expect(normalizeTalkScriptSpacing('  Bonjour   [happy]   [wave]monde  ')).toBe(
      'Bonjour [happy] [wave] monde'
    )
  })

  it('parses target and transform bracket syntax with optional durations', () => {
    expect(parseTalkTag('smiling duration=800ms')).toEqual({
      kind: 'target',
      target: 'smiling',
      durationMs: 800,
    })
    expect(parseTalkTag('transform tx=20 tz=80 ry=-15 duration=650ms')).toEqual({
      kind: 'transform',
      transform: { tx: 20, tz: 80, ry: -15 },
      durationMs: 650,
    })
    expect(parseTalkTag('transform tx=nope')).toBeNull()
    expect(parseTalkTag('smiling duration=6000ms')).toBeNull()
  })

  it('formats only the transform axes that are actually defined', () => {
    expect(formatTalkTransformLabel({ tx: 20, tz: 80, ry: -15 })).toBe('TX:20 TZ:80 RY:-15')
    expect(formatTalkTransformLabel({})).toBe('Transform')
    expect(formatTalkTransformLabel({ rx: 21.321409324823094 })).toBe('RX:21.32')
  })

  it('ignores duration metadata on animations', () => {
    const document: TalkScriptDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'avatarCue',
              attrs: {
                kind: 'animation',
                targetId: 'wave',
                label: 'wave',
                durationMs: 900,
              },
            },
          ],
        },
      ],
    }

    expect(compileTalkScript(document)).toEqual({
      text: '',
      cues: [{ kind: 'animation', targetId: 'wave', label: 'wave', offset: 0 }],
    })
  })

  it('preserves paragraph boundaries without speaking cue labels', () => {
    const document: TalkScriptDocument = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Ligne une.' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'avatarCue',
              attrs: { kind: 'expression', targetId: 'sad', label: 'sad' },
            },
            { type: 'text', text: 'Ligne deux.' },
          ],
        },
      ],
    }

    expect(compileTalkScript(document)).toEqual({
      text: 'Ligne une.\nLigne deux.',
      cues: [{ kind: 'expression', targetId: 'sad', label: 'sad', offset: 11 }],
    })
  })

  it('ignores unknown bracket tags in the spoken text', () => {
    expect(
      compileTalkScript(createTalkScriptDocument('Bonjour [does-not-exist] tout le monde.'))
    ).toEqual({
      text: 'Bonjour  tout le monde.',
      cues: [],
    })
  })

  it('ignores cue nodes whose target no longer exists', () => {
    const document: TalkScriptDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'avatarCue',
              attrs: { kind: 'expression', targetId: 'deleted', label: 'deleted' },
            },
            { type: 'text', text: 'Bonjour.' },
          ],
        },
      ],
    }

    expect(
      compileTalkScript(document, { expressionIds: ['happy'], animationIds: ['wave'] })
    ).toEqual({
      text: 'Bonjour.',
      cues: [],
    })
  })

  it('keeps unknown cue nodes silent', () => {
    const document: TalkScriptDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'avatarCue',
              attrs: { kind: 'unknown', targetId: '', label: 'does-not-exist' },
            },
            { type: 'text', text: 'Bonjour.' },
          ],
        },
      ],
    }

    expect(compileTalkScript(document)).toEqual({ text: 'Bonjour.', cues: [] })
  })

  it('persists and restores a separate rich-text draft for each avatar', () => {
    const document = createTalkScriptDocument('Texte sauvegardé')
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(persistTalkScriptDocument('avatar/a', document, storage)).toBe(true)
    expect(
      loadTalkScriptDocument('avatar/a', createTalkScriptDocument('Fallback'), storage)
    ).toEqual(document)
    expect(
      loadTalkScriptDocument('avatar-b', createTalkScriptDocument('Fallback'), storage)
    ).toEqual(createTalkScriptDocument('Fallback'))
    expect(getTalkScriptStorageKey('avatar/a')).not.toBe(getTalkScriptStorageKey('avatar-b'))
  })

  it('falls back safely when a stored draft is invalid', () => {
    const fallback = createTalkScriptDocument('Fallback')
    expect(
      loadTalkScriptDocument('avatar-a', fallback, {
        getItem: () => '{invalid',
      })
    ).toBe(fallback)
    expect(
      persistTalkScriptDocument('avatar-a', fallback, {
        setItem: () => {
          throw new Error('Storage unavailable')
        },
      })
    ).toBe(false)
  })

  it('dispatches a cue before the audio chunk that reaches its offset', () => {
    const cues = [
      { kind: 'expression' as const, targetId: 'happy', label: 'happy', offset: 8 },
      { kind: 'animation' as const, targetId: 'wave', label: 'wave', offset: 10 },
      { kind: 'expression' as const, targetId: 'sad', label: 'sad', offset: 12 },
    ]

    expect(nextTalkCueIndex(cues, 0, 8, 4)).toBe(2)
    expect(nextTalkCueIndex(cues, 2, 12, 1)).toBe(3)
  })
})
