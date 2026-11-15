import { useEffect, useRef } from 'react'

import { clipLinkHash, DEFAULT_FRAME_RATE, readClipLink } from '@/features/editor/clipLink'
import { slugOf } from '@/features/editor/PhotoPanel'
import type { Editor } from '@/features/editor/useEditor'

// The draft and the address, kept the same both ways. A link that holds a clip opens it as the
// draft, in the Clips tab; a change made to the draft, by hand, rewrites the address a moment
// later. Whoever shares the tab (an agent driving the browser) reads the clip from the address
// and writes a new one there, which the Studio takes up without reloading.

/** How long the address waits after the last change before it is rewritten. */
export const LINK_WRITE_MS = 300

export const useClipLink = (editor: Editor) => {
  const { clipLibrary } = editor
  // The fragment the Studio wrote last, as the browser keeps it: read back, it is not news.
  const written = useRef<string | null>(null)

  const take = useRef<(hash: string, opening: boolean) => void>(() => {})
  take.current = (hash, opening) => {
    if (hash === written.current) return
    const link = readClipLink(hash)
    if (!link) return
    editor.setTab('clips')
    if (link.avatar) {
      const avatar = editor.avatars.find(item => slugOf(item.name) === link.avatar)
      if (avatar && avatar.id !== editor.activeAvatar.id) editor.selectAvatar(avatar.id)
    }
    clipLibrary.setView({
      view: link.view.view ?? 'timeline',
      fps: link.view.fps ?? DEFAULT_FRAME_RATE,
    })
    if (link.problem) {
      clipLibrary.setLinkProblem(link.problem)
      return
    }
    clipLibrary.setLinkProblem(null)
    const current = clipLibrary.draft
    if (JSON.stringify(current?.clip) !== JSON.stringify(link.clip)) {
      // The same clip worked on again keeps the saved clip it was opened from.
      const sameClip = current && current.clip.name === link.clip.name
      clipLibrary.openDraft(link.clip, sameClip ? current.source : undefined)
    }
    const shown =
      'clip' in editor.doing && editor.doing.draft && editor.doing.clip === link.clip.name
    if (opening) editor.setPlaying(false)
    if (!shown) editor.setDoing({ clip: link.clip.name, draft: true })
  }

  useEffect(() => {
    take.current(window.location.hash, true)
    const changed = () => take.current(window.location.hash, false)
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])

  const { draft, view } = clipLibrary
  const avatar = slugOf(editor.activeAvatar.name)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft) {
        const hash = clipLinkHash(draft.clip, view, avatar)
        // Replaced, not pushed: the history of the page is not one step per change.
        if (window.location.hash !== hash)
          window.history.replaceState(window.history.state, '', hash)
        written.current = window.location.hash
      } else if (written.current !== null) {
        // The draft saved or dropped: the address no longer holds it.
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + window.location.search
        )
        written.current = null
      }
    }, LINK_WRITE_MS)
    return () => window.clearTimeout(timer)
  }, [draft, view, avatar])
}
