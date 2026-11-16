import type { StateDefinition } from './catalogue/index.js'
import type { ClipDefinition } from './clips.js'
import {
  compileFace,
  faceNameProblem,
  type CompiledFace,
  type FaceDefinition,
} from './drawnFaces.js'
import type { EngineLibrary } from './engine.js'
import { faceEyesFromSvg } from './svgFace.js'

// A library is what an app gives an avatar besides the catalogue: its own clips, states and
// drawn faces, each by name, as the Studio exports them. It is read once into what the engine
// plays, so that nothing is parsed while the avatar moves.

/** A drawn face given as an SVG file of its eye, as the guide says to draw it. */
export type FaceSvgDefinition = Omit<FaceDefinition, 'eyes'> & { svg: string }

export type AvatarLibrary = {
  clips?: readonly ClipDefinition[]
  /** States, each with its name. */
  states?: readonly (StateDefinition & { name: string })[]
  faces?: readonly (FaceDefinition | FaceSvgDefinition)[]
}

/** Read an SVG face into the marks the face is made of. `ignored` says what the file held that was not read. */
export const faceFromSvg = (
  face: FaceSvgDefinition
): { face: FaceDefinition; ignored: string[] } => {
  const { svg, ...rest } = face
  const { eyes, ignored } = faceEyesFromSvg(svg)
  return { face: { ...rest, eyes }, ignored }
}

/**
 * Read a library into what an engine plays. What cannot be used is left out and said in
 * `problems`: an item without a name, a name given twice, a face that does not draw.
 */
export const readAvatarLibrary = (
  input: AvatarLibrary | null | undefined
): { library: EngineLibrary; problems: string[] } => {
  const problems: string[] = []
  const clips: Record<string, ClipDefinition> = {}
  const states: Record<string, StateDefinition> = {}
  const faces: Record<string, CompiledFace> = {}
  for (const clip of input?.clips ?? []) {
    if (!clip || typeof clip.name !== 'string' || !clip.name) problems.push('a clip has no name')
    else if (clip.name in clips) problems.push(`clip "${clip.name}" is given twice`)
    else clips[clip.name] = clip
  }
  for (const state of input?.states ?? []) {
    if (!state || typeof state.name !== 'string' || !state.name)
      problems.push('a state has no name')
    else if (state.name in states) problems.push(`state "${state.name}" is given twice`)
    else {
      const { name, ...definition } = state
      states[name] = definition
    }
  }
  for (const given of input?.faces ?? []) {
    const label = typeof given?.name === 'string' ? `face "${given.name}"` : 'a face'
    const named = faceNameProblem(given?.name)
    if (named) {
      problems.push(`${label}: ${named}`)
      continue
    }
    if (given.name in faces) {
      problems.push(`${label} is given twice`)
      continue
    }
    try {
      let definition: FaceDefinition
      if ('svg' in given && typeof given.svg === 'string') {
        const read = faceFromSvg(given)
        definition = read.face
        for (const what of read.ignored) problems.push(`${label}: ignored ${what}`)
      } else definition = given as FaceDefinition
      const compiled = compileFace(definition)
      for (const problem of compiled.problems) problems.push(`${label}: ${problem}`)
      faces[given.name] = compiled.face
    } catch (error) {
      problems.push(`${label}: ${(error as Error).message}`)
    }
  }
  return { library: { clips, states, faces }, problems }
}
