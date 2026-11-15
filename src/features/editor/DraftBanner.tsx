import { Link2, Save } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useStudioLanguage } from '@/i18n'

/**
 * The band over a draft: it says the draft lives in the address, copies that address to hand it
 * to an agent, and saves it.
 */
export function DraftBanner({
  note,
  saveLabel,
  onSave,
}: {
  /** What saving does, when it is not plain. */
  note?: string
  saveLabel: string
  onSave: () => void
}) {
  const { t } = useStudioLanguage()
  const [copied, setCopied] = useState(false)
  return (
    <div className="-mx-3 -mt-3 flex flex-col gap-1.5 rounded-t-2xl border-b border-border bg-secondary/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-semibold text-secondary-foreground ring-1 ring-ring/40">
          {t('Brouillon')}
        </span>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          type="button"
          title={t('Copier l’adresse du brouillon, à donner à un agent')}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            } catch {
              setCopied(false)
            }
          }}
        >
          <Link2 /> {t(copied ? 'Lien copié' : 'Copier le lien')}
        </Button>
        <Button size="sm" type="button" onClick={onSave}>
          <Save /> {t(saveLabel)}
        </Button>
      </div>
      <p className="text-[0.7rem] text-muted-foreground">
        {note ?? t('Il vit dans l’adresse de la page tant qu’il n’est pas enregistré.')}
      </p>
    </div>
  )
}
