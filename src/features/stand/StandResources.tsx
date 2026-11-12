import { ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react'
import { motion, useMotionValue } from 'motion/react'
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { useStudioLanguage } from '@/i18n'
import type { HandStatus } from './StandHands'
import { StandQr } from './StandBrand'
import { standResources, type StandResource, type StandResourceId } from './resourceCatalog'

export function StandResources({
  active,
  onOpen,
  onClose,
  hand,
  root,
}: {
  active: StandResourceId | null
  onOpen: (id: StandResourceId) => void
  onClose: () => void
  hand: HandStatus
  root: RefObject<HTMLElement | null>
}) {
  const { t } = useStudioLanguage()
  const resource = standResources.find(resource => resource.id === active)
  return resource ? (
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
              // Cards leave the character's side of the screen, one after another.
              '--resource-from': index < 3 ? '1' : '-1',
              '--resource-order': index % 3,
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
  const progress = useMotionValue(0)
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
        <Button
          className="stand-reader-back"
          variant="secondary"
          data-stand-action="close"
          onClick={onClose}
        >
          <ArrowLeft />
          <span>
            <strong>{t('Retour aux ressources')}</strong>
            <small>{t('Vise ici et ferme le poing pour revenir.')}</small>
          </span>
        </Button>
        <div className="stand-resource-progress" aria-hidden="true">
          <motion.span style={{ scaleX: progress }} />
        </div>
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
        onScroll={event => {
          const element = event.currentTarget
          progress.set(element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight))
        }}
      >
        <div className="stand-resource-hero">
          <img src={`/stand/resources/${resource.image}.webp`} alt="" draggable={false} />
          <span>
            {t('Découverte guidée')} <b>·</b> {t(resource.title)}
          </span>
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
          <div>
            <h2>{t('À découvrir dans Bible Strong')}</h2>
            <p>
              {t(
                'Ces exemples donnent un aperçu des ressources. L’équipe du stand peut te montrer la suite dans l’application.'
              )}
            </p>
          </div>
          <StandQr size="large" />
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
