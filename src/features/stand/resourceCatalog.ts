// Adapted from Bible Strong World’s six discovery journeys (apps/world/src/*-discovery-copy.ts).
// Editorial explanations and paraphrases, not live resource queries or Bible translation quotations.
export const standResources = [
  {
    id: 'lexicon',
    color: '#91b5ff',
    image: 'lexicon',
    title: 'Lexique hébreu / grec',
    subtitle: 'Derrière un mot, un monde.',
    sections: [
      {
        title: 'Un mot qui prend vie',
        body: 'Le mot hébreu hevel évoque un souffle, une vapeur. Dans l’Ecclésiaste, il est aussi traduit par « vanité ». Un mot original peut ouvrir une nouvelle piste de lecture.',
        reference: 'Ecclésiaste 1.2 · H1892',
      },
      {
        title: 'הֶבֶל · hevel',
        body: 'Souffle, vapeur, vanité : ces nuances évoquent ce qui est passager. Le contexte du passage aide à comprendre le sens du mot.',
        reference: null,
      },
      {
        title: 'Retrouve le fil du mot',
        body: 'Dans Bible Strong, sélectionne un mot lié à un numéro Strong. Explore sa définition et les autres passages où il apparaît, puis reviens lire le texte dans son contexte.',
        reference: null,
      },
    ],
  },
  {
    id: 'dictionary',
    color: '#f2cb7e',
    image: 'dictionary',
    title: 'Dictionnaires bibliques',
    subtitle: 'Un mot, toute une époque.',
    sections: [
      {
        title: 'Qui étaient les publicains ?',
        body: 'Zachée est présenté comme un chef des publicains. Ce sont des collecteurs d’impôts ou de taxes : connaître leur métier aide à entrer dans le récit.',
        reference: 'Luc 19.2 · D’après Easton, « Publican »',
      },
      {
        title: 'Le contexte change le regard',
        body: 'Leur lien avec le pouvoir et les abus de perception les rendaient impopulaires. L’accueil de Zachée par Jésus prend alors un relief particulier : la foule lui reproche de loger chez un pécheur.',
        reference: 'Luc 19.7',
      },
      {
        title: 'Personnes, lieux, coutumes',
        body: 'Les dictionnaires de Bible Strong donnent des repères pour comprendre le monde de la Bible. Pars d’un nom ou d’une coutume, puis relis le passage avec ce nouvel éclairage.',
        reference: null,
      },
    ],
  },
  {
    id: 'comparisons',
    color: '#c3a8ec',
    image: 'comparisons',
    title: 'Comparaisons de traductions',
    subtitle: 'Un passage, plusieurs éclairages.',
    sections: [
      {
        title: 'Un autre choix de mots',
        body: 'Dans Jean 1.5, Segond emploie « reçue » et Darby « comprise ». Comparer les formulations attire notre attention sur une question que nous n’aurions peut-être pas posée.',
        reference: 'Jean 1.5 · Segond 1910 / Darby 1890',
      },
      {
        title: 'Observe, puis relis',
        body: 'Quels mots se ressemblent ? Lesquels diffèrent ? Une différence ouvre une piste ; elle ne remplace pas la lecture du chapitre et de son contexte.',
        reference: null,
      },
      {
        title: 'Rapproche tes versions',
        body: 'Sélectionne un ou plusieurs versets dans Bible Strong, puis ajoute les traductions que tu souhaites comparer. Prends le temps de lire leurs formulations côte à côte.',
        reference: null,
      },
    ],
  },
  {
    id: 'references',
    color: '#eda393',
    image: 'references',
    title: 'Références croisées',
    subtitle: 'Un verset, mille connexions.',
    sections: [
      {
        title: 'Suis l’image du berger',
        body: 'Le Psaume 23 présente Dieu comme un berger. Cette image résonne avec d’autres passages : une lecture peut devenir le début d’un parcours.',
        reference: 'Psaume 23.1',
      },
      {
        title: 'Deux pistes à explorer',
        body: 'Dans Jean 10.11, Jésus se présente comme le bon berger qui donne sa vie pour ses brebis. Ésaïe 40.11 évoque le berger qui rassemble les agneaux et les porte avec soin.',
        reference: 'Jean 10.11 · Ésaïe 40.11',
      },
      {
        title: 'Laisse la Bible éclairer la Bible',
        body: 'Ouvre les références liées à un verset dans Bible Strong. Lis chaque passage dans son contexte et observe ce que les rapprochements éclairent.',
        reference: null,
      },
    ],
  },
  {
    id: 'themes',
    color: '#a0bcff',
    image: 'themes',
    title: 'Thèmes bibliques',
    subtitle: 'Une question. Des pistes à explorer.',
    sections: [
      {
        title: 'Et si on explorait la paix ?',
        body: 'Les thèmes Nave rassemblent des références autour d’un sujet. Ils permettent de partir d’une question et de parcourir plusieurs livres de la Bible.',
        reference: null,
      },
      {
        title: 'Une paix donnée, une paix qui garde',
        body: 'Jean 14.27 parle de la paix que Jésus donne. Philippiens 4.7 évoque la paix de Dieu qui garde les cœurs et les pensées. Deux passages, deux éclairages sur un même sujet.',
        reference: 'Jean 14.27 · Philippiens 4.7',
      },
      {
        title: 'La foi, la prière, le pardon…',
        body: 'Choisis un sujet qui te touche dans Bible Strong. Explore ses références, ouvre les passages et prends aussi le temps de lire les versets qui les entourent.',
        reference: null,
      },
    ],
  },
  {
    id: 'commentaries',
    color: '#8fd0c2',
    image: 'commentaries',
    title: 'Commentaires bibliques',
    subtitle: 'Un passage. Un nouvel éclairage.',
    sections: [
      {
        title: 'Un regard accompagne ta lecture',
        body: 'Un commentaire aide à observer un passage, à en comprendre les images et à poursuivre sa réflexion. Il accompagne la Bible et invite à revenir au texte.',
        reference: null,
      },
      {
        title: 'Le berger et la confiance',
        body: 'Dans son commentaire du Psaume 23, Matthew Henry rapproche l’image du berger du soin attentif de Dieu. Cette lecture invite à réfléchir à la confiance.',
        reference: 'Psaume 23 · Synthèse d’après Matthew Henry',
      },
      {
        title: 'Une question à garder',
        body: 'Que m’évoque l’image du berger ? Comment le reste du psaume la développe-t-il ? Dans Bible Strong, explore plusieurs commentaires et poursuis ta lecture avec ces questions.',
        reference: null,
      },
    ],
  },
] as const
export type StandResource = (typeof standResources)[number]
export type StandResourceId = StandResource['id']
