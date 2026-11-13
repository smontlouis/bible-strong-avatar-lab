import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { chinese, translateChineseDynamicText } from './zh'

export type StudioLanguage = 'en' | 'fr' | 'zh-CN'

const STUDIO_LANGUAGE_STORAGE_KEY = 'avatar-studio-language'

const isStudioLanguage = (value: string | null): value is StudioLanguage =>
  value === 'en' || value === 'fr' || value === 'zh-CN'

const readStoredStudioLanguage = (): StudioLanguage => {
  if (typeof window === 'undefined') return 'en'
  try {
    const storedLanguage = window.localStorage.getItem(STUDIO_LANGUAGE_STORAGE_KEY)
    return isStudioLanguage(storedLanguage) ? storedLanguage : 'en'
  } catch {
    return 'en'
  }
}

const english: Record<string, string> = {
  Arrêté: 'Stopped',
  Lecture: 'Playback',
  Arrêter: 'Stop',
  'Langue de l’interface': 'Interface language',
  'Redimensionner l’aperçu et l’éditeur': 'Resize preview and editor',
  'Nom de l’avatar': 'Avatar name',
  sélecteur: 'picker',
  hexadécimal: 'hex value',
  'Glisser horizontalement pour modifier': 'Drag horizontally to adjust',
  'En lecture': 'Playing',
  'En pause': 'Paused',
  'Réinitialiser la rotation de la tête': 'Reset head rotation',
  'Réinitialiser la position et la rotation de': 'Reset position and rotation of',
  'Gizmo de rotation': 'Rotation gizmo',
  'Retour au studio': 'Back to studio',
  Pixel: 'Pixel',
  'Couleur du corps': 'Body color',
  'Couleur de la forme': 'Shape color',
  Automatique: 'Automatic',
  Avatars: 'Avatars',
  'Ce fichier n’est pas une définition d’avatar.': 'This file is not an avatar definition.',
  Clips: 'Clips',
  'Couleur du contour': 'Outline color',
  Couleurs: 'Colors',
  'Courbure au repos': 'Curve at rest',
  'En rayons du corps ; la taille de repos vaut 0,6.': 'In body radii; the size at rest is 0.6.',
  'Glisse pour tourner l’avatar': 'Drag to turn the avatar',
  'Hauteur des yeux': 'Eye height',
  Image: 'Picture',
  'Le corps et le visage.': 'The body and the face.',
  'Les yeux gardent leurs proportions sur tous les avatars. Leur taille, leur écart et leur hauteur se règlent.':
    'Eyes keep their proportions on every avatar. Their size, gap and height can be set.',
  'À 0, l’avatar est vu à plat : rien ne grossit en venant vers l’avant. À 1, la vue habituelle.':
    'At 0 the avatar is seen flat: nothing grows as it comes forward. At 1, the usual view.',
  'Dernière image clé : la valeur tient jusqu’à la fin du clip.':
    'Last keyframe: the value holds until the end of the clip.',
  Début: 'Start',
  Fermer: 'Close',
  Morphing: 'Morphing',
  'Rechercher un clip': 'Search a clip',
  'Rechercher un clip…': 'Search a clip…',
  'Rechercher un état': 'Search a state',
  'Utilisé par': 'Used by',
  Vitesse: 'Speed',
  clips: 'clips',
  clip: 'clip',
  'images clés': 'keyframes',
  sec: 'cut',
  État: 'State',
  états: 'states',
  'largeurs du corps': 'body widths',
  degrés: 'degrees',
  facteur: 'factor',
  '0 ouvert · 1 fermé': '0 open · 1 closed',
  'Reprendre l’état': 'Resume the state',
  'Clip seul': 'Clip alone',
  Clip: 'Clip',
  'Glisse l’avatar sur la scène, depuis n’importe quel onglet : ce qu’il fait se met en pause et il suit ta main. Affine ici avec le gizmo ou les valeurs. Lecture le fait reprendre là où il en était.':
    'Drag the avatar on the stage, from any tab: what it does pauses and it follows your hand. Refine it here with the gizmo or the values. Play makes it go on from where it was.',
  'posé à la main': 'posed by hand',
  Mélangé: 'Shuffled',
  'Rechercher un état…': 'Search a state…',
  'Aucun état': 'No state',
  'Aucun clip': 'No clip',
  'Visage tenu': 'Held face',
  Auto: 'Auto',
  arrêté: 'stopped',
  'Visage tenu par l’état': 'Face held by the state',
  'Se transforme en spinner': 'Turns into a spinner',
  'Tire ses clips au hasard, chacun une fois par tour, sans fin':
    'Draws its clips at random, each once a round, without end',
  Enchaîner: 'Hand over',
  Intégration: 'Integration',
  'Choisis le paquet qui correspond à ton projet.': 'Choose the package that fits your project.',
  'Navigateur, sans framework': 'Browser, no framework',
  'Instructions copiées dans le presse-papiers.': 'Instructions copied to the clipboard.',
  'Impossible de copier les instructions.': 'Could not copy the instructions.',
  'Le corps, les couleurs et le visage. Les états, les clips et les visages viennent avec le paquet.':
    'The body, the colours and the face. States, clips and faces come with the package.',
  'Le Bundle Mode de react-native-worklets est obligatoire : les instructions pour l’IA et le README expliquent comment l’activer.':
    'The Bundle Mode of react-native-worklets is required: the instructions for AI and the README explain how to turn it on.',
  'Taille des yeux': 'Eye size',
  'Écart des yeux': 'Eye gap',
  Paupières: 'Eyelids',
  Personnage: 'Character',
  Position: 'Position',
  'Position et taille': 'Position and size',
  'Remettre au repos': 'Back to rest',
  Rotation: 'Rotation',
  Spinners: 'Spinners',
  'Suit le pointeur': 'Follows the pointer',
  Télécharger: 'Download',
  'Un avatar importé garde son corps, ses couleurs, son nez et sa bouche. Ses expressions et ses animations ne sont pas reprises.':
    'An imported avatar keeps its body, colors, nose and mouth. Its expressions and animations are not brought in.',
  'Une bouche en trait suit le visage : elle se relève pour happy, tombe pour sad.':
    'A mouth drawn as a line follows the face: it rises for happy and drops for sad.',
  Visage: 'Face',
  morphing: 'morphing',
  raccord: 'join',
  visage: 'face',
  'au repos': 'at rest',
  États: 'States',
  Étirement: 'Stretch',
  'Le corps, les couleurs et le visage de cet avatar seront définitivement supprimés.':
    'The body, colors and face of this avatar will be permanently deleted.',
  'Orientation, position et taille de l’avatar.': 'Orientation, position and size of the avatar.',
  'Choisis le visage visible sur la photo.': 'Choose the face shown in the picture.',
  'Pose l’avatar, cadre-le, choisis un fond et enregistre-le en PNG ou en SVG.':
    'Pose the avatar, frame it, choose a background and save it as PNG or SVG.',
  visages: 'faces',
  'Couleur héritée': 'Inherited color',
  'Suit la rotation du corps': 'Follows the body rotation',
  'Désactivé, la forme reste en place quand le corps tourne. Elle le suit toujours quand il se déplace.':
    'When off, the shape stays in place while the body turns. It still follows the body when it moves.',
  'Rotation de la tête': 'Head rotation',
  'Couleur des yeux': 'Eye color',
  Largeur: 'Width',
  Hauteur: 'Height',
  Échelle: 'Scale',
  'Rotation locale': 'Local rotation',
  Projection: 'Projection',
  Perspective: 'Perspective',
  Supprimer: 'Delete',
  Enregistrer: 'Save',
  'Construction du corps': 'Body construction',
  'Choisis la forme principale puis assemble les primitives autour d’elle.':
    'Choose the primary shape, then assemble primitives around it.',
  'Choisir un avatar': 'Choose an avatar',
  'Double-clic pour modifier': 'Double-click to edit',
  'Nouvel avatar': 'New avatar',
  Modifier: 'Edit',
  'Mode d’édition': 'Editing mode',
  Pose: 'Pose',
  Expressions: 'Expressions',
  Animations: 'Animations',
  Exporter: 'Export',
  Installation: 'Installation',
  Preview: 'Preview',
  'Voir le guide complet': 'View full usage guide',
  'Copier les instructions pour l’IA': 'Copy instructions for AI',
  Expression: 'Expression',
  Animation: 'Animation',
  Format: 'Format',
  'Utilisation minimale': 'Minimal usage',
  Snapshot: 'Snapshot',
  'Mode photo': 'Photo Mode',
  Retour: 'Back',
  playing: 'Playing',
  played: 'Played',
  error: 'Error',
  Cadrage: 'Framing',
  Quitter: 'Exit',
  'Position, zoom et coins du cadre photo.': 'Position, zoom and photo frame corners.',
  'Ouvrir le mode photo': 'Open Photo Mode',
  'Recentrer le cadrage': 'Reset framing',
  'Cadre du logo. Glisse pour déplacer l’avatar et utilise la molette pour zoomer.':
    'Logo frame. Drag to move the avatar and use the wheel to zoom.',
  Zoom: 'Zoom',
  'Coins arrondis': 'Rounded corners',
  'Arrière-plan': 'Background',
  'Choisis un fond transparent, uni ou en dégradé.':
    'Choose a transparent, solid or gradient background.',
  Style: 'Style',
  Transparent: 'Transparent',
  Uni: 'Solid',
  'Dégradé linéaire': 'Linear gradient',
  'Dégradé radial': 'Radial gradient',
  'Style d’arrière-plan': 'Background style',
  Aléatoire: 'Random',
  Couleur: 'Color',
  Départ: 'Start',
  Arrivée: 'End',
  Définition: 'Resolution',
  'Dimensions du fichier exporté.': 'Dimensions of the exported file.',
  'Définition du mode photo': 'Photo Mode resolution',
  'Format d’export': 'Export format',
  'Format d’export du mode photo': 'Photo Mode export format',
  'Choisis le type de fichier généré par le mode photo.':
    'Choose the file type generated by Photo Mode.',
  'Prendre une photo': 'Take a picture',
  'Ajouter un avatar': 'Add an avatar',
  'Importer un .avatar.json': 'Import a .avatar.json',
  Importer: 'Import',
  'Une forme principale porte les yeux. Les autres primitives se placent autour d’elle.':
    'One primary shape carries the eyes. Other primitives are placed around it.',
  Principale: 'Primary',
  'porte les yeux': 'carries the eyes',
  'Ajouter une forme': 'Add a shape',
  'Réglages de la forme': 'Shape settings',
  Dupliquer: 'Duplicate',
  'Gizmo local': 'Local gizmo',
  'Déplacer dans le plan de la caméra': 'Move in camera plane',
  Transformer: 'Transform',
  copie: 'copy',
  'Glisse un axe pour déplacer la forme, ou un anneau pour la faire tourner.':
    'Drag an axis to move the shape, or a ring to rotate it.',
  Profondeur: 'Depth',
  'Position locale': 'Local position',
  'Rondeur des arêtes': 'Edge roundness',
  Rondeur: 'Roundness',
  'Rondeur globale': 'Global roundness',
  'Rondeur pointe': 'Tip roundness',
  'Rondeur base': 'Base roundness',
  Trapèze: 'Trapezoid',
  'Largeur du sommet': 'Top width',
  'Largeur de la base': 'Bottom width',
  Contour: 'Outline',
  Épaisseur: 'Thickness',
  Opacité: 'Opacity',
  Ellipse: 'Ellipse',
  'Afficher le nez': 'Show nose',
  'Position X': 'X position',
  'Position Y': 'Y position',
  'Afficher la bouche': 'Show mouth',
  Courbure: 'Curve amount',
  Afficher: 'Show',
  'Les libellés ↔ sont scrubbables, comme dans Figma.':
    'Labels marked ↔ can be scrubbed, like in Figma.',
  Réinitialiser: 'Reset',
  Nom: 'Name',
  Description: 'Description',
  Boucle: 'Loop',
  'Une fois': 'Once',
  Timeline: 'Timeline',
  Transition: 'Transition',
  animations: 'animations',
  Désactivé: 'Disabled',
  Pause: 'Pause',
  Reprendre: 'Resume',
  Annuler: 'Cancel',
  Sphère: 'Sphere',
  Curseur: 'Cursor',
  Cylindre: 'Cylinder',
  Cône: 'Cone',
  Diamant: 'Diamond',
  sleeping: 'sleeping',
  waking: 'waking',
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  searching: 'searching',
  working: 'working',
  excited: 'excited',
  surprised: 'surprised',
  suspicious: 'suspicious',
  angry: 'angry',
  drowsy: 'drowsy',
  happy: 'happy',
  curious: 'curious',
  confused: 'confused',
  bored: 'bored',
  proud: 'proud',
  shy: 'shy',
  sad: 'sad',
  laughing: 'laughing',
  scared: 'scared',
  playful: 'playful',
  celebrate: 'celebrate',
  orbit: 'orbit',
  radar: 'radar',
  progress: 'progress',
  spawning: 'spawning',
  humming: 'humming',
  loading: 'loading',
  dictating: 'dictating',
  writing: 'writing',
  sending: 'sending',
  receiving: 'receiving',
  uploading: 'uploading',
  notifying: 'notifying',
  alerting: 'alerting',
  dragging: 'dragging',
  bouncing: 'bouncing',
  'powering-down': 'powering down',
}

const frenchStates: Record<string, string> = {
  loop: 'boucle',
  once: 'une fois',
  pingPong: 'aller-retour',
  sleeping: 'sommeil',
  waking: 'réveil',
  idle: 'au repos',
  listening: 'écoute',
  thinking: 'réflexion',
  searching: 'recherche',
  working: 'travail',
  excited: 'enthousiaste',
  surprised: 'surpris',
  suspicious: 'méfiant',
  angry: 'en colère',
  drowsy: 'somnolent',
  happy: 'heureux',
  curious: 'curieux',
  confused: 'confus',
  bored: 'ennuyé',
  proud: 'fier',
  shy: 'timide',
  sad: 'triste',
  laughing: 'rire',
  scared: 'effrayé',
  playful: 'joueur',
  celebrate: 'célébration',
  orbit: 'orbite',
  radar: 'radar',
  progress: 'progression',
  spawning: 'apparition',
  humming: 'fredonnement',
  loading: 'chargement',
  dictating: 'dictée',
  writing: 'écriture',
  sending: 'envoi',
  receiving: 'réception',
  uploading: 'téléversement',
  notifying: 'notification',
  alerting: 'alerte',
  dragging: 'glissement',
  bouncing: 'rebond',
  'powering-down': 'extinction',
}

const dynamicTranslations: [RegExp, string][] = [
  [/^Passe à (.+) comme dans l’app$/, 'Goes on to $1, as in the app'],
  [/^Rejoue (.+) au lieu de passer à (.+)$/, 'Plays $1 again instead of going on to $2'],
  [/^Passe à (.+) après (.+) s$/, 'Goes on to $1 after $2 s'],
  [/^Joue l’état une fois, puis passe à (.+)$/, 'Plays the state once, then goes on to $1'],
  [/^Modifier l’expression (.+)$/, 'Edit expression $1'],
  [/^Modifier (.+)$/, 'Edit $1'],
  [/^Supprimer (.+) \?$/, 'Delete $1?'],
  [/^Ajouter une forme · (.+)$/, 'Add a shape · $1'],
  [/^Réinitialiser la position et la rotation de (.+)$/, 'Reset position and rotation of $1'],
  [/^Animation en cours : (.+)$/, 'Active animation: $1'],
  [/^Mettre (.+) en pause$/, 'Pause $1'],
  [/^Sort (\d+) fois plus souvent$/, 'Comes out $1 times as often'],
  [/^Reprendre (.+)$/, 'Resume $1'],
  [/^Arrêter (.+)$/, 'Stop $1'],
  [/^(.+) expressions$/, '$1 expressions'],
]

export const translateStudioText = (text: string, language: StudioLanguage) => {
  if (language === 'fr') return frenchStates[text] ?? text
  if (language === 'zh-CN') {
    const exact = chinese[text]
    if (exact) return exact
    const dynamic = translateChineseDynamicText(text)
    if (dynamic) return dynamic
    return Object.entries(chinese)
      .sort(([left], [right]) => right.length - left.length)
      .reduce(
        (translated, [source, replacement]) => translated.replaceAll(source, replacement),
        text
      )
  }
  const exact = english[text]
  if (exact) return exact
  for (const [pattern, replacement] of dynamicTranslations) {
    if (pattern.test(text)) return text.replace(pattern, replacement)
  }
  return Object.entries(english)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((translated, [source, replacement]) => translated.replaceAll(source, replacement), text)
}

type StudioLanguageContextValue = {
  language: StudioLanguage
  setLanguage: (language: StudioLanguage) => void
  t: (text: string) => string
}

const StudioLanguageContext = createContext<StudioLanguageContextValue | null>(null)

export function StudioLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<StudioLanguage>(readStoredStudioLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    try {
      window.localStorage.setItem(STUDIO_LANGUAGE_STORAGE_KEY, language)
    } catch {
      // The studio remains usable when browser storage is unavailable.
    }
  }, [language])

  return createElement(
    StudioLanguageContext.Provider,
    { value: { language, setLanguage, t: text => translateStudioText(text, language) } },
    children
  )
}

export const useStudioLanguage = () => {
  const context = useContext(StudioLanguageContext)
  if (!context) throw new Error('useStudioLanguage must be used inside StudioLanguageProvider')
  return context
}
