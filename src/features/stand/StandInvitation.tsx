import { Hand, MoveHorizontal, Smile, Sparkles, ThumbsUp } from 'lucide-react'
import { useStudioLanguage } from '@/i18n'
import { invitationCopy } from './standCopy'
import type { StandCue } from './standEncounter'

export function StandInvitation({ cue, name }: { cue: StandCue; name: string }) {
  const { t } = useStudioLanguage()
  const [title, hint] = invitationCopy[cue]
  const reply = cue.endsWith('-reply') || cue === 'hello'
  const Icon =
    cue === 'wave' || cue === 'hello'
      ? Hand
      : cue.startsWith('smile')
        ? Smile
        : cue.startsWith('thumbs-up')
          ? ThumbsUp
          : cue.startsWith('tilt')
            ? MoveHorizontal
            : Sparkles
  return (
    <div
      className="stand-invitation"
      data-reply={reply}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="stand-invitation-name">{name}</div>
      <div className="stand-invitation-message" key={cue}>
        <div className="stand-invitation-icon" aria-hidden="true">
          <Icon />
        </div>
        <div>
          <p className="stand-invitation-title">{t(title)}</p>
          <p className="stand-invitation-hint">{t(hint)}</p>
        </div>
      </div>
    </div>
  )
}
