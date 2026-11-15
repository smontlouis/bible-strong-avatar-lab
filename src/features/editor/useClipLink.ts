import { readCharacter } from '@bible-strong/avatar-core'
import { useEffect, useRef } from 'react'

import { characterOfAvatar } from '@/features/editor/avatar'
import { checkClip } from '@/features/editor/clipLibrary'
import {
  DEFAULT_FRAME_RATE,
  DEFAULT_STATE_FRAME_RATE,
  readStudioLink,
  studioLinkHash,
  type LinkKind,
} from '@/features/editor/clipLink'
import { slugOf } from '@/features/editor/PhotoPanel'
import { checkStateDocument } from '@/features/editor/stateLibrary'
import type { Editor } from '@/features/editor/useEditor'

// The drafts and the address, kept the same both ways. A link that holds a clip, a state or a
// character opens it as the draft of its kind, in its tab; a change made to the draft shown, by
// hand, rewrites the address a moment later. The address holds the draft of the tab shown: the
// clip in the Clips tab, the state in the States tab, the character in the Avatars tab. Whoever
// shares the tab (an agent driving the browser) reads the draft from the address and writes a
// new one there, which the Studio takes up without reloading.

/** How long the address waits after the last change before it is rewritten. */
export const LINK_WRITE_MS = 300

const tabOfKind = { clip: 'clips', state: 'states', character: 'avatars' } as const

export const useClipLink = (editor: Editor) => {
  const { clipLibrary } = editor
  // The fragment the Studio wrote last, as the browser keeps it: read back, it is not news.
  const written = useRef<string | null>(null)
  // The kind of draft the address holds when the tab shown has none of its own.
  const focus = useRef<LinkKind>('clip')

  const take = useRef<(hash: string, opening: boolean) => void>(() => {})
  take.current = (hash, opening) => {
    if (hash === written.current) return
    const link = readStudioLink(hash)
    if (!link) return
    focus.current = link.kind
    editor.setTab(tabOfKind[link.kind])
    const fail = (path: string, message: string) =>
      clipLibrary.setLinkProblem({ kind: link.kind, path, message })
    if (link.problem) return fail(link.problem.path, link.problem.message)

    if (link.kind === 'character') {
      const read = readCharacter(link.value)
      if (!read.ok) {
        const [first] = read.errors
        return fail(first.path || 'character', first.message)
      }
      clipLibrary.setLinkProblem(null)
      const current = editor.characterDraft
      if (current && JSON.stringify(characterOfAvatar(current)) === JSON.stringify(read.value)) {
        return
      }
      if (current) editor.replaceCharacterDraft(read.value)
      else editor.openCharacterDraft(read.value)
      return
    }

    if (link.avatar) {
      const avatar = editor.avatars.find(item => slugOf(item.name) === link.avatar)
      if (avatar && avatar.id !== editor.activeAvatar.id) editor.selectAvatar(avatar.id)
    }

    if (link.kind === 'state') {
      clipLibrary.setStateView({
        view: link.view.view ?? 'timeline',
        fps: link.view.fps ?? DEFAULT_STATE_FRAME_RATE,
      })
      const checked = checkStateDocument(link.value, {
        clips: clipLibrary.clips.map(clip => clip.name),
        states: clipLibrary.states.map(state => state.name),
      })
      if (checked.problem) return fail(checked.problem.path, checked.problem.message)
      clipLibrary.setLinkProblem(null)
      const document = checked.document
      const current = clipLibrary.stateDraft
      if (JSON.stringify(current?.document) !== JSON.stringify(document)) {
        const sameState = current && current.document.state.name === document.state.name
        clipLibrary.openStateDraft(document, sameState ? current.source : undefined)
      }
      const name = document.state.name
      const shown = 'state' in editor.doing && editor.doing.draft && editor.doing.state === name
      if (opening) editor.setPlaying(true)
      if (!shown) editor.setDoing({ state: name, draft: true })
      return
    }

    clipLibrary.setView({
      view: link.view.view ?? 'timeline',
      fps: link.view.fps ?? DEFAULT_FRAME_RATE,
    })
    const checked = checkClip(link.value)
    if (checked.problem) return fail(checked.problem.path, checked.problem.message)
    clipLibrary.setLinkProblem(null)
    const clip = checked.clip
    const current = clipLibrary.draft
    if (JSON.stringify(current?.clip) !== JSON.stringify(clip)) {
      // The same clip worked on again keeps the saved clip it was opened from.
      const sameClip = current && current.clip.name === clip.name
      clipLibrary.openDraft(clip, sameClip ? current.source : undefined)
    }
    const shown = 'clip' in editor.doing && editor.doing.draft && editor.doing.clip === clip.name
    if (opening) editor.setPlaying(false)
    if (!shown) editor.setDoing({ clip: clip.name, draft: true })
  }

  useEffect(() => {
    take.current(window.location.hash, true)
    const changed = () => take.current(window.location.hash, false)
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])

  const { draft, view, stateDraft, stateView } = clipLibrary
  const { characterDraft, tab } = editor
  const avatar = slugOf(editor.activeAvatar.name)
  if (tab === 'clips') focus.current = 'clip'
  if (tab === 'states') focus.current = 'state'
  if (tab === 'avatars') focus.current = 'character'
  const kind = focus.current

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hash =
        kind === 'clip' && draft
          ? studioLinkHash('clip', draft.clip, view, avatar)
          : kind === 'state' && stateDraft
            ? studioLinkHash(
                'state',
                stateDraft.document.newClips.length
                  ? { ...stateDraft.document.state, newClips: stateDraft.document.newClips }
                  : stateDraft.document.state,
                stateView,
                avatar,
                DEFAULT_STATE_FRAME_RATE
              )
            : kind === 'character' && characterDraft
              ? studioLinkHash('character', characterOfAvatar(characterDraft))
              : null
      if (hash) {
        // Replaced, not pushed: the history of the page is not one step per change.
        if (window.location.hash !== hash) {
          window.history.replaceState(window.history.state, '', hash)
        }
        written.current = window.location.hash
      } else if (written.current !== null) {
        // The draft saved or dropped, or another tab shown: the address no longer holds it.
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + window.location.search
        )
        written.current = null
      }
    }, LINK_WRITE_MS)
    return () => window.clearTimeout(timer)
  }, [kind, draft, view, stateDraft, stateView, characterDraft, avatar])
}
