import type { ClipDefinition } from '@bible-strong/avatar-core'

import { checkClip, type ClipProblem } from '@/features/editor/clipLibrary'

// The link of a draft: the document itself (a clip, a state or a character), written in the
// fragment of the Studio's address, with how it is shown. The document comes last and runs to
// the end, so that its JSON may hold any character, `&` included:
//
//   https://avatars.bible-strong.app/#avatar=strobi&view=frames&fps=30&clip={"name":"Hop",...}
//   https://avatars.bible-strong.app/#state={"name":"cheering","clips":["Hop","Done_A"],...}
//   https://avatars.bible-strong.app/#character={"name":"Fox","body":{...},...}
//   https://avatars.bible-strong.app/#avatar=strobi&face={"name":"Star","eyes":{"left":[...]}}
//
// The JSON may be written as it is or percent-encoded: an agent writes the link by hand, and a
// browser encodes some characters of it on its own. The fragment never reaches a server.

export const linkKinds = ['clip', 'state', 'character', 'face'] as const
export type LinkKind = (typeof linkKinds)[number]

export const clipViews = ['timeline', 'frames'] as const
export type ClipView = (typeof clipViews)[number]
/** The rates of a clip's sheet. */
export const frameRates = [12, 24, 30, 60] as const
/** The rates of a state's sheet: a state runs for longer, its frames are further apart. */
export const stateFrameRates = [2, 4, 8, 12] as const
export type FrameRate = (typeof frameRates)[number] | (typeof stateFrameRates)[number]
export const DEFAULT_FRAME_RATE: FrameRate = 30
export const DEFAULT_STATE_FRAME_RATE: FrameRate = 4

export type ClipLinkView = { view: ClipView; fps: FrameRate }

type LinkHead = {
  view: Partial<ClipLinkView>
  /** The avatar to show the document on, by the name of its file (`strobi`). */
  avatar?: string
}

/** What a fragment holds: a document of a kind, still to be checked, or JSON that is not. */
export type StudioLink = LinkHead & { kind: LinkKind } & (
    { value: unknown; problem?: undefined } | { value?: undefined; problem: ClipProblem }
  )

/** The document a fragment holds, unchecked, with the view; `null` when it holds none. */
export const readStudioLink = (hash: string): StudioLink | null => {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  // The first document parameter is the document: what follows it is its JSON.
  let found: { kind: LinkKind; at: number; start: number } | null = null
  for (const kind of linkKinds) {
    const key = `${kind}=`
    const at = fragment.startsWith(key) ? 0 : fragment.indexOf(`&${key}`)
    if (at < 0) continue
    const start = at === 0 ? key.length : at + 1 + key.length
    if (!found || at < found.at) found = { kind, at, start }
  }
  if (!found) return null
  const head = fragment.slice(0, found.at)
  const raw = fragment.slice(found.start)

  const view: Partial<ClipLinkView> = {}
  let avatar: string | undefined
  for (const pair of head.split('&')) {
    const [key, value] = pair.split('=')
    if (key === 'avatar' && value) avatar = decodeURIComponent(value).toLowerCase()
    if (key === 'view' && (clipViews as readonly string[]).includes(value)) {
      view.view = value as ClipView
    }
    const rate = Number(value)
    if (
      key === 'fps' &&
      ((frameRates as readonly number[]).includes(rate) ||
        (stateFrameRates as readonly number[]).includes(rate))
    ) {
      view.fps = rate as FrameRate
    }
  }

  const parsed = parseLinkJson(raw)
  return parsed.ok
    ? { kind: found.kind, value: parsed.value, view, avatar }
    : {
        kind: found.kind,
        problem: { path: found.kind, message: parsed.message },
        view,
        avatar,
      }
}

// Typographic quotes that an app or the system's typing puts in place of straight ones.
const curlyQuotes = /[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g

/**
 * The JSON a link carries, read as kindly as can be: a link may reach the Studio encoded once
 * more by an app that passed it on (`%2522` for `"`), or with its quotes turned typographic by
 * a chat or a notes app. Each reading is tried in turn; the first that parses is the JSON.
 */
export const parseLinkJson = (
  raw: string
): { ok: true; value: unknown } | { ok: false; message: string } => {
  const readings: string[] = []
  let text = raw
  readings.push(text)
  for (let level = 0; level < 3; level += 1) {
    let next: string
    try {
      next = decodeURIComponent(text)
    } catch {
      // A `%` the writer left as it is: the text is read as it stands.
      break
    }
    if (next === text) break
    readings.push(next)
    text = next
  }
  // The most decoded reading first: the usual link is encoded once.
  const tries = [...readings.slice(1).reverse(), readings[0]].flatMap(reading => {
    const straight = reading.replace(curlyQuotes, '"')
    return straight === reading ? [reading] : [reading, straight]
  })
  let firstError = ''
  for (const attempt of tries) {
    try {
      return { ok: true, value: JSON.parse(attempt) }
    } catch (error) {
      firstError ||= (error as Error).message
    }
  }
  const shown = readings.at(-1)!.slice(0, 32)
  return {
    ok: false,
    message: `not JSON (${firstError}); the link starts ${JSON.stringify(shown)}. Was it cut, or changed on the way?`,
  }
}

export type ClipLink =
  | (LinkHead & { clip: ClipDefinition; problem?: undefined })
  | (LinkHead & { clip?: undefined; problem: ClipProblem })

/** The clip and the view a fragment holds, or `null` when it holds no clip. */
export const readClipLink = (hash: string): ClipLink | null => {
  const link = readStudioLink(hash)
  if (!link || link.kind !== 'clip') return null
  const { view, avatar } = link
  if (link.problem) return { problem: link.problem, view, avatar }
  const checked = checkClip(link.value)
  return checked.clip
    ? { clip: checked.clip, view, avatar }
    : { problem: checked.problem!, view, avatar }
}

/**
 * The JSON as the fragment carries it. Only what would break the fragment or the reading is
 * encoded, so that the document stays readable in the address.
 */
const encodeJson = (json: string) =>
  json.replace(/[%#"\s<>`]/g, character => encodeURIComponent(character))

/** The fragment of a draft: the avatar and the view first, the document last. */
export const studioLinkHash = (
  kind: LinkKind,
  document: unknown,
  { view, fps }: Partial<ClipLinkView> = {},
  avatar?: string,
  defaultFps: FrameRate = DEFAULT_FRAME_RATE
) => {
  const head = [
    avatar ? `avatar=${encodeURIComponent(avatar)}` : '',
    view === undefined || view === 'timeline' ? '' : `view=${view}`,
    fps === undefined || fps === defaultFps ? '' : `fps=${fps}`,
  ]
    .filter(Boolean)
    .map(item => `${item}&`)
    .join('')
  return `#${head}${kind}=${encodeJson(JSON.stringify(document))}`
}

export const clipLinkHash = (clip: ClipDefinition, view: ClipLinkView, avatar?: string) =>
  studioLinkHash('clip', clip, view, avatar)
