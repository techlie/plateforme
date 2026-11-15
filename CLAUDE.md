# Règles du dépôt

Ces règles s'appliquent à tout ce qui est écrit ici, par une personne ou par Claude.
Elles ont deux buts : que ce code puisse rejoindre le socle (Talpi) sans réécriture,
et que personne ne puisse douter d'un montant affiché.

## 1. Compatibilité avec le socle

Le socle est l'application des développeurs (lecture des bordereaux compagnies).
On reprend sa technologie et son organisation, pas son habillage.

| Partie | Choix | Version du socle |
| --- | --- | --- |
| Serveur | NestJS | 11 |
| Base de données | PostgreSQL, accès par Prisma | Prisma 7 |
| Interface | Angular, composants autonomes | 19 |
| Langage | TypeScript | 5.x |
| Tests serveur | Jest | 30 |

- Deux dossiers à la racine, comme le socle : `back-end/` et `front-end/`.
- Serveur : un dossier par module dans `back-end/src/modules/<module>/`, avec
  `<module>.module.ts`, `<module>.controller.ts`, `<module>.service.ts`,
  `<module>.repository.ts`, un dossier `dto/` et les tests `*.spec.ts` à côté du code.
- Ce qui sert à plusieurs modules va dans `back-end/src/shared/`.
- Base : modèles en PascalCase, champs en camelCase, tables en `snake_case` au pluriel
  (`@@map`), identifiants `uuid`, champs `createdAt` et `updatedAt` partout.
- Entrées de l'API validées par `class-validator`, avec `whitelist` et
  `forbidNonWhitelisted` : un champ inconnu est refusé.
- Interface : un dossier par écran dans `front-end/src/app/modules/<module>/`.
- Aucune dépendance ajoutée sans raison écrite dans le message d'enregistrement.

Un module ne dépend jamais d'un autre module métier autrement que par son service
exporté. C'est ce qui permet d'activer ou non un module par utilisateur.

## 2. Vocabulaire

- Le code technique (noms de fichiers, classes de structure) suit le socle.
- Les notions métier gardent leur nom français, sans traduction approximative :
  `mandataire`, `bordereau`, `enveloppe`, `avenant`, `reversion`, `escompte`,
  `precompte`, `reprise`, `co-courtage`, `apporteur`.
- Tout ce que l'utilisateur lit est en français, sans jargon technique.
- Le nom affiché est toujours **SR CONSEIL**.

## 3. Argent

- Un montant n'est jamais calculé par une intelligence artificielle. Il sort d'une
  règle écrite dans le code, couverte par un test.
- Aucun taux en dur dans le code. Les taux vivent dans le référentiel, daté
  (`dateEffet`), et un changement de barème ne modifie jamais un calcul passé.
- Les calculs sont des fonctions pures, sans accès à la base ni à l'horloge :
  mêmes entrées, même résultat.
- Les taux restent en décimal pendant le calcul ; l'arrondi au centime se fait une
  seule fois, à la fin.
- Toute hypothèse non confirmée par le cabinet ou la compagnie est marquée
  `aConfirmer` dans le référentiel et signalée à l'écran.
- Tout écart volontaire avec la grille d'origine est listé dans un test nommé.
- Un bordereau envoyé ne se modifie plus : une correction passe par une ligne de
  régularisation.

## 4. Sécurité et confidentialité

- Aucune donnée client réelle dans ce dépôt, ni dans le code, ni dans les tests, ni
  dans les exemples. Les jeux d'essai sont inventés.
- Aucun secret dans le dépôt (mot de passe, clé, jeton). Seul `.env.example` est
  enregistré, sans valeur réelle.
- Chacun ne voit que son périmètre. Le filtrage se fait côté serveur, jamais
  seulement à l'écran.
- La marge du cabinet et le détail compagnie → courtier grossiste → cabinet ne
  sortent jamais vers un profil mandataire.
- Aucun contenu médical : la plateforme connaît au plus un statut
  (« formalités médicales en cours »).
- Aucun IBAN enregistré.
- Chaque action sensible laisse une trace : qui, quoi, quand.
- Connexion à deux étapes par code envoyé par courriel.

## 5. Habillage et parcours utilisateur

L'habillage de référence est celui des maquettes « SR CONSEIL — Maquettes plateforme
mandataires », pas le thème du socle.

- Les couleurs, rayons et espacements passent par les variables de
  `front-end/src/styles/tokens.css`. Aucune couleur écrite en dur dans un composant.
- Clair et sombre fonctionnent partout, par les mêmes variables.
- Police Inter, chiffres alignés (`tabular-nums`) pour tout montant.
- Une question par écran, le résultat principal en grand, le détail en dessous.
- Zones cliquables d'au moins 44 px, libellé visible pour chaque champ, navigation
  au clavier possible partout.
- Utilisable sur téléphone : pas de défilement horizontal.

## 6. Façon de travailler

- Une décision du cabinet s'inscrit d'abord dans `docs/decisions.md`, avec sa date,
  puis se code. Avant de construire un module, relire ce registre en entier : une
  décision déjà prise ne se redemande pas et ne se laisse pas de côté.
- Une formule de protocole incertaine ne bloque pas une décision : on applique la
  lecture la plus naturelle, on la marque `aConfirmer`, on l'affiche.
- `main` est la version en service. Tout travail se fait sur une branche.
- Rien n'est fusionné dans `main` si un test échoue.
- Un message d'enregistrement dit ce qui change et pourquoi, en français.
- Les dépôts des développeurs (COVA, bordeo) sont en lecture seule depuis ici.
