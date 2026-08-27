# Analyse de parenté technique — MetalForge Character Studio

Date de l'analyse : 24 août 2026  
Site inspecté : <https://metalforge.xyz/character>  
Dépôt comparé : Bible Strong Avatar Lab  
Conclusion synthétique : **confiance estimée à 95 % qu'une partie substantielle du moteur de pose et d'animation de MetalForge Character Studio dérive du code de Bible Strong Avatar Lab.**

## Portée et limites

Cette analyse compare le code public du dépôt Bible Strong Avatar Lab aux bundles JavaScript servis au navigateur par MetalForge. Elle permet d'établir une parenté technique très probable, mais ne permet pas à elle seule d'établir juridiquement :

- qui a écrit chaque fragment en premier ;
- la date exacte de la reprise ;
- l'existence éventuelle d'une autorisation ou d'une licence privée ;
- l'identité de la personne ayant intégré le code dans MetalForge.

Le constat ne porte pas sur une copie intégrale de l'application. MetalForge utilise Next.js/Turbopack, tandis que Bible Strong Avatar Lab utilise React/Vite. L'interface, le renderer de surface et plusieurs fonctionnalités de MetalForge sont différents ou supplémentaires.

## Méthode

L'inspection a été réalisée en lecture seule dans le navigateur intégré :

1. inventaire des scripts, feuilles de style et SVG chargés par `/character` ;
2. lecture des bundles JavaScript publics de la page ;
3. recherche de noms, structures, constantes et formules caractéristiques du moteur local ;
4. comparaison avec les sources du dépôt et avec le moteur standalone généré ;
5. recherche d'une attribution visible à Bible Strong, à son auteur, à son dépôt ou à l'AGPL.

Le bundle contenant l'essentiel du moteur observé était :

```text
https://metalforge.xyz/_next/static/chunks/000iya6pxjjky.js?dpl=dpl_3Unt8LQo6d5o7qZranC5wi2bYegH
```

Une seconde copie très proche apparaissait aussi dans :

```text
https://metalforge.xyz/_next/static/chunks/0sy9c2x40th~0.js?dpl=dpl_3Unt8LQo6d5o7qZranC5wi2bYegH
```

Les noms de chunks et l'identifiant de déploiement peuvent changer lors d'une prochaine publication du site.

## Correspondances principales

### 1. Schéma de pose identique

Le bundle MetalForge contient exactement la même liste ordonnée de quinze champs :

```text
headX, headY, headZ,
widthLeft, widthRight, heightLeft, heightRight,
spacing,
positionXLeft, positionXRight,
positionYLeft, positionYRight,
leftAngle, rightAngle,
perspective
```

La même liste et le même ordre se trouvent dans :

- `packages/avatar-core/src/geometry.ts`, lignes 93–109 ;
- `src/features/export/standaloneEngine.generated.ts`.

Certains noms pris isolément pourraient être génériques. Leur combinaison complète, leur asymétrie gauche/droite et leur ordre identique sont beaucoup plus discriminants.

### 2. Projection 3D avec la même focale

Le moteur local utilise une focale de `620` et une projection de la forme :

```text
denominator = 620 - z * perspective
scale = 620 / denominator
```

Référence locale : `packages/avatar-core/src/geometry.ts`, lignes 89–90 et 266–269.

Le bundle MetalForge contient la même constante et la même opération, minifiée sous la forme équivalente :

```text
i = 620 - e[2] * t
o = 620 / i
```

### 3. Graine de mouvement ambiant identique

Bible Strong calcule la graine d'une expression avec :

```text
headX * 0.71 + headY * 1.13 + headZ * 1.37
```

Référence locale : `packages/avatar-core/src/ambientMotion.ts`, lignes 18–20.

MetalForge utilise la même combinaison :

```text
.71 * targetPose.headX + 1.13 * targetPose.headY + 1.37 * targetPose.headZ
```

Cette combinaison de trois coefficients décimaux est un signal de parenté particulièrement fort.

### 4. Mouvement `slowDrift` identique

Pour les rotations de tête, Bible Strong utilise :

| Axe     | Intervalle | Amplitude |
| ------- | ---------: | --------: |
| `headX` |     `2600` |     `0.8` |
| `headY` |     `3300` |    `1.15` |
| `headZ` |     `4100` |    `0.45` |

Pour le déplacement du corps :

| Axe | Intervalle | Amplitude |
| --- | ---------: | --------: |
| `x` |     `2900` |    `1.45` |
| `y` |     `3700` |     `1.1` |

Références locales : `packages/avatar-core/src/ambientMotion.ts`, lignes 46–52 et 89–92.

Le bundle MetalForge reproduit les cinq couples intervalle/amplitude dans la même structure :

```text
hx = .8   * noise(..., 2600)
hy = 1.15 * noise(..., 3300)
hz = .45  * noise(..., 4100)
ox = 1.45 * noise(..., 2900)
oy = 1.1  * noise(..., 3700)
```

### 5. Tremblement identique

Les deux moteurs utilisent les mêmes fréquences et multiplicateurs :

```text
sin(31t) + 0.45 * sin(53t)
sin(37t) + 0.4  * sin(61t)
0.7 * sin(43t)
```

Les amplitudes `1.15`, `1.35` et `0.7` sont également conservées pour les rotations de tête. Les amplitudes `1.35` et `1.1` sont conservées pour le déplacement du corps.

Référence locale : `packages/avatar-core/src/ambientMotion.ts`, lignes 54–59 et 93–97.

### 6. Micro-saccades identiques

Les deux implémentations emploient ensemble :

- le nom interne `microSaccades` ;
- un intervalle de `1100` ms ;
- une durée de transition de `140` ms ;
- la graine particulière `17.29` ;
- des amplitudes `1.5` en X et `0.9` en Y.

Référence locale : `packages/avatar-core/src/ambientMotion.ts`, lignes 20 et 31–40, puis 64–69.

MetalForge a remplacé la fonction de hash trigonométrique par un mélange entier, apparemment afin d'obtenir des résultats reproductibles entre JavaScript et Swift. Cette modification indique une adaptation du bloc plutôt qu'une simple inclusion inchangée.

### 7. Profil de clignement identique

Le profil de clignement suivant apparaît dans les deux projets :

```text
initialDelayMs: 2600
minIntervalMs: 3400
maxIntervalMs: 6200
durationMs: 280
```

Référence locale : `src/features/animation/sequences.ts`, lignes 221–227.

MetalForge l'utilise pour son mouvement `idle`, avec les mêmes noms `slowDrift` et `microSaccades`.

### 8. Interpolation et vocabulaire interne

Le bundle MetalForge conserve également :

- `bodyMotion` et `eyeMotion` ;
- `slowDrift`, `microSaccades`, `shake` et `none` ;
- les transitions `smooth`, `snappy` et `spring` ;
- le smoothstep `t² × (3 − 2t)` ;
- l'easing spring `1 − exp(−6t) × cos(8t)` ;
- la structure générale d'interpolation des champs de pose.

Ces éléments sont moins probants individuellement, mais renforcent les correspondances plus spécifiques ci-dessus.

## Différences observées

MetalForge ne semble pas distribuer une copie brute de l'application Bible Strong :

- application Next.js/Turbopack au lieu de React/Vite ;
- nouveaux personnages : Umbra, Klee, Sol, Fleur, Tri, Quad, Glob et Ghost ;
- textures, éclairages et surfaces supplémentaires ;
- nouvelles formes d'yeux et nouveaux mouvements ;
- exports annoncés pour React, React Native et SwiftUI ;
- remplacement de la fonction de hash du mouvement ambiant ;
- renderer SVG beaucoup plus complexe, notamment pour les surfaces et l'éclairage.

L'hypothèse la plus cohérente est donc la reprise puis l'extension d'une partie du moteur de pose, d'interpolation et d'animation.

## Attribution et licence

Le dépôt Bible Strong Avatar Lab déclare une licence **GNU Affero General Public License v3.0 only** dans `LICENSE` et `package.json`.

Lors de l'inspection :

- aucune occurrence de `bible-strong`, du nom de l'auteur ou de l'URL du dépôt n'a été trouvée dans les bundles de la page ;
- aucune attribution correspondante n'était visible dans Character Studio ;
- aucun lien vers les sources dérivées n'a été identifié sur cette page ;
- les recherches textuelles ressemblant à `AGPL` dans certains gros bundles étaient des faux positifs contenus dans des identifiants comme `dragPlaneZ`.

Cette absence constatée n'exclut pas qu'une attribution, une offre de sources ou une licence privée existe ailleurs.

## Évaluation de confiance

**Niveau de confiance technique : 95 %.**

Cette estimation élevée repose sur la présence simultanée de plusieurs signatures fortement discriminantes :

1. même schéma ordonné de quinze champs ;
2. même focale et même projection ;
3. même graine avec trois coefficients décimaux particuliers ;
4. mêmes cinq intervalles et amplitudes de dérive ;
5. mêmes fréquences de tremblement ;
6. même graine et même timing de micro-saccades ;
7. même profil complet de clignement ;
8. même vocabulaire interne.

La marge de 5 % reflète principalement l'impossibilité, à partir du seul bundle client, d'établir la chronologie, l'auteur de l'intégration et les éventuels accords privés.

## Conservation recommandée des éléments

Pour rendre l'analyse reproductible et préserver l'état observé, il serait utile de conserver séparément :

- les bundles JavaScript exacts avec leurs URL complètes ;
- une somme SHA-256 de chaque bundle ;
- une capture complète de la page ;
- les réponses HTTP et leur date de collecte ;
- le commit exact du dépôt Bible Strong utilisé pour la comparaison ;
- un diff technique automatisé et horodaté ;
- une copie des pages légales et d'aide de MetalForge au même moment.

Ce document constitue une analyse technique interne, pas un avis juridique.
