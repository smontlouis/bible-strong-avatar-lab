import {
  Ban,
  BookOpen,
  Code2,
  ListChecks,
  MousePointer2,
  Play,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HighlightedRuntimeCode } from '@/features/studio/components/HighlightedRuntimeCode'
import {
  agentGuideSections,
  callbackProps,
  controllerProps,
  guideSectionsText,
  reactNativeGuideSections,
  targetProps,
  type GuideIcon,
  type GuideIntegration,
  type GuideSection,
} from '@/features/studio/components/runtimeGuideSections'
import { useStudioLanguage } from '@/i18n'

const runtimeInstallExample = 'npm install @bible-strong/avatar-react react react-dom'
const webInstallExample = 'npm install @bible-strong/avatar-web'

const webAvatarExample = (
  animationKey: string | undefined
) => `import { createAvatar } from '@bible-strong/avatar-web'
import definition from './avatar.avatar.json'

const avatar = createAvatar('#avatar', {
  definition,
  ${animationKey ? `defaultAnimation: '${animationKey}',` : `defaultExpression: 'neutral',`}
})

avatar.play(${animationKey ? `'${animationKey}'` : `'idle'`})
avatar.pause()
avatar.setExpression('neutral')
avatar.stop()`

const nativeBrowserExample = `<!-- Resolve the package URL through your CDN or import map. -->
<div id="avatar"></div>
<script type="module">
  import { createAvatar } from 'https://cdn.example.com/avatar-web.js'

  const definition = await fetch('./avatar.avatar.json').then(response => response.json())
  const avatar = createAvatar('#avatar', { definition, defaultExpression: 'neutral' })
</script>`

const createAvatarExample = (
  animationKey: string | undefined
) => `import { createAvatar } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import avatarJson from './avatar.avatar.json'

const StrobiAvatar = createAvatar(avatarJson)

export function Strobi() {
  return <StrobiAvatar ${
    animationKey ? `defaultAnimation="${animationKey}"` : 'defaultExpression="neutral"'
  } />
}`

const genericAvatarExample = `import { Avatar } from '@bible-strong/avatar-react'
import type { AvatarDefinition, ExpressionKey } from '@bible-strong/avatar-core'
import '@bible-strong/avatar-react/styles.css'

export function DynamicAvatar({
  definition,
  expression,
}: {
  definition: AvatarDefinition
  expression: ExpressionKey
}) {
  return (
    <Avatar
      definition={definition}
      expression={expression}
      onError={error => console.error(error)}
    />
  )
}`

const imperativeExample = (
  animationKey: string | undefined
) => `import { createAvatar, type AvatarController } from '@bible-strong/avatar-react'
import { useRef } from 'react'
import avatarJson from './avatar.avatar.json'

const StrobiAvatar = createAvatar(avatarJson)

export function Controls() {
  const avatar = useRef<AvatarController>(null)

  return <>
    <StrobiAvatar ref={avatar} ${
      animationKey ? `defaultAnimation="${animationKey}"` : 'defaultExpression="neutral"'
    } />${
      animationKey
        ? `
    <button onClick={() => avatar.current?.play('${animationKey}')}>Play animation</button>`
        : ''
    }
    <button onClick={() => avatar.current?.pause()}>Pause</button>
    <button onClick={() => avatar.current?.setExpression('neutral')}>Set expression</button>
    <button onClick={() => avatar.current?.stop()}>Stop</button>
    <button onClick={() => console.log(avatar.current?.getState())}>Read state</button>
  </>
}`

export type RuntimeGuideIntegration = GuideIntegration

type TranslateGuideText = (text: string) => string
type RuntimeGuideProp = readonly [name: string, type: string, description: string]

const markdownCode = (code: string, language = '') => `\`\`\`${language}\n${code}\n\`\`\``

const markdownProps = (props: readonly RuntimeGuideProp[], t: TranslateGuideText) =>
  props
    .map(([name, type, description]) => `- \`${name}\` — \`${type}\`: ${t(description)}`)
    .join('\n')

export function buildRuntimeGuideText({
  animationKey,
  integration,
  t,
}: {
  animationKey?: string
  integration: RuntimeGuideIntegration
  t: TranslateGuideText
}) {
  const privatePackageNotice = t(
    'Les packages sont publiés sur npm sous licence MIT. Le README de chaque package, présent dans node_modules, contient la référence complète.'
  )

  if (integration === 'react-native') {
    return [
      `# ${t('Guide d’utilisation de l’avatar React Native')}`,
      t('Installe le package, active le Bundle Mode, puis crée ton composant.'),
      guideSectionsText(reactNativeGuideSections(animationKey), t),
    ].join('\n\n')
  }

  if (integration === 'javascript') {
    const options: readonly RuntimeGuideProp[] = [
      [
        'definition',
        'AvatarDefinition | unknown',
        'Obligatoire. Définition JSON validée avant la création des éléments SVG.',
      ],
      [
        'defaultAnimation',
        'AnimationKey | undefined',
        'Optionnelle. Animation lancée au montage lorsque autoplay vaut true. Mutuellement exclusive avec defaultExpression.',
      ],
      [
        'defaultExpression',
        'ExpressionKey | undefined',
        'Optionnelle. Expression initiale affichée sans lancer de timeline. Mutuellement exclusive avec defaultAnimation.',
      ],
      [
        'autoplay',
        'boolean | undefined',
        'Optionnelle, défaut true. Contrôle uniquement le lancement automatique de defaultAnimation.',
      ],
      [
        'size',
        'number | string | undefined',
        'Optionnelle, défaut 240. Largeur et hauteur CSS du conteneur rendu.',
      ],
      ['className', 'string | undefined', 'Optionnelle. Classe CSS ajoutée au conteneur rendu.'],
      [
        'ariaLabel',
        'string | undefined',
        'Optionnelle, défaut « Procedural avatar ». Nom accessible du rendu.',
      ],
      [
        'onError',
        '(error: AvatarRuntimeError) => void',
        'Optionnelle. Reçoit les erreurs de clé inconnue utilisées lors de l’initialisation.',
      ],
      [
        'onAnimationEnd',
        '(animation: AnimationKey) => void',
        'Optionnelle. Appelée lorsqu’une animation once se termine.',
      ],
      [
        'onExpressionChange',
        '(expression: ExpressionKey) => void',
        'Optionnelle. Appelée lorsque l’expression active change.',
      ],
    ]
    const controller: readonly RuntimeGuideProp[] = [
      [
        'play(animation)',
        '(animation: AnimationKey) => AvatarCommandResult',
        'Lance ou reprend une animation par sa clé.',
      ],
      [
        'setExpression(expression)',
        '(expression: ExpressionKey) => AvatarCommandResult',
        'Affiche une expression avec une transition courte.',
      ],
      ['pause()', '() => void', 'Met en pause la timeline à sa position exacte.'],
      ['stop()', '() => void', 'Arrête la lecture et revient à neutral.'],
      [
        'getState()',
        '() => AvatarPlaybackState',
        'Retourne l’animation, l’expression et le statut actifs.',
      ],
      [
        'destroy()',
        '() => void',
        'Annule la frame planifiée et retire uniquement le conteneur créé par avatar-web.',
      ],
    ]

    return [
      `# ${t('Guide d’utilisation de l’avatar JavaScript')}`,
      t(
        'Installe le module ESM, charge la définition JSON et monte l’avatar dans un élément du DOM.'
      ),
      `## ${t('Installation')}`,
      t('Ajoute le renderer DOM, qui utilise automatiquement avatar-core.'),
      markdownCode(webInstallExample, 'bash'),
      privatePackageNotice,
      `## ${t('Utilisation avec un bundler ESM')}`,
      t(
        'Vite et les bundlers modernes résolvent le package et importent le même fichier .avatar.json que React.'
      ),
      markdownCode(webAvatarExample(animationKey), 'js'),
      `## ${t('Options de createAvatar')}`,
      t('Référence des valeurs acceptées lors du montage dans le DOM.'),
      markdownProps(options, t),
      `## ${t('API du contrôleur DOM')}`,
      t('createAvatar retourne immédiatement ces commandes impératives.'),
      markdownProps(controller, t),
      `## ${t('Navigateur sans bundler')}`,
      t('Utilise une URL ESM via un CDN ou une import map, puis charge la définition avec fetch.'),
      markdownCode(nativeBrowserExample, 'html'),
      guideSectionsText(agentGuideSections('javascript'), t),
    ].join('\n\n')
  }

  const presentationProps: readonly RuntimeGuideProp[] = [
    [
      'size',
      'number | string | undefined',
      'Optionnelle, défaut 240. Nombre ou valeur CSS utilisée pour la largeur et la hauteur du conteneur.',
    ],
    ['className', 'string | undefined', 'Optionnelle. Classe CSS ajoutée au conteneur externe.'],
    [
      'style',
      'CSSProperties | undefined',
      'Optionnelle. Styles inline du conteneur externe ; width et height viennent de size.',
    ],
    [
      'ariaLabel',
      'string | undefined',
      'Optionnelle, défaut « Procedural avatar ». Nom accessible annoncé aux lecteurs d’écran.',
    ],
  ]
  return [
    `# ${t('Guide d’utilisation de l’avatar React')}`,
    t('Installe le package, crée ton composant et choisis le niveau de contrôle adapté.'),
    `## ${t('Installation')}`,
    t('Ajoute le package React et ses dépendances.'),
    markdownCode(runtimeInstallExample, 'bash'),
    privatePackageNotice,
    `## ${t('API recommandée : créer un avatar concret')}`,
    t(
      'createAvatar valide le JSON et retourne un composant dédié dont les clés d’animations sont typées.'
    ),
    markdownCode(createAvatarExample(animationKey), 'tsx'),
    `## ${t('Props de l’avatar')}`,
    t('Référence complète : type, valeur par défaut, comportement et contraintes de chaque prop.'),
    `### ${t('Cible et lecture')}`,
    markdownProps(targetProps, t),
    `### ${t('Présentation')}`,
    markdownProps(presentationProps, t),
    `### ${t('Callbacks de lecture')}`,
    markdownProps(callbackProps, t),
    `## ${t('Avatar générique')}`,
    t(
      'Utilise Avatar directement lorsque la définition est chargée à l’exécution ou change entre plusieurs avatars.'
    ),
    markdownCode(genericAvatarExample, 'tsx'),
    `## ${t('API impérative')}`,
    t('La ref expose les commandes de lecture et l’état courant de l’avatar.'),
    t('Les commandes de cible sont disponibles en mode non contrôlé ; sinon utilise les props.'),
    markdownProps(controllerProps, t),
    markdownCode(imperativeExample(animationKey), 'tsx'),
    guideSectionsText(agentGuideSections('react'), t),
  ].join('\n\n')
}

function GuideCode({ children }: { children: string }) {
  return (
    <pre className="avatar-guide-code" tabIndex={0}>
      <code>
        <HighlightedRuntimeCode>{children}</HighlightedRuntimeCode>
      </code>
    </pre>
  )
}

function PropRow({ name, type, description }: { name: string; type: string; description: string }) {
  return (
    <div className="avatar-guide-prop">
      <dt>
        <code>{name}</code>
        <span className="avatar-guide-prop-type">{type}</span>
      </dt>
      <dd>{description}</dd>
    </div>
  )
}

const guideIcons: Record<GuideIcon, typeof Code2> = {
  install: Code2,
  setup: Settings2,
  component: Play,
  props: SlidersHorizontal,
  controls: MousePointer2,
  errors: TriangleAlert,
  avoid: Ban,
  check: ListChecks,
}

function GuideSections({ sections }: { sections: readonly GuideSection[] }) {
  const { t } = useStudioLanguage()
  return sections.map(section => {
    const Icon = guideIcons[section.icon]
    return (
      <section
        className={`avatar-guide-section${section.accent ? ' avatar-guide-section--accent' : ''}${
          section.blocks.some(block => block.kind === 'rows') ? ' avatar-guide-section--api' : ''
        }`}
        key={section.title}
      >
        <div className="avatar-guide-section-heading">
          <Icon />
          <div>
            <h3>{t(section.title)}</h3>
            {section.intro && <p>{t(section.intro)}</p>}
          </div>
        </div>
        {section.blocks.map((block, index) => {
          if (block.kind === 'code') return <GuideCode key={index}>{block.code}</GuideCode>
          if (block.kind === 'text') {
            return (
              <p className="avatar-guide-notice" key={index}>
                {t(block.text)}
              </p>
            )
          }
          if (block.kind === 'list') {
            return (
              <ul className="avatar-guide-list" key={index}>
                {block.items.map(item => (
                  <li key={item}>{t(item)}</li>
                ))}
              </ul>
            )
          }
          return (
            <div className="avatar-guide-prop-group" key={index}>
              {block.title && <strong>{t(block.title)}</strong>}
              <dl>
                {block.rows.map(([name, type, description]) => (
                  <PropRow key={name} name={name} type={type} description={t(description)} />
                ))}
              </dl>
            </div>
          )
        })}
      </section>
    )
  })
}

export function RuntimeGuideDialog({
  animationKey,
  integration = 'react',
  onOpenChange,
  open,
}: {
  animationKey?: string
  integration?: RuntimeGuideIntegration
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useStudioLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="avatar-guide-dialog">
        <DialogHeader>
          <div className="avatar-guide-kicker">
            <BookOpen />
            <span>{t('Guide d’utilisation')}</span>
          </div>
          <DialogTitle>
            {t(
              integration === 'react-native'
                ? 'Guide d’utilisation de l’avatar React Native'
                : integration === 'react'
                  ? 'Guide d’utilisation de l’avatar React'
                  : 'Guide d’utilisation de l’avatar JavaScript'
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              integration === 'react-native'
                ? 'Installe le package, active le Bundle Mode, puis crée ton composant.'
                : integration === 'react'
                  ? 'Installe le package, crée ton composant et choisis le niveau de contrôle adapté.'
                  : 'Installe le module ESM, charge la définition JSON et monte l’avatar dans un élément du DOM.'
            )}
          </DialogDescription>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="avatar-guide-close"
                aria-label={t('Fermer le guide')}
              >
                <X />
              </Button>
            }
          />
        </DialogHeader>

        <div className="avatar-guide-body">
          {integration === 'react-native' ? (
            <GuideSections sections={reactNativeGuideSections(animationKey)} />
          ) : integration === 'react' ? (
            <>
              <section className="avatar-guide-section avatar-guide-section--accent">
                <div className="avatar-guide-section-heading">
                  <Code2 />
                  <div>
                    <h3>{t('Installation')}</h3>
                    <p>{t('Ajoute le package React et ses dépendances.')}</p>
                  </div>
                </div>
                <GuideCode>{runtimeInstallExample}</GuideCode>
                <p className="avatar-guide-notice">
                  {t(
                    'Les packages sont publiés sur npm sous licence MIT. Le README de chaque package, présent dans node_modules, contient la référence complète.'
                  )}
                </p>
              </section>

              <section className="avatar-guide-section">
                <div className="avatar-guide-section-heading">
                  <Play />
                  <div>
                    <h3>{t('API recommandée : créer un avatar concret')}</h3>
                    <p>
                      {t(
                        'createAvatar valide le JSON et retourne un composant dédié dont les clés d’animations sont typées.'
                      )}
                    </p>
                  </div>
                </div>
                <GuideCode>{createAvatarExample(animationKey)}</GuideCode>
              </section>

              <section className="avatar-guide-section avatar-guide-section--api">
                <div className="avatar-guide-section-heading">
                  <SlidersHorizontal />
                  <div>
                    <h3>{t('Props de l’avatar')}</h3>
                    <p>
                      {t(
                        'Référence complète : type, valeur par défaut, comportement et contraintes de chaque prop.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="avatar-guide-prop-group">
                  <strong>{t('Cible et lecture')}</strong>
                  <dl>
                    <PropRow
                      name="definition"
                      type="AvatarDefinition"
                      description={t(
                        'Obligatoire. Objet AvatarDefinition validé contenant les expressions et les animations à afficher.'
                      )}
                    />
                    <PropRow
                      name="animation"
                      type="AnimationKey | undefined"
                      description={t(
                        'Optionnelle. Contrôle une timeline par sa clé. Chaque étape choisit l’expression affichée. Mutuellement exclusive avec expression ; une cible contrôlée prend priorité sur les valeurs default.'
                      )}
                    />
                    <PropRow
                      name="expression"
                      type="ExpressionKey | undefined"
                      description={t(
                        'Optionnelle. Contrôle directement une expression par sa clé. Mutuellement exclusive avec animation ; une cible contrôlée prend priorité sur les valeurs default.'
                      )}
                    />
                    <PropRow
                      name="defaultAnimation"
                      type="AnimationKey | undefined"
                      description={t(
                        'Optionnelle. Définit la timeline initiale en mode non contrôlé. Lue au montage ; autoplay est activé par défaut. Mutuellement exclusive avec defaultExpression.'
                      )}
                    />
                    <PropRow
                      name="defaultExpression"
                      type="ExpressionKey | undefined"
                      description={t(
                        'Optionnelle. Définit l’expression initiale en mode non contrôlé. Lue au montage, sans lancer de timeline. Mutuellement exclusive avec defaultAnimation.'
                      )}
                    />
                    <PropRow
                      name="autoplay"
                      type="boolean | undefined"
                      description={t(
                        'Optionnelle, défaut true. Lance automatiquement defaultAnimation ; sans defaultAnimation, elle n’a aucun effet.'
                      )}
                    />
                    <PropRow
                      name="ref"
                      type="Ref<AvatarController> | undefined"
                      description={t(
                        'Optionnelle. Donne accès à l’API impérative AvatarController.'
                      )}
                    />
                  </dl>
                </div>

                <div className="avatar-guide-prop-group">
                  <strong>{t('Présentation')}</strong>
                  <dl>
                    <PropRow
                      name="size"
                      type="number | string | undefined"
                      description={t(
                        'Optionnelle, défaut 240. Nombre ou valeur CSS utilisée pour la largeur et la hauteur du conteneur.'
                      )}
                    />
                    <PropRow
                      name="className"
                      type="string | undefined"
                      description={t('Optionnelle. Classe CSS ajoutée au conteneur externe.')}
                    />
                    <PropRow
                      name="style"
                      type="CSSProperties | undefined"
                      description={t(
                        'Optionnelle. Styles inline du conteneur externe ; width et height viennent de size.'
                      )}
                    />
                    <PropRow
                      name="ariaLabel"
                      type="string | undefined"
                      description={t(
                        'Optionnelle, défaut « Procedural avatar ». Nom accessible annoncé aux lecteurs d’écran.'
                      )}
                    />
                  </dl>
                </div>

                <div className="avatar-guide-prop-group">
                  <strong>{t('Callbacks de lecture')}</strong>
                  <dl>
                    <PropRow
                      name="onAnimationEnd"
                      type="(animation: AnimationKey) => void"
                      description={t(
                        'Optionnelle. Reçoit la clé de l’animation once terminée naturellement.'
                      )}
                    />
                    <PropRow
                      name="onExpressionChange"
                      type="(expression: ExpressionKey) => void"
                      description={t(
                        'Optionnelle. Reçoit la clé de l’expression chaque fois que l’expression sémantique affichée change.'
                      )}
                    />
                    <PropRow
                      name="onError"
                      type="(error: AvatarRuntimeError) => void"
                      description={t(
                        'Optionnelle. Reçoit une erreur typée lorsqu’une prop animation, expression ou default référence une clé inconnue.'
                      )}
                    />
                  </dl>
                </div>
              </section>

              <section className="avatar-guide-section">
                <div className="avatar-guide-section-heading">
                  <Code2 />
                  <div>
                    <h3>{t('Avatar générique')}</h3>
                    <p>
                      {t(
                        'Utilise Avatar directement lorsque la définition est chargée à l’exécution ou change entre plusieurs avatars.'
                      )}
                    </p>
                  </div>
                </div>
                <GuideCode>{genericAvatarExample}</GuideCode>
              </section>

              <section className="avatar-guide-section avatar-guide-section--api">
                <div className="avatar-guide-section-heading">
                  <MousePointer2 />
                  <div>
                    <h3>{t('API impérative')}</h3>
                    <p>
                      {t('La ref expose les commandes de lecture et l’état courant de l’avatar.')}
                    </p>
                    <p>
                      {t(
                        'Les commandes de cible sont disponibles en mode non contrôlé ; sinon utilise les props.'
                      )}
                    </p>
                  </div>
                </div>
                <div className="avatar-guide-prop-group">
                  <dl>
                    <PropRow
                      name="play(animation)"
                      type="(animation: AnimationKey) => AvatarCommandResult"
                      description={t(
                        'Lance ou reprend une animation et retourne un résultat typé.'
                      )}
                    />
                    <PropRow
                      name="pause()"
                      type="() => void"
                      description={t('Met en pause la timeline à sa position exacte.')}
                    />
                    <PropRow
                      name="stop()"
                      type="() => void"
                      description={t(
                        'En mode non contrôlé, arrête la lecture et revient à neutral. En mode contrôlé, les props restent la source de vérité.'
                      )}
                    />
                    <PropRow
                      name="setExpression(expression)"
                      type="(expression: ExpressionKey) => AvatarCommandResult"
                      description={t('Affiche directement une expression.')}
                    />
                    <PropRow
                      name="getState()"
                      type="() => AvatarPlaybackState"
                      description={t('Retourne l’animation, l’expression et le statut actifs.')}
                    />
                  </dl>
                </div>
                <GuideCode>{imperativeExample(animationKey)}</GuideCode>
              </section>
            </>
          ) : (
            <>
              <section className="avatar-guide-section avatar-guide-section--accent">
                <div className="avatar-guide-section-heading">
                  <Code2 />
                  <div>
                    <h3>{t('Installation')}</h3>
                    <p>{t('Ajoute le renderer DOM, qui utilise automatiquement avatar-core.')}</p>
                  </div>
                </div>
                <GuideCode>{webInstallExample}</GuideCode>
                <p className="avatar-guide-notice">
                  {t(
                    'Les packages sont publiés sur npm sous licence MIT. Le README de chaque package, présent dans node_modules, contient la référence complète.'
                  )}
                </p>
              </section>

              <section className="avatar-guide-section">
                <div className="avatar-guide-section-heading">
                  <Play />
                  <div>
                    <h3>{t('Utilisation avec un bundler ESM')}</h3>
                    <p>
                      {t(
                        'Vite et les bundlers modernes résolvent le package et importent le même fichier .avatar.json que React.'
                      )}
                    </p>
                  </div>
                </div>
                <GuideCode>{webAvatarExample(animationKey)}</GuideCode>
              </section>

              <section className="avatar-guide-section avatar-guide-section--api">
                <div className="avatar-guide-section-heading">
                  <SlidersHorizontal />
                  <div>
                    <h3>{t('Options de createAvatar')}</h3>
                    <p>{t('Référence des valeurs acceptées lors du montage dans le DOM.')}</p>
                  </div>
                </div>
                <div className="avatar-guide-prop-group">
                  <dl>
                    <PropRow
                      name="definition"
                      type="AvatarDefinition | unknown"
                      description={t(
                        'Obligatoire. Définition JSON validée avant la création des éléments SVG.'
                      )}
                    />
                    <PropRow
                      name="defaultAnimation"
                      type="AnimationKey | undefined"
                      description={t(
                        'Optionnelle. Animation lancée au montage lorsque autoplay vaut true. Mutuellement exclusive avec defaultExpression.'
                      )}
                    />
                    <PropRow
                      name="defaultExpression"
                      type="ExpressionKey | undefined"
                      description={t(
                        'Optionnelle. Expression initiale affichée sans lancer de timeline. Mutuellement exclusive avec defaultAnimation.'
                      )}
                    />
                    <PropRow
                      name="autoplay"
                      type="boolean | undefined"
                      description={t(
                        'Optionnelle, défaut true. Contrôle uniquement le lancement automatique de defaultAnimation.'
                      )}
                    />
                    <PropRow
                      name="size"
                      type="number | string | undefined"
                      description={t(
                        'Optionnelle, défaut 240. Largeur et hauteur CSS du conteneur rendu.'
                      )}
                    />
                    <PropRow
                      name="className"
                      type="string | undefined"
                      description={t('Optionnelle. Classe CSS ajoutée au conteneur rendu.')}
                    />
                    <PropRow
                      name="ariaLabel"
                      type="string | undefined"
                      description={t(
                        'Optionnelle, défaut « Procedural avatar ». Nom accessible du rendu.'
                      )}
                    />
                    <PropRow
                      name="onError"
                      type="(error: AvatarRuntimeError) => void"
                      description={t(
                        'Optionnelle. Reçoit les erreurs de clé inconnue utilisées lors de l’initialisation.'
                      )}
                    />
                    <PropRow
                      name="onAnimationEnd"
                      type="(animation: AnimationKey) => void"
                      description={t('Optionnelle. Appelée lorsqu’une animation once se termine.')}
                    />
                    <PropRow
                      name="onExpressionChange"
                      type="(expression: ExpressionKey) => void"
                      description={t('Optionnelle. Appelée lorsque l’expression active change.')}
                    />
                  </dl>
                </div>
              </section>

              <section className="avatar-guide-section avatar-guide-section--api">
                <div className="avatar-guide-section-heading">
                  <MousePointer2 />
                  <div>
                    <h3>{t('API du contrôleur DOM')}</h3>
                    <p>{t('createAvatar retourne immédiatement ces commandes impératives.')}</p>
                  </div>
                </div>
                <div className="avatar-guide-prop-group">
                  <dl>
                    <PropRow
                      name="play(animation)"
                      type="(animation: AnimationKey) => AvatarCommandResult"
                      description={t('Lance ou reprend une animation par sa clé.')}
                    />
                    <PropRow
                      name="setExpression(expression)"
                      type="(expression: ExpressionKey) => AvatarCommandResult"
                      description={t('Affiche une expression avec une transition courte.')}
                    />
                    <PropRow
                      name="pause()"
                      type="() => void"
                      description={t('Met en pause la timeline à sa position exacte.')}
                    />
                    <PropRow
                      name="stop()"
                      type="() => void"
                      description={t('Arrête la lecture et revient à neutral.')}
                    />
                    <PropRow
                      name="getState()"
                      type="() => AvatarPlaybackState"
                      description={t('Retourne l’animation, l’expression et le statut actifs.')}
                    />
                    <PropRow
                      name="destroy()"
                      type="() => void"
                      description={t(
                        'Annule la frame planifiée et retire uniquement le conteneur créé par avatar-web.'
                      )}
                    />
                  </dl>
                </div>
              </section>

              <section className="avatar-guide-section">
                <div className="avatar-guide-section-heading">
                  <Code2 />
                  <div>
                    <h3>{t('Navigateur sans bundler')}</h3>
                    <p>
                      {t(
                        'Utilise une URL ESM via un CDN ou une import map, puis charge la définition avec fetch.'
                      )}
                    </p>
                  </div>
                </div>
                <GuideCode>{nativeBrowserExample}</GuideCode>
              </section>
            </>
          )}
          {integration !== 'react-native' && (
            <GuideSections sections={agentGuideSections(integration)} />
          )}
        </div>

        <div className="avatar-guide-footer">
          <DialogClose render={<Button variant="outline">{t('Fermer le guide')}</Button>} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
