import { parseAvatarLibrary, type AvatarLibrary } from '@/features/editor/avatar'

import defaultLibrary from './defaultLibrary.json'

// The Studio keeps one thing between two visits: the library of avatars. The key and the
// shape are those of the first version, whose expressions and animations are no longer read.
const STORAGE_KEY = 'bible-strong-avatar-studio-v2'

const bundledLibrary = (): AvatarLibrary => {
  const bundled = structuredClone(defaultLibrary) as unknown as AvatarLibrary
  return parseAvatarLibrary(bundled, bundled)
}

export const loadLibrary = (
  storage: Pick<Storage, 'getItem'> = window.localStorage
): AvatarLibrary => {
  const fallback = bundledLibrary()
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as {
      library?: unknown
    } | null
    return parseAvatarLibrary(stored?.library, fallback)
  } catch {
    return fallback
  }
}

export const persistLibrary = (
  library: AvatarLibrary,
  storage: Pick<Storage, 'setItem'> = window.localStorage
) => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, library }))
    return true
  } catch {
    // The library in memory stays the one that counts when storage is unavailable.
    return false
  }
}
