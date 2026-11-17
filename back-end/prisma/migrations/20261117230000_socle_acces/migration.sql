-- CreateEnum
CREATE TYPE "Profil" AS ENUM ('SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR', 'BACK_OFFICE', 'MANDATAIRE', 'GESTIONNAIRE_PORTEFEUILLE');

-- CreateEnum
CREATE TYPE "ModulePlateforme" AS ENUM ('SIMULATEUR', 'ENVELOPPES', 'AFFAIRES', 'BORDEREAU', 'SYNTHESE_CONTRATS');

-- CreateEnum
CREATE TYPE "MotifJeton" AS ENUM ('ACTIVATION', 'REINITIALISATION');

-- CreateEnum
CREATE TYPE "StatutJournal" AS ENUM ('SUCCES', 'ECHEC');

-- CreateTable
CREATE TABLE "entites" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "orias" TEXT,
    "membreSofraco" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "profil" "Profil" NOT NULL,
    "motDePasse" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "entiteId" UUID,
    "echecsConnexion" INTEGER NOT NULL DEFAULT 0,
    "bloqueJusqua" TIMESTAMP(3),
    "derniereConnexion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules_utilisateurs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "module" "ModulePlateforme" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codes_connexion" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "empreinte" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "utiliseLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codes_connexion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "empreinteJeton" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "derniereActivite" TIMESTAMP(3) NOT NULL,
    "revoqueeLe" TIMESTAMP(3),
    "adresseIp" TEXT,
    "navigateur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jetons_mot_de_passe" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "empreinte" TEXT NOT NULL,
    "motif" "MotifJeton" NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "utiliseLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jetons_mot_de_passe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" "StatutJournal" NOT NULL,
    "userId" UUID,
    "auteur" TEXT,
    "cible" TEXT,
    "details" JSONB,
    "adresseIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entites_nom_key" ON "entites"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_entiteId_idx" ON "users"("entiteId");

-- CreateIndex
CREATE UNIQUE INDEX "modules_utilisateurs_userId_module_key" ON "modules_utilisateurs"("userId", "module");

-- CreateIndex
CREATE INDEX "codes_connexion_userId_idx" ON "codes_connexion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_empreinteJeton_key" ON "sessions"("empreinteJeton");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "jetons_mot_de_passe_empreinte_key" ON "jetons_mot_de_passe"("empreinte");

-- CreateIndex
CREATE INDEX "jetons_mot_de_passe_userId_idx" ON "jetons_mot_de_passe"("userId");

-- CreateIndex
CREATE INDEX "logs_date_idx" ON "logs"("date");

-- CreateIndex
CREATE INDEX "logs_userId_idx" ON "logs"("userId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules_utilisateurs" ADD CONSTRAINT "modules_utilisateurs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codes_connexion" ADD CONSTRAINT "codes_connexion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jetons_mot_de_passe" ADD CONSTRAINT "jetons_mot_de_passe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
