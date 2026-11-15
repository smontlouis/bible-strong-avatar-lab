import { clips as catalogueClips, type ClipDefinition } from '@bible-strong/avatar-core'
import { useEffect, useRef, useState } from 'react'

import {
  createClip,
  duplicateClip,
  freeClipName,
  loadCustomClips,
  parseClip,
  persistCustomClips,
} from '@/features/editor/clipLibrary'

// The custom clips as the Studio holds them, with an undo history. Changes that come in a burst
// under the same tag (a key dragged, a number scrubbed) make one step of the history.

const HISTORY_LIMIT = 200
const MERGE_MS = 1200

type History = { past: ClipDefinition[][]; future: ClipDefinition[][] }

export const useClipLibrary = () => {
  const [clips, setClips] = useState<ClipDefinition[]>(() => loadCustomClips())
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const lastChange = useRef<{ tag: string; at: number } | null>(null)

  useEffect(() => {
    persistCustomClips(clips)
  }, [clips])

  const commit = (next: ClipDefinition[], tag?: string) => {
    const now = Date.now()
    const merges =
      tag !== undefined &&
      lastChange.current?.tag === tag &&
      now - lastChange.current.at < MERGE_MS &&
      history.past.length > 0
    lastChange.current = tag === undefined ? null : { tag, at: now }
    if (!merges) {
      setHistory(current => ({
        past: [...current.past.slice(-(HISTORY_LIMIT - 1)), clips],
        future: [],
      }))
    } else {
      setHistory(current => ({ ...current, future: [] }))
    }
    setClips(next)
  }

  const find = (name: string): ClipDefinition | undefined =>
    clips.find(clip => clip.name === name) ?? catalogueClips[name]

  return {
    clips,
    /** The clip of that name, custom or of the catalogue. */
    find,
    isCustom: (name: string) => clips.some(clip => clip.name === name),
    /** Replace a custom clip by its new version. `tag` groups a burst of changes. */
    update: (name: string, next: ClipDefinition, tag?: string) =>
      commit(
        clips.map(clip => (clip.name === name ? next : clip)),
        tag === undefined ? undefined : `${name}:${tag}`
      ),
    /** A new empty clip; its name is returned, made free if it was taken. */
    create: (wanted: string) => {
      const clip = createClip(freeClipName(wanted, clips))
      commit([...clips, clip])
      return clip.name
    },
    /** A custom copy of any clip; its name is returned. */
    duplicate: (name: string, wanted: string) => {
      const source = find(name)
      if (!source) return null
      const clip = duplicateClip(source, freeClipName(wanted, clips))
      commit([...clips, clip])
      return clip.name
    },
    remove: (name: string) => commit(clips.filter(clip => clip.name !== name)),
    /** Bring in a clip from a file's text; its name is returned, or `null` if it is not a clip. */
    importText: (text: string) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return null
      }
      const clip = parseClip(parsed)
      if (!clip) return null
      const named = { ...clip, name: freeClipName(clip.name, clips) }
      commit([...clips, named])
      return named.name
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => {
      const previous = history.past.at(-1)
      if (!previous) return
      lastChange.current = null
      setHistory({ past: history.past.slice(0, -1), future: [clips, ...history.future] })
      setClips(previous)
    },
    redo: () => {
      const [next, ...rest] = history.future
      if (!next) return
      lastChange.current = null
      setHistory({ past: [...history.past, clips], future: rest })
      setClips(next)
    },
  }
}

export type ClipLibrary = ReturnType<typeof useClipLibrary>
