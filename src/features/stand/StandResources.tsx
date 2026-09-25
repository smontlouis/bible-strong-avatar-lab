import { ArrowDown, ArrowLeft, ArrowUp, Hand, Heart, Rotate3D, MousePointer2 } from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { useStudioLanguage } from '@/i18n'
import type { HandStatus } from './StandHands'
import { standResources, type StandResource, type StandResourceId } from './resourceCatalog'
import { invitationCopy } from './standCopy'
import type { StandCue } from './standEncounter'

export function StandResources({
  active,
  onOpen,
  onClose,
  hand,
  root,
  cue,
}: {
  active: StandResourceId | null
  onOpen: (id: StandResourceId) => void
  onClose: () => void
  hand: HandStatus
  root: RefObject<HTMLElement | null>
  cue: StandCue
}) {
  const { t } = useStudioLanguage()
  const resource = standResources.find(resource => resource.id === active)
  const petting = hand.mode === 'petting'
  const title = petting
    ? 'Mmm… encore un peu.'
    : hand.mode === 'rotating'
      ? 'À toi de me faire tourner !'
      : hand.mode === 'selecting'
        ? 'Ferme le poing pour sélectionner.'
        : hand.mode === 'hidden'
          ? invitationCopy[cue][0]
          : 'Cette main, c’est toi.'
  const hint = petting
    ? 'Je crois que je t’aime bien.'
    : hand.mode === 'rotating'
      ? 'Déplace ton poing. Ouvre la main pour me relâcher.'
      : hand.mode === 'hidden'
        ? 'Lève une main ouverte. Tu peux aussi caresser ma tête.'
        : hand.mode === 'closed'
          ? 'Rouvre la main pour continuer.'
          : 'Sur un bouton, ferme le poing pour cliquer.'
  return (
    <>
      {resource ? (
        <ResourceReader
          key={resource.id}
          resource={resource}
          onClose={onClose}
          root={root}
          hand={hand}
        />
      ) : (
        <nav className="stand-resource-orbit" aria-label={t('Les six ressources')}>
          {standResources.map((resource, index) => (
            <Button
              key={resource.id}
              className="stand-resource-card"
              variant="ghost"
              data-stand-action={`open:${resource.id}`}
              onClick={() => onOpen(resource.id)}
              style={
                {
                  '--resource-color': resource.color,
                  '--resource-row': (index % 3) + 1,
                  '--resource-column': index < 3 ? 1 : 3,
                } as CSSProperties
              }
            >
              <img src={`/stand/resources/${resource.image}.webp`} alt="" draggable={false} />
              <span>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <strong>{t(resource.title)}</strong>
                <span>{t(resource.subtitle)}</span>
              </span>
            </Button>
          ))}
        </nav>
      )}
      {!resource && (
        <div className="stand-hand-instructions">
          <div className="stand-hand-feedback" role="status" aria-live="polite">
            {petting ? <Heart aria-hidden="true" /> : <Hand aria-hidden="true" />}
            <div>
              <strong>{t(title)}</strong>
              <p>{t(hint)}</p>
            </div>
          </div>
          <ul className="stand-gesture-guide" aria-label={t('Comment jouer')}>
            <li>
              <MousePointer2 aria-hidden="true" />
              <span>
                <b>{t('Explorer')}</b>
                {t('Vise une carte, puis ferme le poing.')}
              </span>
            </li>
            <li>
              <Rotate3D aria-hidden="true" />
              <span>
                <b>{t('Me faire tourner')}</b>
                {t('Ferme le poing sur moi, puis déplace la main.')}
              </span>
            </li>
            <li>
              <Heart aria-hidden="true" />
              <span>
                <b>{t('Me caresser')}</b>
                {t('Passe doucement ta main ouverte sur ma tête.')}
              </span>
            </li>
          </ul>
        </div>
      )}
    </>
  )
}

function ResourceReader({
  resource,
  onClose,
  root,
  hand,
}: {
  resource: StandResource
  onClose: () => void
  root: RefObject<HTMLElement | null>
  hand: HandStatus
}) {
  const { t } = useStudioLanguage()
  const reader = useRef<HTMLElement>(null)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    reader.current?.focus({ preventScroll: true })
    const host = root.current
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
      else
        host
          ?.querySelector<HTMLElement>(`[data-stand-action="open:${resource.id}"]`)
          ?.focus({ preventScroll: true })
    }
  }, [root, resource.id])
  const scroll = (direction: number) => {
    const element = content.current
    if (element) element.scrollTop += element.clientHeight * 0.7 * direction
  }
  return (
    <section
      className="stand-resource-reader"
      style={{ '--resource-color': resource.color } as CSSProperties}
      ref={reader}
      tabIndex={-1}
      aria-labelledby="stand-resource-title"
    >
      <header>
        <span>
          {t('Découverte guidée')} <b>·</b> {t(resource.title)}
        </span>
        <Button
          className="stand-reader-back"
          variant="secondary"
          data-stand-action="close"
          onClick={onClose}
        >
          <ArrowLeft />
          <span>
            <strong>{t('Retour à Strobi')}</strong>
            <small>{t('Vise ici et ferme le poing pour revenir.')}</small>
          </span>
        </Button>
      </header>
      <Button
        className="stand-scroll-control"
        variant="secondary"
        data-stand-action="up"
        onClick={() => scroll(-1)}
      >
        <ArrowUp />
        {t('Défiler vers le haut')}
      </Button>
      <div
        className="stand-resource-scroll"
        ref={content}
        data-stand-scroll
        tabIndex={0}
        aria-label={t(resource.title)}
      >
        <div className="stand-resource-hero">
          <img src={`/stand/resources/${resource.image}.webp`} alt="" draggable={false} />
          <h1 id="stand-resource-title">{t(resource.subtitle)}</h1>
        </div>
        {resource.sections.map((section, index) => (
          <article className="stand-resource-section" key={section.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2>{t(section.title)}</h2>
              <p>{t(section.body)}</p>
              {section.reference && <small>{t(section.reference)}</small>}
            </div>
          </article>
        ))}
        <div className="stand-resource-end">
          <h2>{t('À découvrir dans Bible Strong')}</h2>
          <p>
            {t(
              'Ces exemples donnent un aperçu des ressources. L’équipe du stand peut te montrer la suite dans l’application.'
            )}
          </p>
        </div>
      </div>
      <Button
        className="stand-scroll-control"
        variant="secondary"
        data-stand-action="down"
        onClick={() => scroll(1)}
      >
        <ArrowDown />
        {t('Défiler vers le bas')}
      </Button>
      <footer>
        <p>
          {t(
            hand.mode === 'grabbing'
              ? 'Ouvre la main pour arrêter le défilement.'
              : hand.mode === 'hidden'
                ? 'Tu peux relâcher le bras pour lire.'
                : 'Poing fermé dans le texte : déplace la main pour défiler. Sur une flèche : ferme le poing pour cliquer.'
          )}
        </p>
      </footer>
    </section>
  )
}
