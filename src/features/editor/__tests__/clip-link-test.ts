import { readFileSync } from 'node:fs'
import path from 'node:path'

import { clips, faces, type ClipDefinition } from '@bible-strong/avatar-core'
import Ajv2020 from 'ajv/dist/2020.js'

import { clipSheet, MAX_SHEET_FRAMES, sheetTimes } from '@/features/editor/clipFrames'
import { checkClip } from '@/features/editor/clipLibrary'
import { clipLinkHash, readClipLink } from '@/features/editor/clipLink'

const hop: ClipDefinition = {
  name: 'Hop & saut #1 — é',
  duration: 1,
  squashAnchor: -1,
  tracks: {
    position: [
      { t: 0, v: [0, 0], ease: [0.33, 1, 0.68, 1] },
      { t: 0.5, v: [0, 0.2], ease: [0.32, 0, 0.67, 0] },
      { t: 1, v: [0, 0] },
    ],
    expression: [{ t: 0.2, v: 'happy' }],
  },
}

describe('the link of a draft', () => {
  it('carries the clip and its view there and back, whatever its name holds', () => {
    const hash = clipLinkHash(hop, { view: 'frames', fps: 12 })
    expect(hash.startsWith('#view=frames&fps=12&clip=')).toBe(true)
    // Only what would break the fragment is encoded: the clip stays readable.
    expect(hash).toContain('{%22name%22:%22Hop%20&%20saut%20%231')
    const link = readClipLink(hash)
    expect(link?.clip).toEqual(hop)
    expect(link?.view).toEqual({ view: 'frames', fps: 12 })
  })

  it('names the avatar to show the clip on, before the clip', () => {
    const hash = clipLinkHash(hop, { view: 'timeline', fps: 30 }, 'grok-bot')
    expect(hash.startsWith('#avatar=grok-bot&clip=')).toBe(true)
    expect(readClipLink(hash)?.avatar).toBe('grok-bot')
    expect(readClipLink(`#view=frames&avatar=Strobi&clip=${JSON.stringify(hop)}`)?.avatar).toBe(
      'strobi'
    )
  })

  it('leaves out the view the Studio opens on anyway', () => {
    expect(clipLinkHash(hop, { view: 'timeline', fps: 30 }).startsWith('#clip={')).toBe(true)
  })

  it('reads a clip written as it is, or percent-encoded', () => {
    const json = JSON.stringify(hop)
    expect(readClipLink(`#clip=${json}`)?.clip).toEqual(hop)
    expect(readClipLink(`#clip=${encodeURIComponent(json)}`)?.clip).toEqual(hop)
  })

  it('reads a link that an app encoded again, or whose quotes it curled', () => {
    const hash = clipLinkHash(hop, { view: 'frames', fps: 12 })
    expect(readClipLink(hash.replace(/%/g, '%25'))?.clip).toEqual(hop)
    expect(readClipLink(hash.replace(/%/g, '%25').replace(/%/g, '%25'))?.clip).toEqual(hop)
    const curled = `#clip=${JSON.stringify(hop)}`.replace(/"([^"]*)"/g, '“$1”')
    expect(readClipLink(curled)?.clip).toEqual(hop)
    // Quotes of a name that are meant are kept.
    const quoted = { ...hop, name: 'Le « saut »' }
    expect(readClipLink(clipLinkHash(quoted, { view: 'timeline', fps: 30 }))?.clip?.name).toBe(
      'Le « saut »'
    )
  })

  it('shows the start of a link it cannot read', () => {
    expect(readClipLink('#clip={%22name%22:%22Ho')?.problem?.message).toMatch(
      /the link starts "\{\\"name\\":\\"Ho"/
    )
  })

  it('ignores an address that holds no clip, and a view it does not know', () => {
    expect(readClipLink('')).toBeNull()
    expect(readClipLink('#view=frames')).toBeNull()
    expect(readClipLink(`#view=film&fps=7&clip=${JSON.stringify(hop)}`)?.view).toEqual({})
  })

  it('says where a clip goes wrong', () => {
    expect(readClipLink('#clip={"name":')?.problem?.path).toBe('clip')
    expect(
      readClipLink(`#clip=${JSON.stringify({ ...hop, tracks: { squash: [{ t: 0, v: [1] }] } })}`)
        ?.problem
    ).toEqual({ path: 'tracks.squash[0].v', message: 'expected 2 numbers' })
    expect(
      readClipLink(`#clip=${JSON.stringify({ ...hop, tracks: { wobble: [] } })}`)?.problem?.path
    ).toBe('tracks.wobble')
    expect(
      readClipLink(
        `#clip=${JSON.stringify({ ...hop, tracks: { lids: [{ t: 0, v: [0], ease: [2, 0, 1, 1] }] } })}`
      )?.problem?.message
    ).toBe('x1 and x2 must be between 0 and 1')
  })
})

describe('the sheet of a clip', () => {
  it('takes every frame of the rate, and the last moment of the clip', () => {
    expect(sheetTimes(1, 12)).toHaveLength(13)
    expect(sheetTimes(1, 12).at(-1)).toBe(1)
    expect(sheetTimes(0.5, 12)).toHaveLength(7)
    expect(sheetTimes(1.05, 12).slice(-2)).toEqual([1, 1.05])
  })

  it('starts on the clip’s first face, as a loop does', () => {
    const sad: ClipDefinition = {
      name: 'Sad',
      duration: 1,
      tracks: { expression: [{ t: 0, v: 'sad' }] },
    }
    const [first] = clipSheet(sad, 12)
    expect(first.frame.face).toBe('sad')
    expect(first.frame.eyes).toEqual(faces.sad.eyes)
  })

  it('spreads its frames over a clip too long for the rate', () => {
    const times = sheetTimes(60, 60)
    expect(times.length).toBeLessThanOrEqual(MAX_SHEET_FRAMES + 1)
    expect(times.at(-1)).toBe(60)
  })

  it('draws the clip as it plays: the body at the top of the hop, the face changed', () => {
    const frames = clipSheet(hop, 12)
    expect(frames[0].frame.position[1]).toBeCloseTo(0)
    expect(frames[6].time).toBeCloseTo(0.5)
    expect(frames[6].frame.position[1]).toBeCloseTo(0.2, 2)
    expect(frames[0].frame.face).toBe('neutral')
    expect(frames[6].frame.face).toBe('happy')
    // The last frame is the end of the clip, not its start come round again.
    expect(frames.at(-1)!.frame.position[1]).toBeCloseTo(0, 2)
  })
})

describe('the guide to writing clips', () => {
  const guide = readFileSync(path.join(__dirname, '../../../../public/clip-authoring.md'), 'utf8')

  it('gives an example the Studio reads, which ends at rest and loops cleanly', () => {
    const example = guide.split('## A complete example')[1].match(/```json\n([\s\S]*?)```/)![1]
    const checked = checkClip(JSON.parse(example))
    expect(checked.problem).toBeUndefined()
    const frames = clipSheet(checked.clip!, 30)
    const last = frames.at(-1)!.frame
    expect(last.position[1]).toBeCloseTo(0, 2)
    expect(last.squash[0]).toBeCloseTo(1, 2)
    expect(last.rotation[0]).toBeCloseTo(0, 1)
  })
})

describe('the schema of a clip', () => {
  const schema = JSON.parse(
    readFileSync(path.join(__dirname, '../../../../public/clip.schema.json'), 'utf8')
  )
  const validate = new Ajv2020({ allErrors: true }).compile(schema)
  const withoutNulls = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, item) => (item === null ? undefined : item)))

  it('takes every clip of the catalogue, and a clip of its own', () => {
    for (const clip of Object.values(clips)) {
      expect(validate(withoutNulls(clip)), clip.name).toBe(true)
    }
    expect(validate(hop)).toBe(true)
  })

  it('refuses what the Studio refuses', () => {
    expect(validate({ ...hop, tracks: { rotation: [{ t: 0, v: [1, 2] }] } })).toBe(false)
    expect(validate({ ...hop, tracks: { wobble: [] } })).toBe(false)
    expect(validate({ ...hop, duration: 0 })).toBe(false)
  })
})
