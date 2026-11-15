# Plateforme

Espace de travail des mandataires et du back-office : simulateur de commission,
enveloppes de produits structurés, affaires et bordereau mensuel, synthèse des
contrats avant rendez-vous.

Ce dépôt est privé. Il appartient à l'organisation REKA-Consulting.

## Modules prévus

| Module | Contenu | État |
| --- | --- | --- |
| Socle applicatif | Connexion, double authentification par code mail, profils, modules activables par utilisateur, journal des actions | À construire |
| Simulateur | Commission estimée d'une affaire, selon le référentiel de l'année | Première version : 151 contrats du barème 2026, sans connexion |
| Enveloppes | Réservations, compteurs théorique et réel, validation, relances, avenant pré-rempli | À construire |
| Affaires et bordereau | Saisie des affaires, étapes de validation, bordereau mensuel du mandataire | À construire |
| Synthèse des contrats | Récapitulatif des contrats d'un client avant rendez-vous | À construire |

## Choix techniques

Les mêmes que le socle de lecture des bordereaux, pour pouvoir fusionner les deux
applications plus tard :

- interface : Angular
- serveur : NestJS
- base de données : PostgreSQL, via Prisma

## Lancer l'application sur un poste

Il faut Node.js 22. Dans deux fenêtres de terminal :

```bash
# Serveur, sur le port 3000
cd back-end
npm install
cp .env.example .env
npm run start:dev
```

```bash
# Interface, sur http://localhost:4200
cd front-end
npm install
npm start
```

Tests : `npm test` dans `back-end`, `npm test -- --watch=false` dans `front-end`.

## Simulateur : ce qui est fait, ce qui manque

Fait :

- les 151 contrats de la grille du cabinet, dans un référentiel daté
  (`back-end/prisma/data/referentiel-commissions-2026.json`) ;
- le calcul côté serveur, vérifié contre la grille d'origine sur toutes les
  combinaisons du barème ;
- l'écran, en clair et en sombre, utilisable sur téléphone.

Règles du cabinet appliquées, en plus de la grille : surcommission Abeille sur la
part réelle en unités de compte, baisse selon l'âge de l'assuré (Abeille, Generali,
Cardif), plafond Abeille de 2 000 € par mois par client et par type de contrat, bonus
Swiss Life sur la seule part en unités de compte. Le détail, décision par décision,
est dans [`docs/decisions.md`](docs/decisions.md).

Manque :

- la connexion : le taux de reversement est pour l'instant celui de référence (70 %) ;
  il viendra de la fiche de chaque mandataire ;
- les lectures de protocole marquées « à confirmer » dans le référentiel ;
- le cumul automatique du plafond Abeille entre les contrats d'un même client, qui
  viendra avec le module Affaires (il se saisit à la main pour l'instant) ;
- le référentiel en base de données, modifiable par un administrateur.

## Règles du dépôt

Le détail est dans [`CLAUDE.md`](CLAUDE.md). En résumé :

1. Aucune donnée réelle de client dans le dépôt : ni nom, ni contrat, ni bordereau.
   Les exemples et les jeux de test sont fictifs.
2. Aucun secret dans le dépôt : ni mot de passe, ni clé, ni jeton. Ils sont fournis
   au serveur par des variables d'environnement.
3. La branche `main` contient la version en service. Le travail se fait sur des
   branches, fusionnées après vérification.
4. L'argent se calcule par des règles écrites et testées. L'IA lit, rédige et
   signale ; elle ne valide ni un calcul ni un paiement.
