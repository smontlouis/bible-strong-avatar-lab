// What the documentation for agents needs from the Studio's address. Kept apart from
// `agentDocs.ts`: the Vite config reads this file, and cannot follow the Studio's aliases.

/** The address of the Studio in production, which the guide and the schema write out. */
export const PRODUCTION_ORIGIN = 'https://avatars.bible-strong.app'

/** A page that names the Studio's address, pointed at where the Studio is served. */
export const localized = (text: string, origin: string) =>
  text.replaceAll(PRODUCTION_ORIGIN, origin)
