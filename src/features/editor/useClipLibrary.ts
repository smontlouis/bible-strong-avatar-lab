import { clips as catalogueClips, type ClipDefinition } from '@bible-strong/avatar-core'
import { useEffect, useRef, useState } from 'react'

import {
  createClip,
  duplicateClip,
  freeClipName,
  loadCustomClips,
  parseClip,
  persistCustomClips,
  type ClipProblem,
} from '@/features/editor/clipLibrary'
import { DEFAULT_FRAME_RATE, type ClipLinkView } from '@/features/editor/clipLink'

// The custom clips as the Studio holds them, the draft being made, and an undo history of both.
// Saved clips are kept in the browser. The draft is not: it lives in the address, where whoever
// works on it (a person, an agent) reads and writes it, until it is saved or dropped. Changes
// that come in a burst under the same tag (a key dragged, a number scrubbed) make one step.

const HISTORY_LIMIT = 200
const MERGE_MS = 1200

/** A clip being made. `source` is the saved clip it was opened from, which saving replaces. */
export type ClipDraft = { clip: ClipDefinition; source?: string }

type Snapshot = { clips: ClipDefinition[]; draft: ClipDraft | null }
type History = { past: Snapshot[]; future: Snapshot[] }

/** Which clip a change is for: the draft, or a saved custom clip by its name. */
export type ClipRef = { draft: true } | { name: string }

export const useClipLibrary = () => {
  const [state, setState] = useState<Snapshot>(() => ({ clips: loadCustomClips(), draft: null }))
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const [view, setView] = useState<ClipLinkView>({ view: 'timeline', fps: DEFAULT_FRAME_RATE })
  // What was wrong with the last link that could not be opened.
  const [linkProblem, setLinkProblem] = useState<ClipProblem | null>(null)
  const lastChange = useRef<{ tag: string; at: number } | null>(null)
  const { clips, draft } = state

  useEffect(() => {
    persistCustomClips(clips)
  }, [clips])

  const commit = (next: Snapshot, tag?: string) => {
    const now = Date.now()
    const merges =
      tag !== undefined &&
      lastChange.current?.tag === tag &&
      now - lastChange.current.at < MERGE_MS &&
      history.past.length > 0
    lastChange.current = tag === undefined ? null : { tag, at: now }
    setHistory(current =>
      merges
        ? { ...current, future: [] }
        : { past: [...current.past.slice(-(HISTORY_LIMIT - 1)), state], future: [] }
    )
    setState(next)
  }

  /** A clip by name: the draft when asked for, else a custom clip, else the catalogue's. */
  const find = (name: string, fromDraft = false): ClipDefinition | undefined =>
    fromDraft ? draft?.clip : (clips.find(clip => clip.name === name) ?? catalogueClips[name])

  /** Open a clip as the draft, in place of the one there was. Its name is returned. */
  const openDraft = (clip: ClipDefinition, source?: string) => {
    commit({ clips, draft: source ? { clip, source } : { clip } })
    return clip.name
  }

  return {
    clips,
    draft,
    find,
    isCustom: (name: string) => clips.some(clip => clip.name === name),
    /** Replace a clip by its new version. `tag` groups a burst of changes into one step. */
    update: (ref: ClipRef, next: ClipDefinition, tag?: string) => {
      const key = 'draft' in ref ? 'draft' : `clip:${ref.name}`
      const tagged = tag === undefined ? undefined : `${key}:${tag}`
      if ('draft' in ref) {
        if (draft) commit({ clips, draft: { ...draft, clip: next } }, tagged)
        return
      }
      commit({ clips: clips.map(clip => (clip.name === ref.name ? next : clip)), draft }, tagged)
    },
    openDraft,
    /** A new empty clip, as the draft. */
    create: (wanted: string) => openDraft(createClip(freeClipName(wanted, clips))),
    /** A copy of any clip, as the draft. */
    duplicate: (name: string, wanted: string, fromDraft = false) => {
      const source = find(name, fromDraft)
      return source ? openDraft(duplicateClip(source, freeClipName(wanted, clips))) : null
    },
    /** A saved clip opened as the draft: saving it replaces the saved one. */
    edit: (name: string) => {
      const source = clips.find(clip => clip.name === name)
      return source ? openDraft(structuredClone(source), name) : null
    },
    /**
     * Keep the draft among the custom clips: in place of the clip it was opened from, else under
     * a free name. The name it is kept under is returned.
     */
    saveDraft: () => {
      if (!draft) return null
      const replacing = draft.source && clips.some(clip => clip.name === draft.source)
      const others = replacing ? clips.filter(clip => clip.name !== draft.source) : clips
      const saved = { ...draft.clip, name: freeClipName(draft.clip.name, others) }
      commit({
        clips: replacing
          ? clips.map(clip => (clip.name === draft.source ? saved : clip))
          : [...clips, saved],
        draft: null,
      })
      return saved.name
    },
    discardDraft: () => commit({ clips, draft: null }),
    remove: (name: string) => commit({ clips: clips.filter(clip => clip.name !== name), draft }),
    /** Bring in a clip from a file's text, as the draft; `null` when it is not a clip. */
    importText: (text: string) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return null
      }
      const clip = parseClip(parsed)
      return clip ? openDraft(clip) : null
    },
    view,
    setView,
    linkProblem,
    setLinkProblem,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => {
      const previous = history.past.at(-1)
      if (!previous) return
      lastChange.current = null
      setHistory({ past: history.past.slice(0, -1), future: [state, ...history.future] })
      setState(previous)
    },
    redo: () => {
      const [next, ...rest] = history.future
      if (!next) return
      lastChange.current = null
      setHistory({ past: [...history.past, state], future: rest })
      setState(next)
    },
  }
}

export type ClipLibrary = ReturnType<typeof useClipLibrary>
