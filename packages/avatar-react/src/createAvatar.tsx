import { characterOf } from '@bible-strong/avatar-core'
import type { ReactElement } from 'react'

import { Avatar, type AvatarProps } from './Avatar'

export type CreatedAvatarProps = Omit<AvatarProps, 'character'>
export type CreatedAvatarComponent = (props: CreatedAvatarProps) => ReactElement

/**
 * A component for one character: `const Strobi = createAvatar(strobi)`, then `<Strobi />`. The
 * file is checked once, here: a character exported by the Studio, or an `.avatar.json` of the
 * first format, of which only the character is kept.
 */
export const createAvatar = (file: unknown): CreatedAvatarComponent => {
  const character = characterOf(file)
  const CreatedAvatar = (props: CreatedAvatarProps) => <Avatar character={character} {...props} />
  CreatedAvatar.displayName = `Avatar(${character.name ?? 'character'})`
  return CreatedAvatar
}
