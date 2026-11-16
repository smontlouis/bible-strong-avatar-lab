import {
  ARTBOARD_RADII,
  compileFace,
  eyeOutline,
  faceDefinitionProblem,
  faceEyesFromSvg,
  faceNames,
  faces as builtInFaces,
  reservedFaceNames,
  type ClipDefinition,
  type CompiledFace,
  type FaceDefinition,
  type FaceMark,
  type FaceName,
} from '@bible-strong/avatar-core'

import type { ClipProblem } from '@/features/editor/clipLibrary'
import type { CustomState } from '@/features/editor/stateLibrary'

// The drawn faces of the Studio: kept in the browser as clips and states are, checked as the
// packages read them, and written back and forth as the SVG of each eye.

const FACES_KEY = 'bible-strong-avatar-studio-faces-v1'

/** Whether a name is one of the built-in faces or of their other names. */
export const isBuiltInFaceName = (name: string) => reservedFaceNames.includes(name.toLowerCase())

/**
 * What is wrong with a face to keep: its shape, or a mark that does not draw. An eye with too
 * many points is not wrong, the packages simplify it.
 */
export const checkFace = (value: unknown): { face?: FaceDefinition; problem?: ClipProblem } => {
  const shape = faceDefinitionProblem(value)
  if (shape) return { problem: { path: 'face', message: shape } }
  const face = value as FaceDefinition
  const { problems } = compileFace(face)
  const blocking = problems.find(problem => /mark \d+:|draws nothing/.test(problem))
  if (blocking) {
    const [eye, rest] = blocking.split(/ (?=mark \d+:)/)
    const mark = /mark (\d+):\s*(.*)/.exec(rest ?? '')
    return {
      problem: mark
        ? { path: `eyes.${eye.split(' ')[0]}[${Number(mark[1]) - 1}].d`, message: mark[2] }
        : { path: 'eyes', message: blocking },
    }
  }
  // Only what the format holds is kept.
  const kept: FaceDefinition = { name: face.name, eyes: { left: face.eyes.left } }
  if (face.blinks !== undefined) kept.blinks = face.blinks
  if (face.smile !== undefined) kept.smile = face.smile
  if (face.eyes.right) kept.eyes.right = face.eyes.right
  return { face: structuredClone(kept) }
}

export const loadCustomFaces = (): FaceDefinition[] => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(FACES_KEY) ?? '{"faces":[]}') as {
      faces?: unknown[]
    }
    return (stored.faces ?? []).flatMap(item => {
      const { face } = checkFace(item)
      return face ? [face] : []
    })
  } catch {
    return []
  }
}

export const persistCustomFaces = (faces: readonly FaceDefinition[]) => {
  try {
    window.localStorage.setItem(FACES_KEY, JSON.stringify({ faces }))
  } catch {
    // A full or blocked storage keeps the faces for the session only.
  }
}

/** A name for a face, free among the faces given and the built-in ones. */
export const freeFaceName = (wanted: string, faces: readonly FaceDefinition[]) => {
  const base = wanted.trim() || 'face'
  const taken = (name: string) => isBuiltInFaceName(name) || faces.some(face => face.name === name)
  if (!taken(base)) return base
  for (let index = 2; ; index += 1) {
    const name = `${base}-${index}`
    if (!taken(name)) return name
  }
}

/** What is wrong with a name for a face, among the others, or `null`. */
export const faceNameProblem = (
  name: string,
  others: readonly FaceDefinition[],
  current: string
): 'empty' | 'builtIn' | 'taken' | null => {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'
  if (isBuiltInFaceName(trimmed)) return 'builtIn'
  if (trimmed !== current && others.some(face => face.name === trimmed)) return 'taken'
  return null
}

/** A new face: the built-in neutral eye, drawn as one round stroke, to be made into another. */
export const createFace = (name: string): FaceDefinition => ({
  name,
  eyes: { left: [{ d: 'M50 26.5V73.5', fill: false, stroke: { width: 43, cap: 'round' } }] },
})

export const duplicateFace = (face: Readonly<FaceDefinition>, name: string): FaceDefinition => ({
  ...structuredClone(face),
  name,
})

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'face'

export const faceFileName = (face: Readonly<FaceDefinition>) => `${slugOf(face.name)}.face.json`
export const faceFileText = (face: Readonly<FaceDefinition>) => `${JSON.stringify(face, null, 2)}\n`

const attribute = (name: string, value: string | number) => ` ${name}="${value}"`

/** One eye as an SVG file on the artboard, which reads back into the same marks. */
export const eyeSvgText = (marks: readonly FaceMark[]) => {
  const lines = marks.map(mark => {
    let attributes = attribute('d', mark.d)
    attributes += attribute('fill', mark.fill === false ? 'none' : 'currentColor')
    if (mark.fillRule === 'evenodd') attributes += attribute('fill-rule', 'evenodd')
    if (mark.stroke) {
      attributes += attribute('stroke', 'currentColor')
      attributes += attribute('stroke-width', mark.stroke.width)
      attributes += attribute('stroke-linecap', mark.stroke.cap ?? 'butt')
      attributes += attribute('stroke-linejoin', mark.stroke.join ?? 'miter')
    }
    return `  <path${attributes} />`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n${lines.join('\n')}\n</svg>\n`
}

/**
 * The marks of an eye written as an SVG file: those of the eye on the left of the screen. The
 * file is fitted to the artboard by its view, so one drawn on `0 0 100 100` keeps its numbers.
 */
export const marksFromSvgText = (
  text: string
): { marks?: FaceMark[]; right?: FaceMark[]; ignored: string[]; problem?: string } => {
  try {
    const { eyes, ignored } = faceEyesFromSvg(text)
    if (!eyes.left.length) {
      return { ignored, problem: 'nothing in the file draws: a path, a line or a shape is needed' }
    }
    return { marks: eyes.left, right: eyes.right, ignored }
  } catch (error) {
    return { ignored: [], problem: (error as Error).message }
  }
}

/** Read a file (a `.face.json`, or an `.svg` of the eye) into a face named after it. */
export const faceFromFile = (
  text: string,
  fileName: string,
  faces: readonly FaceDefinition[]
): { face?: FaceDefinition; problem?: string; ignored: string[] } => {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<')) {
    const read = marksFromSvgText(text)
    if (!read.marks) return { problem: read.problem, ignored: read.ignored }
    const name = freeFaceName(fileName.replace(/\.svg$/i, '').replace(/[-_]+/g, ' '), faces)
    const face: FaceDefinition = { name, eyes: { left: read.marks } }
    if (read.right?.length) face.eyes.right = read.right
    return { face, ignored: read.ignored }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { problem: 'neither a .face.json nor an .svg', ignored: [] }
  }
  const checked = checkFace(parsed)
  if (!checked.face) return { problem: checked.problem?.message, ignored: [] }
  return {
    face: { ...checked.face, name: freeFaceName(checked.face.name, faces) },
    ignored: [],
  }
}

/** The clips and states that name a face, renamed to follow it. */
export const renameFace = (
  from: string,
  to: string,
  clips: readonly ClipDefinition[],
  states: readonly CustomState[]
) => {
  if (from === to) return { clips: [...clips], states: [...states] }
  return {
    clips: clips.map(clip =>
      clip.tracks.expression?.some(key => key.v === from)
        ? {
            ...clip,
            tracks: {
              ...clip.tracks,
              expression: clip.tracks.expression.map(key =>
                key.v === from ? { ...key, v: to } : key
              ),
            },
          }
        : clip
    ),
    states: states.map(state => (state.face === from ? { ...state, face: to } : state)),
  }
}

// Read once for each face as it is written: an edit reads only the face it changes.
const compiled = new Map<string, CompiledFace>()

/** The faces read into what draws them, by name. */
export const compiledFaces = (faces: readonly FaceDefinition[]) => {
  const out: Record<string, CompiledFace> = {}
  for (const face of faces) {
    const key = JSON.stringify(face)
    let read = compiled.get(key)
    if (!read) {
      try {
        read = compileFace(face).face
      } catch {
        continue
      }
      if (compiled.size > 200) compiled.clear()
      compiled.set(key, read)
    }
    out[face.name] = read
  }
  return out
}

/** Every face a clip or a state can name here: the built-in ones, then the drawn ones. */
export const faceChoices = (faces: readonly FaceDefinition[]): string[] => [
  ...faceNames,
  ...faces.map(face => face.name),
]

/**
 * A built-in face drawn as marks, to be made into another: each eye its outline, filled. The
 * right eye is drawn too when it is not the left one's mirror, as for `inspecting`.
 */
export const builtInFaceAsDrawn = (face: FaceName, name: string): FaceDefinition => {
  const [left, right] = builtInFaces[face].eyes
  const unit = ARTBOARD_RADII / 100
  const round = (value: number) => Math.round(value * 100) / 100
  const marksOf = (eye: typeof left, side: -1 | 1): FaceMark[] => [
    {
      d: `M${eyeOutline(eye)
        .map(([x, y]) => `${round(50 + (side * x) / unit)} ${round(50 - y / unit)}`)
        .join('L')}Z`,
    },
  ]
  const drawn: FaceDefinition = { name, eyes: { left: marksOf(left, -1) } }
  if (JSON.stringify(left) !== JSON.stringify(right)) drawn.eyes.right = marksOf(right, 1)
  if (!builtInFaces[face].blinks) drawn.blinks = false
  return drawn
}
