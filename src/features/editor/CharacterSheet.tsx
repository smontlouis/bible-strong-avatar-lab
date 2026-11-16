import {
  createAvatarPlayer,
  faceNames,
  faces,
  faceSmiles,
  playerFrame,
  renderCharacterFrame,
  type AvatarCharacter,
  type FaceName,
} from '@bible-strong/avatar-core'

import { Scene } from '@/features/editor/Scene'
import { useStudioLanguage } from '@/i18n'

// The sheet of a character: the character turned to every side, then with each face. Clips turn
// an avatar all the way round, so every side is seen in an app; one screenshot of this sheet
// shows whether parts stay in place, cover the face, or stick out of the view.

const restFrame = playerFrame(createAvatarPlayer())
// Wider than the stage's view: parts that reach past it still show, cut by the dashed square.
const VIEW = '-190 -190 380 380'

export const characterViews: readonly {
  id: string
  label: string
  rotation: [number, number, number]
}[] = [
  { id: 'front', label: 'Face', rotation: [0, 0, 0] },
  { id: 'three-quarter-right', label: '3/4 droite', rotation: [0, 35, 0] },
  { id: 'right', label: 'Profil droit', rotation: [0, 90, 0] },
  { id: 'back', label: 'Dos', rotation: [0, 180, 0] },
  { id: 'left', label: 'Profil gauche', rotation: [0, -90, 0] },
  { id: 'three-quarter-left', label: '3/4 gauche', rotation: [0, -35, 0] },
  { id: 'from-above', label: 'Vu d’au-dessus', rotation: [25, 0, 0] },
  { id: 'from-below', label: 'Vu d’en dessous', rotation: [-25, 0, 0] },
]

const frameOf = (rotation: [number, number, number], face: FaceName = 'neutral') => ({
  ...restFrame,
  rotation,
  face,
  eyes: faces[face].eyes,
  smile: faceSmiles[face],
  inspectWeight: face === 'inspecting' ? 1 : 0,
})

function Cell({
  character,
  rotation,
  face,
  label,
  data,
}: {
  character: AvatarCharacter
  rotation: [number, number, number]
  face?: FaceName
  label: string
  data: Record<string, string>
}) {
  return (
    <span className="flex flex-col items-center gap-0.5 rounded-md bg-muted p-1" {...data}>
      <span className="relative aspect-square w-full overflow-hidden rounded-sm">
        <svg
          viewBox={VIEW}
          className="absolute inset-0 size-full text-muted-foreground"
          aria-hidden="true"
        >
          <rect
            x={-150}
            y={-150}
            width={300}
            height={300}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="6 6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <Scene
          scene={renderCharacterFrame(character, frameOf(rotation, face))}
          character={character}
          viewBox={VIEW}
          className="absolute inset-0 size-full"
        />
      </span>
      <span className="max-w-full truncate text-[0.6rem] font-semibold">{label}</span>
    </span>
  )
}

/** The character all in one colour, eyes included: what reads of it from afar. */
const silhouetteOf = (character: AvatarCharacter): AvatarCharacter => ({
  ...character,
  colors: { body: '#1f2328', eyes: '#1f2328' },
  body: {
    ...character.body,
    nodes: character.body.nodes.map(node => ({ ...node, color: '#1f2328' })),
  },
  style: undefined,
})

export function CharacterSheet({ character }: { character: AvatarCharacter }) {
  const { t } = useStudioLanguage()
  const silhouette = silhouetteOf(character)
  return (
    <div className="flex flex-col gap-2" data-character-sheet>
      <p className="text-[0.7rem] text-muted-foreground">
        {t(
          'Le carré pointillé est la vue de l’avatar : ce qui le dépasse peut être coupé dans une app.'
        )}
      </p>
      <div className="grid grid-cols-4 gap-1">
        {characterViews.map(view => (
          <Cell
            character={character}
            rotation={view.rotation}
            label={t(view.label)}
            data={{ 'data-view': view.id }}
            key={view.id}
          />
        ))}
        <Cell
          character={silhouette}
          rotation={[0, 0, 0]}
          label={t('Silhouette')}
          data={{ 'data-view': 'silhouette' }}
        />
        <Cell
          character={silhouette}
          rotation={[0, 35, 0]}
          label={`${t('Silhouette')} 3/4`}
          data={{ 'data-view': 'silhouette-three-quarter' }}
        />
      </div>
      <p className="eyebrow">{t('Visages')}</p>
      <div className="grid grid-cols-5 gap-1">
        {faceNames.map(face => (
          <Cell
            character={character}
            rotation={[0, 0, 0]}
            face={face}
            label={face}
            data={{ 'data-face': face }}
            key={face}
          />
        ))}
      </div>
    </div>
  )
}
