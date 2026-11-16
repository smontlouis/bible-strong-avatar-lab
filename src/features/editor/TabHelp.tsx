import { ArrowRight, BookOpen, CircleHelp } from 'lucide-react'
import { useState } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { EditorTab } from '@/features/editor/useEditor'

const SITE = 'https://avatars.bible-strong.app'

/** The four notions an avatar is made of, in the order they hold each other. */
const CHAIN = [
  { tab: 'avatars', label: 'Personnage' },
  { tab: 'states', label: 'États' },
  { tab: 'clips', label: 'Clips' },
  { tab: 'faces', label: 'Visages' },
] as const satisfies readonly { tab: EditorTab; label: string }[]

type Topic = {
  title: string
  /** The notions of the chain this tab is about. */
  chain: readonly EditorTab[]
  what: string
  here: string
  fit: string
  guide?: { href: string; label: string }
}

const TOPICS: Record<EditorTab, Topic> = {
  avatars: {
    title: 'Le personnage',
    chain: ['avatars'],
    what: 'Un personnage, c’est un corps : ses formes, leurs couleurs, la place et la taille des yeux. Il ne contient aucun mouvement.',
    here: 'Choisir l’avatar qui joue sur la scène, en créer un, le dupliquer, l’importer ou l’exporter en .json. Double-clique une carte pour construire son corps.',
    fit: 'Tous les personnages jouent les mêmes états, clips et visages : ce que tu animes dans les autres onglets marche sur chacun d’eux.',
    guide: { href: `${SITE}/character-authoring.md`, label: 'Guide des personnages' },
  },
  pose: {
    title: 'La pose',
    chain: ['avatars'],
    what: 'Une pose, c’est le personnage orienté et placé à la main, pour une photo ou une image fixe.',
    here: 'Glisse l’avatar sur la scène ou règle sa rotation et sa position : ce qu’il joue se met en pause et il suit ta main. Le mode photo en tire une image.',
    fit: 'La pose ne change ni le personnage ni ses animations : Lecture le fait reprendre là où il en était.',
  },
  states: {
    title: 'Les états',
    chain: ['states'],
    what: 'Un état, c’est ce que fait l’avatar pendant qu’une app est dans une situation : idle quand il attend, thinking quand il réfléchit, listening quand il écoute.',
    here: 'Choisir un état pour le voir jouer, en créer un, choisir ses clips et la règle qui les enchaîne : au hasard, l’un après l’autre, une fois puis un autre état, pendant un temps. Un état peut aussi tenir un visage ou devenir un spinner.',
    fit: 'Une app ne demande qu’un état. L’état choisit les clips, les clips choisissent les visages.',
    guide: { href: `${SITE}/state-authoring.md`, label: 'Guide des états' },
  },
  clips: {
    title: 'Les clips',
    chain: ['clips'],
    what: 'Un clip, c’est un morceau de mouvement d’une durée fixe : des pistes (tête, corps, yeux, visage…) et des clés posées dans le temps.',
    here: 'Jouer les clips intégrés, en créer un, poser des clés sur la frise ou dans la feuille, régler la courbe entre deux clés.',
    fit: 'Les états jouent les clips. Une clé de visage nomme un visage, intégré ou dessiné, et un clip se raccorde à ses voisins sans à-coup.',
    guide: { href: `${SITE}/clip-authoring.md`, label: 'Guide des clips' },
  },
  faces: {
    title: 'Les visages',
    chain: ['faces'],
    what: 'Un visage, c’est la forme des yeux. Neuf sont intégrés ; un visage dessiné est fait de tracés, comme dans un outil vectoriel.',
    here: 'Choisir un visage pour le voir sur l’avatar, en dessiner un sur la planche, importer un .svg ou un .face.json, le vérifier sous tous les angles.',
    fit: 'Les clips et les états nomment un visage par son nom. Les visages intégrés se transforment les uns en les autres ; un visage dessiné arrive et repart par un clignement.',
    guide: { href: `${SITE}/face-authoring.md`, label: 'Guide des visages' },
  },
  export: {
    title: 'L’export',
    chain: ['avatars', 'states', 'clips', 'faces'],
    what: 'Exporter, c’est emporter ton travail dans une app.',
    here: 'Télécharger le fichier du personnage, la bibliothèque (tes clips, états et visages), puis copier le code d’intégration pour React, React Native ou le web.',
    fit: 'Le personnage dit à quoi ressemble l’avatar ; la bibliothèque dit ce qu’il sait faire en plus de ce qui est intégré. Les deux vont ensemble dans l’app.',
    guide: { href: `${SITE}/llms.txt`, label: 'Tous les guides' },
  },
}

/**
 * A "?" beside a tab's title: a window that says what the tab's notion is, what one does there,
 * and where it sits in the chain character → states → clips → faces. Each link of the chain opens
 * its own explanation.
 */
export function TabHelp({
  tab,
  t,
  onOpenTab,
}: {
  tab: EditorTab
  t: (text: string) => string
  onOpenTab: (tab: EditorTab) => void
}) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState<EditorTab>(tab)
  const shown = TOPICS[topic]

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="tab-help-button"
        aria-label={t('C’est quoi ?')}
        data-tab-help={tab}
        onClick={() => {
          setTopic(tab)
          setOpen(true)
        }}
      >
        <CircleHelp />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="tab-help" data-help-topic={topic}>
          <DialogHeader>
            <ol className="tab-help-chain" aria-label={t('Comment un avatar est fait')}>
              {CHAIN.map((link, index) => (
                <li key={link.tab}>
                  {index > 0 && <ArrowRight aria-hidden className="tab-help-arrow" />}
                  <button
                    type="button"
                    className="tab-help-link"
                    data-current={shown.chain.includes(link.tab) || undefined}
                    aria-current={shown.chain.includes(link.tab) ? 'true' : undefined}
                    onClick={() => setTopic(link.tab)}
                  >
                    {t(link.label)}
                  </button>
                </li>
              ))}
            </ol>
            <DialogTitle>{t(shown.title)}</DialogTitle>
            <DialogDescription>{t(shown.what)}</DialogDescription>
          </DialogHeader>
          <div className="tab-help-body">
            <section>
              <h3>{t('Ce que tu peux faire ici')}</h3>
              <p>{t(shown.here)}</p>
            </section>
            <section>
              <h3>{t('Comment ça s’emboîte')}</h3>
              <p>{t(shown.fit)}</p>
            </section>
            <footer className="tab-help-footer">
              {shown.guide && (
                <a
                  className={buttonVariants({ variant: 'ghost' })}
                  href={shown.guide.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen />
                  {t(shown.guide.label)}
                </a>
              )}
              {topic !== tab && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onOpenTab(topic)
                  }}
                >
                  {t('Aller à cet onglet')}
                  <ArrowRight />
                </Button>
              )}
            </footer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
