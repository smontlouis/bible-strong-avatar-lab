import {
  clips as catalogueClips,
  states as catalogueStates,
  type ClipDefinition,
  type FaceDefinition,
  type StateDefinition,
} from '@bible-strong/avatar-core'
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
import {
  DEFAULT_FRAME_RATE,
  DEFAULT_STATE_FRAME_RATE,
  type ClipLinkView,
  type LinkKind,
} from '@/features/editor/clipLink'
import {
  compiledFaces,
  createFace,
  duplicateFace,
  faceFromFile,
  freeFaceName,
  loadCustomFaces,
  persistCustomFaces,
  renameFace,
} from '@/features/editor/faceLibrary'
import {
  checkStateDocument,
  createState,
  duplicateState,
  freeStateName,
  loadCustomStates,
  persistCustomStates,
  takeNewClips,
  type CustomState,
  type StateDocument,
} from '@/features/editor/stateLibrary'

// The custom clips and states as the Studio holds them, the drafts being made, and one undo
// history of all of it. Saved clips and states are kept in the browser. A draft is not: it lives
// in the address, where whoever works on it (a person, an agent) reads and writes it, until it is
// saved or dropped. There is one clip draft and one state draft at a time. Changes that come in
// a burst under the same tag (a key dragged, a number scrubbed) make one step of the history.

const HISTORY_LIMIT = 200
const MERGE_MS = 1200

/** A clip being made. `source` is the saved clip it was opened from, which saving replaces. */
export type ClipDraft = { clip: ClipDefinition; source?: string }
/** A state being made, with the clips it brings along. `source` as for a clip. */
export type StateDraft = { document: StateDocument; source?: string }
/** A drawn face being made. `source` as for a clip. */
export type FaceDraft = { face: FaceDefinition; source?: string }

type Snapshot = {
  clips: ClipDefinition[]
  states: CustomState[]
  faces: FaceDefinition[]
  draft: ClipDraft | null
  stateDraft: StateDraft | null
  faceDraft: FaceDraft | null
}
type History = { past: Snapshot[]; future: Snapshot[] }

/** Which clip or state a change is for: the draft, or a saved one by its name. */
export type ClipRef = { draft: true } | { name: string }

const loadSnapshot = (): Snapshot => {
  const clips = loadCustomClips()
  return {
    clips,
    states: loadCustomStates(clips.map(clip => clip.name)),
    faces: loadCustomFaces(),
    draft: null,
    stateDraft: null,
    faceDraft: null,
  }
}

export const useClipLibrary = () => {
  const [state, setState] = useState<Snapshot>(loadSnapshot)
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const [view, setView] = useState<ClipLinkView>({ view: 'timeline', fps: DEFAULT_FRAME_RATE })
  const [stateView, setStateView] = useState<ClipLinkView>({
    view: 'timeline',
    fps: DEFAULT_STATE_FRAME_RATE,
  })
  // What was wrong with the last link that could not be opened, and what it held.
  const [linkProblem, setLinkProblem] = useState<(ClipProblem & { kind: LinkKind }) | null>(null)
  const lastChange = useRef<{ tag: string; at: number } | null>(null)
  const { clips, states, faces, draft, stateDraft, faceDraft } = state

  useEffect(() => {
    persistCustomClips(clips)
  }, [clips])
  useEffect(() => {
    persistCustomStates(states)
  }, [states])
  useEffect(() => {
    persistCustomFaces(faces)
  }, [faces])

  const commit = (change: Partial<Snapshot>, tag?: string) => {
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
    setState({ ...state, ...change })
  }
  const tagOf = (ref: ClipRef, kind: string, tag?: string) =>
    tag === undefined ? undefined : `${kind}:${'draft' in ref ? 'draft' : ref.name}:${tag}`

  // Clips.

  /** A clip by name: the draft when asked for, else a custom clip, else the catalogue's. */
  const find = (name: string, fromDraft = false): ClipDefinition | undefined =>
    fromDraft ? draft?.clip : (clips.find(clip => clip.name === name) ?? catalogueClips[name])

  /** Open a clip as the draft, in place of the one there was. Its name is returned. */
  const openDraft = (clip: ClipDefinition, source?: string) => {
    commit({ draft: source ? { clip, source } : { clip } })
    return clip.name
  }

  /** A saved clip renamed: the states that name it follow. */
  const renameInStates = (from: string, to: string) =>
    from === to
      ? states
      : states.map(item => {
          const rename = (list: string[]) => list.map(name => (name === from ? to : name))
          const next: CustomState = { ...item, clips: rename(item.clips) }
          if (item.compactClips) next.compactClips = rename(item.compactClips)
          return next
        })

  // States.

  /** A state by name: the draft when asked for, else a custom state, else the catalogue's. */
  const findState = (name: string, fromDraft = false): StateDefinition | undefined =>
    fromDraft
      ? stateDraft?.document.state
      : (states.find(item => item.name === name) ?? catalogueStates[name])

  const openStateDraft = (document: StateDocument, source?: string) => {
    commit({ stateDraft: source ? { document, source } : { document } })
    return document.state.name
  }

  // Faces.

  const openFaceDraft = (face: FaceDefinition, source?: string) => {
    commit({ faceDraft: source ? { face, source } : { face } })
    return face.name
  }
  /** Every drawn face there is here, the draft in place of the face it was opened from. */
  const facesHere = () => {
    const shown = faceDraft
      ? faces.filter(face => face.name !== faceDraft.source && face.name !== faceDraft.face.name)
      : faces
    return faceDraft ? [...shown, faceDraft.face] : shown
  }
  /** The drawn faces read into what draws them, by name, for the engine and the previews. */
  const drawnFaces = () => compiledFaces(facesHere())

  /** What the engine is given besides the catalogue: every clip, state and face there is here. */
  const engineLibrary = () => {
    const ownClips: Record<string, ClipDefinition> = {}
    for (const clip of clips) ownClips[clip.name] = clip
    for (const clip of stateDraft?.document.newClips ?? []) ownClips[clip.name] ??= clip
    if (draft) ownClips[draft.clip.name] ??= draft.clip
    const ownStates: Record<string, StateDefinition> = {}
    for (const item of states) ownStates[item.name] = item
    if (stateDraft) ownStates[stateDraft.document.state.name] = stateDraft.document.state
    return { clips: ownClips, states: ownStates, faces: drawnFaces() }
  }

  return {
    clips,
    draft,
    find,
    isCustom: (name: string) => clips.some(clip => clip.name === name),
    /** Replace a clip by its new version. `tag` groups a burst of changes into one step. */
    update: (ref: ClipRef, next: ClipDefinition, tag?: string) => {
      const tagged = tagOf(ref, 'clip', tag)
      if ('draft' in ref) {
        if (draft) commit({ draft: { ...draft, clip: next } }, tagged)
        return
      }
      commit(
        {
          clips: clips.map(clip => (clip.name === ref.name ? next : clip)),
          states: renameInStates(ref.name, next.name),
        },
        tagged
      )
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
        states: replacing ? renameInStates(draft.source!, saved.name) : states,
        draft: null,
      })
      return saved.name
    },
    discardDraft: () => commit({ draft: null }),
    remove: (name: string) => commit({ clips: clips.filter(clip => clip.name !== name) }),
    /** The custom states that play a clip. */
    statesUsing: (name: string) =>
      states
        .filter(item => item.clips.includes(name) || item.compactClips?.includes(name))
        .map(item => item.name),
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

    states,
    stateDraft,
    findState,
    isCustomState: (name: string) => states.some(item => item.name === name),
    updateState: (ref: ClipRef, next: CustomState, tag?: string) => {
      const tagged = tagOf(ref, 'state', tag)
      if ('draft' in ref) {
        if (stateDraft) {
          commit(
            { stateDraft: { ...stateDraft, document: { ...stateDraft.document, state: next } } },
            tagged
          )
        }
        return
      }
      commit(
        {
          states: states.map(item => {
            if (item.name === ref.name) return next
            // A state renamed: the states that hand over to it follow.
            return item.next === ref.name && next.name !== ref.name
              ? { ...item, next: next.name }
              : item
          }),
        },
        tagged
      )
    },
    openStateDraft,
    createState: (wanted: string) =>
      openStateDraft({ state: createState(freeStateName(wanted, states)), newClips: [] }),
    duplicateState: (name: string, wanted: string, fromDraft = false) => {
      const source = findState(name, fromDraft)
      if (!source) return null
      const newClips = fromDraft ? (stateDraft?.document.newClips ?? []) : []
      return openStateDraft({
        state: duplicateState(source, freeStateName(wanted, states)),
        newClips: structuredClone(newClips),
      })
    },
    editState: (name: string) => {
      const source = states.find(item => item.name === name)
      return source ? openStateDraft({ state: structuredClone(source), newClips: [] }, name) : null
    },
    /**
     * Keep the state draft among the custom states, in place of the state it was opened from or
     * under a free name, and the clips it brings among the custom clips. Its name is returned.
     */
    saveStateDraft: () => {
      if (!stateDraft) return null
      const taken = takeNewClips(stateDraft.document, clips)
      const source = stateDraft.source
      const replacing = source !== undefined && states.some(item => item.name === source)
      const others = replacing ? states.filter(item => item.name !== source) : states
      const saved = { ...taken.state, name: freeStateName(taken.state.name, others) }
      commit({
        clips: taken.clips,
        states: replacing
          ? states.map(item => (item.name === source ? saved : item))
          : [...states, saved],
        stateDraft: null,
      })
      return saved.name
    },
    discardStateDraft: () => commit({ stateDraft: null }),
    removeState: (name: string) => commit({ states: states.filter(item => item.name !== name) }),
    /** Bring in a state from a file's text, as the draft; `null` when it is not a state. */
    importStateText: (text: string) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return null
      }
      const checked = checkStateDocument(parsed, {
        clips: clips.map(clip => clip.name),
        states: states.map(item => item.name),
      })
      return checked.document ? openStateDraft(checked.document) : null
    },
    engineLibrary,

    faces,
    faceDraft,
    facesHere,
    drawnFaces,
    findFace: (name: string, fromDraft = false) =>
      fromDraft ? faceDraft?.face : faces.find(face => face.name === name),
    isCustomFace: (name: string) => faces.some(face => face.name === name),
    /** Replace a face by its new version; a saved face renamed is renamed where it is named. */
    updateFace: (ref: ClipRef, next: FaceDefinition, tag?: string) => {
      const tagged = tagOf(ref, 'face', tag)
      if ('draft' in ref) {
        if (faceDraft) commit({ faceDraft: { ...faceDraft, face: next } }, tagged)
        return
      }
      commit(
        {
          faces: faces.map(face => (face.name === ref.name ? next : face)),
          ...renameFace(ref.name, next.name, clips, states),
        },
        tagged
      )
    },
    openFaceDraft,
    createFace: (wanted: string) => openFaceDraft(createFace(freeFaceName(wanted, faces))),
    duplicateFace: (name: string, wanted: string, fromDraft = false) => {
      const source = fromDraft ? faceDraft?.face : faces.find(face => face.name === name)
      return source ? openFaceDraft(duplicateFace(source, freeFaceName(wanted, faces))) : null
    },
    editFace: (name: string) => {
      const source = faces.find(face => face.name === name)
      return source ? openFaceDraft(structuredClone(source), name) : null
    },
    /**
     * Keep the face draft among the faces, in place of the face it was opened from or under a
     * free name. Clips and states that named the face it replaces follow its name.
     */
    saveFaceDraft: () => {
      if (!faceDraft) return null
      const source = faceDraft.source
      const replacing = source !== undefined && faces.some(face => face.name === source)
      const others = replacing ? faces.filter(face => face.name !== source) : faces
      const saved = { ...faceDraft.face, name: freeFaceName(faceDraft.face.name, others) }
      commit({
        faces: replacing
          ? faces.map(face => (face.name === source ? saved : face))
          : [...faces, saved],
        ...(replacing ? renameFace(source!, saved.name, clips, states) : {}),
        faceDraft: null,
      })
      return saved.name
    },
    discardFaceDraft: () => commit({ faceDraft: null }),
    removeFace: (name: string) => commit({ faces: faces.filter(face => face.name !== name) }),
    /** The clips and states here that name a face. */
    usersOfFace: (name: string) => [
      ...clips
        .filter(clip => clip.tracks.expression?.some(key => key.v === name))
        .map(clip => clip.name),
      ...states.filter(item => item.face === name).map(item => item.name),
    ],
    /** Bring in a face from a file (`.face.json` or `.svg`), as the draft. */
    importFaceFile: (text: string, fileName: string) => {
      const read = faceFromFile(text, fileName, faces)
      return {
        name: read.face ? openFaceDraft(read.face) : null,
        problem: read.problem ?? null,
        ignored: read.ignored,
      }
    },

    view,
    setView,
    stateView,
    setStateView,
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
