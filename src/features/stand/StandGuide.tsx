import { Check } from 'lucide-react'
import { motion, useTransform, type MotionValue } from 'motion/react'
import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import { useStudioLanguage } from '@/i18n'
import { gestureLabels, instructionCopy, isReplyCue } from './standCopy'
import { collectionActions, secretActions, type StandAction, type StandCue } from './standEncounter'
import { pictogramForCue, StandPictogram, type PictogramKind } from './StandPictogram'

/** The character's speech. Quick hand changes settle before the bubble re-pops. */
export function StandBubble({ line, immediate }: { line: [string, string]; immediate: boolean }) {
  const { t } = useStudioLanguage()
  const [title, hint] = line
  const [shown, setShown] = useState(line)
  useEffect(() => {
    const timer = setTimeout(() => setShown([title, hint]), immediate ? 0 : 320)
    return () => clearTimeout(timer)
  }, [title, hint, immediate])
  return (
    <div className="stand-bubble" role="status" aria-live="polite" aria-atomic="true">
      <div className="stand-bubble-body" key={shown.join('|')}>
        <p className="stand-bubble-title">
          {t(shown[0])
            .split(' ')
            .map((word, index) => (
              <Fragment key={index}>
                {index > 0 && ' '}
                <span style={{ '--word': index } as CSSProperties}>{word}</span>
              </Fragment>
            ))}
        </p>
        <p className="stand-bubble-hint">{t(shown[1])}</p>
      </div>
    </div>
  )
}

/** What to do next, before exploring: one gesture, its demonstration and its progress. */
export function StandInstruction({
  cue,
  progress,
  discovered,
}: {
  cue: StandCue
  progress: MotionValue<number>
  discovered: StandAction[]
}) {
  const { t } = useStudioLanguage()
  // A zero-length round cap would still draw a dot at the top of the ring.
  const progressOpacity = useTransform(progress, value => (value > 0.02 ? 1 : 0))
  const reply = isReplyCue(cue) && cue !== 'farewell' && cue !== 'petted'
  const [title, defaultHint] = instructionCopy[cue]
  const hint =
    !reply || cue === 'hello'
      ? defaultHint
      : discovered.length >= collectionActions.length
        ? 'Collection complète. Bravo !'
        : 'Essaie un autre geste pour compléter ta collection.'
  return (
    <section className="stand-instruction" data-tone={reply ? 'success' : 'invite'} key={cue}>
      <div className="stand-instruction-visual">
        <svg className="stand-progress" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="stand-progress-track" cx="50" cy="50" r="46" />
          <motion.circle
            className="stand-progress-value"
            cx="50"
            cy="50"
            r="46"
            transform="rotate(-90 50 50)"
            style={{ pathLength: progress, opacity: progressOpacity }}
          />
        </svg>
        <StandPictogram kind={reply ? 'success' : pictogramForCue(cue)} />
      </div>
      <div className="stand-instruction-text">
        <h2>{t(title)}</h2>
        <p>{t(hint)}</p>
      </div>
    </section>
  )
}

/** A small collection makes every recognized gesture feel like progress. */
export function StandBadges({ discovered }: { discovered: StandAction[] }) {
  const { t } = useStudioLanguage()
  const found = (action: StandAction) => discovered.includes(action)
  // Once every suggested gesture is found, hint that a secret one remains.
  const secretLeft =
    collectionActions.every(action => secretActions.has(action) || found(action)) &&
    collectionActions.some(action => !found(action))
  return (
    <section
      className="stand-badges"
      data-complete={discovered.length === collectionActions.length}
      aria-label={t('Gestes découverts')}
    >
      <p>
        <span>{t(secretLeft ? 'Un geste secret se cache…' : 'Gestes découverts')}</span>
        <strong>
          {discovered.length} / {collectionActions.length}
        </strong>
      </p>
      <ul>
        {collectionActions.map(action => {
          const hidden = secretActions.has(action) && !found(action)
          return (
            <li key={action} data-found={found(action)} data-secret={hidden}>
              <StandPictogram kind={hidden ? 'secret' : action} />
              <span>{t(hidden ? 'Secret' : gestureLabels[action])}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export type CoachProgress = { raised: boolean; aimed: boolean; opened: boolean }

/** Teaches the virtual hand step by step, then becomes a compact reminder. */
export function StandCoach({ progress }: { progress: CoachProgress }) {
  const { t } = useStudioLanguage()
  const learned = progress.opened
  const items: { kind: PictogramKind; title: string; hint: string; done: boolean }[] = learned
    ? [
        {
          kind: 'grab',
          title: 'Explorer',
          hint: 'Vise une carte, puis ferme le poing.',
          done: false,
        },
        {
          kind: 'rotate',
          title: 'Me faire tourner',
          hint: 'Ferme le poing sur moi, puis déplace la main.',
          done: false,
        },
        {
          kind: 'pet',
          title: 'Me caresser',
          hint: 'Passe doucement ta main ouverte sur ma tête.',
          done: false,
        },
      ]
    : [
        {
          kind: 'raise',
          title: 'Lève la main',
          hint: 'Elle apparaît à l’écran.',
          done: progress.raised,
        },
        {
          kind: 'aim',
          title: 'Vise une carte',
          hint: 'Déplace ta main ouverte.',
          done: progress.aimed,
        },
        { kind: 'grab', title: 'Ferme le poing', hint: 'La carte s’ouvre.', done: progress.opened },
      ]
  const current = items.findIndex(item => !item.done)
  return (
    <section className="stand-coach" data-mode={learned ? 'tips' : 'tutorial'}>
      <h2>{t(learned ? 'Comment jouer' : 'Ta main devient un curseur')}</h2>
      <ol>
        {items.map((item, index) => (
          <li
            key={item.title}
            data-state={
              learned ? 'tip' : item.done ? 'done' : index === current ? 'current' : 'next'
            }
          >
            <span className="stand-coach-visual">
              {item.done ? <Check aria-hidden="true" /> : <StandPictogram kind={item.kind} />}
            </span>
            <span className="stand-coach-text">
              <b>{t(item.title)}</b>
              <span>{t(item.hint)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
