/**
 * Tests de bout en bout du module Enveloppes, sur une vraie base PostgreSQL de test.
 * Compagnie, produit, personnes, clients et contrats sont inventés.
 */
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { MOTIFS_INITIAUX, PARAMETRES_INITIAUX } from '../src/modules/enveloppes/parametres-initiaux';
import { PlanificateurService } from '../src/modules/enveloppes/planificateur.service';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ajouterJours, dateParis } from '../src/shared/regles/dates';
import { BoiteDeTest, demarrer, seConnecter } from './outils';

const MDP = 'une phrase de passe assez longue';
const SA = 'sa.enveloppes@exemple.fr';
const ADMIN = 'admin.enveloppes@exemple.fr';
const BO = 'bo.enveloppes@exemple.fr';
const M1 = 'm1.enveloppes@exemple.fr';
const M2 = 'm2.enveloppes@exemple.fr';
const M3 = 'm3.enveloppes@exemple.fr';

const aujourdHui = dateParis(new Date());

describe('Module Enveloppes (bout en bout)', () => {
  let app: INestApplication;
  let boite: BoiteDeTest;
  let prisma: PrismaService;
  const c: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const get = (qui: string, url: string) => http().get(`/api${url}`).set('Cookie', c[qui]);
  const post = (qui: string, url: string, corps: object = {}) => http().post(`/api${url}`).set('Cookie', c[qui]).send(corps);
  const patch = (qui: string, url: string, corps: object) => http().patch(`/api${url}`).set('Cookie', c[qui]).send(corps);
  const put = (qui: string, url: string, corps: object) => http().put(`/api${url}`).set('Cookie', c[qui]).send(corps);

  function reservation(modif: Record<string, unknown> = {}) {
    return {
      enveloppeId: ids.enveloppe,
      typeOperation: 'VERSEMENT_LIBRE',
      typeClient: 'PHYSIQUE',
      clientNom: 'Durand',
      clientPrenom: 'Élodie',
      numeroContrat: '1234 5678',
      montantBrut: '20000',
      tauxFrais: '0.01',
      clientPrevendu: true,
      encoursClient: '400000',
      gammeId: ids.gammeA,
      codeApporteurId: ids.codeM1,
      ...modif,
    };
  }

  beforeAll(async () => {
    ({ app, boite } = await demarrer());
    prisma = app.get(PrismaService);
    await prisma.parametresEnveloppes.create({ data: PARAMETRES_INITIAUX });
    for (const motif of MOTIFS_INITIAUX) await prisma.motif.create({ data: motif });
    ids.refus = (await prisma.motif.create({ data: { categorie: 'REFUS', libelle: 'Hors cible' } })).id;
    ids.annulationImputable = (await prisma.motif.create({ data: { categorie: 'ANNULATION', libelle: 'Client renonce', imputable: true } })).id;
    ids.annulationCompagnie = (await prisma.motif.findFirstOrThrow({ where: { categorie: 'ANNULATION', libelle: 'Arbitrage refusé par la compagnie' } })).id;
    ids.ecartValorisation = (await prisma.motif.findFirstOrThrow({ where: { categorie: 'ECART', libelle: 'Valorisation au jour de l’opération' } })).id;
    ids.renvoi = (await prisma.motif.findFirstOrThrow({ where: { categorie: 'RENVOI', libelle: 'Client à prévendre' } })).id;

    const entite = await prisma.entite.create({ data: { nom: 'Cabinet Essai Enveloppes' } });
    ids.entite = entite.id;
    const empreinte = await bcrypt.hash(MDP, 4);
    const comptes: [string, string, string, 'SUPER_ADMINISTRATEUR' | 'ADMINISTRATEUR' | 'BACK_OFFICE' | 'MANDATAIRE', boolean][] = [
      ['SA', SA, 'Sarah', 'SUPER_ADMINISTRATEUR', true],
      ['ADMIN', ADMIN, 'Adam', 'ADMINISTRATEUR', true],
      ['BO', BO, 'Bérénice', 'BACK_OFFICE', true],
      ['M1', M1, 'Marc', 'MANDATAIRE', true],
      ['M2', M2, 'Maud', 'MANDATAIRE', true],
      ['M3', M3, 'Mila', 'MANDATAIRE', false],
    ];
    for (const [cle, email, prenom, profil, module] of comptes) {
      const u = await prisma.user.create({
        data: { email, nom: 'Essai', prenom, profil, motDePasse: empreinte, entiteId: entite.id, modules: module ? { create: [{ module: 'ENVELOPPES' }] } : undefined },
      });
      ids[`user${cle}`] = u.id;
      c[cle] = await seConnecter(app, boite, email, MDP);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('réserve les référentiels aux administrateurs et contrôle les fonds importés', async () => {
    await post('M1', '/referentiels/compagnies', { nom: 'Compagnie Essai' }).expect(403);
    await post('BO', '/referentiels/compagnies', { nom: 'Compagnie Essai' }).expect(403);
    await post('ADMIN', '/referentiels/compagnies', { nom: 'Compagnie Essai', formatNumeroContrat: '99?99' }).expect(400);
    const compagnie = await post('ADMIN', '/referentiels/compagnies', { nom: 'Compagnie Essai', formatNumeroContrat: '99999999', exempleNumeroContrat: '12345678' }).expect(201);
    ids.compagnie = compagnie.body.id;
    ids.gammeA = (await post('ADMIN', `/referentiels/compagnies/${ids.compagnie}/gammes`, { nom: 'Gamme A' }).expect(201)).body.id;
    ids.gammeAncienne = (await post('ADMIN', `/referentiels/compagnies/${ids.compagnie}/gammes`, { nom: 'Gamme ancienne' }).expect(201)).body.id;

    const a1 = await post('ADMIN', '/referentiels/apporteurs', { nom: 'Essai', prenom: 'Marc', role: 'MANDATAIRE', entiteId: ids.entite, userId: ids.userM1 }).expect(201);
    const a2 = await post('ADMIN', '/referentiels/apporteurs', { nom: 'Essai', prenom: 'Maud', role: 'MANDATAIRE', entiteId: ids.entite, userId: ids.userM2 }).expect(201);
    const aSa = await post('ADMIN', '/referentiels/apporteurs', { nom: 'Essai', prenom: 'Sarah', role: 'ASSOCIE', entiteId: ids.entite, userId: ids.userSA, habiliteReservationGlobale: true }).expect(201);
    ids.a1 = a1.body.id;
    ids.a2 = a2.body.id;
    ids.aSa = aSa.body.id;
    await post('ADMIN', '/referentiels/apporteurs', { nom: 'X', prenom: 'Y', role: 'MANDATAIRE', userId: ids.userM1 }).expect(409);

    ids.codeM1 = (await post('ADMIN', '/referentiels/codes', { compagnieId: ids.compagnie, code: 'C-001', nature: 'PROPRE', apporteurIds: [ids.a1] }).expect(201)).body.id;
    ids.codeM2 = (await post('ADMIN', '/referentiels/codes', { compagnieId: ids.compagnie, code: 'C-002', nature: 'PROPRE', apporteurIds: [ids.a2] }).expect(201)).body.id;
    ids.codeSa = (await post('ADMIN', '/referentiels/codes', { compagnieId: ids.compagnie, code: 'C-SA', nature: 'PROPRE', apporteurIds: [ids.aSa] }).expect(201)).body.id;

    const csv = 'Nom du fonds;Code ISIN\nFonds Alpha;US0378331005\nMandat Prudent;\n';
    const apercu = await post('ADMIN', '/referentiels/fonds/import', { compagnieId: ids.compagnie, contenu: csv, appliquer: false }).expect(201);
    expect(apercu.body.ajouts).toHaveLength(2);
    expect(await prisma.fonds.count()).toBe(0);
    await post('ADMIN', '/referentiels/fonds/import', { compagnieId: ids.compagnie, contenu: 'Fonds Faux;US0378331006', appliquer: true }).expect(400);
    await post('ADMIN', '/referentiels/fonds/import', { compagnieId: ids.compagnie, contenu: csv, appliquer: true }).expect(201);
    // Une nouvelle liste sans « Mandat Prudent » le ferme, sans le supprimer.
    const second = await post('ADMIN', '/referentiels/fonds/import', { compagnieId: ids.compagnie, contenu: 'Fonds Alpha (C);US0378331005', appliquer: true }).expect(201);
    expect(second.body.fermetures).toEqual([expect.objectContaining({ nom: 'Mandat Prudent' })]);
    const fonds = await get('M1', `/referentiels/fonds?compagnie=${ids.compagnie}`).expect(200);
    expect(fonds.body.map((f: { nom: string; ouvert: boolean }) => [f.nom, f.ouvert])).toEqual([
      ['Fonds Alpha (C)', true],
      ['Mandat Prudent', false],
    ]);
    ids.fondsAlpha = fonds.body[0].id;
  });

  it('crée et ouvre une enveloppe : back-office et administrateurs, dates dans l’ordre', async () => {
    const enveloppe = {
      compagnieId: ids.compagnie,
      nomProduit: 'Produit Essai Décembre',
      isin: 'GB0002634946',
      montantInitial: '100000',
      dateOuverture: aujourdHui,
      dateLimiteInterne: ajouterJours(aujourdHui, 40),
      dateFinCommercialisation: ajouterJours(aujourdHui, 45),
      dateClotureProduit: ajouterJours(aujourdHui, 50),
      tauxCommission: '0.02',
      tauxClientsConfies: '0.005',
      seuilConcentration: '0.15',
      montantMinimum: '1500',
      gammesExclues: [ids.gammeAncienne],
    };
    await post('M1', '/enveloppes', enveloppe).expect(403);
    await post('BO', '/enveloppes', { ...enveloppe, dateLimiteInterne: ajouterJours(aujourdHui, 46) }).expect(400);
    await post('BO', '/enveloppes', { ...enveloppe, isin: 'GB0002634947' }).expect(400);
    const creee = await post('BO', '/enveloppes', enveloppe).expect(201);
    ids.enveloppe = creee.body.id;
    expect(creee.body.statut).toBe('EN_PREPARATION');
    // Invisible du mandataire tant qu'elle n'est pas ouverte.
    expect((await get('M1', '/enveloppes').expect(200)).body).toHaveLength(0);
    await post('BO', `/enveloppes/${ids.enveloppe}/ouverture`).expect(201);
  });

  it('montre au mandataire l’enveloppe restante, jamais le réel ni l’upfront ; module requis', async () => {
    await put('BO', `/enveloppes/${ids.enveloppe}/upfront`, { taux: '0.04' }).expect(403);
    await put('SA', `/enveloppes/${ids.enveloppe}/upfront`, { taux: '0.04' }).expect(200);
    const vueSa = await get('SA', `/enveloppes/${ids.enveloppe}`).expect(200);
    expect(vueSa.body.upfrontReel).toBe('0.04');
    const vueAdmin = await get('ADMIN', `/enveloppes/${ids.enveloppe}`).expect(200);
    expect(vueAdmin.body).not.toHaveProperty('upfrontReel');
    expect(vueAdmin.body.compteurs).toMatchObject({ enveloppeTotale: '100000.00', restante: '100000.00', reelValide: '0.00' });

    const liste = await get('M1', '/enveloppes').expect(200);
    expect(liste.body).toHaveLength(1);
    expect(liste.body[0].compteurs).toEqual({ enveloppeTotale: '100000.00', restante: '100000.00', tauxRemplissage: '0', depassement: '0.00' });
    expect(liste.body[0]).not.toHaveProperty('upfrontReel');
    expect(JSON.stringify(liste.body)).not.toContain('0.04');
    await get('M3', '/enveloppes').expect(403);
  });

  it('affiche avant l’envoi le net, la commission et l’enveloppe restante après la demande', async () => {
    const apercu = await post('M1', '/reservations/apercu', reservation({ encoursClient: '100000' })).expect(201);
    expect(apercu.body).toMatchObject({
      montantNet: '19800.00',
      commissionEstimee: '396.00',
      restanteAvant: '100000.00',
      restanteApres: '80200.00',
      bloquants: [],
      derogeables: [],
    });
    expect(apercu.body.alertes.map((a: { code: string }) => a.code)).toEqual(['CONCENTRATION']);
  });

  it('applique les contrôles bloquants de la saisie', async () => {
    const codes = async (corps: object) => (await post('M1', '/reservations', corps).expect(422)).body;
    expect((await codes(reservation({ numeroContrat: '' }))).bloquants[0].code).toBe('CONTRAT_ABSENT');
    expect((await codes(reservation({ gammeId: ids.gammeAncienne }))).bloquants[0].code).toBe('GAMME_EXCLUE');
    expect((await codes(reservation({ montantBrut: '1500' }))).bloquants[0].code).toBe('MINIMUM');
    expect((await codes(reservation({ codeApporteurId: ids.codeSa }))).bloquants[0].code).toBe('CODE_APPORTEUR');
    // Hors format : le mandataire ne peut pas déroger.
    const format = await codes(reservation({ numeroContrat: '123' }));
    expect(format.derogeables[0].code).toBe('FORMAT_CONTRAT');
    await post('M1', '/reservations', reservation({ numeroContrat: '123', derogations: [{ code: 'FORMAT_CONTRAT', motif: 'Contrat ancien' }] })).expect(403);
    // Arbitrage fonds par fonds : le total doit égaler le montant réservé.
    const fonds = await codes(reservation({ typeOperation: 'ARBITRAGE', modeArbitrage: 'PAR_FONDS', fonds: [{ fondsId: ids.fondsAlpha, nom: 'Fonds Alpha (C)', montant: '10000' }] }));
    expect(fonds.bloquants[0].code).toBe('FONDS_TOTAL');
    await post('M1', '/reservations', reservation({ typeOperation: 'ARBITRAGE', modeArbitrage: 'PAR_FONDS', fonds: [{ nom: 'Libre', isin: 'US0378331006', montant: '19800' }] })).expect(400);
    expect(await prisma.reservation.count()).toBe(0);
  });

  it('enregistre une réservation, prévient le mandataire et le back-office, et bloque le doublon', async () => {
    boite.vider();
    const r = await post('M1', '/reservations', reservation()).expect(201);
    ids.r1 = r.body.id;
    expect(r.body).toMatchObject({ statut: 'SOUMISE', montantNet: '19800.00', numeroContrat: '12345678', tauxCommission: '0.02', commissionEstimee: '396.00' });
    expect(boite.dernierPour(M1).objet).toMatch(/réservation reçue/);
    expect(boite.dernierPour(BO).objet).toMatch(/réservation à traiter/);
    // Jamais le nom complet du client dans un courriel.
    for (const courriel of boite.recus) {
      expect(`${courriel.objet} ${courriel.texte}`).not.toMatch(/Durand|Élodie/);
    }
    expect((await get('ADMIN', `/enveloppes/${ids.enveloppe}`).expect(200)).body.compteurs.restante).toBe('80200.00');

    const doublon = await post('M1', '/reservations', reservation({ montantBrut: '5000' })).expect(422);
    expect(doublon.body.bloquants[0]).toMatchObject({ code: 'DOUBLON' });
    expect(doublon.body.bloquants[0].message).toContain(`n° ${r.body.numero}`);
  });

  it('cloisonne : un mandataire ne voit ni ne touche la réservation d’un autre', async () => {
    await get('M2', `/reservations/${ids.r1}`).expect(404);
    expect((await get('M2', '/reservations').expect(200)).body).toHaveLength(0);
    await post('M2', `/reservations/${ids.r1}/annulation`, { motifId: ids.annulationImputable }).expect(404);
    await post('M1', `/reservations/${ids.r1}/validation`).expect(403);
    await get('M1', '/referentiels/apporteurs').expect(403);
  });

  it('séparation des tâches : personne ne valide sa propre réservation, même super administrateur', async () => {
    const r = await post('BO', '/reservations', reservation({ apporteurId: ids.aSa, codeApporteurId: ids.codeSa, numeroContrat: '87654321', clientNom: 'Petit', clientPrenom: 'Hugo' })).expect(201);
    ids.rSa = r.body.id;
    const refus = await post('SA', `/reservations/${ids.rSa}/validation`).expect(403);
    expect(refus.body.code).toBe('PROPRE_PRODUCTION');
    await post('ADMIN', `/reservations/${ids.rSa}/validation`).expect(201);
    // Un mandataire ne saisit pas pour le compte d'un autre.
    await post('M1', '/reservations', reservation({ apporteurId: ids.a2, codeApporteurId: ids.codeM2, numeroContrat: '11112222' })).expect(403);
  });

  it('valide, déclare l’opération, vérifie et exige un motif au-delà de 5 % d’écart', async () => {
    const validee = await post('BO', `/reservations/${ids.r1}/validation`).expect(201);
    // Délai standard pas encore fixé : l'échéance est la date limite interne.
    expect(validee.body).toMatchObject({ statut: 'VALIDEE', echeance: ajouterJours(aujourdHui, 40), tauxFige: true });
    expect(boite.dernierPour(M1).objet).toMatch(/réservation validée/);

    await post('M1', `/reservations/${ids.r1}/operation`, { dateOperation: ajouterJours(aujourdHui, 1), modeOperation: 'DEMATERIALISE' }).expect(400);
    await post('M1', `/reservations/${ids.r1}/operation`, { dateOperation: aujourdHui, modeOperation: 'DEMATERIALISE' }).expect(201);
    await post('M1', `/reservations/${ids.r1}/verification`, { montantValide: '21000', dateValidationCompagnie: aujourdHui }).expect(403);

    const ecart = await post('BO', `/reservations/${ids.r1}/verification`, { montantValide: '21000', dateValidationCompagnie: aujourdHui }).expect(201);
    expect(ecart.body).toMatchObject({ statut: 'ECART_A_JUSTIFIER', ecart: '1200.00', commissionDefinitive: null });
    const justifiee = await post('BO', `/reservations/${ids.r1}/justification-ecart`, { motifEcartId: ids.ecartValorisation }).expect(201);
    expect(justifiee.body).toMatchObject({ statut: 'VERIFIEE', motifEcart: 'Valorisation au jour de l’opération', commissionDefinitive: '420.00' });

    const vue = await get('BO', `/enveloppes/${ids.enveloppe}`).expect(200);
    // 100 000 − 21 000 validés − 19 800 réservés (réservation de l'associée).
    expect(vue.body.compteurs).toMatchObject({ restante: '59200.00', reelValide: '21000.00', reelRestant: '79000.00' });
  });

  it('produit l’avenant seulement après l’accord du client, et le périme à chaque modification', async () => {
    const arbitrage = await post('M1', '/reservations', reservation({
      typeOperation: 'ARBITRAGE',
      numeroContrat: '22223333',
      clientNom: 'Lemoine',
      clientPrenom: 'Anne',
      montantBrut: '10000',
      tauxFrais: '0',
      modeArbitrage: 'PAR_FONDS',
      fonds: [
        { fondsId: ids.fondsAlpha, nom: 'Fonds Alpha (C)', montant: '6000' },
        { nom: 'Support hors liste', montant: '4000' },
      ],
    })).expect(201);
    ids.rArb = arbitrage.body.id;
    expect(arbitrage.body.fonds.map((f: { horsReferentiel: boolean }) => f.horsReferentiel)).toEqual([false, true]);
    await get('M1', `/reservations/${ids.rArb}/avenant`).expect(400);
    await post('M1', `/reservations/${ids.rArb}/accord-client`).expect(201);
    const pdf = await get('M1', `/reservations/${ids.rArb}/avenant`).buffer(true).parse((res, fin) => {
      const morceaux: Buffer[] = [];
      res.on('data', (m: Buffer) => morceaux.push(m));
      res.on('end', () => fin(null, Buffer.concat(morceaux)));
    }).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.headers['content-disposition']).toContain('v1.pdf');

    const modifiee = await patch('M1', `/reservations/${ids.rArb}`, { numeroContrat: '22223334' }).expect(200);
    expect(modifiee.body.avenantVersion).toBe(2);
    // Versement libre : la production d'un document attend une décision du cabinet.
    const vl = await post('M2', '/reservations', reservation({ codeApporteurId: ids.codeM2, numeroContrat: '33334444', clientNom: 'Roux', clientPrenom: 'Jean', montantBrut: '5000' })).expect(201);
    ids.rM2 = vl.body.id;
    expect((await post('M2', `/reservations/${ids.rM2}/accord-client`).expect(422)).body.code).toBe('A_CONFIRMER');
  });

  it('une baisse est une annulation partielle motivée ; une hausse repasse en validation', async () => {
    await post('BO', `/reservations/${ids.rArb}/validation`).expect(201);
    await patch('M1', `/reservations/${ids.rArb}`, { montantBrut: '8000', fonds: [{ fondsId: ids.fondsAlpha, nom: 'Fonds Alpha (C)', montant: '8000' }] }).expect(400);
    const baisse = await patch('M1', `/reservations/${ids.rArb}`, {
      montantBrut: '8000',
      fonds: [{ fondsId: ids.fondsAlpha, nom: 'Fonds Alpha (C)', montant: '8000' }],
      motifBaisseId: ids.annulationImputable,
    }).expect(200);
    expect(baisse.body).toMatchObject({ statut: 'VALIDEE', montantNet: '8000.00' });
    const hausse = await patch('M1', `/reservations/${ids.rArb}`, {
      montantBrut: '9000',
      fonds: [{ fondsId: ids.fondsAlpha, nom: 'Fonds Alpha (C)', montant: '9000' }],
    }).expect(200);
    expect(hausse.body).toMatchObject({ statut: 'SOUMISE', tauxFige: false });
    const detail = await get('M1', `/reservations/${ids.rArb}`).expect(200);
    expect(detail.body.historique.map((h: { action: string }) => h.action)).toEqual(['CREATION', 'ACCORD_CLIENT', 'MODIFICATION', 'VALIDATION', 'BAISSE', 'MODIFICATION']);
  });

  it('enveloppe pleine : liste d’attente, service dans l’ordre ou motivé, dérogation tracée', async () => {
    // Restant : 100 000 − 21 000 − 19 800 − 9 000 − 4 950 = 45 250.
    const plein = await post('M2', '/reservations', reservation({ codeApporteurId: ids.codeM2, numeroContrat: '44445555', clientNom: 'Blanc', clientPrenom: 'Lou', montantBrut: '50000', tauxFrais: '0' })).expect(422);
    expect(plein.body.derogeables[0].code).toBe('DEPASSEMENT');
    const attente1 = await post('M2', '/reservations', reservation({ codeApporteurId: ids.codeM2, numeroContrat: '44445555', clientNom: 'Blanc', clientPrenom: 'Lou', montantBrut: '50000', tauxFrais: '0', listeAttente: true })).expect(201);
    const attente2 = await post('M1', '/reservations', reservation({ numeroContrat: '55556666', clientNom: 'Noir', clientPrenom: 'Ana', montantBrut: '48000', tauxFrais: '0', listeAttente: true })).expect(201);
    expect(attente1.body.statut).toBe('LISTE_ATTENTE');
    expect((await get('BO', `/enveloppes/${ids.enveloppe}`).expect(200)).body.compteurs.restante).toBe('45250.00');

    const liste = await get('BO', `/enveloppes/${ids.enveloppe}/liste-attente`).expect(200);
    expect(liste.body.map((l: { rang: number; id: string }) => [l.rang, l.id])).toEqual([
      [1, attente1.body.id],
      [2, attente2.body.id],
    ]);
    // Hors de l'ordre d'arrivée : motif exigé. Sans place : service partiel avec accord, ou dérogation.
    await post('BO', `/reservations/${attente2.body.id}/service`, {}).expect(400);
    await post('BO', `/reservations/${attente1.body.id}/service`, {}).expect(422);
    await post('BO', `/reservations/${attente1.body.id}/service`, { montantBrut: '45000' }).expect(400);
    const servie = await post('BO', `/reservations/${attente1.body.id}/service`, { montantBrut: '45000', accordMandataire: true }).expect(201);
    expect(servie.body).toMatchObject({ statut: 'SOUMISE', montantNet: '45000.00' });
    expect(boite.dernierPour(M2).objet).toMatch(/réservation servie/);

    const derogee = await post('BO', `/reservations/${attente2.body.id}/service`, { motifDerogation: 'Accord de la compagnie pour un dépassement' }).expect(201);
    expect(derogee.body.derogations).toContain('DEPASSEMENT');
    const vue = await get('BO', `/enveloppes/${ids.enveloppe}`).expect(200);
    expect(vue.body.compteurs).toMatchObject({ restante: '-47750.00', depassement: '47750.00' });
    expect(boite.pour(ADMIN).some((m) => /alerte de remplissage/.test(m.objet))).toBe(true);
    ids.rDerogee = derogee.body.id;
  });

  it('annulation : montant rendu, avertissement avant une annulation tardive', async () => {
    const annulee = await post('M1', `/reservations/${ids.rDerogee}/annulation`, { motifId: ids.annulationImputable }).expect(201);
    expect(annulee.body).toMatchObject({ statut: 'ANNULEE', annulationTardive: false });
    expect((await get('BO', `/enveloppes/${ids.enveloppe}`).expect(200)).body.compteurs.restante).toBe('250.00');

    // À moins de 15 jours de la date limite interne, l'annulation imputable est tardive.
    await prisma.enveloppe.update({ where: { id: ids.enveloppe }, data: { dateLimiteInterne: new Date(`${ajouterJours(aujourdHui, 10)}T00:00:00Z`) } });
    const avertie = await post('M2', `/reservations/${ids.rM2}/annulation`, { motifId: ids.annulationImputable }).expect(409);
    expect(avertie.body.code).toBe('TARDIVE');
    const tardive = await post('M2', `/reservations/${ids.rM2}/annulation`, { motifId: ids.annulationImputable, confirmeTardive: true }).expect(201);
    expect(tardive.body.annulationTardive).toBe(true);
    await prisma.enveloppe.update({ where: { id: ids.enveloppe }, data: { dateLimiteInterne: new Date(`${ajouterJours(aujourdHui, 40)}T00:00:00Z`) } });

    const fiabilite = await get('M2', '/enveloppes/fiabilite').expect(200);
    expect(fiabilite.body).toHaveLength(1);
    expect(fiabilite.body[0]).toMatchObject({ apporteur: { prenom: 'Maud' }, annulationsTardives: { nombre: 1, montant: '4950.00' } });
    const tous = await get('BO', '/enveloppes/fiabilite').expect(200);
    expect(tous.body.length).toBeGreaterThanOrEqual(2);
  });

  it('deux réservations simultanées ne prennent jamais le même montant', async () => {
    await post('ADMIN', `/enveloppes/${ids.enveloppe}/mouvements`, { type: 'RALLONGE', montant: '4800', motif: 'Rallonge accordée par la compagnie' }).expect(201);
    // Restant : 10 000. Deux demandes de 10 000 arrivent en même temps.
    const [a, b] = await Promise.all([
      post('M1', '/reservations', reservation({ numeroContrat: '66667777', clientNom: 'Vert', clientPrenom: 'Iris', montantBrut: '10000', tauxFrais: '0' })),
      post('M2', '/reservations', reservation({ codeApporteurId: ids.codeM2, numeroContrat: '77778888', clientNom: 'Gris', clientPrenom: 'Théo', montantBrut: '10000', tauxFrais: '0' })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 422]);
    expect((await get('BO', `/enveloppes/${ids.enveloppe}`).expect(200)).body.compteurs.restante).toBe('0.00');
    await post('ADMIN', `/enveloppes/${ids.enveloppe}/mouvements`, { type: 'RESTITUTION', montant: '1', motif: 'Essai' }).expect(422);
  });

  it('clients confiés : affectés par l’administrateur, au taux minoré, signalés par le mandataire', async () => {
    await post('BO', `/enveloppes/${ids.enveloppe}/clients-confies`, { apporteurId: ids.a1, typeClient: 'PHYSIQUE', clientNom: 'Morel', clientPrenom: 'Lina' }).expect(403);
    const confie = await post('ADMIN', `/enveloppes/${ids.enveloppe}/clients-confies`, { apporteurId: ids.a1, typeClient: 'PHYSIQUE', clientNom: 'Morel', clientPrenom: 'Lina', numeroContrat: '88889999' }).expect(201);
    expect(confie.body.taux).toBe('0.005');
    expect(boite.dernierPour(M1).objet).toMatch(/client confié/);
    expect((await get('M1', '/enveloppes/clients-confies').expect(200)).body).toHaveLength(1);
    expect((await get('M2', '/enveloppes/clients-confies').expect(200)).body).toHaveLength(0);
    await post('M2', '/reservations', reservation({ codeApporteurId: ids.codeM2, clientConfieId: confie.body.id, numeroContrat: '88889999' })).expect(400);

    await post('ADMIN', `/enveloppes/${ids.enveloppe}/mouvements`, { type: 'RALLONGE', montant: '20000', motif: 'Rallonge clients confiés' }).expect(201);
    const r = await post('M1', '/reservations', reservation({ clientConfieId: confie.body.id, clientNom: 'Autre', numeroContrat: '88889999', montantBrut: '10000', tauxFrais: '0' })).expect(201);
    expect(r.body).toMatchObject({ origineClient: 'CONFIE', clientNom: 'Morel', tauxCommission: '0.005', commissionEstimee: '50.00' });
    expect(r.body.accordClientLe).not.toBeNull();
    expect(boite.dernierPour(BO).objet).toMatch(/signature à organiser/);
    expect((await get('M1', '/enveloppes/clients-confies').expect(200)).body[0].statut).toBe('ACCEPTE');
    ids.rConfie = r.body.id;
  });

  it('documents : PDF déposé par le back-office, lu par le mandataire ; avenant vierge réservé', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%essai\n');
    const fiche = await http().post(`/api/enveloppes/${ids.enveloppe}/documents`).set('Cookie', c.BO).field('categorie', 'FICHE_PRODUIT').attach('fichier', pdf, 'fiche-produit.pdf').expect(201);
    const vierge = await http().post(`/api/enveloppes/${ids.enveloppe}/documents`).set('Cookie', c.BO).field('categorie', 'AVENANT_VIERGE').attach('fichier', pdf, 'avenant-vierge.pdf').expect(201);
    await http().post(`/api/enveloppes/${ids.enveloppe}/documents`).set('Cookie', c.BO).field('categorie', 'FICHE_PRODUIT').attach('fichier', Buffer.from('<html>'), 'piege.pdf').expect(400);
    await http().post(`/api/enveloppes/${ids.enveloppe}/documents`).set('Cookie', c.M1).field('categorie', 'FICHE_PRODUIT').attach('fichier', pdf, 'x.pdf').expect(403);

    const lu = await get('M1', `/enveloppes/documents/${fiche.body.id}`).expect(200);
    expect(lu.headers['content-type']).toBe('application/pdf');
    await get('M1', `/enveloppes/documents/${vierge.body.id}`).expect(404);
    const vue = await get('M1', `/enveloppes/${ids.enveloppe}`).expect(200);
    expect(vue.body.documents.map((d: { categorie: string }) => d.categorie)).toEqual(['FICHE_PRODUIT']);

    // Preuve de vérification : back-office seulement.
    await http().post(`/api/reservations/${ids.r1}/documents`).set('Cookie', c.M1).field('categorie', 'PREUVE_VERIFICATION').attach('fichier', pdf, 'preuve.pdf').expect(403);
    await http().post(`/api/reservations/${ids.r1}/documents`).set('Cookie', c.BO).field('categorie', 'PREUVE_VERIFICATION').attach('fichier', pdf, 'preuve.pdf').expect(201);
  });

  it('exporte en CSV : le mandataire ses seules lignes, chaque export journalisé', async () => {
    const tout = await get('BO', `/reservations/export?enveloppe=${ids.enveloppe}`).expect(200);
    expect(tout.headers['content-type']).toContain('text/csv');
    expect(tout.text).toContain('Durand Élodie');
    expect(tout.text).toContain('Petit Hugo');
    const siennes = await get('M2', '/reservations/export').expect(200);
    expect(siennes.text).not.toContain('Durand');
    expect(siennes.text).toContain('Roux');
    const traces = await prisma.log.findMany({ where: { action: 'EXPORT_RESERVATIONS' } });
    expect(traces).toHaveLength(2);
  });

  it('contrôle Swiss Life : sans situation patrimoniale à jour, l’opération ne peut pas être déclarée', async () => {
    await patch('ADMIN', `/enveloppes/${ids.enveloppe}`, { controlePatrimoine: true, motif: 'Produit soumis au contrôle patrimonial' }).expect(200);
    await post('BO', `/reservations/${ids.rConfie}/validation`).expect(201);
    const bloquee = await post('BO', `/reservations/${ids.rConfie}/operation`, { dateOperation: aujourdHui, modeOperation: 'PAPIER' }).expect(422);
    expect(bloquee.body.code).toBe('PATRIMOINE');
    await post('M1', `/reservations/${ids.rConfie}/patrimoine`, { aJour: true }).expect(201);
    await post('BO', `/reservations/${ids.rConfie}/operation`, { dateOperation: aujourdHui, modeOperation: 'PAPIER' }).expect(201);
    expect(boite.dernierPour(M1).objet).toMatch(/signature reçue/);
    await patch('ADMIN', `/enveloppes/${ids.enveloppe}`, { controlePatrimoine: false, motif: 'Fin de l’essai' }).expect(200);
    // Une enveloppe ouverte ne se modifie que par un administrateur, avec motif.
    await patch('BO', `/enveloppes/${ids.enveloppe}`, { montantMinimum: '2000' }).expect(403);
    await patch('ADMIN', `/enveloppes/${ids.enveloppe}`, { montantMinimum: '2000' }).expect(400);
  });

  it('à l’échéance : échue, contact obligatoire, puis prolongation ou libération', async () => {
    const planificateur = app.get(PlanificateurService);
    await prisma.parametresEnveloppes.updateMany({ data: { delaiHonorerJours: 5 } });
    await post('ADMIN', `/reservations/${ids.rArb}/validation`).expect(201);
    const r = await get('M1', `/reservations/${ids.rArb}`).expect(200);
    expect(r.body.echeance).toBe(ajouterJours(aujourdHui, 5));

    boite.vider();
    await planificateur.executer(new Date(`${ajouterJours(aujourdHui, 6)}T10:00:00Z`));
    expect((await get('M1', `/reservations/${ids.rArb}`).expect(200)).body.statut).toBe('ECHUE');
    expect(boite.dernierPour(BO).objet).toMatch(/échue, à traiter/);

    await post('BO', `/reservations/${ids.rArb}/prolongation`, { echeance: ajouterJours(aujourdHui, 20) }).expect(400);
    const prolongee = await post('BO', `/reservations/${ids.rArb}/prolongation`, { compteRendu: 'Client en déplacement, signature la semaine prochaine.', echeance: ajouterJours(aujourdHui, 20) }).expect(201);
    expect(prolongee.body).toMatchObject({ statut: 'VALIDEE', echeance: ajouterJours(aujourdHui, 20) });

    await planificateur.executer(new Date(`${ajouterJours(aujourdHui, 21)}T10:00:00Z`));
    const liberee = await post('BO', `/reservations/${ids.rArb}/liberation`, { compteRendu: 'Le client ne donne pas suite.' }).expect(201);
    expect(liberee.body.statut).toBe('LIBEREE');
    const f = (await get('M1', '/enveloppes/fiabilite').expect(200)).body[0];
    expect(f).toMatchObject({ prolongations: 1, nonHonorees: { nombre: 1, montant: '9000.00' } });
  });

  it('mail du jeudi : une fois le modèle validé, initiales seulement, envoi archivé', async () => {
    const planificateur = app.get(PlanificateurService);
    // Prochain jeudi, 9 h 01 à Paris (8 h 01 UTC en hiver).
    let jeudi = aujourdHui;
    while (new Date(`${jeudi}T12:00:00Z`).getUTCDay() !== 4) jeudi = ajouterJours(jeudi, 1);
    boite.vider();
    await planificateur.executer(new Date(`${jeudi}T08:01:00Z`));
    expect(boite.recus.filter((m) => /point de la semaine/.test(m.objet))).toHaveLength(0);

    await post('BO', '/enveloppes/parametres/emailing').expect(403);
    await post('ADMIN', '/enveloppes/parametres/emailing').expect(201);
    await planificateur.executer(new Date(`${jeudi}T08:00:00Z`));
    expect(boite.recus.filter((m) => /point de la semaine/.test(m.objet))).toHaveLength(0);
    await planificateur.executer(new Date(`${jeudi}T08:01:00Z`));
    const hebdo = boite.recus.filter((m) => /point de la semaine/.test(m.objet));
    expect(hebdo.map((m) => m.a).sort()).toEqual([M1, M2, SA].sort());
    for (const m of hebdo) {
      expect(m.texte).not.toMatch(/Durand|Élodie|Morel|Lemoine|Blanc|Noir/);
    }
    const archive = await prisma.envoiEmailing.findMany();
    expect(archive).toHaveLength(1);
    expect(archive[0].destinataires).toHaveLength(3);
    // Pas de second envoi la même semaine.
    await planificateur.executer(new Date(`${jeudi}T09:30:00Z`));
    expect(boite.recus.filter((m) => /point de la semaine/.test(m.objet))).toHaveLength(3);
  });

  it('à la date limite interne, l’enveloppe se ferme ; seule une dérogation de l’administrateur permet encore de réserver', async () => {
    const planificateur = app.get(PlanificateurService);
    await planificateur.executer(new Date(`${ajouterJours(aujourdHui, 41)}T10:00:00Z`));
    expect((await get('BO', `/enveloppes/${ids.enveloppe}`).expect(200)).body.statut).toBe('FERMEE');
    const tardive = await post('M1', '/reservations', reservation({ numeroContrat: '99990000', clientNom: 'Tard', clientPrenom: 'Zoé', montantBrut: '2000', tauxFrais: '0' })).expect(422);
    expect(tardive.body.derogeables[0].code).toBe('DATE_LIMITE');
    await post('BO', '/reservations', reservation({ apporteurId: ids.a1, numeroContrat: '99990000', clientNom: 'Tard', clientPrenom: 'Zoé', montantBrut: '2000', tauxFrais: '0', derogations: [{ code: 'DATE_LIMITE', motif: 'Accord compagnie' }] })).expect(403);
    await post('ADMIN', '/reservations', reservation({ apporteurId: ids.a1, numeroContrat: '99990000', clientNom: 'Tard', clientPrenom: 'Zoé', montantBrut: '2000', tauxFrais: '0', derogations: [{ code: 'DATE_LIMITE', motif: 'Accord compagnie' }] })).expect(201);
    // La clôture attend que chaque réservation ait un statut final.
    expect((await post('BO', `/enveloppes/${ids.enveloppe}/cloture`).expect(422)).body.code).toBe('NON_FINALISEE');
  });

  it('trace chaque action sensible au journal, sans nom de client', async () => {
    const actions = (await prisma.log.findMany({ select: { action: true } })).map((l) => l.action);
    for (const attendue of ['ENVELOPPE_CREEE', 'RESERVATION_CREEE', 'RESERVATION_VALIDEE', 'RESERVATION_VERIFIEE', 'ECART_JUSTIFIE', 'LISTE_ATTENTE_SERVIE', 'DEROGATION', 'RALLONGE', 'CLIENT_CONFIE', 'UPFRONT_SAISI', 'FICHE_AVENANT_PRODUITE', 'DOCUMENT_DEPOSE', 'EMAILING_ENVOYE', 'ENVELOPPE_FERMEE']) {
      expect(actions).toContain(attendue);
    }
    const messages = (await prisma.log.findMany({ select: { message: true } })).map((l) => l.message).join(' ');
    expect(messages).not.toMatch(/Durand|Lemoine|Blanc/);
  });
});
