import { clips, sampleClipTrack, type ClipDefinition } from '@bible-strong/avatar-core'

import { DEFAULT_EASE, presetOfEase } from '@/features/editor/clipEasings'
import {
  addClipKey,
  clipFileName,
  clipNameProblem,
  createClip,
  deleteClipKey,
  duplicateClip,
  freeClipName,
  loadCustomClips,
  moveClipKey,
  parseClip,
  parseCustomClips,
  persistCustomClips,
  setClipDuration,
  setClipFaceKey,
  setClipKeyEase,
  setClipKeyValue,
  setClipRestTime,
  setClipTrackEase,
} from '@/features/editor/clipLibrary'

const memory = () => {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  }
}

const turning = (): ClipDefinition => ({
  name: 'Turn',
  duration: 2,
  tracks: {
    rotation: [
      { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
      { t: 1, v: [0, 360, 0] },
    ],
  },
})

describe('custom clip names', () => {
  it('keeps the catalogue names for the catalogue', () => {
    expect(clipNameProblem('Idle_A', [])).toBe('catalogue')
    expect(freeClipName('Idle_A', [])).toBe('Idle_A 2')
  })

  it('numbers a name another custom clip has', () => {
    const custom = [createClip('Wave'), createClip('Wave 2')]
    expect(clipNameProblem('Wave', custom)).toBe('taken')
    expect(clipNameProblem('Wave', custom, 'Wave')).toBeNull()
    expect(clipNameProblem('  ', custom)).toBe('empty')
    expect(freeClipName('Wave', custom)).toBe('Wave 3')
  })
})

describe('custom clips', () => {
  it('copies a catalogue clip without touching it', () => {
    const source = clips.Done_A
    const before = JSON.stringify(source)
    const copy = duplicateClip(source, 'Done_A copie')
    copy.tracks.position![0].v = [9, 9] as never
    expect(JSON.stringify(source)).toBe(before)
    expect(copy.name).toBe('Done_A copie')
    expect(copy.squashAnchor).toBe(source.squashAnchor)
  })

  it('adds a key with the value the track has at its time', () => {
    const clip = turning()
    const { clip: next, index } = addClipKey(clip, 'rotation', 0.5)
    expect(index).toBe(1)
    const keys = next.tracks.rotation!
    expect(keys.map(key => key.t)).toEqual([0, 0.5, 1])
    expect(keys[1].v).toEqual(sampleClipTrack(clip.tracks.rotation!, 0.5))
    // It takes the curve of the passage it falls in.
    expect(keys[1].ease).toEqual([0.42, 0, 0.58, 1])
  })

  it('starts a track at rest, with the usual curve', () => {
    const { clip } = addClipKey(createClip('Empty'), 'squash', 0.3)
    expect(clip.tracks.squash).toEqual([{ t: 0.3, v: [1, 1], ease: DEFAULT_EASE }])
    const { clip: faces } = addClipKey(clip, 'expression', 1)
    expect(faces.tracks.expression).toEqual([{ t: 1, v: 'neutral' }])
  })

  it('returns the key already at a time instead of adding another', () => {
    const clip = turning()
    const result = addClipKey(clip, 'rotation', 1)
    expect(result.clip).toBe(clip)
    expect(result.index).toBe(1)
  })

  it('moves a key past another and follows it to its new place', () => {
    const { clip, index } = moveClipKey(turning(), 'rotation', 0, 1.5)
    expect(index).toBe(1)
    expect(clip.tracks.rotation!.map(key => key.t)).toEqual([1, 1.5])
    expect(clip.tracks.rotation![1].v).toEqual([0, 0, 0])
  })

  it('keeps a moved key within the clip, on the millisecond', () => {
    const { clip } = moveClipKey(turning(), 'rotation', 1, 7.12345)
    expect(clip.tracks.rotation![1].t).toBe(2)
    expect(moveClipKey(turning(), 'rotation', 1, 0.33333).clip.tracks.rotation![1].t).toBe(0.333)
  })

  it('drops a track with its last key', () => {
    const once = deleteClipKey(turning(), 'rotation', 0)
    expect(once.tracks.rotation).toHaveLength(1)
    expect(deleteClipKey(once, 'rotation', 0).tracks).toEqual({})
  })

  it('sets one number of a key, and the curve to the next', () => {
    let clip = setClipKeyValue(turning(), 'rotation', 1, 2, 15)
    expect(clip.tracks.rotation![1].v).toEqual([0, 360, 15])
    clip = setClipKeyEase(clip, 'rotation', 0, [1.4, 2.5, -0.2, -3])
    expect(clip.tracks.rotation![0].ease).toEqual([1, 2, 0, -1])
    clip = setClipTrackEase(clip, 'rotation', [0.34, 1.56, 0.64, 1])
    expect(clip.tracks.rotation!.map(key => presetOfEase(key.ease!)?.id)).toEqual([
      'back-out',
      'back-out',
    ])
  })

  it('sets a face key and drops a cut set back to off', () => {
    let clip = addClipKey(createClip('Face'), 'expression', 0).clip
    clip = setClipFaceKey(clip, 0, { v: 'happy', cut: true })
    expect(clip.tracks.expression).toEqual([{ t: 0, v: 'happy', cut: true }])
    clip = setClipFaceKey(clip, 0, { cut: false })
    expect(clip.tracks.expression).toEqual([{ t: 0, v: 'happy' }])
  })

  it('does not shorten a clip past its last key', () => {
    const clip = setClipRestTime(turning(), 1.8)
    const shorter = setClipDuration(clip, 0.5)
    expect(shorter.duration).toBe(1)
    expect(shorter.workArea).toEqual({ start: 1, end: 1 })
    expect(setClipDuration(clip, 3).duration).toBe(3)
  })
})

describe('reading and keeping custom clips', () => {
  it('reads back every clip of the catalogue', () => {
    // A field the catalogue leaves `null` is read as left out.
    const withoutNulls = (value: unknown) =>
      JSON.parse(JSON.stringify(value, (_, item) => (item === null ? undefined : item)))
    for (const clip of Object.values(clips)) {
      expect(parseClip(JSON.parse(JSON.stringify(clip)))).toEqual(withoutNulls(clip))
    }
  })

  it('refuses what is not a clip', () => {
    expect(parseClip(null)).toBeNull()
    expect(parseClip({ name: 'A', duration: 0, tracks: {} })).toBeNull()
    expect(
      parseClip({ name: 'A', duration: 1, tracks: { rotation: [{ t: 0, v: [1, 2] }] } })
    ).toBeNull()
    expect(
      parseClip({ name: 'A', duration: 1, tracks: { lids: [{ t: 0, v: [0], ease: [0, 0] }] } })
    ).toBeNull()
  })

  it('keeps clips between two visits, under names of their own', () => {
    const storage = memory()
    persistCustomClips([turning(), createClip('Wave')], storage)
    expect(loadCustomClips(storage).map(clip => clip.name)).toEqual(['Turn', 'Wave'])
    expect(
      parseCustomClips([turning(), turning(), { name: 'Idle_A', duration: 1, tracks: {} }]).map(
        clip => clip.name
      )
    ).toEqual(['Turn', 'Turn 2', 'Idle_A 2'])
  })

  it('names the file after the clip', () => {
    expect(clipFileName(createClip('Petit salut !'))).toBe('Petit-salut.clip.json')
  })
})
