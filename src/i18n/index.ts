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
  Caméra: 'Camera',
  'Caméra par défaut': 'Default camera',
  'Caméra déconnectée': 'Disconnected camera',
  'Après autorisation, choisissez la caméra à utiliser. Le suivi redémarre automatiquement.':
    'After granting permission, choose the camera to use. Tracking restarts automatically.',
  'Rotation de l’avatar': 'Rotate the avatar',
  'À bientôt !': 'See you soon!',
  'Reviens me voir quand tu veux.': 'Come back and see me anytime.',
  'Wouhou, ça tourne !': 'Wheee, I’m spinning!',
  'Ouvre la main pour me relâcher.': 'Open your hand to let me go.',
  'Bonne lecture !': 'Enjoy reading!',
  'Je reste juste à côté.': 'I’ll be right here.',
  'Oh, bon choix !': 'Ooh, good choice!',
  'Celle-là, je l’adore.': 'I love that one.',
  'Tu peux aussi caresser ma tête.': 'You can pat my head, too.',
  'Viens dire bonjour': 'Come say hello',
  'Place-toi face à l’écran, à un ou deux pas.': 'Stand facing the screen, a step or two away.',
  'Il t’a repéré': 'It’s spotted you',
  'Reste là, il t’observe.': 'Stay there, it’s taking a look at you.',
  'Avance d’un pas': 'Take a step closer',
  'Il te verra mieux de près.': 'It can see you better up close.',
  'Reviens face à l’écran': 'Face the screen again',
  'Il te cherche du regard.': 'It’s looking for you.',
  'Fais-lui coucou': 'Wave hello',
  'Main ouverte, de gauche à droite.': 'Open hand, side to side.',
  'Souris-lui': 'Give it a smile',
  'Garde ton sourire une seconde.': 'Hold your smile for a second.',
  'Lève le pouce': 'Give a thumbs up',
  'Tiens-le une seconde.': 'Hold it for a second.',
  'Penche la tête': 'Tilt your head',
  'Sur le côté, quelques instants.': 'To one side, for a moment.',
  'À toi de jouer': 'Your turn to play',
  'Parle à l’équipe du stand': 'Talk to the stand team',
  'Elle te racontera son histoire.': 'They’ll tell you its story.',
  'Coucou réussi !': 'Nice wave!',
  'La glace est brisée.': 'The ice is broken.',
  'Sourire partagé !': 'Smile shared!',
  'Geste reconnu.': 'Gesture recognized.',
  'Pouce validé !': 'Thumbs up received!',
  'Bien penché !': 'Nice tilt!',
  'Il adore ça': 'It loves that',
  'Continue doucement.': 'Keep going, gently.',
  'Merci de ta visite.': 'Thanks for stopping by.',
  Coucou: 'Wave',
  Sourire: 'Smile',
  'Tête penchée': 'Head tilt',
  'Collection complète. Bravo !': 'Collection complete. Well done!',
  'Essaie un autre geste pour compléter ta collection.':
    'Try another gesture to complete your collection.',
  'Gestes découverts': 'Gestures discovered',
  'Lève la main': 'Raise your hand',
  'Elle apparaît à l’écran.': 'It appears on screen.',
  'Vise une carte': 'Point at a card',
  'Déplace ta main ouverte.': 'Move your open hand.',
  'Ferme le poing': 'Close your fist',
  'La carte s’ouvre.': 'The card opens.',
  'Ta main devient un curseur': 'Your hand becomes a cursor',
  'Rouvre la main': 'Open your hand',
  'Glisse pour défiler': 'Slide to scroll',
  'Découvrir la Bible sous un nouveau jour.': 'Discover the Bible in a new light.',
  'QR code vers bible-strong.app': 'QR code to bible-strong.app',
  'Télécharge ton outil d’étude biblique': 'Download your Bible study tool',
  'Bible Strong, l’application gratuite pour étudier la Bible.':
    'Bible Strong, the free app to study the Bible.',
  'Rien n’est enregistré : l’image est analysée sur place.':
    'Nothing is recorded: the image is analysed right here.',
  'Retour aux ressources': 'Back to the resources',
  Visiteur: 'Visitor',
  Distance: 'Distance',
  'Se déplacer': 'Move sideways',
  'Main (clic = poing)': 'Hand (click = fist)',
  'Simulation clavier': 'Keyboard simulation',
  'Quelqu’un veut jouer ?': 'Anyone want to play?',
  'Je réagis à tes gestes. Viens voir !': 'I react to your gestures. Come and see!',
  'Fais-moi coucou !': 'Wave at me!',
  'Promis, je te réponds.': 'I promise I’ll wave back.',
  'J’ai des trésors à te montrer.': 'I have treasures to show you.',
  'Six façons d’explorer la Bible.': 'Six ways to explore the Bible.',
  'On fête ça ?': 'Shall we celebrate?',
  'Fais le V de la victoire.': 'Make a victory V.',
  'Yeah ! Victoire !': 'Yeah! Victory!',
  'On forme une sacrée équipe.': 'We make quite a team.',
  'Un pouce baissé ?': 'A thumbs down?',
  'Tu n’oserais pas…': 'You wouldn’t dare…',
  'Oh… vraiment ?': 'Oh… really?',
  'Pas grave, je t’aime quand même.': 'No worries, I still love you.',
  'Fais le V': 'Make a V',
  'Deux doigts levés, une seconde.': 'Two fingers up, for a second.',
  'V validé !': 'V confirmed!',
  'Geste secret trouvé !': 'Secret gesture found!',
  'Il boude… un tout petit peu.': 'It’s sulking… just a tiny bit.',
  Victoire: 'Victory',
  'Coucou, sourire, pouce, V ou tête penchée.': 'Wave, smile, thumbs up, V or head tilt.',
  'Un geste secret se cache…': 'A secret gesture is hiding…',
  Secret: 'Secret',
  'Salut la bande !': 'Hi, everyone!',
  'Je vous présente mes amis.': 'Meet my friends.',
  'Faire venir d’autres personnages': 'Bring in other characters',
  'Personnages invités (3 au maximum)': 'Guest characters (up to 3)',
  'Un personnage rejoint chaque visiteur supplémentaire, dans cet ordre. Il le regarde et le suit tant qu’il reste.':
    'A character joins each additional visitor, in this order. It looks at them and follows them while they stay.',
  'Autres visiteurs': 'Other visitors',
  'Préparation du stand…': 'Getting the stand ready…',
  'Comment jouer': 'How to play',
  Explorer: 'Explore',
  'Vise une carte, puis ferme le poing.': 'Point at a card, then close your fist.',
  'Me faire tourner': 'Spin me around',
  'Ferme le poing sur moi, puis déplace la main.': 'Close your fist over me, then move your hand.',
  'Me caresser': 'Pet me',
  'Passe doucement ta main ouverte sur ma tête.': 'Gently move your open hand over my head.',
  'Vise ici et ferme le poing pour revenir.': 'Point here and close your fist to go back.',
  'Poing fermé dans le texte : déplace la main pour défiler. Sur une flèche : ferme le poing pour cliquer.':
    'Over the text: hold a fist and move to scroll. Over an arrow: close your fist to click.',
  Aucun: 'None',
  'Diagnostic caméra': 'Camera diagnostics',
  'Ce que voit la caméra': 'What the camera sees',
  'Suivi actif': 'Tracking live',
  'En attente d’images': 'Waiting for frames',
  'Caméra inactive': 'Camera inactive',
  'Afficher les repères': 'Show landmarks',
  'Vert : visiteur suivi': 'Green: tracked visitor',
  'Bleu : autres visages': 'Blue: other faces',
  'Orange : paume ouverte': 'Orange: open palm',
  'Aucune caméra active': 'No active camera',
  'Distance estimée': 'Estimated distance',
  'Estimation depuis la taille du visage, pas une mesure précise.':
    'Estimated from face size, not a precise measurement.',
  'Visages détectés': 'Faces detected',
  'Visiteur suivi': 'Tracked visitor',
  'Mains détectées': 'Hands detected',
  'Fréquence du suivi': 'Tracking frequency',
  'Temps d’analyse': 'Inference time',
  'Rotation visée H / V': 'Target rotation H / V',
  'Décalage des yeux H / V': 'Eye offset H / V',
  'Largeur du visage': 'Face width',
  'Calibrage du regard': 'Gaze calibration',
  Calibré: 'Calibrated',
  'Par défaut': 'Default',
  'Prochain coucou': 'Next wave response',
  Disponible: 'Ready',
  'Signaux du visage suivi': 'Tracked face signals',
  'Coefficients visuels, sans interprétation des émotions.':
    'Visual coefficients, without interpreting emotions.',
  'Gestes observés': 'Observed gestures',
  'Main gauche': 'Left hand',
  'Main droite': 'Right hand',
  'Score du geste': 'Gesture score',
  'Aucune main détectée': 'No hands detected',
  'Le coucou nécessite une paume ouverte qui oscille, pas seulement une main levée.':
    'A wave requires an open palm moving back and forth, not just a raised hand.',
  'Œil gauche fermé': 'Left eye closed',
  'Œil droit fermé': 'Right eye closed',
  'Bouche ouverte': 'Mouth open',
  'Sourire gauche': 'Left smile',
  'Sourire droit': 'Right smile',
  'Sourcils relevés': 'Brows raised',
  'Paume ouverte': 'Open palm',
  'Poing fermé': 'Closed fist',
  'Index levé': 'Pointing up',
  'Pouce levé': 'Thumbs up',
  'Pouce baissé': 'Thumbs down',
  'Signe de victoire': 'Victory sign',
  'Signe I love you': 'I love you sign',
  'Geste non reconnu': 'Unrecognized gesture',
  'Calibrer le regard': 'Calibrate gaze',
  'Placez-vous au centre de l’écran, à votre distance habituelle, puis calibrez.':
    'Stand in front of the center of the screen at your usual distance, then calibrate.',
  'Regard centré. Vous pouvez vous déplacer.': 'Gaze centered. You can move around now.',
  'Aucun visage suivi. Placez-vous devant la caméra et réessayez.':
    'No face tracked. Stand in front of the camera and try again.',
  'Psst… par ici.': 'Psst… over here.',
  'Approche. Je crois qu’on ne se connaît pas.': 'Come closer. I don’t think we’ve met.',
  'C’est moi que tu regardes ?': 'Are you looking at me?',
  '… je te regarde aussi.': '… I’m looking at you too.',
  'Viens un peu plus près.': 'Come a little closer.',
  'Je suis curieux. Enfin… un peu.': 'I’m curious. Well… a little.',
  'Tu es encore là ?': 'Still there?',
  'Je te garde une place.': 'I’m saving you a spot.',
  'On se dit bonjour ?': 'Shall we say hello?',
  'Fais-moi coucou, ou souris-moi.': 'Give me a wave, or a smile.',
  'Ah ! Salut, toi.': 'Oh! Hello, you.',
  'Je savais qu’on allait s’entendre.': 'I knew we’d get along.',
  'À toi de sourire.': 'Your turn to smile.',
  'Promis, je te le rends.': 'I promise to smile back.',
  'C’est contagieux !': 'That’s catching!',
  'Tu as vu mes yeux ?': 'Did you see my eyes?',
  'On est copains ?': 'Are we friends?',
  'Montre-moi un pouce levé.': 'Show me a thumbs up.',
  'C’est officiel. On est copains.': 'It’s official. We’re friends.',
  'Petit clin d’œil entre nous.': 'A little wink, just for you.',
  'Tu peux faire comme moi ?': 'Can you do what I do?',
  'Penche un peu la tête.': 'Tilt your head a little.',
  'On se ressemble, non ?': 'We look alike, don’t we?',
  'Joli mouvement.': 'Nice move.',
  'Tu veux connaître mon histoire ?': 'Want to hear my story?',
  'L’équipe du stand te la raconte.': 'Ask the team at the stand.',
  'À toi de me surprendre.': 'Go on, surprise me.',
  'Un coucou, un sourire… je te suis.': 'A wave, a smile… I’m with you.',
  'Afficher les invitations à jouer': 'Show invitations to play',
  'Distance d’accueil': 'Welcome distance',
  'Réglé pour des visiteurs à 1–2 m. Strobi se rapproche progressivement quand ils avancent.':
    'Tuned for visitors 1–2 m away. Strobi gradually comes closer as they approach.',
  'Invitation en cours': 'Current invitation',
  'Interactions découvertes': 'Interactions discovered',
  'Inclinaison du visage': 'Face tilt',
  'Geste en cours de validation': 'Recognizing the gesture',
  'Lexique hébreu / grec': 'Hebrew / Greek lexicon',
  'Derrière un mot, un monde.': 'Behind a word, a world.',
  'Un mot qui prend vie': 'A word comes alive',
  'Le mot hébreu hevel évoque un souffle, une vapeur. Dans l’Ecclésiaste, il est aussi traduit par « vanité ». Un mot original peut ouvrir une nouvelle piste de lecture.':
    'The Hebrew word hevel evokes a breath or vapour. In Ecclesiastes, it is also translated as “vanity”. An original word can open a new path into the text.',
  'Ecclésiaste 1.2 · H1892': 'Ecclesiastes 1:2 · H1892',
  'הֶבֶל · hevel': 'הֶבֶל · hevel',
  'Souffle, vapeur, vanité : ces nuances évoquent ce qui est passager. Le contexte du passage aide à comprendre le sens du mot.':
    'Breath, vapour, vanity: these shades of meaning evoke what is fleeting. The passage’s context helps us understand the word.',
  'Retrouve le fil du mot': 'Follow the word',
  'Dans Bible Strong, sélectionne un mot lié à un numéro Strong. Explore sa définition et les autres passages où il apparaît, puis reviens lire le texte dans son contexte.':
    'In Bible Strong, select a word linked to a Strong number. Explore its definition and other passages where it appears, then return to read the text in context.',
  'Dictionnaires bibliques': 'Bible dictionaries',
  'Un mot, toute une époque.': 'One word, a whole world.',
  'Qui étaient les publicains ?': 'Who were the publicans?',
  'Zachée est présenté comme un chef des publicains. Ce sont des collecteurs d’impôts ou de taxes : connaître leur métier aide à entrer dans le récit.':
    'Zacchaeus is introduced as a chief publican. Publicans collected taxes or duties: knowing their work helps us enter the story.',
  'Luc 19.2 · D’après Easton, « Publican »': 'Luke 19:2 · Based on Easton, “Publican”',
  'Le contexte change le regard': 'Context changes our perspective',
  'Leur lien avec le pouvoir et les abus de perception les rendaient impopulaires. L’accueil de Zachée par Jésus prend alors un relief particulier : la foule lui reproche de loger chez un pécheur.':
    'Their ties to the authorities and abuses in tax collection made them unpopular. Jesus welcoming Zacchaeus takes on new meaning: the crowd objects to his staying with a sinner.',
  'Luc 19.7': 'Luke 19:7',
  'Personnes, lieux, coutumes': 'People, places, customs',
  'Les dictionnaires de Bible Strong donnent des repères pour comprendre le monde de la Bible. Pars d’un nom ou d’une coutume, puis relis le passage avec ce nouvel éclairage.':
    'Bible Strong’s dictionaries provide background to the world of the Bible. Start with a name or custom, then reread the passage with that new insight.',
  'Comparaisons de traductions': 'Compare translations',
  'Un passage, plusieurs éclairages.': 'One passage, different perspectives.',
  'Un autre choix de mots': 'Another choice of words',
  'Dans Jean 1.5, Segond emploie « reçue » et Darby « comprise ». Comparer les formulations attire notre attention sur une question que nous n’aurions peut-être pas posée.':
    'In John 1:5, the KJV uses “comprehended” and the ASV “apprehended”. Comparing the wording can draw our attention to a question we might not otherwise have asked.',
  'Jean 1.5 · Segond 1910 / Darby 1890': 'John 1:5 · KJV / ASV',
  'Observe, puis relis': 'Notice, then reread',
  'Quels mots se ressemblent ? Lesquels diffèrent ? Une différence ouvre une piste ; elle ne remplace pas la lecture du chapitre et de son contexte.':
    'Which words are alike? Which differ? A difference opens a path; it does not replace reading the chapter in its context.',
  'Rapproche tes versions': 'Bring your versions together',
  'Sélectionne un ou plusieurs versets dans Bible Strong, puis ajoute les traductions que tu souhaites comparer. Prends le temps de lire leurs formulations côte à côte.':
    'Select one or more verses in Bible Strong, then add the translations you want to compare. Take time to read their wording side by side.',
  'Références croisées': 'Cross references',
  'Un verset, mille connexions.': 'One verse, a thousand connections.',
  'Suis l’image du berger': 'Follow the image of the shepherd',
  'Le Psaume 23 présente Dieu comme un berger. Cette image résonne avec d’autres passages : une lecture peut devenir le début d’un parcours.':
    'Psalm 23 presents God as a shepherd. This image echoes in other passages: one reading can become the start of a journey.',
  'Psaume 23.1': 'Psalm 23:1',
  'Deux pistes à explorer': 'Two paths to explore',
  'Dans Jean 10.11, Jésus se présente comme le bon berger qui donne sa vie pour ses brebis. Ésaïe 40.11 évoque le berger qui rassemble les agneaux et les porte avec soin.':
    'In John 10:11, Jesus calls himself the good shepherd who gives his life for the sheep. Isaiah 40:11 evokes a shepherd gathering lambs and carrying them with care.',
  'Jean 10.11 · Ésaïe 40.11': 'John 10:11 · Isaiah 40:11',
  'Laisse la Bible éclairer la Bible': 'Let the Bible illuminate the Bible',
  'Ouvre les références liées à un verset dans Bible Strong. Lis chaque passage dans son contexte et observe ce que les rapprochements éclairent.':
    'Open a verse’s related references in Bible Strong. Read each passage in context and notice what the connections illuminate.',
  'Thèmes bibliques': 'Bible topics',
  'Une question. Des pistes à explorer.': 'One question. New paths to explore.',
  'Et si on explorait la paix ?': 'What if we explored peace?',
  'Les thèmes Nave rassemblent des références autour d’un sujet. Ils permettent de partir d’une question et de parcourir plusieurs livres de la Bible.':
    'Nave’s topics gather references around a subject. They let you start with a question and explore several books of the Bible.',
  'Une paix donnée, une paix qui garde': 'Peace as a gift, peace that keeps',
  'Jean 14.27 parle de la paix que Jésus donne. Philippiens 4.7 évoque la paix de Dieu qui garde les cœurs et les pensées. Deux passages, deux éclairages sur un même sujet.':
    'John 14:27 speaks of the peace Jesus gives. Philippians 4:7 describes God’s peace keeping hearts and minds. Two passages, two perspectives on one subject.',
  'Jean 14.27 · Philippiens 4.7': 'John 14:27 · Philippians 4:7',
  'La foi, la prière, le pardon…': 'Faith, prayer, forgiveness…',
  'Choisis un sujet qui te touche dans Bible Strong. Explore ses références, ouvre les passages et prends aussi le temps de lire les versets qui les entourent.':
    'Choose a subject that matters to you in Bible Strong. Explore its references, open the passages and take time to read the surrounding verses too.',
  'Commentaires bibliques': 'Bible commentaries',
  'Un passage. Un nouvel éclairage.': 'One passage. A fresh insight.',
  'Un regard accompagne ta lecture': 'Another perspective on your reading',
  'Un commentaire aide à observer un passage, à en comprendre les images et à poursuivre sa réflexion. Il accompagne la Bible et invite à revenir au texte.':
    'A commentary helps us observe a passage, understand its images and reflect further. It accompanies the Bible and invites us back to the text.',
  'Le berger et la confiance': 'The shepherd and trust',
  'Dans son commentaire du Psaume 23, Matthew Henry rapproche l’image du berger du soin attentif de Dieu. Cette lecture invite à réfléchir à la confiance.':
    'In his commentary on Psalm 23, Matthew Henry connects the shepherd’s image with God’s attentive care. This reading invites reflection on trust.',
  'Psaume 23 · Synthèse d’après Matthew Henry': 'Psalm 23 · Summary based on Matthew Henry',
  'Une question à garder': 'A question to take with you',
  'Que m’évoque l’image du berger ? Comment le reste du psaume la développe-t-il ? Dans Bible Strong, explore plusieurs commentaires et poursuis ta lecture avec ces questions.':
    'What does the shepherd’s image bring to mind? How does the rest of the psalm develop it? In Bible Strong, explore different commentaries and keep reading with these questions.',
  'Mmm… encore un peu.': 'Mmm… a little more.',
  'Je crois que je t’aime bien.': 'I think I like you.',
  'Explore avec ta main': 'Explore with your hand',
  'Cette main, c’est toi.': 'That hand is you.',
  'Garde la main sur une carte pour l’ouvrir.': 'Hold your hand over a card to open it.',
  'Tu peux relâcher le bras pour lire.': 'You can lower your arm while you read.',
  'Ferme le poing et déplace la main pour faire défiler.':
    'Close your fist and move your hand to scroll.',
  'Ouvre la main pour arrêter le défilement.': 'Open your hand to stop scrolling.',
  'Les six ressources': 'The six resources',
  'Découverte guidée': 'Guided discovery',
  'Défiler vers le haut': 'Scroll up',
  'Défiler vers le bas': 'Scroll down',
  'À découvrir dans Bible Strong': 'Discover in Bible Strong',
  'Ces exemples donnent un aperçu des ressources. L’équipe du stand peut te montrer la suite dans l’application.':
    'These examples introduce the resources. The stand team can show you more in the app.',
  'Afficher les ressources et la main virtuelle': 'Show resources and the virtual hand',
  'Main virtuelle': 'Virtual hand',
  'Main non suivie': 'Hand not tracked',
  'Main en déplacement': 'Hand moving',
  'Sélection en cours': 'Selecting',
  'Défilement à la main': 'Hand scrolling',
  'Caresse détectée': 'Stroke detected',
  'Ouvre la main pour choisir une carte.': 'Open your hand to choose a card.',
  'Mode stand': 'Stand mode',
  'Réglages du stand': 'Stand settings',
  'Dans sa bulle': 'In its own little world',
  'Un peu méfiant…': 'A little wary…',
  Curieux: 'Curious',
  'Coucou !': 'Hello there!',
  'Prêt à jouer': 'Ready to play',
  'Autorisez la caméra dans votre navigateur, puis réessayez.':
    'Allow camera access in your browser, then try again.',
  'Caméra indisponible. Vérifiez son branchement et utilisez HTTPS ou localhost.':
    'Camera unavailable. Check its connection and use HTTPS or localhost.',
  'Le suivi a été interrompu. Vérifiez votre connexion pour charger les modèles, puis réessayez.':
    'Tracking stopped. Check your connection to load the models, then try again.',
  'RENCONTREZ VOTRE AVATAR': 'MEET YOUR AVATAR',
  'Masquer les réglages': 'Hide settings',
  'Un peu méfiant. Bientôt complice.': 'A little wary. Soon a friend.',
  'Approchez-vous, laissez-le vous observer… puis faites-lui coucou pour briser la glace.':
    'Come closer, let it watch you… then give it a wave to break the ice.',
  'Aperçu de la caméra': 'Camera preview',
  'Préparation de la caméra et du suivi…': 'Preparing camera and tracking…',
  'La caméra démarrera avec le mode stand.': 'The camera starts when you launch stand mode.',
  'Inverser le suivi horizontal': 'Mirror horizontal tracking',
  'Réagir à l’approche': 'React to proximity',
  'Plus loin': 'Farther away',
  'Plus près': 'Closer',
  'Plein écran indisponible. Le mode stand reste actif dans cette fenêtre.':
    'Fullscreen unavailable. Stand mode stays active in this window.',
  'Reprendre le plein écran': 'Resume fullscreen',
  'Préparation…': 'Preparing…',
  Réessayer: 'Try again',
  'Activer la caméra et démarrer': 'Enable camera and start',
  'Images analysées sur cet appareil, sans enregistrement ni envoi. Une connexion est nécessaire au chargement des modèles.':
    'Images are analyzed on this device, without recording or uploading. Loading the models requires a connection.',
  'Échap pour quitter et éteindre la caméra.': 'Press Escape to exit and turn off the camera.',
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
  'Apparence neutre': 'Neutral appearance',
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
  'Couleur de la forme': 'Shape color',
  'Couleur héritée': 'Inherited color',
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
  'Talk Mode': 'Talk Mode',
  'Ouvrir le Talk Mode': 'Open Talk Mode',
  Dialogue: 'Dialogue',
  'Écris une phrase et fais parler l’avatar directement dans le navigateur.':
    'Write a sentence and make the avatar speak directly in the browser.',
  'Texte de l’avatar': 'Avatar text',
  'Le texte reste local et n’est envoyé à aucun service.':
    'The text stays local and is not sent to any service.',
  'Texte à prononcer': 'Text to speak',
  'Écris ce que ton avatar doit dire…': 'Write what your avatar should say…',
  'Ajouter une action': 'Add an action',
  'Copier le dialogue': 'Copy dialogue',
  Retour: 'Back',
  'Ajouter une transformation': 'Add a transform',
  'Ajouter la transformation': 'Insert transform',
  'Les tags déclenchent l’avatar avant le mot suivant.':
    'Tags trigger the avatar before the next word.',
  'Retirer le tag': 'Remove tag',
  'Choisir une expression ou une animation': 'Choose an expression or animation',
  'Choisir une expression, une animation ou une transformation':
    'Choose an expression, animation, or transform',
  Transformation: 'Transform',
  'Surcharge de pose': 'Pose override',
  Activer: 'Enable',
  'Durée personnalisée': 'Custom duration',
  'Aucun tag correspondant': 'No matching tag',
  'Chargement…': 'Loading…',
  'Arrêter la voix': 'Stop voice',
  'Faire parler': 'Speak',
  'Timeline du dialogue': 'Dialogue timeline',
  'Mettre le dialogue en pause': 'Pause dialogue',
  'Lire le dialogue': 'Play dialogue',
  'Position dans le dialogue': 'Dialogue position',
  'Couper le son du scrub': 'Mute scrubbing audio',
  'Activer le son du scrub': 'Enable scrubbing audio',
  'Revenir au début': 'Return to start',
  'Laisser Jev mettre en scène': 'Let Jev direct',
  'Jev choisit les expressions…': 'Jev is choosing expressions…',
  'Jev n’a pas pu mettre en scène ce texte.': 'Jev could not direct this text.',
  'Ouvrir le Stream Mode': 'Open Stream Mode',
  'Stream Mode': 'Stream Mode',
  'Flux simulé': 'Simulated stream',
  'Simule une réponse LLM, dirige chaque beat avec Jev et prépare son audio en continu.':
    'Simulate an LLM response, direct every beat with Jev, and prepare its audio continuously.',
  'Texte source': 'Source text',
  'Le texte est émis progressivement comme un flux de tokens.':
    'The text is emitted progressively like a token stream.',
  'Intervalle des tokens': 'Token interval',
  'Arrêter le stream': 'Stop stream',
  'Démarrer le stream': 'Start stream',
  'Le stream a échoué.': 'The stream failed.',
  'Pipeline en direct': 'Live pipeline',
  'Chaque beat avance indépendamment jusqu’à sa lecture.':
    'Each beat progresses independently until playback.',
  'État du pipeline': 'Pipeline status',
  'Flux reçu': 'Received stream',
  'En direct': 'Live',
  Prêt: 'Ready',
  'Le texte reçu apparaîtra ici…': 'Received text will appear here…',
  directing: 'Directing',
  synthesizing: 'Synthesizing',
  queued: 'Queued',
  playing: 'Playing',
  played: 'Played',
  error: 'Error',
  Voix: 'Voice',
  'Les réglages affichés dépendent de la banque sélectionnée.':
    'The displayed settings depend on the selected voice bank.',
  'Banque de voix': 'Voice bank',
  Animalese: 'Animalese',
  'RPG Blips': 'RPG Blips',
  'Game boy': 'Game Boy',
  'Registre de voix': 'Voice register',
  'Grave · 100 Hz': 'Low · 100 Hz',
  'Masculine · 120 Hz': 'Male · 120 Hz',
  'Moyenne · 150 Hz': 'Medium · 150 Hz',
  'Féminine · 180 Hz': 'Female · 180 Hz',
  'Aiguë · 280 Hz': 'High · 280 Hz',
  'Langue, hauteur, vitesse et caractère mélodique de la synthèse.':
    'Language, pitch, speed and melodic character of the synthesis.',
  'Langue de la voix': 'Voice language',
  Français: 'French',
  Anglais: 'English',
  Japonais: 'Japanese',
  'Hauteur de voix': 'Pitch',
  'Vitesse de parole': 'Speaking speed',
  'Variation aléatoire': 'Random variation',
  'Fréquence mélodique': 'Melody rate',
  'Amplitude mélodique': 'Melody amplitude',
  Volume: 'Volume',
  Rythme: 'Timing',
  'Pauses et ponctuation utilisées pour cadencer les phrases.':
    'Pauses and punctuation used to pace sentences.',
  'Pause entre les mots': 'Space delay',
  'Pause de ponctuation': 'Punctuation delay',
  'Tentatives de chargement': 'Loading retries',
  'Caractères de ponctuation': 'Punctuation characters',
  'Réinitialiser les réglages de voix': 'Reset voice settings',
  'Synthèse Animalese locale propulsée par': 'Local Animalese synthesis powered by',
  'Les bips RPG sont générés directement par le navigateur.':
    'RPG blips are generated directly by the browser.',
  'La synthèse Game Boy adapte': 'Game Boy synthesis adapts',
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
  Trapèze: 'Trapezoid',
  'Largeur du sommet': 'Top width',
  'Largeur de la base': 'Bottom width',
  'Finition vectorielle et contour de la silhouette.': 'Vector finish and silhouette outline.',
  'Le mode vectoriel peut recevoir un contour de style cel-shading.':
    'Vector rendering can use a cel-shaded outline.',
  'Afficher le contour': 'Show outline',
  Contour: 'Outline',
  Épaisseur: 'Thickness',
  Opacité: 'Opacity',
  'Forme des yeux': 'Eye shape',
  'Ellipse parfaite ou rectangle aux coins réglables.':
    'Perfect ellipse or rectangle with adjustable corners.',
  Forme: 'Shape',
  'Rectangle arrondi': 'Rounded rectangle',
  Ellipse: 'Ellipse',
  Nez: 'Nose',
  'Caractéristique permanente du visage neutre.': 'Permanent feature of the neutral face.',
  'Afficher le nez': 'Show nose',
  'Triangle inversé': 'Inverted triangle',
  Arrondi: 'Rounded',
  'Forme du nez': 'Nose shape',
  'Position X': 'X position',
  'Position Y': 'Y position',
  'Position Z': 'Z position',
  'Position dans l’espace': 'Position in space',
  'Position de l’avatar': 'Avatar position',
  'Déplace la pose sur les axes X, Y et Z.': 'Move the pose along the X, Y, and Z axes.',
  'Position neutre héritée par toutes les poses et expressions.':
    'Neutral position inherited by every pose and expression.',
  'X et Y déplacent l’avatar dans le plan ; Z l’avance ou le recule.':
    'X and Y move the avatar in the plane; Z moves it forward or backward.',
  'Bouche neutre': 'Neutral mouth',
  'Base héritée puis modifiable ou masquable dans chaque expression.':
    'Inherited base that each expression can change or hide.',
  'Afficher la bouche': 'Show mouth',
  Courbe: 'Curve',
  'Triangle arrondi': 'Rounded triangle',
  'Forme de la bouche': 'Mouth shape',
  Courbure: 'Curve amount',
  Bouche: 'Mouth',
  'Surcharge la bouche neutre pour cette expression.':
    'Override the neutral mouth for this expression.',
  Visibilité: 'Visibility',
  'Hériter du visage neutre': 'Inherit neutral face',
  Afficher: 'Show',
  Masquer: 'Hide',
  'Visibilité de la bouche': 'Mouth visibility',
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
  'Clignements automatiques': 'Automatic blinking',
  'Cligne naturellement à des intervalles aléatoires avec cette expression.':
    'Blinks naturally at random intervals with this expression.',
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
