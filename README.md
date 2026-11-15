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

Manque :

- la connexion : le taux de réversion est pour l'instant celui de référence (70 %) ;
  il viendra de la fiche de chaque mandataire ;
- les points marqués « à confirmer » dans le référentiel, à trancher avec le cabinet ;
- la surcommission Abeille selon la part en unités de compte, l'âge et le plafond ;
- le moment du paiement et les règles de reprise, contrat par contrat ;
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
