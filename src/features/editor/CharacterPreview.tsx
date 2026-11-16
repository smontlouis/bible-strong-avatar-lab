import {
  createAvatarPlayer,
  playerFrame,
  renderCharacterFrame,
  setPlayerFace,
  setPlayerFaces,
  settlePlayerFace,
  type AvatarCharacter,
  type CompiledFace,
  type PlayerFrame,
} from '@bible-strong/avatar-core'
import { useMemo } from 'react'

import { Scene } from '@/features/editor/Scene'

const NO_FACES: Readonly<Record<string, CompiledFace>> = {}

/**
 * The frame of an avatar at rest showing a face: a built-in one, or a drawn one among `faces`,
 * as an avatar shows it once it has turned into it.
 */
export const restFrameWithFace = (
  face: string,
  faces: Readonly<Record<string, CompiledFace>> = NO_FACES
): PlayerFrame => {
  const player = createAvatarPlayer()
  setPlayerFaces(player, faces)
  setPlayerFace(player, face)
  settlePlayerFace(player)
  return playerFrame(player)
}

/** A small picture of a character at rest, or with a face, as the gallery's cards show them. */
export function CharacterPreview({
  character,
  face = 'neutral',
  faces = NO_FACES,
  turned = false,
}: {
  character: AvatarCharacter
  /** A built-in face, or a drawn one among `faces`. */
  face?: string
  faces?: Readonly<Record<string, CompiledFace>>
  turned?: boolean
}) {
  const scene = useMemo(
    () =>
      renderCharacterFrame(character, {
        ...restFrameWithFace(face, faces),
        rotation: turned ? [-8, 32, 0] : [0, 0, 0],
      }),
    [character, face, faces, turned]
  )
  return <Scene scene={scene} character={character} className="avatar-preview" />
}
