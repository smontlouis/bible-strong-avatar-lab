import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type StudioLanguage } from '@/i18n'

type StudioIdentityProps = {
  language: StudioLanguage
  setLanguage: (language: StudioLanguage) => void
  t: (source: string) => string
  className?: string
}

function GitHubLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  )
}

export function StudioIdentity({ className = '', language, setLanguage, t }: StudioIdentityProps) {
  return (
    <div className={`studio-identity ${className}`.trim()}>
      <div className="brand">
        <span className="brand-mark" />
        Bible Strong <em>Avatar Lab</em>
      </div>
      <div className="language-picker">
        <a
          className="source-link"
          href="https://github.com/smontlouis/bible-strong-avatar-lab"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
        >
          <GitHubLogo />
          <span>GitHub</span>
        </a>
        <span className="identity-divider" aria-hidden="true" />
        <Select
          value={language}
          items={[
            { value: 'en', label: '🇬🇧' },
            { value: 'fr', label: '🇫🇷' },
            { value: 'zh-CN', label: '🇨🇳' },
          ]}
          onValueChange={next => next && setLanguage(next as StudioLanguage)}
        >
          <SelectTrigger aria-label={t('Langue de l’interface')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">🇬🇧</SelectItem>
            <SelectItem value="fr">🇫🇷</SelectItem>
            <SelectItem value="zh-CN">🇨🇳</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
