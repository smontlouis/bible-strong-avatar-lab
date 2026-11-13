import type { AvatarCharacter } from '@bible-strong/avatar-core'
import type { ReactElement } from 'react'

import { Avatar, type AvatarProps } from './Avatar'

export type CreatedAvatarProps = Omit<AvatarProps, 'character'>
export type CreatedAvatarComponent = (props: CreatedAvatarProps) => ReactElement

/** A component for one character: `const Strobi = createAvatar(strobi)`, then `<Strobi />`. */
export const createAvatar = (character: AvatarCharacter): CreatedAvatarComponent => {
  const CreatedAvatar = (props: CreatedAvatarProps) => <Avatar character={character} {...props} />
  CreatedAvatar.displayName = `Avatar(${character.name ?? 'character'})`
  return CreatedAvatar
}
