# Mise en service sur le serveur

Pour la personne qui installe la plateforme sur le serveur IONOS. Rien ici n'est secret :
les valeurs secrètes se renseignent sur le serveur, dans le fichier `.env`, jamais dans
le dépôt.

## Ce qu'il faut sur le serveur

- Node.js 22 et PostgreSQL 16, sur une machine et une base propres à la plateforme.
- Un nom de domaine en HTTPS, par exemple un sous-domaine du groupe.
- Un serveur frontal (nginx ou équivalent) qui sert l'interface et transmet `/api` au
  serveur Node.
- Un compte d'envoi de courriels (SMTP) depuis un domaine du groupe, correctement
  authentifié (SPF, DKIM), pour que les codes de connexion n'arrivent pas en indésirables.
- Une sauvegarde quotidienne de la base, avec un essai de restauration régulier.

## Installation

```bash
git clone <dépôt> plateforme && cd plateforme/back-end
npm ci
cp .env.example .env
# Renseigner dans .env :
#   NODE_ENV=production
#   DATABASE_URL=postgresql://…
#   CLE_SECRETE=<au moins 32 caractères aléatoires, propres à ce serveur>
#   URL_APPLICATION=https://<adresse publique>
#   ORIGINES_AUTORISEES=https://<adresse publique>
#   CONFIANCE_PROXY=true
#   COURRIEL_EXPEDITEUR, SMTP_HOTE, SMTP_PORT, SMTP_SECURISE, SMTP_UTILISATEUR, SMTP_MOT_DE_PASSE
npx prisma generate
npx prisma migrate deploy
npm run build
npm run initialiser -- --email <adresse du premier super administrateur> --prenom <Prénom> --nom <Nom>
npm run start:prod            # à lancer comme service (systemd, pm2…)

cd ../front-end
npm ci
npx ng build                  # produit front-end/dist/front-end/browser
```

Le script d'initialisation crée les entités du groupe et le premier super
administrateur, qui reçoit par courriel le lien pour choisir son mot de passe. Il ne
crée rien deux fois si on le relance.

En production, le serveur refuse de démarrer sans `CLE_SECRETE` d'au moins 32
caractères, sans `URL_APPLICATION` ou sans serveur d'envoi de courriels.

## Vérification de la migration

La première migration a été écrite à la main, le moteur de migration de Prisma n'étant
pas joignable depuis l'environnement où elle a été préparée. Sur un poste qui y a accès,
vérifier qu'elle correspond exactement au schéma :

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script
```

La commande ne doit rien proposer. Si elle propose un changement, le signaler avant la
mise en service.

## Serveur frontal

- Servir `front-end/dist/front-end/browser` ; toute adresse inconnue renvoie
  `index.html` (application d'une seule page).
- Transmettre `/api/` au serveur Node (port 3000 par défaut), avec les en-têtes
  `X-Forwarded-For` et `X-Forwarded-Proto`.
- HTTPS obligatoire : le cookie de session n'est envoyé qu'en HTTPS en production.

## Mise à jour

```bash
git pull
cd back-end && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
cd ../front-end && npm ci && npx ng build
# puis redémarrer le service Node
```

Seule la branche `main` est mise en service, et seulement si tous les tests passent.
