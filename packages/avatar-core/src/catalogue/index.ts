import type { ClipDefinition } from '../clips'
import clipsData from './clips.json'

/** The clips every avatar can play, by name. */
export const clips: Readonly<Record<string, ClipDefinition>> = Object.fromEntries(
  (clipsData as unknown as ClipDefinition[]).map(clip => [clip.name, clip])
)

export const clipNames: readonly string[] = Object.keys(clips)
