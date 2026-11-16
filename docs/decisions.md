# Registre des décisions

Ce fichier liste les décisions prises par le cabinet et dit, pour chacune, où elle est
appliquée dans le code. Une décision qui n'est pas ici n'est pas garantie d'être
appliquée : toute nouvelle décision s'ajoute ici avant d'être codée.

États possibles : **Appliqué** (dans le code, avec un test), **À faire** (décidé, module
pas encore construit), **Ouvert** (pas encore tranché).

## 1. Commissions : règles de calcul

| Décision | Date | État | Où |
| --- | --- | --- | --- |
| Chaîne compagnie → courtier grossiste (retenue de 15 %) → cabinet → mandataire | début nov. | Appliqué | Moteur du simulateur |
| Taux de reversement propre à chaque mandataire, fixé à la création de son espace (70 % chez SR CONSEIL, différent chez Label Assurances) | 12 nov. | Appliqué dans le calcul ; 70 % pour tous tant que la connexion n'existe pas | Moteur, puis fiche mandataire |
| Coefficient 0,87 conservé en première version pour passer du TTC au hors taxe | début nov. | Appliqué | Référentiel |
| Référentiel versionné par année ; un nouveau barème ne modifie pas un calcul passé | début nov. | Appliqué | Référentiel daté |
| Surcommission payée comme acquise si et seulement si elle est reprise dans la grille | début nov. | Appliqué | Référentiel |
| Abeille : surcommission payée sur la part réelle en unités de compte | début nov. | Appliqué | Moteur, tests « part en unités de compte » |
| Pondérations d'âge des protocoles répercutées au mandataire, transparence totale | 12 nov. | Appliqué pour Abeille, Generali et Cardif | Moteur, tests « âge » |
| Abeille : plafond de 2 000 € par mois sur la surcommission, par client et par type de contrat, sur les primes périodiques | 12 nov. | Appliqué | Moteur, tests « plafond » |
| Swiss Life : bonus payé sur la seule part en unités de compte | début nov. | Appliqué | Moteur, tests « Swiss Life » |
| Generali : rappel de 25 % payé d'avance, sur un palier certain | début nov. | Appliqué (inclus dans le barème) | Référentiel |
| Abeille retraite : option choisie contrat par contrat, Acquisition Max proposée par défaut | 15 nov. | Appliqué | Moteur, écran |
| Compagnies sans taux dans la grille : conservées, taux à saisir à la main | 12 nov. | Appliqué | Référentiel, écran |
| Base de commission jamais négative quand les frais sont sous le minimum | audit A6 | Appliqué | Test « écarts voulus » |
| Saisie des frais bornée | audit A14 | Appliqué, de 0 à 4,75 % | Référentiel |
| Le mandataire ne voit que son montant ; la chaîne complète et la marge sont réservées aux administrateurs | début nov. | Appliqué | Réponse du serveur, test dédié |
| Abeille prévoyance : taux avant retenue du courtier grossiste, Boost considéré comme inclus | 15 nov. | Appliqué | Référentiel |
| Co-courtage avec un cabinet d'expertise comptable : case à cocher et taux de la convention (30 % proposé) ; part calculée sur la commission brute de la compagnie ; le mandataire reçoit son taux de reversement sur ce qui reste au cabinet | 15 nov. | Appliqué | Moteur, tests « co-courtage », écran |
| Co-courtage : la part du cabinet d'expertise comptable est affichée, avec le rappel qu'elle est versée sans avance, au fil des bordereaux reçus | 15 nov. | Appliqué | Écran |
| Règles de reprise affichées par compagnie, avec le calcul et un exemple chiffré sur l'affaire simulée | 15 nov. | Appliqué pour 40 contrats ; 111 contrats sans règle connue du cabinet | `moteur/reprise.ts`, tests « reprise » |

### Hypothèses de calcul encore à confirmer

Elles sont marquées `aConfirmer` dans le référentiel et affichées à l'écran.

| Sujet | Lecture retenue | À confirmer par |
| --- | --- | --- |
| Abeille, baisse entre 57 et 67 ans | Au prorata : un dixième de surcommission en moins par année | Sofraco |
| Abeille, option Acquisition Max | Surcommission maintenue telle quelle | Géraldine |
| Abeille Épargne Active | Encours Max seul, comme la grille | Géraldine |
| Generali, de 45 à 54 ans | (60 − âge) / 15 de l'escompte | Sofraco |
| Generali, à partir de 55 ans | 6 % par an, rappel de 25 % maintenu | Sofraco |
| Cardif, de 45 à 65 ans | (65 − âge) / 20 sur l'escompte, pas sur le bonus | Sofraco |
| Cardif, frais de référence | 2,75 % comme la grille (4,75 % selon le protocole) | Géraldine, Sofraco |
| Barèmes Generali et Cardif à 80 ou 90 % de reversement | Règle de trois depuis le barème à 70 % | Cabinet |
| Abeille prévoyance, seuil de 1 700 € | Apprécié sur la cotisation hors taxe | Philippe |

### Règles de reprise connues

Source : protocoles Sofraco Retraite, Épargne et Prévoyance 2026, édition de juin 2026.

| Compagnie, contrat | Règle retenue |
| --- | --- |
| Abeille, primes périodiques | Base : prorata des versements non faits sur la durée d'escompte. Surcommission : 100 %, 90 %, 80 %, 70 % les années 1 à 4 ; 60 % la 5e au-delà de 1 500 € par mois |
| Abeille, versement unique | Surcommission seule, mêmes taux sur 4 ans, en cas de rachat d'au moins 30 000 € à frais de 1,5 % ou moins |
| Abeille prévoyance | Prorata des primes non payées, la 1re année seulement |
| Generali Retraite Pro | Totalité la 1re année, puis mois restants sur 72 |
| Cardif Elite | Mois restants sur 36 ; le bonus n'est pas repris |
| Swiss Life PER individuel | Mois restants sur 48 |
| Swiss Life et Cardif, versement unique | Pas de reprise |
| Alptis prévoyance | Précompte : 100 % de la commission d'apport la 1re année, 50 % la 2e |
| Swiss Life prévoyance | 100 % de la commission d'apport pendant 3 ans, hors sinistre avec paiement du capital |
| April prévoyance | Pendant 2 ans, commission versée moins son équivalent linéaire (14 % pour un 30/10, 16 % pour un 40/10) |
| Entoria prévoyance | Précompte : pendant 2 ans, commission versée moins commission due sur les cotisations encaissées (non chiffré) |
| Santé, emprunteur, autres compagnies | Règle non connue du cabinet : protocoles à obtenir |

## 2. Commissions : affaires, bordereau, reprises

| Décision | Date | État |
| --- | --- | --- |
| Une affaire est payable si le contrat est validé, le devoir de conseil fait et signé | début nov. | À faire (module Affaires) ; rappelé à l'écran du simulateur |
| Taux et montant figés à la validation de l'affaire | début nov. | À faire (module Affaires) |
| Plafond Abeille cumulé automatiquement entre les contrats d'un même client | 12 nov. | À faire (module Affaires) ; saisi à la main dans le simulateur |
| Surcommission Swiss Life avancée en entier dès la validation du contrat | 12 nov. | À faire (module Affaires) |
| Reprise répercutée au prorata de ce que le mandataire a touché | début nov. | À faire (module Bordereau) ; rappelé à l'écran |
| Lissage des reprises réglé au cas par cas par l'administrateur ou le super administrateur | 12 nov. | À faire (module Bordereau) |
| Récurrent reversé à un taux propre à chaque mandataire, 40 % du net dans le cas courant | début nov. | À faire (module Bordereau) |
| Bordereau envoyé non modifiable ; correction par ligne de régularisation | début nov. | À faire (module Bordereau) |
| Protocole signé en retard avec effet rétroactif : lignes de régularisation exceptionnelles | 15 nov. | À faire (module Bordereau) |
| Blocage signalé avec son motif : devoir de conseil non signé, arbitrage non signé, formalités médicales en cours | 15 nov. | À faire (module Affaires) |
| Un mois de fonctionnement en double avec le fichier Excel avant bascule | 15 nov. | À faire |

## 3. Enveloppes de produits structurés

| Décision | Date | État |
| --- | --- | --- |
| Commission avancée dès la validation par la compagnie ; écart d'upfront assumé par le cabinet | début nov. | À faire |
| Upfront réel visible des deux super administrateurs seulement | début nov. | À faire |
| Montant brut et frais saisis ; le net consomme l'enveloppe et porte la commission | début nov. | À faire |
| Un taux par enveloppe, le même pour tous | début nov. | À faire |
| Client confié : taux minoré de 0,5 % par défaut, modifiable | 15 nov. | À faire |
| Client confié : le mandataire propose, le client valide, le mandataire notifie, le back-office gère la signature, le mandataire est informé du montant réel | 15 nov. | À faire |
| Réservation globale puis affectation ligne par ligne ; réservations « à prévendre » libres | début nov. | À faire |
| Concentration limitée à 15 % de l'encours total du client | début nov. | À faire |
| Anomalie dès 5 % d'écart entre réservé et validé, dans les deux sens | 12 nov. | À faire |
| Validations des super administrateurs tracées et visibles de l'autre ; aucun ne valide son propre règlement | 12 nov. | À faire |
| Contrôle « mise à jour du patrimoine » propre aux produits Swiss Life | 12 nov. | À faire |
| Fiabilité : statistiques remises à zéro à la mise en service ; annulation comptée, avec un poids qui croît à l'approche de la clôture | 12 nov. | À faire |
| Deux campagnes menées en même temps dans deux compagnies | 15 nov. | À faire |
| Entités du groupe à créer : SR CONSEIL, Label Assurances, Label Santé, RJ Assurances, Nembrini Colombani, A2C Courtage, A3C (Midi Courtage) | 16 nov. | À faire (référentiel des entités) |
| À l'ouverture d'une campagne : avenant pré-rempli, mail hebdomadaire, clients confiés, liste d'attente, indicateurs de fiabilité | 15 nov. | À faire |
| Annulation après opération par le back-office, commission reprise | début nov. | À faire |

## 4. Socle, sécurité, données

| Décision | Date | État |
| --- | --- | --- |
| Même technologie que le socle des développeurs, habillage des maquettes | 15 nov. | Appliqué (`CLAUDE.md`) |
| Hébergement sur un serveur propre, dépôt privé | 15 nov. | Dépôt fait ; serveur à créer |
| Connexion à deux étapes par code envoyé par courriel | 15 nov. | À faire |
| Modules activables par utilisateur, par case à cocher | 15 nov. | À faire |
| Un mandataire ne voit que ses clients et ses commissions | 15 nov. | À faire |
| Un mandataire peut avoir plusieurs codes apporteur chez une même compagnie | 15 nov. | À faire |
| Conservation des données : durée du contrat puis dix ans ; trois ans sans contact pour un prospect | 15 nov. | À faire ; à valider par le conseil RGPD |
| Conventions et protocoles signés versés dans la plateforme, consultables par l'administrateur et le mandataire concerné | 15 nov. | À faire |
| Aucune donnée médicale, aucun IBAN | 15 nov. | Appliqué (`CLAUDE.md`) |

## 5. Version pour d'autres cabinets

| Décision | Date | État |
| --- | --- | --- |
| Tout paramètre propre à un cabinet est paramétrable, jamais codé en dur | 12 nov. | Appliqué pour le simulateur |
| Superviseur : base de calcul choisie parmi trois (commission nette du cabinet, part du cabinet, part du mandataire) ; un superviseur peut être supervisé ; rien de plus sur ses propres affaires | 15 nov. | À faire |
| Superviseur : les reprises s'appliquent toujours ; le récurrent est paramétrable | 15 nov. | À faire |
| Co-courtage : 30 % du brut pour la filiale du cabinet comptable, sur toutes les commissions des bordereaux ; upfront des enveloppes paramétrable | 15 nov. | À faire |
| Sous-code partagé : pourcentage fixe uniquement | 15 nov. | À faire |
| Commercial salarié : annexe de paie avec récapitulatif par compagnie puis détail par affaire | 15 nov. | À faire |
| IARD : commission d'apporteur, forfaitaire en général, en pourcentage par exception | 15 nov. | À faire |
| Cabinet comptable partenaire : accès à la plateforme | 15 nov. | À faire |

## 6. Points encore ouverts

La liste complète est tenue dans le document « SR CONSEIL — Questions en attente ».
Ceux qui touchent le calcul :

- Swiss Life prévoyance : ramener la grille de 70 % à 60 % si le protocole confirme les bordereaux.
- Cardif : valeur du barème à 2,5 % de frais (30,79 % ou 30,89 %).
- Version de la grille qui fait foi, puisque deux versions coexistent.
- Correction des affaires déjà réglées, ou application aux seules affaires nouvelles.
- Nom du complément versé à un superviseur.
- Co-courtage : en cas de reprise par la compagnie, la filiale du cabinet comptable rend-elle sa part.
- Règles de reprise en santé et en assurance de prêt, et pour les compagnies de prévoyance dont le protocole ne dit rien.
