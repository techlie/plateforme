-- CreateEnum
CREATE TYPE "NatureCodeApporteur" AS ENUM ('PROPRE', 'PARTENARIAT', 'ENTITE');

-- CreateEnum
CREATE TYPE "RoleApporteur" AS ENUM ('MANDATAIRE', 'ASSOCIE', 'SALARIE');

-- CreateEnum
CREATE TYPE "OrigineFonds" AS ENUM ('IMPORT', 'SAISIE');

-- CreateEnum
CREATE TYPE "StatutEnveloppe" AS ENUM ('EN_PREPARATION', 'OUVERTE', 'FERMEE', 'CLOTUREE', 'ANNULEE', 'REPORTEE');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('RALLONGE', 'RESTITUTION');

-- CreateEnum
CREATE TYPE "TypeOperation" AS ENUM ('ARBITRAGE', 'VERSEMENT_LIBRE', 'AFFAIRE_NOUVELLE');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('PHYSIQUE', 'MORALE');

-- CreateEnum
CREATE TYPE "OrigineClient" AS ENUM ('MANDATAIRE', 'CONFIE');

-- CreateEnum
CREATE TYPE "SourceReservation" AS ENUM ('ENVELOPPE', 'RESERVATION_GLOBALE');

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('SOUMISE', 'LISTE_ATTENTE', 'RENVOYEE', 'REFUSEE', 'VALIDEE', 'OPERATION_PASSEE', 'VERIFIEE', 'ECART_A_JUSTIFIER', 'ECHUE', 'LIBEREE', 'ANNULEE', 'ANNULEE_APRES_OPERATION');

-- CreateEnum
CREATE TYPE "ModeArbitrage" AS ENUM ('GLOBAL', 'PAR_FONDS');

-- CreateEnum
CREATE TYPE "ModeOperation" AS ENUM ('DEMATERIALISE', 'PAPIER');

-- CreateEnum
CREATE TYPE "CategorieMotif" AS ENUM ('REFUS', 'RENVOI', 'ANNULATION', 'ECART');

-- CreateEnum
CREATE TYPE "StatutReservationGlobale" AS ENUM ('ACTIVE', 'ECHUE', 'SOLDEE');

-- CreateEnum
CREATE TYPE "StatutClientConfie" AS ENUM ('CONFIE', 'ACCEPTE', 'RETIRE');

-- CreateEnum
CREATE TYPE "CategorieDocument" AS ENUM ('DOCUMENTATION_TECHNIQUE', 'AVENANT_COMPAGNIE', 'FICHE_PRODUIT', 'AVENANT_VIERGE', 'PREUVE_VERIFICATION', 'JUSTIFICATIF_OPERATION');

-- CreateTable
CREATE TABLE "compagnies" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "formatNumeroContrat" TEXT,
    "exempleNumeroContrat" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compagnies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gammes" (
    "id" UUID NOT NULL,
    "compagnieId" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gammes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apporteurs" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT,
    "role" "RoleApporteur" NOT NULL,
    "entiteId" UUID,
    "userId" UUID,
    "restreint" BOOLEAN NOT NULL DEFAULT false,
    "habiliteReservationGlobale" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apporteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codes_apporteur" (
    "id" UUID NOT NULL,
    "compagnieId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "nature" "NatureCodeApporteur" NOT NULL,
    "dateDebut" DATE,
    "dateFin" DATE,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codes_apporteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codes_apporteur_autorises" (
    "id" UUID NOT NULL,
    "codeId" UUID NOT NULL,
    "apporteurId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codes_apporteur_autorises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fonds" (
    "id" UUID NOT NULL,
    "compagnieId" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "isin" TEXT,
    "cle" TEXT NOT NULL,
    "ouvert" BOOLEAN NOT NULL DEFAULT true,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFermeture" TIMESTAMP(3),
    "origine" "OrigineFonds" NOT NULL,
    "anciensNoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fonds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres_enveloppes" (
    "id" UUID NOT NULL,
    "delaiHonorerJours" INTEGER,
    "rappelAvantEcheanceJours" INTEGER,
    "seuilEcart" DECIMAL(9,6) NOT NULL,
    "seuilEstimationArbitrage" DECIMAL(9,6) NOT NULL,
    "delaiAnnulationTardiveJours" INTEGER NOT NULL,
    "tauxClientsConfiesDefaut" DECIMAL(9,6) NOT NULL,
    "tauxClientsConfiesAConfirmer" BOOLEAN NOT NULL DEFAULT true,
    "seuilConcentrationDefaut" DECIMAL(9,6) NOT NULL,
    "compteAReboursJours" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "seuilsRemplissage" DECIMAL(9,6)[],
    "seuilsReelValide" DECIMAL(9,6)[],
    "emailingJour" INTEGER NOT NULL,
    "emailingHeure" TEXT NOT NULL,
    "emailingValideLe" TIMESTAMP(3),
    "emailingValidePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametres_enveloppes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motifs" (
    "id" UUID NOT NULL,
    "categorie" "CategorieMotif" NOT NULL,
    "libelle" TEXT NOT NULL,
    "imputable" BOOLEAN NOT NULL DEFAULT false,
    "commentaireObligatoire" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enveloppes" (
    "id" UUID NOT NULL,
    "compagnieId" UUID NOT NULL,
    "nomProduit" TEXT NOT NULL,
    "isin" TEXT,
    "montantInitial" DECIMAL(14,2) NOT NULL,
    "dateOuverture" DATE NOT NULL,
    "dateLimiteInterne" DATE NOT NULL,
    "dateFinCommercialisation" DATE NOT NULL,
    "dateClotureProduit" DATE NOT NULL,
    "tauxCommission" DECIMAL(9,6) NOT NULL,
    "tauxClientsConfies" DECIMAL(9,6) NOT NULL,
    "rendement" TEXT,
    "seuilConcentration" DECIMAL(9,6),
    "montantMinimum" DECIMAL(14,2) NOT NULL,
    "controlePatrimoine" BOOLEAN NOT NULL DEFAULT false,
    "statut" "StatutEnveloppe" NOT NULL DEFAULT 'EN_PREPARATION',
    "upfrontReel" DECIMAL(9,6),
    "alertesEnvoyees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fermeeLe" TIMESTAMP(3),
    "clotureeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enveloppes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enveloppes_gammes_exclues" (
    "id" UUID NOT NULL,
    "enveloppeId" UUID NOT NULL,
    "gammeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enveloppes_gammes_exclues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_enveloppes" (
    "id" UUID NOT NULL,
    "enveloppeId" UUID NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "motif" TEXT NOT NULL,
    "auteurId" UUID,
    "auteur" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mouvements_enveloppes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations_globales" (
    "id" UUID NOT NULL,
    "enveloppeId" UUID NOT NULL,
    "apporteurId" UUID NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "montantLibere" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "motif" TEXT NOT NULL,
    "echeance" DATE NOT NULL,
    "statut" "StatutReservationGlobale" NOT NULL DEFAULT 'ACTIVE',
    "auteurId" UUID,
    "auteur" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_globales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "enveloppeId" UUID NOT NULL,
    "apporteurId" UUID NOT NULL,
    "entiteId" UUID,
    "codeApporteurId" UUID,
    "gammeId" UUID,
    "typeOperation" "TypeOperation" NOT NULL,
    "typeClient" "TypeClient" NOT NULL,
    "clientNom" TEXT NOT NULL,
    "clientPrenom" TEXT,
    "cleClient" TEXT NOT NULL,
    "numeroContrat" TEXT,
    "numeroDemande" TEXT,
    "montantBrut" DECIMAL(14,2) NOT NULL,
    "tauxFrais" DECIMAL(9,6) NOT NULL,
    "montantNet" DECIMAL(14,2) NOT NULL,
    "clientPrevendu" BOOLEAN NOT NULL,
    "encoursClient" DECIMAL(14,2),
    "origineClient" "OrigineClient" NOT NULL DEFAULT 'MANDATAIRE',
    "clientConfieId" UUID,
    "source" "SourceReservation" NOT NULL DEFAULT 'ENVELOPPE',
    "reservationGlobaleId" UUID,
    "statut" "StatutReservation" NOT NULL,
    "echeance" DATE,
    "tauxCommission" DECIMAL(9,6) NOT NULL,
    "tauxFigeLe" TIMESTAMP(3),
    "accordAdministrateur" BOOLEAN NOT NULL DEFAULT false,
    "modeArbitrage" "ModeArbitrage",
    "pourcentageArbitrage" DECIMAL(9,6),
    "valeurContrat" DECIMAL(14,2),
    "accordClientLe" TIMESTAMP(3),
    "avenantVersion" INTEGER NOT NULL DEFAULT 0,
    "patrimoineAJour" BOOLEAN NOT NULL DEFAULT false,
    "datePatrimoine" DATE,
    "dateOperation" DATE,
    "modeOperation" "ModeOperation",
    "operationDeclareeLe" TIMESTAMP(3),
    "montantValide" DECIMAL(14,2),
    "dateValidationCompagnie" DATE,
    "verifieeLe" TIMESTAMP(3),
    "motifEcartId" UUID,
    "commentaireEcart" TEXT,
    "motifId" UUID,
    "commentaireMotif" TEXT,
    "valideeLe" TIMESTAMP(3),
    "annuleeLe" TIMESTAMP(3),
    "annulationTardive" BOOLEAN,
    "signalements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "derogations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relancesEnvoyees" INTEGER NOT NULL DEFAULT 0,
    "derniereRelanceLe" TIMESTAMP(3),
    "rappelEcheanceEnvoye" BOOLEAN NOT NULL DEFAULT false,
    "creeParId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_fonds" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "fondsId" UUID,
    "nom" TEXT NOT NULL,
    "isin" TEXT,
    "montant" DECIMAL(14,2) NOT NULL,
    "horsReferentiel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lignes_fonds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historiques_reservations" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "deStatut" "StatutReservation",
    "versStatut" "StatutReservation",
    "auteurId" UUID,
    "auteur" TEXT NOT NULL,
    "commentaire" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historiques_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients_confies" (
    "id" UUID NOT NULL,
    "enveloppeId" UUID NOT NULL,
    "apporteurId" UUID NOT NULL,
    "typeClient" "TypeClient" NOT NULL,
    "clientNom" TEXT NOT NULL,
    "clientPrenom" TEXT,
    "numeroContrat" TEXT,
    "taux" DECIMAL(9,6) NOT NULL,
    "statut" "StatutClientConfie" NOT NULL DEFAULT 'CONFIE',
    "auteurId" UUID,
    "auteur" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_confies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "categorie" "CategorieDocument" NOT NULL,
    "nom" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "fichier" TEXT NOT NULL,
    "empreinte" TEXT NOT NULL,
    "enveloppeId" UUID,
    "reservationId" UUID,
    "auteurId" UUID,
    "auteur" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envois_emailing" (
    "id" UUID NOT NULL,
    "enveloppeId" UUID NOT NULL,
    "semaine" TEXT NOT NULL,
    "destinataires" TEXT[],
    "objet" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "bloque" BOOLEAN NOT NULL DEFAULT false,
    "raisonBlocage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envois_emailing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compagnies_nom_key" ON "compagnies"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "gammes_compagnieId_nom_key" ON "gammes"("compagnieId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "apporteurs_userId_key" ON "apporteurs"("userId");

-- CreateIndex
CREATE INDEX "apporteurs_entiteId_idx" ON "apporteurs"("entiteId");

-- CreateIndex
CREATE UNIQUE INDEX "codes_apporteur_compagnieId_code_key" ON "codes_apporteur"("compagnieId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "codes_apporteur_autorises_codeId_apporteurId_key" ON "codes_apporteur_autorises"("codeId", "apporteurId");

-- CreateIndex
CREATE INDEX "codes_apporteur_autorises_apporteurId_idx" ON "codes_apporteur_autorises"("apporteurId");

-- CreateIndex
CREATE UNIQUE INDEX "fonds_compagnieId_cle_key" ON "fonds"("compagnieId", "cle");

-- CreateIndex
CREATE UNIQUE INDEX "motifs_categorie_libelle_key" ON "motifs"("categorie", "libelle");

-- CreateIndex
CREATE INDEX "enveloppes_compagnieId_idx" ON "enveloppes"("compagnieId");

-- CreateIndex
CREATE UNIQUE INDEX "enveloppes_gammes_exclues_enveloppeId_gammeId_key" ON "enveloppes_gammes_exclues"("enveloppeId", "gammeId");

-- CreateIndex
CREATE INDEX "mouvements_enveloppes_enveloppeId_idx" ON "mouvements_enveloppes"("enveloppeId");

-- CreateIndex
CREATE INDEX "reservations_globales_enveloppeId_idx" ON "reservations_globales"("enveloppeId");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_numero_key" ON "reservations"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_clientConfieId_key" ON "reservations"("clientConfieId");

-- CreateIndex
CREATE INDEX "reservations_enveloppeId_statut_idx" ON "reservations"("enveloppeId", "statut");

-- CreateIndex
CREATE INDEX "reservations_apporteurId_idx" ON "reservations"("apporteurId");

-- CreateIndex
CREATE INDEX "reservations_cleClient_idx" ON "reservations"("cleClient");

-- CreateIndex
CREATE INDEX "lignes_fonds_reservationId_idx" ON "lignes_fonds"("reservationId");

-- CreateIndex
CREATE INDEX "historiques_reservations_reservationId_idx" ON "historiques_reservations"("reservationId");

-- CreateIndex
CREATE INDEX "clients_confies_enveloppeId_idx" ON "clients_confies"("enveloppeId");

-- CreateIndex
CREATE INDEX "clients_confies_apporteurId_idx" ON "clients_confies"("apporteurId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_fichier_key" ON "documents"("fichier");

-- CreateIndex
CREATE INDEX "documents_enveloppeId_idx" ON "documents"("enveloppeId");

-- CreateIndex
CREATE INDEX "documents_reservationId_idx" ON "documents"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "envois_emailing_enveloppeId_semaine_bloque_key" ON "envois_emailing"("enveloppeId", "semaine", "bloque");

-- AddForeignKey
ALTER TABLE "gammes" ADD CONSTRAINT "gammes_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "compagnies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apporteurs" ADD CONSTRAINT "apporteurs_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apporteurs" ADD CONSTRAINT "apporteurs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codes_apporteur" ADD CONSTRAINT "codes_apporteur_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "compagnies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codes_apporteur_autorises" ADD CONSTRAINT "codes_apporteur_autorises_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "codes_apporteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codes_apporteur_autorises" ADD CONSTRAINT "codes_apporteur_autorises_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "apporteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fonds" ADD CONSTRAINT "fonds_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "compagnies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enveloppes" ADD CONSTRAINT "enveloppes_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "compagnies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enveloppes_gammes_exclues" ADD CONSTRAINT "enveloppes_gammes_exclues_enveloppeId_fkey" FOREIGN KEY ("enveloppeId") REFERENCES "enveloppes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enveloppes_gammes_exclues" ADD CONSTRAINT "enveloppes_gammes_exclues_gammeId_fkey" FOREIGN KEY ("gammeId") REFERENCES "gammes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_enveloppes" ADD CONSTRAINT "mouvements_enveloppes_enveloppeId_fkey" FOREIGN KEY ("enveloppeId") REFERENCES "enveloppes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations_globales" ADD CONSTRAINT "reservations_globales_enveloppeId_fkey" FOREIGN KEY ("enveloppeId") REFERENCES "enveloppes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations_globales" ADD CONSTRAINT "reservations_globales_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "apporteurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_enveloppeId_fkey" FOREIGN KEY ("enveloppeId") REFERENCES "enveloppes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "apporteurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "entites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_codeApporteurId_fkey" FOREIGN KEY ("codeApporteurId") REFERENCES "codes_apporteur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_gammeId_fkey" FOREIGN KEY ("gammeId") REFERENCES "gammes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_clientConfieId_fkey" FOREIGN KEY ("clientConfieId") REFERENCES "clients_confies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reservationGlobaleId_fkey" FOREIGN KEY ("reservationGlobaleId") REFERENCES "reservations_globales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_motifEcartId_fkey" FOREIGN KEY ("motifEcartId") REFERENCES "motifs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_motifId_fkey" FOREIGN KEY ("motifId") REFERENCES "motifs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_fonds" ADD CONSTRAINT "lignes_fonds_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_fonds" ADD CONSTRAINT "lignes_fonds_fondsId_fkey" FOREIGN KEY ("fondsId") REFERENCES "fonds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiques_reservations" ADD CONSTRAINT "historiques_reservations_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients_confies" ADD CONSTRAINT "clients_confies_enveloppeId_fkey" FOREIGN KEY ("enveloppeId") REFERENCES "enveloppes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients_confies" ADD CONSTRAINT "clients_confies_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "apporteurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_enveloppeId_fkey" FOREIGN KEY ("enveloppeId") REFERENCES "enveloppes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envois_emailing" ADD CONSTRAINT "envois_emailing_enveloppeId_fkey" FOREIGN KEY ("enveloppeId") REFERENCES "enveloppes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

