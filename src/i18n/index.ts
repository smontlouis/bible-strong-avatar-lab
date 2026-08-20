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
  'Playground de l’avatar': 'Avatar playground',
  Arrêté: 'Stopped',
  'Aperçu procédural en direct': 'Live procedural preview',
  'Aperçu de l’avatar': 'Avatar preview',
  'Choisissez une animation exportée pour la lancer.': 'Choose an exported animation to play it.',
  Lecture: 'Playback',
  'Contrôlez l’animation active.': 'Control the active animation.',
  Lire: 'Play',
  Arrêter: 'Stop',
  'API JavaScript': 'JavaScript API',
  'Le module réutilisable est disponible dans avatar.js.':
    'The reusable module is available as avatar.js.',
  'Ouvrez cette démo directement, ou servez le dossier localement pour importer avatar.js depuis un autre module.':
    'Open this demo directly, or serve the folder locally to import avatar.js from another module.',
  'Langue de l’interface': 'Interface language',
  'Redimensionner l’aperçu et l’éditeur': 'Resize preview and editor',
  'Nom de l’avatar': 'Avatar name',
  sélecteur: 'picker',
  hexadécimal: 'hex value',
  'Lier width': 'Link widths',
  'Lier height': 'Link heights',
  'Lier size': 'Link sizes',
  'Lier la position des yeux': 'Link eye positions',
  'Glisser horizontalement pour modifier': 'Drag horizontally to adjust',
  'En lecture': 'Playing',
  'En pause': 'Paused',
  'Réinitialiser la rotation de la tête': 'Reset head rotation',
  'Réinitialiser la position et la rotation de': 'Reset position and rotation of',
  'Avatar procédural': 'Procedural avatar',
  'Gizmo de rotation': 'Rotation gizmo',
  'Retour aux expressions': 'Back to expressions',
  'Retour aux animations': 'Back to animations',
  'Retour au studio': 'Back to studio',
  'Preset en mémoire': 'Saved preset',
  'Nouvelle expression': 'New expression',
  'Identité runtime': 'Runtime identity',
  'Nom public stable utilisé par les applications qui chargent cet avatar.':
    'Stable public name used by applications that load this avatar.',
  'Clé sémantique': 'Semantic key',
  'Clé sémantique manquante': 'Missing semantic key',
  'Clé publique stable utilisée par l’API runtime, par exemple happy-smile.':
    'Stable public key used by the runtime API, for example happy-smile.',
  'Clé publique stable utilisée par l’API runtime, par exemple thinking.':
    'Stable public key used by the runtime API, for example thinking.',
  'Ajoute une clé pour inclure cet élément dans l’export runtime.':
    'Add a key to include this item in the runtime export.',
  'Utilise des lettres minuscules, des chiffres et des tirets, par exemple happy-smile.':
    'Use lowercase letters, numbers, and hyphens, for example happy-smile.',
  'neutral est réservé à l’apparence neutre de l’avatar.':
    'neutral is reserved for the avatar neutral appearance.',
  'Cette clé est déjà utilisée dans cette bibliothèque.':
    'This key is already used in this library.',
  'L’avatar à gauche affiche cette expression en direct.':
    'The avatar on the left previews this expression live.',
  Corps: 'Body',
  Rendu: 'Rendering',
  'Choisis la finition visuelle propre à cet avatar.':
    'Choose the visual finish specific to this avatar.',
  'Type de rendu': 'Rendering type',
  'Le rendu Pixel est temporairement désactivé.': 'Pixel rendering is temporarily disabled.',
  'Le mode Vectoriel est utilisé pour l’instant.': 'Vector rendering is currently used.',
  'Pixel utilise une palette franche, sans lissage ni couleur intermédiaire.':
    'Pixel uses a hard palette, with no smoothing or intermediate colors.',
  Vectoriel: 'Vector',
  Pixel: 'Pixel',
  'Définition de la grille': 'Grid resolution',
  'Apparence et orientation générale de l’avatar.': 'General avatar appearance and orientation.',
  'Couleur du corps': 'Body color',
  'Rotation de la tête': 'Head rotation',
  Yeux: 'Eyes',
  'Forme, placement et orientation propres au regard.': 'Eye shape, placement and orientation.',
  'Couleur des yeux': 'Eye color',
  Largeur: 'Width',
  Hauteur: 'Height',
  Échelle: 'Scale',
  'Taille proportionnelle': 'Proportional size',
  'Œil gauche': 'Left eye',
  'Œil droit': 'Right eye',
  'Position et espacement': 'Position and spacing',
  Horizontale: 'Horizontal',
  Verticale: 'Vertical',
  Espacement: 'Spacing',
  'Rotation locale': 'Local rotation',
  Projection: 'Projection',
  'Perspective appliquée à la surface active.': 'Perspective applied to the active surface.',
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
  'Exporter l’avatar': 'Export avatar',
  'Exporter le JSON runtime': 'Export runtime JSON',
  Nouveau: 'New',
  'Exporte le fichier .avatar.json utilisé par les nouveaux packages npm.':
    'Export the .avatar.json file used by the new npm packages.',
  'JSON runtime + createAvatar': 'Runtime JSON + createAvatar',
  'Télécharge la définition portable complète de l’avatar actif.':
    'Download the complete portable definition for the active avatar.',
  'Définition runtime': 'Runtime definition',
  'Fichier .avatar.json portable': 'Portable .avatar.json file',
  'Export runtime incomplet': 'Runtime export is incomplete',
  'Corrige les clés signalées dans les éditeurs Expressions ou Animations.':
    'Fix the highlighted keys in the Expressions or Animations editors.',
  'Télécharger la définition .avatar.json': 'Download .avatar.json definition',
  'Copier le JSON formaté': 'Copy formatted JSON',
  'Copier le JSON': 'Copy JSON',
  'JSON runtime copié dans le presse-papiers.': 'Runtime JSON copied to the clipboard.',
  'Impossible de copier le JSON runtime.': 'Could not copy the runtime JSON.',
  Installation: 'Installation',
  'Lancer l’exemple': 'Run example',
  'Masquer l’aperçu': 'Hide preview',
  'Aperçu avec le package React': 'Preview using the React package',
  Preview: 'Preview',
  'Définition prête à tester': 'Definition ready to test',
  'Démarrage rapide': 'Quick start',
  'Preview de la définition exportée': 'Exported definition preview',
  'Teste les animations et expressions réellement présentes dans le fichier .avatar.json.':
    'Test the animations and expressions actually included in the .avatar.json file.',
  'Fermer la preview': 'Close preview',
  'Définition exportée': 'Exported definition',
  'Animation active': 'Active animation',
  'Expression active': 'Active expression',
  'Contrôles de lecture': 'Playback controls',
  'Animations exportées': 'Exported animations',
  'Expressions exportées': 'Exported expressions',
  'Clique pour lancer': 'Click to play',
  'Clique pour afficher': 'Click to display',
  'Aucune animation exportée': 'No exported animation',
  'Aperçu runtime de l’avatar actif': 'Runtime preview of the active avatar',
  'Animation de départ': 'Starting animation',
  'Expression de départ': 'Starting expression',
  'Aucune animation sélectionnée': 'No animation selected',
  'Guide d’utilisation': 'Usage guide',
  'Voir le guide complet': 'View full usage guide',
  'Copier les instructions pour l’IA': 'Copy instruction for AI',
  'Guide d’utilisation copié dans le presse-papiers.': 'Usage guide copied to the clipboard.',
  'Impossible de copier le guide d’utilisation.': 'Could not copy the usage guide.',
  'Guide d’utilisation de l’avatar React': 'React avatar usage guide',
  'Guide d’utilisation de l’avatar JavaScript': 'JavaScript avatar usage guide',
  'Installe le package, crée ton composant et choisis le niveau de contrôle adapté.':
    'Install the package, create your component and choose the right control level.',
  'Fermer le guide': 'Close guide',
  'Ajoute le package React et ses dépendances.': 'Add the React package and its dependencies.',
  'Installe le module ESM, charge la définition JSON et monte l’avatar dans un élément du DOM.':
    'Install the ESM module, load the JSON definition and mount the avatar in a DOM element.',
  'Ajoute le renderer DOM, qui utilise automatiquement avatar-core.':
    'Add the DOM renderer, which automatically uses avatar-core.',
  'Utilisation avec un bundler ESM': 'Using an ESM bundler',
  'Vite et les bundlers modernes résolvent le package et importent le même fichier .avatar.json que React.':
    'Vite and modern bundlers resolve the package and import the same .avatar.json file as React.',
  'Options de createAvatar': 'createAvatar options',
  'Référence des valeurs acceptées lors du montage dans le DOM.':
    'Reference for values accepted when mounting into the DOM.',
  'Obligatoire. Définition JSON validée avant la création des éléments SVG.':
    'Required. JSON definition validated before the SVG elements are created.',
  'Optionnelle. Animation lancée au montage lorsque autoplay vaut true. Mutuellement exclusive avec defaultExpression.':
    'Optional. Animation started on mount when autoplay is true. Mutually exclusive with defaultExpression.',
  'Optionnelle. Expression initiale affichée sans lancer de timeline. Mutuellement exclusive avec defaultAnimation.':
    'Optional. Initial expression displayed without starting a timeline. Mutually exclusive with defaultAnimation.',
  'Optionnelle, défaut true. Contrôle uniquement le lancement automatique de defaultAnimation.':
    'Optional, defaults to true. Only controls whether defaultAnimation starts automatically.',
  'Optionnelle, défaut 240. Largeur et hauteur CSS du conteneur rendu.':
    'Optional, defaults to 240. CSS width and height of the rendered container.',
  'Optionnelle. Classe CSS ajoutée au conteneur rendu.':
    'Optional. CSS class added to the rendered container.',
  'Optionnelle, défaut « Procedural avatar ». Nom accessible du rendu.':
    'Optional, defaults to “Procedural avatar”. Accessible name for the rendered avatar.',
  'Optionnelle. Reçoit les erreurs de clé inconnue utilisées lors de l’initialisation.':
    'Optional. Receives unknown-key errors encountered during initialization.',
  'Optionnelle. Appelée lorsqu’une animation once se termine.':
    'Optional. Called when a once animation completes.',
  'Optionnelle. Appelée lorsque l’expression active change.':
    'Optional. Called when the active expression changes.',
  'API du contrôleur DOM': 'DOM controller API',
  'createAvatar retourne immédiatement ces commandes impératives.':
    'createAvatar immediately returns these imperative commands.',
  'Lance ou reprend une animation par sa clé.': 'Starts or resumes an animation by key.',
  'Affiche une expression avec une transition courte.':
    'Displays an expression with a short transition.',
  'Arrête la lecture et revient à neutral.': 'Stops playback and returns to neutral.',
  'Annule la frame planifiée et retire uniquement le conteneur créé par avatar-web.':
    'Cancels the scheduled frame and removes only the container created by avatar-web.',
  'Navigateur sans bundler': 'Browser without a bundler',
  'Utilise une URL ESM via un CDN ou une import map, puis charge la définition avec fetch.':
    'Use an ESM URL through a CDN or import map, then load the definition with fetch.',
  'Les packages sont encore privés. Cette commande fonctionnera après leur publication ; utilise le workspace ou les tarballs pour les tests locaux.':
    'The packages are still private. This command will work after publication; use the workspace or tarballs for local testing.',
  'API recommandée : créer un avatar concret': 'Recommended API: create a concrete avatar',
  'createAvatar valide le JSON et retourne un composant dédié dont les clés d’animations sont typées.':
    'createAvatar validates the JSON and returns a dedicated component with typed animation keys.',
  'Props de l’avatar': 'Avatar props',
  'Référence complète : type, valeur par défaut, comportement et contraintes de chaque prop.':
    'Complete reference: type, default value, behavior and constraints for every prop.',
  'Cible et lecture': 'Target and playback',
  'Obligatoire. Objet AvatarDefinition validé contenant les expressions et les animations à afficher.':
    'Required. Validated AvatarDefinition object containing the expressions and animations to display.',
  'Optionnelle. Contrôle une timeline par sa clé. Chaque étape choisit l’expression affichée. Mutuellement exclusive avec expression ; une cible contrôlée prend priorité sur les valeurs default.':
    'Optional. Controls a timeline by key. Each step chooses the displayed expression. Mutually exclusive with expression; a controlled target takes priority over default values.',
  'Optionnelle. Contrôle directement une expression par sa clé. Mutuellement exclusive avec animation ; une cible contrôlée prend priorité sur les valeurs default.':
    'Optional. Directly controls an expression by key. Mutually exclusive with animation; a controlled target takes priority over default values.',
  'Optionnelle. Définit la timeline initiale en mode non contrôlé. Lue au montage ; autoplay est activé par défaut. Mutuellement exclusive avec defaultExpression.':
    'Optional. Defines the initial timeline in uncontrolled mode. Read on mount; autoplay is enabled by default. Mutually exclusive with defaultExpression.',
  'Optionnelle. Définit l’expression initiale en mode non contrôlé. Lue au montage, sans lancer de timeline. Mutuellement exclusive avec defaultAnimation.':
    'Optional. Defines the initial expression in uncontrolled mode. Read on mount without starting a timeline. Mutually exclusive with defaultAnimation.',
  'Optionnelle, défaut true. Lance automatiquement defaultAnimation ; sans defaultAnimation, elle n’a aucun effet.':
    'Optional, defaults to true. Automatically starts defaultAnimation; without defaultAnimation, it has no effect.',
  'Optionnelle. Donne accès à l’API impérative AvatarController.':
    'Optional. Provides access to the imperative AvatarController API.',
  Présentation: 'Presentation',
  'Optionnelle, défaut 240. Nombre ou valeur CSS utilisée pour la largeur et la hauteur du conteneur.':
    'Optional, defaults to 240. Number or CSS value used for the container width and height.',
  'Optionnelle. Classe CSS ajoutée au conteneur externe.':
    'Optional. CSS class added to the outer container.',
  'Optionnelle. Styles inline du conteneur externe ; width et height viennent de size.':
    'Optional. Inline styles for the outer container; width and height come from size.',
  'Optionnelle, défaut « Procedural avatar ». Nom accessible annoncé aux lecteurs d’écran.':
    'Optional, defaults to “Procedural avatar”. Accessible name announced to screen readers.',
  'Callbacks de lecture': 'Playback callbacks',
  'Optionnelle. Reçoit la clé de l’animation once terminée naturellement.':
    'Optional. Receives the key of a once animation when it completes naturally.',
  'Optionnelle. Reçoit la clé de l’expression chaque fois que l’expression sémantique affichée change.':
    'Optional. Receives the expression key whenever the displayed semantic expression changes.',
  'Optionnelle. Reçoit une erreur typée lorsqu’une prop animation, expression ou default référence une clé inconnue.':
    'Optional. Receives a typed error when an animation, expression or default prop references an unknown key.',
  'Avatar générique': 'Generic Avatar',
  'Utilise Avatar directement lorsque la définition est chargée à l’exécution ou change entre plusieurs avatars.':
    'Use Avatar directly when the definition is loaded at runtime or changes between multiple avatars.',
  'API impérative': 'Imperative API',
  'La ref expose les commandes de lecture et l’état courant de l’avatar.':
    'The ref exposes playback commands and the avatar’s current state.',
  'Les commandes de cible sont disponibles en mode non contrôlé ; sinon utilise les props.':
    'Target commands are available in uncontrolled mode; otherwise use props.',
  'Lance ou reprend une animation et retourne un résultat typé.':
    'Starts or resumes an animation and returns a typed result.',
  'Met en pause la timeline à sa position exacte.': 'Pauses the timeline at its exact position.',
  'En mode non contrôlé, arrête la lecture et revient à neutral. En mode contrôlé, les props restent la source de vérité.':
    'In uncontrolled mode, stops playback and returns to neutral. In controlled mode, props remain the source of truth.',
  'Affiche directement une expression.': 'Directly displays an expression.',
  'Retourne l’animation, l’expression et le statut actifs.':
    'Returns the active animation, expression and status.',
  Expression: 'Expression',
  Animation: 'Animation',
  'Une étape référence une expression qui ne peut pas être exportée.':
    'A step references an expression that cannot be exported.',
  'Valeur incompatible avec le format runtime': 'Value incompatible with the runtime format',
  'Télécharge un composant autonome avec les animations de ton choix.':
    'Download a standalone component with the animations you choose.',
  'Génère l’export ZIP autonome React ou JavaScript qui existait déjà.':
    'Generate the existing standalone React or JavaScript ZIP export.',
  'Choisis les animations puis exporte le JSON runtime ou un package autonome.':
    'Choose animations, then export runtime JSON or a standalone package.',
  'Choisis les animations puis utilise la même définition JSON avec React ou JavaScript.':
    'Choose animations, then use the same JSON definition with React or JavaScript.',
  'Avatar sélectionné': 'Selected avatar',
  Format: 'Format',
  'Choisis l’intégration correspondant à ton projet.':
    'Choose the integration that matches your project.',
  'Composant TSX autonome': 'Standalone TSX component',
  'Package React local (.zip)': 'Local React package (.zip)',
  'JavaScript / ESM': 'JavaScript / ESM',
  'JSON runtime + avatar-web': 'Runtime JSON + avatar-web',
  'Module ES autonome': 'Standalone ES module',
  'Projet HTML + module JS (.zip)': 'HTML project + JS module (.zip)',
  sélectionnées: 'selected',
  'Animations à exporter': 'Animations to export',
  'Tout sélectionner': 'Select all',
  'Tout désélectionner': 'Deselect all',
  Personnaliser: 'Customize',
  'Masquer la sélection': 'Hide selection',
  'Télécharger le composant TSX': 'Download TSX component',
  'Télécharger le package React': 'Download React package',
  'Télécharger le module': 'Download module',
  'Intégration ESM avec le package avatar-web': 'ESM integration with the avatar-web package',
  'Le ZIP contient le JSON exporté, une démo index.html et son README. La démo charge avatar-web depuis un CDN.':
    'The ZIP contains the exported JSON, an index.html demo and its README. The demo loads avatar-web from a CDN.',
  'Le ZIP contient le JSON exporté et un projet Vite React TypeScript prêt à lancer avec npm install puis npm run dev.':
    'The ZIP contains the exported JSON and a ready-to-run Vite React TypeScript project. Start it with npm install, then npm run dev.',
  'Télécharger l’intégration ESM (.zip)': 'Download ESM integration (.zip)',
  'Télécharger la démo React (.zip)': 'Download React demo (.zip)',
  'Télécharger la démo ESM (.zip)': 'Download ESM demo (.zip)',
  'Télécharger le JSON': 'Download JSON',
  'Utilisation minimale': 'Minimal usage',
  'Utiliser cet avatar': 'Use this avatar',
  'Prêt à exporter': 'Ready to export',
  Snapshot: 'Snapshot',
  'Mode photo': 'Photo Mode',
  Cadrage: 'Framing',
  Quitter: 'Exit',
  'Outils du mode photo': 'Photo Mode tools',
  'Orientation, regard, couleurs et perspective.': 'Orientation, gaze, colors and perspective.',
  'Position, zoom et coins du cadre photo.': 'Position, zoom and photo frame corners.',
  'Ouvrir le mode photo': 'Open Photo Mode',
  'Recentrer le cadrage': 'Reset framing',
  'Réinitialiser la pose et le cadrage': 'Reset pose and framing',
  'Choisis l’expression visible sur la photo.': 'Choose the expression shown in the picture.',
  'Utilise l’outil Cadrage dans l’aperçu ou saisis des valeurs précises.':
    'Use the Framing tool in the preview or enter precise values.',
  'Prépare une image statique directement dans l’aperçu principal.':
    'Prepare a static image directly in the main preview.',
  'Composer dans le live preview': 'Compose in the live preview',
  'Choisis une expression, ajuste la pose et cadre l’avatar dans un espace dédié.':
    'Choose an expression, adjust the pose and frame the avatar in a dedicated workspace.',
  'Utilise Pose pour orienter l’avatar et Cadrage pour le déplacer ou le zoomer.':
    'Use Pose to orient the avatar and Framing to move or zoom it.',
  'Ouvre le mode photo pour choisir une expression, cadrer puis exporter l’avatar.':
    'Open Photo Mode to choose an expression, frame the avatar and export it.',
  'Capture une image statique de l’avatar.': 'Capture a static image of the avatar.',
  'Les options de capture seront configurées ici.': 'Snapshot options will be configured here.',
  'Aperçu du Snapshot': 'Snapshot preview',
  'Aperçu du mode photo': 'Photo Mode preview',
  'Cadre du logo. Glisse pour déplacer l’avatar et utilise la molette pour zoomer.':
    'Logo frame. Drag to move the avatar and use the wheel to zoom.',
  'Glisse l’avatar pour le placer. La molette zoome sans faire défiler la page.':
    'Drag the avatar to position it. The wheel zooms without scrolling the page.',
  'Cadrage du logo': 'Logo framing',
  'Place, agrandis et recadre l’avatar sans modifier sa géométrie.':
    'Position, enlarge and crop the avatar without changing its geometry.',
  'Position X': 'X position',
  'Position Y': 'Y position',
  Zoom: 'Zoom',
  'Coins arrondis': 'Rounded corners',
  'Exporter le logo': 'Export logo',
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
  'Dimensions inscrites dans le fichier SVG.': 'Dimensions embedded in the SVG file.',
  'Dimensions du fichier exporté.': 'Dimensions of the exported file.',
  'Définition du Snapshot': 'Snapshot resolution',
  'Définition du mode photo': 'Photo Mode resolution',
  'Télécharger le Snapshot SVG': 'Download SVG snapshot',
  'Télécharger en SVG': 'Download SVG',
  'Télécharger en PNG': 'Download PNG',
  'Format d’export': 'Export format',
  'Format d’export du mode photo': 'Photo Mode export format',
  'Choisis le type de fichier généré par le mode photo.':
    'Choose the file type generated by Photo Mode.',
  'Prendre une photo': 'Take a picture',
  'Informations sur le mode photo': 'Photo Mode information',
  'Tu peux modifier le format, le fond et la définition du mode photo dans Export.':
    'You can change the format, background and resolution for Photo Mode in Export.',
  'Projet du Studio': 'Studio project',
  'Transfère tous les avatars, expressions et animations vers un autre navigateur.':
    'Transfer every avatar, expression and animation to another browser.',
  'Télécharger le projet JSON': 'Download JSON project',
  'Importer un projet JSON': 'Import JSON project',
  'Ce fichier n’est ni un avatar .avatar.json ni un projet Avatar Studio valide.':
    'This file is neither a .avatar.json avatar nor a valid Avatar Studio project.',
  'Ajouter un avatar': 'Add an avatar',
  'Importer un .avatar.json': 'Import a .avatar.json',
  'Importer cet avatar ?': 'Import this avatar?',
  'Cet avatar sera ajouté à ta bibliothèque avec ses expressions et animations, puis sélectionné. Les autres avatars sont conservés.':
    'This avatar will be added to your library with its expressions and animations, then selected. Your other avatars are kept.',
  'Importer ce projet ?': 'Import this project?',
  'Le projet local actuel sera remplacé par les avatars, expressions, animations et état de lecture de ce fichier.':
    'The current local project will be replaced with the avatars, expressions, animations and playback state from this file.',
  'Le projet n’a pas pu être enregistré dans ce navigateur. Libère de l’espace puis réessaie.':
    'The project could not be saved in this browser. Free up some space and try again.',
  Importer: 'Import',
  'Construction, forme et couleur de la tête de l’avatar.':
    'Build, shape and color of the avatar head.',
  'Une forme principale porte les yeux. Les autres primitives se placent autour d’elle.':
    'One primary shape carries the eyes. Other primitives are placed around it.',
  'Forme principale': 'Primary shape',
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
  'Cette surface est la référence du visage et porte les yeux.':
    'This surface is the face reference and carries the eyes.',
  'Rondeur des arêtes': 'Edge roundness',
  Rondeur: 'Roundness',
  'Rondeur morphologique': 'Morph roundness',
  'Rondeur de la pointe': 'Tip roundness',
  'Rondeur de la base': 'Base roundness',
  'Rondeur globale': 'Global roundness',
  'Rondeur pointe': 'Tip roundness',
  'Rondeur base': 'Base roundness',
  'Couleur de base utilisée par les poses et les expressions.':
    'Base color used by poses and expressions.',
  'Forme, placement, orientation et couleur du regard par défaut.':
    'Default eye shape, placement, orientation and color.',
  'Définis l’identité du regard de cet avatar. Les poses s’ajoutent ensuite à cette base.':
    'Define this avatar’s default eyes. Poses are then applied on top of this base.',
  'Coordonnées propres à l’avatar, indépendantes des poses.':
    'Avatar-specific coordinates, independent from poses.',
  'Inclinaison par défaut propre à chaque œil.': 'Default tilt for each eye.',
  'Orientation et apparence générale de la pose.': 'General pose orientation and appearance.',
  'La pose peut remplacer temporairement la couleur de l’avatar.':
    'The pose can temporarily override the avatar color.',
  'Reprendre la couleur de l’avatar': 'Use avatar color',
  'Les libellés ↔ sont scrubbables, comme dans Figma.':
    'Labels marked ↔ can be scrubbed, like in Figma.',
  'Forme, placement, orientation et couleur du regard.':
    'Eye shape, placement, orientation and color.',
  'Coordonnées communes projetées sur la forme choisie.':
    'Shared coordinates projected onto the selected shape.',
  'Inclinaison propre à chaque œil.': 'Tilt applied to each eye.',
  'Perspective et repères appliqués à la surface active.':
    'Perspective and guides applied to the active surface.',
  'Profondeur simulée du visage.': 'Simulated face depth.',
  'Afficher le maillage': 'Show wireframe',
  Réinitialiser: 'Reset',
  Mouvement: 'Motion',
  'Mouvement perpétuel': 'Perpetual motion',
  'Aucun mouvement': 'No motion',
  'Dérive lente': 'Slow drift',
  'Micro-ajustements': 'Micro-adjustments',
  Tremblement: 'Shake',
  'Ajoute une légère présence ou un tremblement continu au corps.':
    'Adds a subtle living presence or a continuous shake to the body.',
  'Anime le regard par petites saccades naturelles ou par tremblement.':
    'Animates the gaze with natural micro-saccades or a continuous shake.',
  'Motion interpole les valeurs et notre moteur effectue le slerp quaternion.':
    'Motion interpolates values while the engine performs quaternion slerp.',
  'Vitesse du ressort': 'Spring speed',
  'Une animation est en cours de lecture': 'An animation is currently playing',
  'Mettez l’animation en pause avant de manipuler les paramètres de pose.':
    'Pause the animation before adjusting pose parameters.',
  'Mettez l’animation en pause avant de choisir ou personnaliser une expression.':
    'Pause the animation before selecting or customizing an expression.',
  Cligner: 'Blink',
  'Expression aléatoire': 'Random expression',
  'Cycle de vie': 'Life cycle',
  Réactions: 'Reactions',
  'Éditeur d’animation': 'Animation editor',
  'Modifier l’animation': 'Edit animation',
  'Nouvelle animation': 'New animation',
  'Compose les expressions, leur cadence et les clignements de cette animation.':
    'Compose the expressions, timing and blinks for this animation.',
  'Prévisualiser l’animation': 'Preview animation',
  'Arrêter l’animation': 'Stop animation',
  Identité: 'Identity',
  'Nom, catégorie et comportement de lecture de l’animation.':
    'Animation name, category and playback behavior.',
  Nom: 'Name',
  Catégorie: 'Category',
  Description: 'Description',
  'Mode de lecture': 'Playback mode',
  Boucle: 'Loop',
  'Une fois': 'Once',
  'Aller-retour': 'Ping-pong',
  Timeline: 'Timeline',
  'Glisse les étapes pour les réordonner, puis sélectionne-en une pour régler sa cadence.':
    'Drag steps to reorder them, then select one to adjust its timing.',
  'Ajoute une expression pour commencer.': 'Add an expression to get started.',
  'Étape sélectionnée': 'Selected step',
  'Durée visible avant de passer à l’expression suivante.':
    'Visible duration before moving to the next expression.',
  'Supprimer cette étape': 'Delete this step',
  'Temps d’affichage': 'Display time',
  'Durée de transition': 'Transition duration',
  Transition: 'Transition',
  Ressort: 'Spring',
  Douce: 'Smooth',
  Rapide: 'Snappy',
  'Ajouter une expression': 'Add expression',
  'Sélectionne un preset pour l’ajouter à la fin de la timeline.':
    'Select a preset to append it to the timeline.',
  Clignements: 'Blinks',
  'Le blink fonctionne indépendamment des changements d’expression.':
    'Blinking runs independently from expression changes.',
  'Activer les clignements': 'Enable blinking',
  'Intervalle minimum': 'Minimum interval',
  'Intervalle maximum': 'Maximum interval',
  'Intervalle du clignement': 'Blink interval',
  'Durée du clignement': 'Blink duration',
  animations: 'animations',
  'Chaque étape possède sa propre durée et sa propre transition.':
    'Each step has its own duration and transition.',
  Désactivé: 'Disabled',
  'comportement de la timeline': 'timeline behavior',
  'Supprimer cette animation ?': 'Delete this animation?',
  'Cette action supprimera définitivement cette animation.':
    'This permanently deletes this animation.',
  'Cette animation enchaîne un pool de presets et des clignements.':
    'This animation cycles through presets and blinks.',
  'Cet état enchaîne un pool de presets et des clignements.':
    'This animation cycles through presets and blinks.',
  'Expressions de l’animation': 'Animation expressions',
  'Les presets sont joués dans cet ordre, puis la boucle recommence.':
    'Presets play in this order, then the loop starts again.',
  'Logique de clignement': 'Blink behavior',
  'Le rythme reste naturel grâce à un intervalle légèrement aléatoire.':
    'A slightly randomized interval keeps the rhythm natural.',
  'Premier clignement': 'First blink',
  'après le lancement': 'after launch',
  Intervalle: 'Interval',
  'tirage aléatoire': 'randomized',
  Durée: 'Duration',
  'fermeture et ouverture': 'close and open',
  'Changement d’expression': 'Expression change',
  'cadence de l’animation': 'animation tempo',
  'Détails de l’animation': 'Animation details',
  'Afficher les détails de l’animation': 'Show animation details',
  'Masquer les détails de l’animation': 'Hide animation details',
  Relancer: 'Restart',
  Lancer: 'Play',
  Pause: 'Pause',
  Reprendre: 'Resume',
  Annuler: 'Cancel',
  'Supprimer cette expression ?': 'Delete this expression?',
  'Cette action retirera définitivement le preset de la bibliothèque de cet avatar.':
    'This permanently removes the preset from this avatar’s library.',
  'Cette expression sera aussi retirée des animations suivantes :':
    'This expression will also be removed from the following animations:',
  'Si une animation ne contient que cette expression, l’expression de repli lui sera assignée pour qu’elle reste jouable.':
    'If an animation only contains this expression, the fallback expression will be assigned so it remains playable.',
  'Le corps, les expressions et les animations propres à cet avatar seront définitivement supprimés. La bibliothèque de base sera conservée.':
    'This avatar’s body, expressions and animations will be permanently deleted. The base library will be preserved.',
  'Glisse sur la surface pour orienter la tête. Les anneaux du gizmo contrôlent X, Y et Z.':
    'Drag on the surface to orient the head. The gizmo rings control X, Y and Z.',
  Sphère: 'Sphere',
  Curseur: 'Cursor',
  Cylindre: 'Cylinder',
  Cône: 'Cone',
  Diamant: 'Diamond',
  'Yeux presque fermés, respiration lente et expression de sommeil.':
    'Nearly closed eyes, slow breathing and a sleepy expression.',
  'Animation courte de réveil avant retour vers une expression neutre.':
    'Short waking animation before returning to a neutral expression.',
  'Séquence courte de réveil avant retour vers une expression neutre.':
    'Short waking animation before returning to a neutral expression.',
  'Micro-mouvements lents, expressions 00 et 08, clignement rare.':
    'Slow micro-movements, expressions 00 and 08, infrequent blinking.',
  'Expressions 10, 01 et 19, regard stable et clignement attentif.':
    'Expressions 10, 01 and 19, steady gaze and attentive blinking.',
  'Regard haut et latéral, expressions asymétriques et changements fréquents.':
    'Upward side gaze, asymmetric expressions and frequent changes.',
  'Balayage rapide et changements très fréquents.': 'Fast scanning and very frequent changes.',
  'Rythme régulier, regard concentré et micro-variations.':
    'Steady rhythm, focused gaze and subtle variations.',
  'Grandes expressions positives et mouvements rapides.':
    'Big positive expressions and fast movements.',
  'Inclinaisons et rotations rapides pour simuler un agent en mouvement.':
    'Fast tilts and rotations to simulate a moving agent.',
  'Rythme régulier et expressions concentrées.': 'Steady rhythm and focused expressions.',
  'Grandes expressions et transitions rapides.': 'Big expressions and fast transitions.',
  'Inclinaisons et forte asymétrie.': 'Tilts and strong asymmetry.',
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
  Custom: 'Personnalisé',
  'Untitled animation': 'Animation sans titre',
  // Compatibilité avec les animations intégrées déjà persistées avant le renommage.
  'Untitled sequence': 'Animation sans titre',
  'Cet état enchaîne un pool de presets et des clignements.':
    'Cette animation enchaîne un pool de presets et des clignements.',
  'Séquence courte de réveil avant retour vers une expression neutre.':
    'Animation courte de réveil avant retour vers une expression neutre.',
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
  [/^Modifier l’expression (.+)$/, 'Edit expression $1'],
  [/^Modifier (.+)$/, 'Edit $1'],
  [/^Supprimer (.+) \?$/, 'Delete $1?'],
  [/^Ajouter une forme · (.+)$/, 'Add a shape · $1'],
  [/^Réinitialiser la position et la rotation de (.+)$/, 'Reset position and rotation of $1'],
  [/^Animation en cours : (.+)$/, 'Active animation: $1'],
  [/^Mettre (.+) en pause$/, 'Pause $1'],
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
