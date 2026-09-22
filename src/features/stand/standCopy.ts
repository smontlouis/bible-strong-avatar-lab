import type { StandCue } from './standEncounter'

export const invitationCopy: Record<StandCue, [string, string]> = {
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
  tilt: ['Tu peux faire comme moi ?', 'Penche un peu la tête.'],
  'tilt-reply': ['On se ressemble, non ?', 'Joli mouvement.'],
  connection: ['Tu veux connaître mon histoire ?', 'L’équipe du stand te la raconte.'],
  'free-play': ['À toi de me surprendre.', 'Un coucou, un sourire… je te suis.'],
}
