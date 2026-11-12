import type { StandAction, StandCue } from './standEncounter'
import type { HandMode } from './standHandNavigation'
import type { StandStage } from './standJourney'

// French source strings; translations live in src/i18n.
// Speech bubbles are the character talking. Instructions are the stand explaining.
export const invitationCopy: Record<StandCue, [string, string]> = {
  petted: ['Mmm… encore un peu.', 'Je crois que je t’aime bien.'],
  idle: ['Psst… par ici.', 'Approche. Je crois qu’on ne se connaît pas.'],
  notice: ['C’est moi que tu regardes ?', '… je te regarde aussi.'],
  closer: ['Viens un peu plus près.', 'Je suis curieux. Enfin… un peu.'],
  searching: ['Tu es encore là ?', 'Je te garde une place.'],
  wave: ['On se dit bonjour ?', 'Fais-moi coucou, ou souris-moi.'],
  hello: ['Ah ! Salut, toi.', 'Je savais qu’on allait s’entendre.'],
  smile: ['À toi de sourire.', 'Promis, je te le rends.'],
  'smile-reply': ['C’est contagieux !', 'Tu as vu mes yeux ?'],
  'thumbs-up': ['On est copains ?', 'Montre-moi un pouce levé.'],
  'thumbs-up-reply': ['C’est officiel. On est copains.', 'Petit clin d’œil entre nous.'],
  victory: ['On fête ça ?', 'Fais le V de la victoire.'],
  'victory-reply': ['Yeah ! Victoire !', 'On forme une sacrée équipe.'],
  // Never suggested: the thumbs-down is a secret for curious visitors.
  'thumbs-down': ['Un pouce baissé ?', 'Tu n’oserais pas…'],
  'thumbs-down-reply': ['Oh… vraiment ?', 'Pas grave, je t’aime quand même.'],
  tilt: ['Tu peux faire comme moi ?', 'Penche un peu la tête.'],
  'tilt-reply': ['On se ressemble, non ?', 'Joli mouvement.'],
  connection: ['Tu veux connaître mon histoire ?', 'L’équipe du stand te la raconte.'],
  'free-play': ['À toi de me surprendre.', 'Un coucou, un sourire… je te suis.'],
  farewell: ['À bientôt !', 'Reviens me voir quand tu veux.'],
}

const replyCues = new Set<StandCue>([
  'hello',
  'smile-reply',
  'thumbs-up-reply',
  'victory-reply',
  'thumbs-down-reply',
  'tilt-reply',
  'farewell',
  'petted',
])
export const isReplyCue = (cue: StandCue) => replyCues.has(cue)

// Rotating lines while nobody is there: movement in the text catches passers-by.
export const attractCopy: [string, string][] = [
  invitationCopy.idle,
  ['Quelqu’un veut jouer ?', 'Je réagis à tes gestes. Viens voir !'],
  ['Fais-moi coucou !', 'Promis, je te réponds.'],
  ['J’ai des trésors à te montrer.', 'Six façons d’explorer la Bible.'],
]

/** What the character says, given the encounter and the virtual hand. */
export function bubbleCopy(
  cue: StandCue,
  stage: StandStage,
  hand: HandMode,
  reading: boolean,
  attractLine = 0,
  introducing = false
): [string, string] {
  if (replyCues.has(cue)) return invitationCopy[cue]
  if (introducing) return ['Salut la bande !', 'Je vous présente mes amis.']
  if (stage === 'attract' && cue === 'idle') return attractCopy[attractLine % attractCopy.length]
  if (hand === 'rotating') return ['Wouhou, ça tourne !', 'Ouvre la main pour me relâcher.']
  if (reading) return ['Bonne lecture !', 'Je reste juste à côté.']
  if (stage === 'explore') {
    if (hand === 'selecting') return ['Oh, bon choix !', 'Celle-là, je l’adore.']
    if (hand === 'moving' || hand === 'closed')
      return ['Cette main, c’est toi.', 'Tu peux aussi caresser ma tête.']
    if (cue === 'idle' || cue === 'searching') return invitationCopy.searching
  }
  return invitationCopy[cue]
}

/** The stand's instruction under the character, before the resources unlock. */
export const instructionCopy: Record<StandCue, [string, string]> = {
  idle: ['Viens dire bonjour', 'Place-toi face à l’écran, à un ou deux pas.'],
  notice: ['Il t’a repéré', 'Reste là, il t’observe.'],
  closer: ['Avance d’un pas', 'Il te verra mieux de près.'],
  searching: ['Reviens face à l’écran', 'Il te cherche du regard.'],
  wave: ['Fais-lui coucou', 'Main ouverte, de gauche à droite.'],
  smile: ['Souris-lui', 'Garde ton sourire une seconde.'],
  'thumbs-up': ['Lève le pouce', 'Tiens-le une seconde.'],
  victory: ['Fais le V', 'Deux doigts levés, une seconde.'],
  'thumbs-down': ['Pouce baissé', 'Tiens-le une seconde.'],
  tilt: ['Penche la tête', 'Sur le côté, quelques instants.'],
  'free-play': ['À toi de jouer', 'Coucou, sourire, pouce, V ou tête penchée.'],
  connection: ['Parle à l’équipe du stand', 'Elle te racontera son histoire.'],
  hello: ['Coucou réussi !', 'La glace est brisée.'],
  'smile-reply': ['Sourire partagé !', 'Geste reconnu.'],
  'thumbs-up-reply': ['Pouce validé !', 'Geste reconnu.'],
  'victory-reply': ['V validé !', 'Geste reconnu.'],
  'thumbs-down-reply': ['Geste secret trouvé !', 'Il boude… un tout petit peu.'],
  'tilt-reply': ['Bien penché !', 'Geste reconnu.'],
  petted: ['Il adore ça', 'Continue doucement.'],
  farewell: ['À bientôt !', 'Merci de ta visite.'],
}

export const gestureLabels: Record<StandAction, string> = {
  wave: 'Coucou',
  smile: 'Sourire',
  'thumbs-up': 'Pouce levé',
  victory: 'Victoire',
  tilt: 'Tête penchée',
  'thumbs-down': 'Pouce baissé',
}
