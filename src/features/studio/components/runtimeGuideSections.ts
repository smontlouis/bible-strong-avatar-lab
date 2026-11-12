// The parts of the usage guide that are data: sections made of code, text, reference rows and
// lists. The dialog draws them and the « copy for AI » button turns them into Markdown, so the
// two never drift apart. Every string is French source copy, translated where it is shown.

export type GuideRow = readonly [name: string, type: string, description: string]

export type GuideBlock =
  | { kind: 'code'; code: string; language: string }
  | { kind: 'text'; text: string }
  | { kind: 'rows'; title?: string; rows: readonly GuideRow[] }
  | { kind: 'list'; items: readonly string[] }

export type GuideIcon =
  'install' | 'setup' | 'component' | 'props' | 'controls' | 'errors' | 'avoid' | 'check'

export type GuideSection = {
  icon: GuideIcon
  title: string
  intro?: string
  accent?: boolean
  blocks: readonly GuideBlock[]
}

export type GuideIntegration = 'react' | 'javascript' | 'react-native'

export const packagesNotice =
  'Les packages sont publiés sur npm sous licence MIT. Le README de chaque package, présent dans node_modules, contient la référence complète.'

export const targetProps: readonly GuideRow[] = [
  [
    'definition',
    'AvatarDefinition',
    'Obligatoire. Objet AvatarDefinition validé contenant les expressions et les animations à afficher.',
  ],
  [
    'animation',
    'AnimationKey | undefined',
    'Optionnelle. Contrôle une timeline par sa clé. Chaque étape choisit l’expression affichée. Mutuellement exclusive avec expression ; une cible contrôlée prend priorité sur les valeurs default.',
  ],
  [
    'expression',
    'ExpressionKey | undefined',
    'Optionnelle. Contrôle directement une expression par sa clé. Mutuellement exclusive avec animation ; une cible contrôlée prend priorité sur les valeurs default.',
  ],
  [
    'defaultAnimation',
    'AnimationKey | undefined',
    'Optionnelle. Définit la timeline initiale en mode non contrôlé. Lue au montage ; autoplay est activé par défaut. Mutuellement exclusive avec defaultExpression.',
  ],
  [
    'defaultExpression',
    'ExpressionKey | undefined',
    'Optionnelle. Définit l’expression initiale en mode non contrôlé. Lue au montage, sans lancer de timeline. Mutuellement exclusive avec defaultAnimation.',
  ],
  [
    'autoplay',
    'boolean | undefined',
    'Optionnelle, défaut true. Lance automatiquement defaultAnimation ; sans defaultAnimation, elle n’a aucun effet.',
  ],
  [
    'ref',
    'Ref<AvatarController> | undefined',
    'Optionnelle. Donne accès à l’API impérative AvatarController.',
  ],
]

export const callbackProps: readonly GuideRow[] = [
  [
    'onAnimationEnd',
    '(animation: AnimationKey) => void',
    'Optionnelle. Reçoit la clé de l’animation once terminée naturellement.',
  ],
  [
    'onExpressionChange',
    '(expression: ExpressionKey) => void',
    'Optionnelle. Reçoit la clé de l’expression chaque fois que l’expression sémantique affichée change.',
  ],
  [
    'onError',
    '(error: AvatarRuntimeError) => void',
    'Optionnelle. Reçoit une erreur typée lorsqu’une prop animation, expression ou default référence une clé inconnue.',
  ],
]

export const controllerProps: readonly GuideRow[] = [
  [
    'play(animation)',
    '(animation: AnimationKey) => AvatarCommandResult',
    'Lance ou reprend une animation et retourne un résultat typé.',
  ],
  ['pause()', '() => void', 'Met en pause la timeline à sa position exacte.'],
  [
    'stop()',
    '() => void',
    'En mode non contrôlé, arrête la lecture et revient à neutral. En mode contrôlé, les props restent la source de vérité.',
  ],
  [
    'setExpression(expression)',
    '(expression: ExpressionKey) => AvatarCommandResult',
    'Affiche directement une expression.',
  ],
  [
    'getState()',
    '() => AvatarPlaybackState',
    'Retourne l’animation, l’expression et le statut actifs.',
  ],
]

const nativePresentationProps: readonly GuideRow[] = [
  ['size', 'number | undefined', 'Optionnelle, défaut 240. Largeur et hauteur en points.'],
  [
    'style',
    'StyleProp<ViewStyle> | undefined',
    'Optionnelle. Style de la View qui entoure l’avatar ; width et height viennent de size.',
  ],
  [
    'accessibilityLabel',
    'string | undefined',
    'Optionnelle, défaut « Procedural avatar ». L’avatar est exposé comme une seule image portant ce nom.',
  ],
  [
    'muted',
    'boolean | undefined',
    'Optionnelle, défaut false. Fait passer toutes les couleurs à leur gris en 300 ms.',
  ],
  [
    'settleAfterMs',
    'number | undefined',
    'Optionnelle, défaut 0. Arrête le calcul ce délai après le début d’une cible, sur la prochaine pose tenue, yeux ouverts. À donner à tout avatar décoratif.',
  ],
  [
    'frameRate',
    '30 | 60 | undefined',
    'Optionnelle, défaut 30. Images calculées par seconde sur le thread UI.',
  ],
]

export const nativeInstallExample =
  'npx expo install react-native-reanimated react-native-worklets react-native-svg && npm install @bible-strong/avatar-react-native'

const nativeBabelExample = `module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    [
      'react-native-worklets/plugin',
      {
        bundleMode: true,
        importForwarding: { moduleNames: ['@bible-strong/avatar-core'] },
      },
    ],
  ],
}`

const nativeMetroExample = `const { getDefaultConfig } = require('expo/metro-config')
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode')

module.exports = getBundleModeMetroConfig(getDefaultConfig(__dirname))`

export const nativeAvatarExample = (
  animationKey: string | undefined
) => `import { createAvatar } from '@bible-strong/avatar-react-native'
import avatarJson from './avatar.avatar.json'

const Avatar = createAvatar(avatarJson)

export function Assistant() {
  return <Avatar ${
    animationKey ? `animation="${animationKey}"` : 'expression="neutral"'
  } size={96} />
}`

const nativeImperativeExample = (
  animationKey: string | undefined
) => `import { createAvatar, type AvatarController } from '@bible-strong/avatar-react-native'
import { useRef } from 'react'
import { Button } from 'react-native'
import avatarJson from './avatar.avatar.json'

const Avatar = createAvatar(avatarJson)

export function Controls() {
  const avatar = useRef<AvatarController>(null)

  return <>
    <Avatar ref={avatar} ${
      animationKey ? `defaultAnimation="${animationKey}"` : 'defaultExpression="neutral"'
    } />${
      animationKey
        ? `
    <Button title="Play" onPress={() => avatar.current?.play('${animationKey}')} />`
        : ''
    }
    <Button title="Pause" onPress={() => avatar.current?.pause()} />
    <Button title="Neutral" onPress={() => avatar.current?.setExpression('neutral')} />
  </>
}`

const keyErrors: readonly GuideRow[] = [
  [
    'unknown_animation',
    '',
    'Retournée par play() ou transmise à onError : la clé n’existe pas dans definition.animations. Utilise une clé du JSON.',
  ],
  [
    'unknown_expression',
    '',
    'Retournée par setExpression() ou transmise à onError : la clé n’existe pas dans definition.expressions. Utilise une clé du JSON.',
  ],
]

const controlledError: GuideRow = [
  'controlled_by_props',
  '',
  'Retournée par play() ou setExpression() quand la prop animation ou expression est définie. Change la prop, ou retire-la.',
]

const invalidDefinitionError: GuideRow = [
  'Invalid avatar definition',
  '',
  'Levée au rendu : le JSON ne respecte pas le schéma. Réexporte-le depuis le Studio.',
]

const twoTargetsError: GuideRow = [
  'Avatar accepts either animation or expression',
  '',
  'Levée au rendu : deux cibles ont été données (animation et expression, ou leurs variantes default). Gardes-en une.',
]

const errorsSection = (rows: readonly GuideRow[]): GuideSection => ({
  icon: 'errors',
  title: 'Erreurs et corrections',
  intro:
    'Chaque erreur a une cause précise. Applique la correction indiquée plutôt que de contourner.',
  blocks: [{ kind: 'rows', rows }],
})

const checkSection = (items: readonly string[]): GuideSection => ({
  icon: 'check',
  title: 'Vérifier l’intégration',
  intro: 'Avant de considérer l’intégration terminée, vérifie chaque point.',
  blocks: [
    { kind: 'list', items },
    {
      kind: 'text',
      text: 'La référence complète est dans le README du package, lisible dans node_modules.',
    },
  ],
})

const typedKeysCheck =
  'npx tsc --noEmit passe, et une clé d’animation fausse est une erreur de type avec createAvatar.'
const noJumpCheck = 'Changer animation fait partir l’avatar de sa pose actuelle, sans saut.'

/** What a coding agent needs beyond the reference: every error with its fix, and how to verify. */
export const agentGuideSections = (integration: 'react' | 'javascript'): GuideSection[] =>
  integration === 'react'
    ? [
        errorsSection([
          ...keyErrors,
          controlledError,
          invalidDefinitionError,
          twoTargetsError,
          [
            'window is not defined',
            '',
            'Levée au rendu côté serveur : le composant lit window. Rends-le uniquement dans un composant client.',
          ],
        ]),
        checkSection([
          typedKeysCheck,
          'L’avatar apparaît à la taille attendue : s’il est sans style, l’import de la feuille de style manque.',
          noJumpCheck,
        ]),
      ]
    : [
        errorsSection([
          ...keyErrors,
          invalidDefinitionError,
          [
            'Avatar target was not found',
            '',
            'Levée par createAvatar : le sélecteur ne correspond à aucun élément. Appelle createAvatar une fois l’élément présent.',
          ],
        ]),
        checkSection([
          'L’avatar apparaît dans la cible et cligne des yeux.',
          'avatar.play() retourne { ok: true } pour une clé du JSON.',
          'avatar.destroy() est appelé partout où la page retire la cible.',
        ]),
      ]

export const reactNativeGuideSections = (animationKey: string | undefined): GuideSection[] => [
  {
    icon: 'install',
    title: 'Installation',
    intro:
      'Ajoute le renderer React Native et ses dépendances natives. avatar-core est installé automatiquement.',
    accent: true,
    blocks: [
      { kind: 'code', code: nativeInstallExample, language: 'bash' },
      { kind: 'text', text: packagesNotice },
    ],
  },
  {
    icon: 'setup',
    title: 'Configuration obligatoire : Bundle Mode',
    intro:
      'L’avatar calcule chaque image sur le thread UI. Active le Bundle Mode de react-native-worklets et transmets avatar-core au thread UI ; sans cela, le composant lève une erreur au premier rendu.',
    blocks: [
      { kind: 'text', text: 'babel.config.js, avec le plugin worklets en dernier :' },
      { kind: 'code', code: nativeBabelExample, language: 'js' },
      { kind: 'text', text: 'metro.config.js :' },
      { kind: 'code', code: nativeMetroExample, language: 'js' },
      {
        kind: 'text',
        text: 'Redémarre ensuite Metro avec un cache vide (npx expo start --clear). Pour le web et pour Jest, laisse bundleMode désactivé.',
      },
    ],
  },
  {
    icon: 'component',
    title: 'API recommandée : créer un avatar concret',
    intro:
      'createAvatar valide le JSON et retourne un composant dédié dont les clés d’animations sont typées.',
    blocks: [{ kind: 'code', code: nativeAvatarExample(animationKey), language: 'tsx' }],
  },
  {
    icon: 'props',
    title: 'Props de l’avatar',
    intro:
      'Référence complète : type, valeur par défaut, comportement et contraintes de chaque prop.',
    blocks: [
      { kind: 'rows', title: 'Cible et lecture', rows: targetProps },
      { kind: 'rows', title: 'Présentation', rows: nativePresentationProps },
      { kind: 'rows', title: 'Callbacks de lecture', rows: callbackProps },
    ],
  },
  {
    icon: 'controls',
    title: 'API impérative',
    intro: 'La ref expose les commandes de lecture et l’état courant de l’avatar.',
    blocks: [
      {
        kind: 'text',
        text: 'Les commandes de cible sont disponibles en mode non contrôlé ; sinon utilise les props.',
      },
      { kind: 'rows', rows: controllerProps },
      { kind: 'code', code: nativeImperativeExample(animationKey), language: 'tsx' },
    ],
  },
  errorsSection([
    ...keyErrors,
    controlledError,
    invalidDefinitionError,
    twoTargetsError,
    [
      'needs the Bundle Mode of react-native-worklets',
      '',
      'Levée au rendu : la configuration du Bundle Mode manque, ou Metro a gardé un ancien cache. Applique la configuration ci-dessus puis redémarre Metro avec --clear.',
    ],
    [
      'only renders on iOS and Android',
      '',
      'Levée au rendu : le composant a été rendu sur le web. Utilise @bible-strong/avatar-react dans un fichier .web.tsx.',
    ],
  ]),
  {
    icon: 'avoid',
    title: 'À ne pas faire',
    intro: 'Ces raccourcis ont été mesurés et coûtent cher.',
    blocks: [
      {
        kind: 'list',
        items: [
          'Ne calcule pas les images sur le thread JS (requestAnimationFrame avec renderAvatarFrame) : 12 à 19 % d’un cœur au repos, et une boucle folle en arrière-plan.',
          'N’écris pas les tracés avec setNativeProps : environ 64 ms par image, contre environ 2 ms avec ce package.',
          'N’importe pas ce package dans un fichier chargé par le bundle web.',
          'Ne reconstruis pas l’objet definition à chaque rendu : une nouvelle référence relance l’avatar.',
        ],
      },
    ],
  },
  checkSection([
    typedKeysCheck,
    'L’avatar apparaît et cligne des yeux sur un simulateur iOS et sur un émulateur Android.',
    noJumpCheck,
    'Aucune image n’est calculée une fois l’app en arrière-plan.',
  ]),
]

const markdownCode = (code: string, language: string) => `\`\`\`${language}\n${code}\n\`\`\``

/** The sections as Markdown, for the « copy for AI » button. */
export const guideSectionsText = (sections: readonly GuideSection[], t: (text: string) => string) =>
  sections
    .flatMap(section => [
      `## ${t(section.title)}`,
      ...(section.intro ? [t(section.intro)] : []),
      ...section.blocks.flatMap(block => {
        if (block.kind === 'code') return [markdownCode(block.code, block.language)]
        if (block.kind === 'text') return [t(block.text)]
        if (block.kind === 'list') return [block.items.map(item => `- ${t(item)}`).join('\n')]
        return [
          ...(block.title ? [`### ${t(block.title)}`] : []),
          block.rows
            .map(([name, type, description]) =>
              type
                ? `- \`${name}\` — \`${type}\`: ${t(description)}`
                : `- \`${name}\`: ${t(description)}`
            )
            .join('\n'),
        ]
      }),
    ])
    .join('\n\n')
