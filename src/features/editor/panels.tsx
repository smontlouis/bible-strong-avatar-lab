import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlaybackStatus } from '@/features/editor/utils'
import { useStudioLanguage } from '@/i18n'

export function InspectorCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={`panel${className ? ` ${className}` : ''}`} {...props} />
}

export function PlaybackIdentity({ name, status }: { name: string; status: PlaybackStatus }) {
  const { t } = useStudioLanguage()
  const statusLabel =
    status === 'playing' ? 'En lecture' : status === 'paused' ? 'En pause' : 'Arrêté'
  return (
    <span className={`playback-identity is-${status}`}>
      <i />
      <span>
        <small>{t(statusLabel)}</small>
        <strong>{name}</strong>
      </span>
    </span>
  )
}

export function PanelTitle({
  title,
  subtitle,
  level = 2,
}: {
  title: string
  subtitle: string
  level?: 2 | 3
}) {
  const { t } = useStudioLanguage()
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <CardHeader className="panel-title">
      <CardTitle as={Heading}>{t(title)}</CardTitle>
      <CardDescription>{t(subtitle)}</CardDescription>
    </CardHeader>
  )
}
