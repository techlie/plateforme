# Plateforme

Espace de travail des mandataires et du back-office : simulateur de commission,
enveloppes de produits structurés, affaires et bordereau mensuel, synthèse des
contrats avant rendez-vous.

Ce dépôt est privé.

## Modules prévus

| Module | Contenu | État |
| --- | --- | --- |
| Socle applicatif | Connexion, double authentification par code mail, profils, modules activables par utilisateur, journal des actions | Construit et testé : connexion en deux étapes, comptes, entités, journal, écrans d'administration |
| Simulateur | Commission estimée d'une affaire, selon le référentiel de l'année, et ce qui est repris si le contrat s'arrête | Construit et testé : 151 contrats du barème 2026, reprises, co-courtage, reversement à 70, 80 ou 90 % ; sans connexion |
| Enveloppes | Réservations, compteurs théorique et réel, validation, relances, avenant pré-rempli | Construit et testé : référentiels, enveloppes, réservations et tous leurs contrôles, liste d'attente, vérification compagnie, clients confiés, fiche avenant, mail du jeudi, fiabilité, export ; points ouverts listés dans `docs/decisions.md` |
| Affaires et bordereau | Saisie des affaires, étapes de validation, bordereau mensuel du mandataire | À construire |
| Synthèse des contrats | Récapitulatif des contrats d'un client avant rendez-vous : garanties et coût avec échéancier, encours et versements réguliers en assurance vie et PER | À construire |

## Choix techniques

Les mêmes que le socle de lecture des bordereaux, pour pouvoir fusionner les deux
applications plus tard :

- interface : Angular
- serveur : NestJS
- base de données : PostgreSQL, via Prisma

## Lancer l'application sur un poste

Il faut Node.js 22 et PostgreSQL 16, avec une base pour l'application et une base de
test dont le nom contient « test ».

```bash
# Serveur, sur le port 3000
cd back-end
npm install
cp .env.example .env          # puis renseigner DATABASE_URL, CLE_SECRETE, URL_APPLICATION
npx prisma generate
npx prisma migrate deploy     # crée les tables
npm run build
npm run initialiser -- --email vous@exemple.fr --prenom Prénom --nom Nom
npm run start:dev
```

Sans serveur de messagerie configuré, sur un poste de développement, les courriels
(lien d'activation, codes de connexion) s'affichent dans la console du serveur.

```bash
# Interface, sur http://localhost:4200
cd front-end
npm install
npm start
```

Tests : dans `back-end`, `npm test` (calculs et règles) et `npm run test:e2e`
(connexion, droits et module Enveloppes, sur la base de test, avec
`DATABASE_URL_TEST`) ; dans `front-end`, `npm test -- --watch=false`.

La mise en service sur le serveur est décrite dans
[`docs/deploiement.md`](docs/deploiement.md).

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
Swiss Life sur la seule part en unités de compte, partage de co-courtage avec un
cabinet d'expertise comptable. L'écran donne aussi la règle de reprise du contrat, son
calcul et ce qu'elle coûterait sur l'affaire simulée. Le détail, décision par décision,
est dans [`docs/decisions.md`](docs/decisions.md).

Manque :

- la connexion : le taux de reversement se choisit pour l'instant entre 70, 80 et 90 % ;
  il viendra de la fiche de chaque mandataire ;
- les réponses aux questions marquées « à confirmer » dans le référentiel ; en
  attendant, la règle concernée est affichée sans exemple chiffré ;
- les règles de reprise en santé et en assurance de prêt, que les protocoles dont
  dispose le cabinet ne donnent pas ;
- le cumul automatique du plafond Abeille entre les contrats d'un même client, qui
  viendra avec le module Affaires (il se saisit à la main pour l'instant) ;
- le référentiel en base de données, modifiable par un administrateur.

## Enveloppes : ce qui est fait, ce qui manque

Fait, selon le cahier des charges du module (version 2) :

- référentiels communs : compagnies et gammes avec le modèle du numéro de contrat,
  apporteurs rattachés ou non à un compte, codes apporteur, fonds importés par
  compagnie (aucun fonds n'est supprimé : il passe « fermé ») ;
- enveloppes : création, dates dans l'ordre imposé, fermeture seule à la date limite
  interne (23 h 59, Paris), rallonges et restitutions, réservations globales, clients
  confiés, upfront réservé aux super administrateurs, produit annulé ou reporté ;
- réservations : brut et frais saisis, net calculé ; les contrôles de la section 6.3,
  avec dérogations motivées ; liste d'attente ; validation, renvoi, refus, annulation
  (tardive signalée), déclaration de l'opération, vérification compagnie et écart,
  échéance, prolongation, libération, annulation après opération ;
- double compteur recalculé à chaque affichage, et contrôle de l'enveloppe dans la même
  transaction que l'enregistrement : deux réservations ne prennent jamais le même
  montant ;
- fiche des valeurs à reporter sur l'avenant, produite après l'accord du client ;
- notifications par courriel sans nom de client, mail du jeudi à 9 h 01, fiabilité des
  mandataires, export CSV journalisé, documents déposés.

Manque : le récapitulatif et la demande de règlement des commissions, l'import des
fichiers d'ordres des compagnies, le pré-remplissage de la fiche par l'IA, le
remplissage de l'avenant vierge lui-même, les relances automatiques, le bilan de
clôture et l'export Excel. Les règles encore à trancher sont listées dans
[`docs/decisions.md`](docs/decisions.md) ; en attendant, la plateforme les affiche
« à fixer » ou « à confirmer ».

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
