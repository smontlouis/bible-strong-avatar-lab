import {
  createAvatarPlayer,
  faces,
  faceSmiles,
  playerFrame,
  renderCharacterFrame,
  type AvatarCharacter,
  type FaceName,
} from '@bible-strong/avatar-core'
import { useMemo } from 'react'

import { Scene } from '@/features/editor/Scene'

const restFrame = playerFrame(createAvatarPlayer())

/** A small picture of a character at rest, or with a face, as the gallery's cards show them. */
export function CharacterPreview({
  character,
  face = 'neutral',
  turned = false,
}: {
  character: AvatarCharacter
  face?: FaceName
  turned?: boolean
}) {
  const scene = useMemo(
    () =>
      renderCharacterFrame(character, {
        ...restFrame,
        face,
        eyes: faces[face].eyes,
        smile: faceSmiles[face],
        inspectWeight: face === 'inspecting' ? 1 : 0,
        rotation: turned ? [-8, 32, 0] : [0, 0, 0],
      }),
    [character, face, turned]
  )
  return <Scene scene={scene} character={character} className="avatar-preview" />
}
