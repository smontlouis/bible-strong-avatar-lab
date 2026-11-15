import type { ClipDefinition } from '@bible-strong/avatar-core'

import { checkClip, type ClipProblem } from '@/features/editor/clipLibrary'

// The link of a draft: the clip itself, written in the fragment of the Studio's address, with how
// it is shown. `clip=` comes last and runs to the end, so that the clip's JSON may hold any
// character, `&` included:
//
//   https://avatars.bible-strong.app/#view=frames&fps=30&clip={"name":"Hop",...}
//
// The JSON may be written as it is or percent-encoded: an agent writes the link by hand, and a
// browser encodes some characters of it on its own. The fragment never reaches a server.

export const clipViews = ['timeline', 'frames'] as const
export type ClipView = (typeof clipViews)[number]
export const frameRates = [12, 24, 30, 60] as const
export type FrameRate = (typeof frameRates)[number]
export const DEFAULT_FRAME_RATE: FrameRate = 30

export type ClipLinkView = { view: ClipView; fps: FrameRate }

type ClipLinkHead = {
  view: Partial<ClipLinkView>
  /** The avatar to show the clip on, by the name of its file (`strobi`). */
  avatar?: string
}

export type ClipLink =
  | (ClipLinkHead & { clip: ClipDefinition; problem?: undefined })
  | (ClipLinkHead & { clip?: undefined; problem: ClipProblem })

const CLIP_PARAM = 'clip='

/** The clip and the view a fragment holds, or `null` when it holds no clip. */
export const readClipLink = (hash: string): ClipLink | null => {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const at = fragment.startsWith(CLIP_PARAM) ? 0 : fragment.indexOf(`&${CLIP_PARAM}`)
  if (at < 0) return null
  const head = at === 0 ? '' : fragment.slice(0, at)
  const raw = fragment.slice(at === 0 ? CLIP_PARAM.length : at + 1 + CLIP_PARAM.length)

  const view: Partial<ClipLinkView> = {}
  let avatar: string | undefined
  for (const pair of head.split('&')) {
    const [key, value] = pair.split('=')
    if (key === 'avatar' && value) avatar = decodeURIComponent(value).toLowerCase()
    if (key === 'view' && (clipViews as readonly string[]).includes(value)) {
      view.view = value as ClipView
    }
    if (key === 'fps' && (frameRates as readonly number[]).includes(Number(value))) {
      view.fps = Number(value) as FrameRate
    }
  }

  let text = raw
  try {
    text = decodeURIComponent(raw)
  } catch {
    // A `%` the writer left as it is: the text is read as it stands.
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      problem: { path: 'clip', message: `not JSON (${(error as Error).message})` },
      view,
      avatar,
    }
  }
  const checked = checkClip(parsed)
  return checked.clip
    ? { clip: checked.clip, view, avatar }
    : { problem: checked.problem!, view, avatar }
}

/**
 * The JSON as the fragment carries it. Only what would break the fragment or the reading is
 * encoded, so that the clip stays readable in the address.
 */
const encodeJson = (json: string) =>
  json.replace(/[%#"\s<>`]/g, character => encodeURIComponent(character))

/** The fragment of a draft: the avatar and the view first, the clip last. */
export const clipLinkHash = (
  clip: ClipDefinition,
  { view, fps }: ClipLinkView,
  avatar?: string
) => {
  const head = [
    avatar ? `avatar=${encodeURIComponent(avatar)}` : '',
    view === 'timeline' ? '' : `view=${view}`,
    fps === DEFAULT_FRAME_RATE ? '' : `fps=${fps}`,
  ]
    .filter(Boolean)
    .map(item => `${item}&`)
    .join('')
  return `#${head}${CLIP_PARAM}${encodeJson(JSON.stringify(clip))}`
}
