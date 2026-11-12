import { useStudioLanguage } from '@/i18n'

// Bible Strong's mark: a ring around the blue dot, with the "strong" highlight.
export function StandBrand() {
  const { t } = useStudioLanguage()
  return (
    <div className="stand-brand">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="9" />
        <circle cx="50" cy="50" r="22" fill="#0984e3" />
      </svg>
      <span>
        <strong aria-label="Bible Strong">
          bible <b>strong</b>
        </strong>
        <small>{t('Découvrir la Bible sous un nouveau jour.')}</small>
      </span>
    </div>
  )
}

/** Stationary, high-contrast QR code to bible-strong.app, worded as a study tool, not a game. */
export function StandQr({ size = 'compact' }: { size?: 'compact' | 'large' }) {
  const { t } = useStudioLanguage()
  return (
    <aside className="stand-qr" data-size={size}>
      <img src="/stand/bible-strong-qr.svg" alt={t('QR code vers bible-strong.app')} />
      <span>
        <strong>{t('Télécharge ton outil d’étude biblique')}</strong>
        <span>{t('Bible Strong, l’application gratuite pour étudier la Bible.')}</span>
        <b>bible-strong.app</b>
      </span>
    </aside>
  )
}
