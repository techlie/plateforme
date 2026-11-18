-- Décisions du 18 novembre 2026 : motifs et poids des annulations, arbitrage en pourcentage
-- de l'encours du contrat, relances rapprochées, appareils reconnus, conventions jointes.

-- AlterEnum
ALTER TYPE "CategorieDocument" ADD VALUE 'CONVENTION';

-- CreateEnum
CREATE TYPE "ImputabiliteMotif" AS ENUM ('IMPUTABLE', 'NON_IMPUTABLE', 'AU_CHOIX', 'SELON_DELAI');

-- AlterTable : l'imputabilité devient un choix parmi quatre ; les motifs déjà imputables le restent.
ALTER TABLE "motifs" ADD COLUMN     "imputabilite" "ImputabiliteMotif" NOT NULL DEFAULT 'NON_IMPUTABLE';
UPDATE "motifs" SET "imputabilite" = 'IMPUTABLE' WHERE "imputable" = true;
ALTER TABLE "motifs" DROP COLUMN "imputable";

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "annulationImputable" BOOLEAN,
ADD COLUMN     "poidsAnnulation" INTEGER;

-- AlterTable
ALTER TABLE "lignes_fonds" ADD COLUMN     "pourcentage" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "parametres_enveloppes" ADD COLUMN     "relancesRapprocheesJours" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "emailingJourRapproche" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "alerteBackOfficeJours" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "ancienneteAnnulationJours" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "poidsAnnulationAggravee" INTEGER NOT NULL DEFAULT 2;

-- Décision du 18 novembre : annulation tardive dans les 20 derniers jours (15 auparavant) ;
-- le taux des clients confiés suit la convention du mandataire.
UPDATE "parametres_enveloppes" SET "delaiAnnulationTardiveJours" = 20 WHERE "delaiAnnulationTardiveJours" = 15;
UPDATE "parametres_enveloppes" SET "tauxClientsConfiesAConfirmer" = false;

-- Décision du 18 novembre : un refus de la compagnie s'apprécie au cas par cas, par le back-office.
UPDATE "motifs" SET "imputabilite" = 'AU_CHOIX', "commentaireObligatoire" = true WHERE "categorie" = 'ANNULATION' AND "libelle" = 'Arbitrage refusé par la compagnie';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "conventionId" UUID;

-- CreateTable
CREATE TABLE "appareils_reconnus" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "empreinte" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "navigateur" TEXT,
    "derniereUtilisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoqueLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appareils_reconnus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conventions" (
    "id" UUID NOT NULL,
    "apporteurId" UUID NOT NULL,
    "dateEffet" DATE NOT NULL,
    "tauxClientsConfies" DECIMAL(9,6),
    "commentaire" TEXT,
    "auteurId" UUID,
    "auteur" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conventions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appareils_reconnus_empreinte_key" ON "appareils_reconnus"("empreinte");

-- CreateIndex
CREATE INDEX "appareils_reconnus_userId_idx" ON "appareils_reconnus"("userId");

-- CreateIndex
CREATE INDEX "conventions_apporteurId_idx" ON "conventions"("apporteurId");

-- AddForeignKey
ALTER TABLE "appareils_reconnus" ADD CONSTRAINT "appareils_reconnus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conventions" ADD CONSTRAINT "conventions_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "apporteurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "documents_conventionId_key" ON "documents"("conventionId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "conventions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
