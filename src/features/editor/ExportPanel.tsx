import { BookOpen, Camera, Check, ClipboardCopy, Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import reactReadme from '../../../packages/avatar-react/README.md?raw'
import nativeReadme from '../../../packages/avatar-react-native/README.md?raw'
import webReadme from '../../../packages/avatar-web/README.md?raw'
import { Button, buttonVariants } from '@/components/ui/button'
import { InspectorCard, PanelTitle } from '@/features/editor/panels'
import { slugOf } from '@/features/editor/PhotoPanel'
import type { Editor } from '@/features/editor/useEditor'

// The Export tab: the character as a file, and how to put it in a project, for each renderer.
// What it gives a coding agent is the package's own README, so the two never drift apart.

export type IntegrationId = 'react' | 'react-native' | 'web'

/** How the code of an integration names the avatar: its file, its value and its component. */
export type AvatarNames = { name: string; file: string; value: string; component: string }

type Integration = {
  id: IntegrationId
  label: string
  detail: string
  packageName: string
  readme: string
  install: string
  example: (names: AvatarNames) => string
}

const REPOSITORY = 'https://github.com/smontlouis/bible-strong-avatar-lab/tree/main/packages'

export const integrations: readonly Integration[] = [
  {
    id: 'react',
    label: 'React',
    detail: 'React DOM, React Native Web',
    packageName: '@bible-strong/avatar-react',
    readme: reactReadme,
    install: 'npm install @bible-strong/avatar-react',
    example: ({
      file,
      value,
      component,
    }) => `import { createAvatar } from '@bible-strong/avatar-react'
import ${value} from './${file}'

const ${component} = createAvatar(${value})

export function Assistant({ thinking }: { thinking: boolean }) {
  return <${component} state={thinking ? 'thinking' : 'idle'} size={96} />
}`,
  },
  {
    id: 'react-native',
    label: 'React Native',
    detail: 'iOS, Android',
    packageName: '@bible-strong/avatar-react-native',
    readme: nativeReadme,
    install: `npx expo install react-native-reanimated react-native-worklets react-native-svg
npm install @bible-strong/avatar-react-native`,
    example: ({
      file,
      value,
      component,
    }) => `import { createAvatar } from '@bible-strong/avatar-react-native'
import ${value} from './${file}'

const ${component} = createAvatar(${value})

export function Assistant({ thinking }: { thinking: boolean }) {
  return <${component} state={thinking ? 'thinking' : 'idle'} size={96} />
}`,
  },
  {
    id: 'web',
    label: 'JavaScript',
    detail: 'Navigateur, sans framework',
    packageName: '@bible-strong/avatar-web',
    readme: webReadme,
    install: 'npm install @bible-strong/avatar-web',
    example: ({ file, value }) => `import { createAvatar } from '@bible-strong/avatar-web'
import ${value} from './${file}'

const avatar = createAvatar('#avatar', { character: ${value}, state: 'idle', size: 96 })

avatar.setState('thinking')`,
  },
]

/** The names an avatar takes in code, from its name in the library. */
export const avatarNames = (name: string): AvatarNames => {
  const slug = slugOf(name)
  const camel = slug.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
  // An identifier cannot start with a digit.
  const value = /^[0-9]/.test(camel) ? `avatar${camel}` : camel
  return {
    name,
    file: `${slug}.avatar.json`,
    value,
    component: value.charAt(0).toUpperCase() + value.slice(1),
  }
}

/**
 * What to give a coding agent to put the avatar in a project: the package's README, with the
 * example avatar of its code renamed after this one.
 */
export const agentInstructions = (integration: Integration, names: AvatarNames) => {
  const readme = integration.readme
    .replace(/\bstrobi\.avatar\.json\b/g, names.file)
    .replace(/\bStrobi\b/g, names.component)
    .replace(/\bstrobi\b/g, names.value)
  return `# Add the avatar “${names.name}” with ${integration.packageName}

The avatar's character is the file \`${names.file}\`, exported by Avatar Lab. Put it in the
project, then follow the package's guide below, from its setup to its checklist. Its examples
already use this avatar's file and names.

---

${readme}`
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <pre
      aria-label={label}
      className="overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-100"
    >
      {code}
    </pre>
  )
}

export function ExportPanel({ editor }: { editor: Editor }) {
  const { t, character, activeAvatar } = editor
  const [chosen, setChosen] = useState<IntegrationId>('react')
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(null), 2400)
    return () => window.clearTimeout(timer)
  }, [copied])
  if (!character) return null

  const names = avatarNames(activeAvatar.name)
  const integration = integrations.find(item => item.id === chosen)!
  const saveCharacter = () => {
    const link = window.document.createElement('a')
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' })
    )
    link.download = names.file
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const copyInstructions = async () => {
    try {
      await navigator.clipboard.writeText(agentInstructions(integration, names))
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <div className="panel-stack">
      <InspectorCard>
        <PanelTitle
          level={3}
          title="Personnage"
          subtitle="Le corps, les couleurs et le visage. Les états, les clips et les visages viennent avec le paquet."
        />
        <Button type="button" onClick={saveCharacter}>
          <Download />
          {t('Télécharger')} {names.file}
        </Button>
      </InspectorCard>

      <InspectorCard>
        <PanelTitle
          level={3}
          title="Intégration"
          subtitle="Choisis le paquet qui correspond à ton projet."
        />
        <div
          className="grid grid-cols-3 gap-1 rounded-lg bg-background p-0.5 ring-1 ring-border"
          role="group"
          aria-label={t('Intégration')}
        >
          {integrations.map(item => (
            <button
              type="button"
              className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-semibold ${
                item.id === chosen
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={item.id === chosen}
              aria-label={`${item.label} · ${t(item.detail)}`}
              key={item.id}
              onClick={() => setChosen(item.id)}
            >
              {item.label}
              <span className="text-[0.65rem] font-normal opacity-80">{t(item.detail)}</span>
            </button>
          ))}
        </div>

        <p className="eyebrow mt-4">{t('Installation')}</p>
        <CodeBlock code={integration.install} label={t('Installation')} />
        {integration.id === 'react-native' && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t(
              'Le Bundle Mode de react-native-worklets est obligatoire : les instructions pour l’IA et le README expliquent comment l’activer.'
            )}
          </p>
        )}

        <p className="eyebrow mt-4">{t('Utilisation minimale')}</p>
        <CodeBlock code={integration.example(names)} label={t('Utilisation minimale')} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void copyInstructions()}>
            {copied === 'done' ? <Check /> : <ClipboardCopy />}
            {t('Copier les instructions pour l’IA')}
          </Button>
          <a
            className={buttonVariants({ variant: 'ghost' })}
            href={`${REPOSITORY}/${integration.packageName.replace('@bible-strong/', '')}#readme`}
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen />
            {t('Voir le guide complet')}
          </a>
        </div>
        <p className="mt-2 min-h-4 text-xs text-muted-foreground" role="status">
          {copied === 'done'
            ? t('Instructions copiées dans le presse-papiers.')
            : copied === 'failed'
              ? t('Impossible de copier les instructions.')
              : ''}
        </p>
      </InspectorCard>

      <InspectorCard>
        <PanelTitle
          level={3}
          title="Image"
          subtitle="Pose l’avatar, cadre-le, choisis un fond et enregistre-le en PNG ou en SVG."
        />
        <Button variant="secondary" type="button" onClick={editor.openPhotoMode}>
          <Camera />
          {t('Ouvrir le mode photo')}
        </Button>
      </InspectorCard>
    </div>
  )
}
