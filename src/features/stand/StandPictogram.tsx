import {
  CircleHelp,
  Eye,
  Footprints,
  MessagesSquare,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import type { StandCue } from './standEncounter'

// Shared with the virtual hand cursor (100 × 100 view box).
export const openHandPath =
  'M36 54 27 43q-5-6-10-2-4 4 1 10l14 22q6 10 22 10 21 0 23-21l3-23q1-7-5-7-6-1-7 6l-2 13 1-30q0-7-6-7-6 0-6 7l-1 28-3-34q-1-7-7-6-6 1-5 8l3 33-7-24q-2-7-8-5-6 2-4 9z'
export const fistPath =
  'M31 52V40q0-9 8-9 6 0 7 6v-3q0-9 8-8 7 0 7 9 2-7 8-5 7 1 7 9v18q0 19-21 20-18 0-23-14l-7-10q-4-7 2-10 5-2 9 6l5 6'

// Two raised fingers over a closed palm, drawn as one outline.
const victoryPath =
  'M30.7 53.5 21.7 15.5a6.5 6.5 0 0 1 12.6-3L43.3 50.5q4.2 4.5 8.4-.1l10-40a6.5 6.5 0 0 1 12.6 3.2l-10 40q7.7 2.4 7.7 10.4v12q0 14-14 14H44q-14 0-14-14z'

export type PictogramKind =
  | 'wave'
  | 'smile'
  | 'thumbs-up'
  | 'victory'
  | 'thumbs-down'
  | 'secret'
  | 'tilt'
  | 'closer'
  | 'look'
  | 'play'
  | 'talk'
  | 'success'
  | 'heart'
  | 'raise'
  | 'aim'
  | 'grab'
  | 'rotate'
  | 'pet'

export function pictogramForCue(cue: StandCue): PictogramKind {
  if (cue === 'wave' || cue === 'idle' || cue === 'farewell') return 'wave'
  if (
    cue === 'smile' ||
    cue === 'thumbs-up' ||
    cue === 'victory' ||
    cue === 'thumbs-down' ||
    cue === 'tilt' ||
    cue === 'closer'
  )
    return cue
  if (cue === 'notice' || cue === 'searching') return 'look'
  if (cue === 'connection') return 'talk'
  if (cue === 'petted') return 'heart'
  if (cue === 'free-play') return 'play'
  return 'success'
}

/** Small looping demonstrations of each gesture; animation is paused by reduced motion. */
export function StandPictogram({ kind }: { kind: PictogramKind }) {
  const icon =
    kind === 'thumbs-up' ? (
      <ThumbsUp />
    ) : kind === 'thumbs-down' ? (
      <ThumbsDown />
    ) : kind === 'secret' ? (
      <CircleHelp />
    ) : kind === 'closer' ? (
      <Footprints />
    ) : kind === 'look' ? (
      <Eye />
    ) : kind === 'play' ? (
      <Sparkles />
    ) : kind === 'talk' ? (
      <MessagesSquare />
    ) : null
  return (
    <span className="stand-pictogram" data-kind={kind} aria-hidden="true">
      {icon ?? (
        <svg viewBox="0 0 100 100">
          {kind === 'wave' && (
            <>
              <path className="stand-picto-motion" d="M14 30q-6 10 0 20M86 30q6 10 0 20" />
              <g className="stand-picto-hand">
                <path d={openHandPath} />
              </g>
            </>
          )}
          {kind === 'victory' && (
            <g className="stand-picto-victory">
              <path d={victoryPath} />
              <path d="M30 66q12-6 24 2" />
            </g>
          )}
          {kind === 'raise' && (
            <>
              <path className="stand-picto-motion" d="M82 44V16m-9 9 9-9 9 9" />
              <g className="stand-picto-hand">
                <path d={openHandPath} />
              </g>
            </>
          )}
          {kind === 'aim' && (
            <>
              <rect className="stand-picto-target" x="56" y="10" width="36" height="28" rx="6" />
              <g className="stand-picto-hand">
                <path d={openHandPath} />
              </g>
            </>
          )}
          {kind === 'grab' && (
            <>
              <g className="stand-picto-open">
                <path d={openHandPath} />
              </g>
              <g className="stand-picto-fist">
                <path d={fistPath} />
              </g>
            </>
          )}
          {kind === 'rotate' && (
            <>
              <path className="stand-picto-orbit" d="M50 8a42 42 0 1 1-36 20m-4-12 4 12 12-3" />
              <g className="stand-picto-fist" transform="translate(20 20) scale(.6)">
                <path d={fistPath} />
              </g>
            </>
          )}
          {kind === 'pet' && (
            <>
              <circle className="stand-picto-head" cx="50" cy="78" r="30" />
              <g className="stand-picto-hand" transform="translate(22 0) scale(.56)">
                <path d={openHandPath} />
              </g>
            </>
          )}
          {(kind === 'smile' || kind === 'tilt') && (
            <g className="stand-picto-face">
              <circle cx="50" cy="50" r="40" />
              <circle className="stand-picto-fill" cx="36" cy="42" r="5" />
              <circle className="stand-picto-fill" cx="64" cy="42" r="5" />
              <path className="stand-picto-mouth" d="M32 60q18 16 36 0" />
            </g>
          )}
          {kind === 'success' && <path className="stand-picto-check" d="M24 52l17 17 35-37" />}
          {kind === 'heart' && (
            <path
              className="stand-picto-heart"
              d="M50 84 18 52Q6 38 16 25q14-15 34 5 20-20 34-5 10 13-2 27z"
            />
          )}
        </svg>
      )}
    </span>
  )
}
