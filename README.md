# Plateforme

Espace de travail des mandataires et du back-office : simulateur de commission,
enveloppes de produits structurés, affaires et bordereau mensuel, synthèse des
contrats avant rendez-vous.

Ce dépôt est privé. Il appartient à l'organisation REKA-Consulting.

## Modules prévus

| Module | Contenu | État |
| --- | --- | --- |
| Socle applicatif | Connexion, double authentification par code mail, profils, modules activables par utilisateur, journal des actions | À construire |
| Simulateur | Commission estimée d'une affaire, selon le référentiel de l'année | À construire |
| Enveloppes | Réservations, compteurs théorique et réel, validation, relances, avenant pré-rempli | À construire |
| Affaires et bordereau | Saisie des affaires, étapes de validation, bordereau mensuel du mandataire | À construire |
| Synthèse des contrats | Récapitulatif des contrats d'un client avant rendez-vous | À construire |

## Choix techniques

Les mêmes que le socle de lecture des bordereaux, pour pouvoir fusionner les deux
applications plus tard :

- interface : Angular
- serveur : NestJS
- base de données : PostgreSQL, via Prisma

## Règles du dépôt

1. Aucune donnée réelle de client dans le dépôt : ni nom, ni contrat, ni bordereau.
   Les exemples et les jeux de test sont fictifs.
2. Aucun secret dans le dépôt : ni mot de passe, ni clé, ni jeton. Ils sont fournis
   au serveur par des variables d'environnement.
3. La branche `main` contient la version en service. Le travail se fait sur des
   branches, fusionnées après vérification.
4. L'argent se calcule par des règles écrites et testées. L'IA lit, rédige et
   signale ; elle ne valide ni un calcul ni un paiement.
