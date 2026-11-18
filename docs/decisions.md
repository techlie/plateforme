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
| Taux de reversement propre à chaque mandataire, fixé à la création de son espace (70 % chez SR CONSEIL, différent chez Label Assurances) | 12 nov. | Appliqué dans le calcul | Moteur, puis fiche mandataire |
| Simulateur : choix du taux de reversement entre 70, 80 et 90 %, certains mandataires de Label Assurances étant à 80 ou 90 % ; le serveur refuse tout autre taux. Provisoire : le taux viendra de la fiche du mandataire | 16 nov. | Appliqué | Référentiel, service, écran, test dédié |
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
| Co-courtage : en cas de reprise par la compagnie, chacun est impacté proportionnellement à sa part, cabinet d'expertise comptable compris | 17 nov. | Appliqué dans le rappel de l'écran ; calcul à faire (module Bordereau) | Écran |
| Règles de reprise affichées par compagnie, avec le calcul et un exemple chiffré sur l'affaire simulée | 15 nov. | Appliqué pour 40 contrats ; 111 contrats sans règle connue du cabinet | `moteur/reprise.ts`, tests « reprise » |
| Une règle de protocole s'applique telle qu'elle est écrite, sans interprétation. En cas de doute, la question est posée au cabinet avant de coder ; en attendant, la règle est affichée sans exemple chiffré | 16 nov. | Appliqué | `CLAUDE.md`, référentiel (`TEXTE`) |
| Abeille épargne et retraite : reprise de toute la commission selon l'année d'arrêt, quel que soit le mois : 100 %, 90 %, 80 %, 70 % les années 1 à 4 ; 60 % la 5e au-delà de 1 500 € de versement par mois | 16 nov. | Appliqué | Référentiel (`PAR_ANNEE`), tests « reprise » |
| N/72 (Generali), N/48 (Swiss Life PER), N/36 (Cardif) : N est le nombre de mois restant à courir | 16 nov. | Appliqué | Référentiel, tests « reprise » |
| Abeille prévoyance : reprise au prorata des primes non payées, la 1re année | 16 nov. | Appliqué | Référentiel, tests « reprise » |
| Une compagnie peut appliquer des protocoles différents selon la gamme, et les reprises peuvent évoluer : la règle de reprise est portée par chaque contrat du référentiel daté. Une règle donnée pour toute une compagnie est affichée « à vérifier pour cette gamme » | 16 nov. | Appliqué pour 32 gammes de prévoyance | Référentiel, test dédié |
| Le simulateur sort des maquettes : l'écran construit fait référence | 16 nov. | Appliqué | Écran du simulateur |

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
| Abeille, primes périodiques | Toute la commission, base et surcommission : 100 %, 90 %, 80 %, 70 % selon l'année d'arrêt, le même taux quel que soit le mois ; 60 % la 5e année au-delà de 1 500 € par mois. Confirmé le 16 nov. |
| Abeille, versement unique et transfert | En cas de rachat d'au moins 30 000 € à frais de 1,5 % ou moins : 100 %, 90 %, 80 %, 70 % sur 4 ans. Affichée sans exemple chiffré : question posée (toute la commission ou surcommission seule) |
| Abeille prévoyance | Prorata des primes non payées, la 1re année seulement. Confirmé le 16 nov. |
| Generali Retraite Pro | Totalité la 1re année, puis N/72, N étant le nombre de mois restant à courir |
| Cardif Elite | N/36, N étant le nombre de mois restant à courir ; le bonus n'est pas repris (à confirmer) |
| Swiss Life PER individuel | N/48, N étant le nombre de mois restant à courir |
| Swiss Life et Cardif, versement unique | Pas de reprise |
| Alptis prévoyance | Précompte : 100 % de la commission d'apport la 1re année, 50 % la 2e |
| Swiss Life prévoyance | 100 % de la commission d'apport pendant 3 ans, hors sinistre avec paiement du capital ; surcommission 100 % la 1re année, puis de 50 % à 0 % la 2e. Affichée sans exemple chiffré : question posée (répartition du taux de la grille, baisse de la 2e année) |
| April prévoyance | Pendant 2 ans, commission versée moins son équivalent linéaire (14 % pour un 30/10, 16 % pour un 40/10) |
| Entoria prévoyance | Précompte : pendant 2 ans, commission versée moins commission due sur les cotisations encaissées (non chiffré) |
| Santé, emprunteur, autres compagnies | Règle non connue du cabinet : protocoles à obtenir |

Les règles de prévoyance ci-dessus viennent du protocole Sofraco, qui les donne par compagnie. Chaque gamme concernée est signalée « à vérifier pour cette gamme ».

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

### Code apporteur partagé par plusieurs mandataires

Cas d'une structure du groupe, par exemple RJ Assurances : un seul code apporteur chez
une compagnie, plusieurs mandataires qui se le partagent.

| Décision | Date | État |
| --- | --- | --- |
| Chaque contrat d'un code partagé est affecté à un seul mandataire. L'affectation se fait contrat par contrat, plus fiable ; un raccourci affecte en une fois tous les contrats d'un client | 16 nov. | À faire (module Affaires) |
| Contrat sans mandataire affecté : par défaut, la structure garde toute la commission | 16 nov. | À faire |
| À l'affectation, la part du mandataire est paramétrable : une partie ou toute la commission, selon un protocole qui peut différer de son taux habituel, y compris sur le récurrent | 16 nov. | À faire |
| Date d'effet d'une affectation ou d'un changement de mandataire fixée par l'administrateur à chaque fois ; un rattrapage passe par une ligne de régularisation | 16 nov. | À faire |
| Seul l'administrateur affecte un contrat ou change son mandataire ; chaque affectation est tracée | 16 nov. | À faire |
| Bordereau d'un code partagé : chaque mandataire ne voit que les lignes des contrats qui lui sont affectés | 17 nov. | À faire |

### Affectation et commissionnement

| Décision | Date | État |
| --- | --- | --- |
| L'affectation (qui suit le client ou le contrat) et le commissionnement (qui est payé, et combien) sont deux notions distinctes, réglées séparément | 17 nov. | À faire |
| Deux sources d'affectation cohabitent : le CRM, qui fait foi quand il existe, et l'affectation faite dans la plateforme, indispensable pour un cabinet sans CRM (version commercialisable) | 17 nov. | À faire |
| Statut « gestionnaire de portefeuille » : des clients lui sont affectés pour le suivi, sans acte commercial. Une commission ne s'y attache que si elle est configurée, par exemple un récurrent prévu dans la gestion d'un cabinet | 17 nov. | À faire |
| Le gestionnaire de portefeuille a un profil proche du mandataire : il voit son portefeuille et les commissions perçues par le cabinet sur ce portefeuille, sans calcul de marge ni trésorerie | 17 nov. | À faire |

## 3. Enveloppes de produits structurés

| Décision | Date | État |
| --- | --- | --- |
| Commission avancée dès la validation par la compagnie ; écart d'upfront assumé par le cabinet | début nov. | Appliqué en partie : commission définitive dès la vérification compagnie ; demande de règlement à faire |
| Upfront réel visible des deux super administrateurs seulement | début nov. | Appliqué : taux d'upfront attendu, jamais envoyé à un autre profil (test) |
| Montant brut et frais saisis ; le net consomme l'enveloppe et porte la commission | début nov. | Appliqué (`regles/montants.ts`, tests) |
| Un taux par enveloppe, le même pour tous | début nov. | Appliqué ; figé sur la réservation à sa validation |
| Client confié : taux minoré de 0,5 % par défaut, modifiable | 15 nov. | Appliqué, paramètre réglable |
| Client confié : la règle est régie par une convention propre à chaque mandataire. La convention s'annexe à sa fiche, se télécharge, et le mandataire la consulte dans son espace. Son taux s'applique aux clients qui lui sont confiés ; à défaut de convention, le taux de l'enveloppe | 18 nov. | Appliqué (`referentiels`, `confier`, tests) |
| Client confié : le mandataire propose, le client valide, le mandataire notifie, le back-office gère la signature, le mandataire est informé du montant réel | 15 nov. | Appliqué (test) |
| Client confié : signature par l'outil de signature électronique de la compagnie ; si le client signe sur papier, l'opérateur le précise | 17 nov. | Appliqué : le back-office déclare l'opération, signature électronique ou papier |
| Réservation globale puis affectation ligne par ligne ; réservations « à prévendre » libres | début nov. | Appliqué (`regles/compteurs.ts`, tests) |
| Concentration limitée à 15 % de l'encours total du client | début nov. | Appliqué : alerte non bloquante, toutes enveloppes ouvertes cumulées |
| Anomalie dès 5 % d'écart entre réservé et validé, dans les deux sens | 12 nov. | Appliqué, seuil réglable (test) |
| Validations des super administrateurs tracées et visibles de l'autre ; aucun ne valide son propre règlement | 12 nov. | Appliqué pour les réservations ; règlement à faire |
| Un super administrateur peut valider sa propre réservation : c'est inscrit au journal et l'autre associé en est prévenu par courriel. Un administrateur, le back-office ou un mandataire ne valide jamais la sienne | 18 nov. | Appliqué (`valider`, test) |
| Contrôle « mise à jour du patrimoine » propre aux produits Swiss Life, bloquant : sans situation patrimoniale à jour, l'opération ne peut pas être déclarée | 12 et 17 nov. | Appliqué (test) |
| Fiabilité : statistiques remises à zéro à la mise en service ; annulation comptée, avec un poids qui croît à l'approche de la clôture | 12 nov. | Appliqué |
| Poids d'une annulation imputable : 1 ; 2 si elle tombe dans les 20 derniers jours avant la date limite interne et que la réservation avait plus de 30 jours. Une annulation non imputable pèse 0. Les trois valeurs sont réglables | 18 nov. | Appliqué (`regles/annulation.ts`, tests) |
| Annulation tardive : dans les 20 derniers jours avant la date limite interne (15 dans le cahier des charges) | 18 nov. | Appliqué, réglable |
| Motifs d'annulation et imputabilité. Le client renonce, le client ne répond plus : imputables si tardives (surtout sur une réservation ancienne). Dossier incomplet ou mal rempli, contrat ou fonds non éligible, enveloppe clôturée, erreur de saisie ou doublon : imputables. Enveloppe épuisée, décès du client : non imputables. Arbitrage refusé par la compagnie, opération déjà en cours sur le contrat : au choix du back-office, selon la raison, avec un commentaire | 18 nov. | Appliqué (motifs de départ, tests) |
| Pas de délai standard pour honorer une réservation : aucune péremption. À la place, un récapitulatif hebdomadaire par mail à chaque mandataire : ses réservations, ce qui est fait et ce qui reste à faire, un mot pour avancer et le lien vers la plateforme (identifiant et mot de passe) | 18 nov. | Appliqué (`regles/emailing.ts`, planificateur, tests) |
| Plus la date limite approche, plus les rappels sont fréquents : à 20 jours, deux récapitulatifs par semaine, le lundi (ce qui reste) et le jeudi (ce qui est fait et ce qui ne l'est pas) | 18 nov. | Appliqué, réglable (tests) |
| À deux semaines de la date limite, alerte au back-office : les réservations pas encore assez avancées, par mandataire, pour les appeler et les motiver. Les rôles sont partagés, le mandataire garde un niveau de responsabilité important | 18 nov. | Appliqué, réglable (test) |
| Arbitrage fonds par fonds : le total des lignes égale le montant brut, frais compris. L'arbitrage se fait sur les lignes en brut ; l'investissement réel se fait net des frais | 18 nov. | Appliqué (`regles/controles.ts`, tests) |
| Désinvestissement en pourcentage : pourcentage de l'encours du contrat. Euros ou pourcentage, au choix, pour tout le contrat ; par défaut en euros. Une bascule passe de l'un à l'autre, la valeur de l'autre côté est grisée. En pourcentage, l'encours du contrat devient obligatoire. L'encours total du client reste demandé pour le contrôle des 15 % | 18 nov. | Appliqué (serveur, écran, tests) |
| Deux campagnes menées en même temps dans deux compagnies | 15 nov. | Appliqué |
| Entités du groupe à créer : SR CONSEIL, Label Assurances, Label Santé, RJ Assurances, Nembrini Colombani, A2C Courtage, A3C (Midi Courtage) ; ajout le 17 nov. de TC2K, cabinet de co-courtage avec un cabinet d'expertise comptable. Pas CPA pour l'instant. Liste non définitive : l'administrateur peut ajouter une entité | 16 et 17 nov. | Appliqué (script d'initialisation, écran) |
| À l'ouverture d'une campagne : avenant pré-rempli, mail hebdomadaire, clients confiés, liste d'attente, indicateurs de fiabilité | 15 nov. | Appliqué ; l'avenant est fourni sous forme de fiche des valeurs à reporter, tant que les champs de l'avenant de chaque compagnie ne sont pas repérés |
| Avenant pré-rempli produit seulement quand le commercial, mandataire ou salarié, déclare que le client a accepté l'arbitrage ; il est alors mis en téléchargement. Rien n'est produit avant | 16 nov. | Appliqué pour l'arbitrage, versionné à chaque modification (test) |
| 27 novembre 2026 : présentation et lancement officiel d'au moins une des deux campagnes | 16 nov. | À faire |
| Annulation après opération par le back-office, commission reprise | début nov. | Appliqué : plus aucune commission due ; régularisation à faire avec la demande de règlement |

## 4. Socle, sécurité, données

| Décision | Date | État |
| --- | --- | --- |
| Même technologie que le socle des développeurs, habillage des maquettes | 15 nov. | Appliqué (`CLAUDE.md`) |
| Dépôt de code privé | 15 nov. | Appliqué : vérifié invisible de l'extérieur le 16 nov. |
| Hébergement chez IONOS, sur l'infrastructure déjà utilisée par Label, sans surcoût technique | 16 nov. | À faire ; réglages à voir avec Willie (machine et base propres, centre de données, sauvegarde quotidienne) |
| Connexion à deux étapes par code envoyé par courriel | 15 nov. | Appliqué : mot de passe, puis code à six chiffres envoyé par courriel |
| Appareil reconnu : après le code, « faire confiance à cet appareil » évite le code pendant 30 jours sur cet appareil ; le mot de passe reste demandé. Un nouvel appareil redemande le code. Un nouveau mot de passe ou la fermeture des sessions retire la confiance | 18 nov. | Appliqué (tests de bout en bout) |
| Accès par un site internet ; à terme, des applications mobiles iOS et Android | 18 nov. | Site appliqué (utilisable sur téléphone) ; applications à faire |
| Réglages de sécurité retenus par défaut, à valider par le cabinet : code valable 10 minutes et 5 essais ; compte bloqué 15 minutes après 5 mots de passe faux ; session de 12 heures, fermée après 2 heures sans activité ; mot de passe de 12 caractères au moins ; seul un super administrateur agit sur un super administrateur ; personne ne change son propre profil ni ne se désactive | 17 nov. | Appliqué, tests de bout en bout |
| Une adresse de connexion par personne : le code y est envoyé et chaque acte est tracé à son nom, back-office compris. Une adresse commune reste possible comme simple contact d'une société | 17 nov. | Appliqué pour l'adresse de connexion ; contact de société à faire avec les fiches mandataires |
| Un mandataire a un seul espace, qui regroupe ses sociétés et ses codes apporteur | 17 nov. | À faire |
| Pas d'étage intermédiaire (directeur de cabinet) pour l'instant : les chiffres du groupe, marge et trésorerie, sont gérés par les deux associés seuls | 17 nov. | À faire |
| Le mandataire voit les bordereaux de ses codes | 17 nov. | À faire |
| Onglet protocoles : le mandataire voit les protocoles des compagnies traduits à ses conditions, selon son protocole signé avec le cabinet. Le protocole dépend du cabinet : celui de RJ Assurances peut différer de celui de SR CONSEIL | 17 nov. | À faire |
| Modules activables par utilisateur, par case à cocher | 15 nov. | Appliqué : vérifié par le serveur à chaque demande ; le simulateur demande son module |
| Un mandataire ne voit que ses clients et ses commissions | 15 nov. | Appliqué pour les enveloppes, filtré par le serveur (test) |
| Un mandataire peut avoir plusieurs codes apporteur chez une même compagnie | 15 nov. | Appliqué (référentiel des codes apporteur) |
| Conservation des données : durée du contrat puis dix ans ; trois ans sans contact pour un prospect | 15 nov., confirmé le 18 nov. | À faire (purge automatique) |
| Conventions et protocoles signés versés dans la plateforme, consultables par l'administrateur et le mandataire concerné | 15 nov. | Appliqué pour les conventions des apporteurs (18 nov.) ; protocoles à faire |
| Aucune donnée médicale, aucun IBAN | 15 nov. | Appliqué (`CLAUDE.md`) |

## 5. Synthèse des contrats (bilan client)

| Décision | Date | État |
| --- | --- | --- |
| Pas de calcul du régime obligatoire. Il figure dans le bilan seulement s'il est dans les documents fournis ; sinon, le bilan reprend les éléments disponibles | 16 nov. | À faire |
| Pour chaque contrat : les garanties et le coût, avec un échéancier ; pour l'assurance vie et le PER : l'encours et le montant des versements réguliers | 16 nov. | À faire |

## 6. Version pour d'autres cabinets

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

## 7. Points encore ouverts

La liste complète est tenue dans le document « SR CONSEIL — Questions en attente ».
Ceux qui touchent le calcul :

- Swiss Life prévoyance : ramener la grille de 70 % à 60 % si le protocole confirme les bordereaux.
- Cardif : valeur du barème à 2,5 % de frais (30,79 % ou 30,89 %).
- Version de la grille qui fait foi, puisque deux versions coexistent.
- Correction des affaires déjà réglées, ou application aux seules affaires nouvelles.
- Nom du complément versé à un superviseur.
- Co-courtage : base du taux. Le simulateur applique 30 % sur la commission brute de la compagnie (35,3 % de ce que reçoit le cabinet) ; confirmer qu'aucune convention n'est exprimée sur le net ou à 35 %.
- Règles de reprise en santé et en assurance de prêt, et pour les compagnies de prévoyance dont le protocole ne dit rien.
- Abeille, versement unique et transfert : reprise sur toute la commission ou sur la surcommission seule.
- Swiss Life prévoyance : répartition du taux de la grille entre commission d'apport et surcommission, et baisse de la reprise la 2e année.
- Generali : le rappel de 25 % est-il repris avec l'escompte.
- Cardif : le bonus non repris.
- Prévoyance : règle de reprise de chaque gamme à vérifier.
- Versement libre et affaire nouvelle : le document pré-rempli attend-il aussi l'accord du client. En attendant, rien n'est produit pour ces deux types.
- Code partagé : à l'affectation, quelle part par défaut pour le mandataire (son taux habituel ?), et la part peut-elle différer entre commission d'acquisition et récurrent.
- Code partagé : un mandataire peut-il réserver un arbitrage sur un contrat affecté à un autre mandataire.
- Taux de reversement porté par chaque ligne société du mandataire (protocole signé par société), comme le prévoit le cahier des charges du socle : proposé le 17 nov., à confirmer.

### Lectures retenues en construisant le module Enveloppes, à confirmer

Chacune est appliquée telle qu'écrite dans le cahier des charges ; la question porte sur
le sens exact. La plateforme la signale à l'écran quand elle a un effet visible.

- Taux de réalisation : lignes validées par le back-office dans les 12 derniers mois et
  arrivées à leur terme (vérifiées, libérées, annulées pour un motif imputable).
- Liste d'attente à la date limite interne : les demandes non servies restent en liste
  d'attente, les mandataires sont prévenus, et le back-office les annule avant la
  clôture. Faut-il un statut propre ?
- Alerte au back-office sans décision après N jours ouvrés, écart sans motif après un
  délai : valeurs à fixer ; rien ne part tant qu'elles ne le sont pas. Les relances au
  mandataire sont remplacées par les récapitulatifs décidés le 18 novembre.
- « Montant élevé rapporté à l'encours » : aucun seuil n'est écrit ; la part de
  l'encours est affichée au back-office, sans alerte.
- Concentration : le client est reconnu à son nom et son prénom (ou sa raison sociale),
  la date de naissance n'étant pas retenue ; deux homonymes sont donc cumulés.
- Numéro de contrat : un modèle simple par compagnie (9 pour un chiffre, A pour une
  lettre), à remplir à partir des bordereaux ; vide, seule la présence est contrôlée.

### Lectures retenues en appliquant les décisions du 18 novembre, à confirmer

Petits choix faits pour coder ce qui a été décidé. Chacun se règle depuis l'écran des
paramètres ou se change en une ligne.

- Le second récapitulatif part le lundi à la même heure que celui du jeudi (9 h 01).
- Le récapitulatif du lundi ne reprend que ce qui reste à faire ; celui du jeudi, ce qui
  reste et ce qui est fait.
- L'alerte de J-14 part au back-office seul. Elle liste les réservations soumises,
  renvoyées, en liste d'attente, validées sans opération, ou échues.
- Motifs de refus de départ : ceux des motifs d'annulation qui ont un sens avant la
  validation (dossier incomplet, contrat ou fonds non éligible, enveloppe épuisée ou
  clôturée, erreur de saisie ou doublon, opération déjà en cours).
- Un motif « au choix du back-office » n'est pas proposé au mandataire.
- « Faire confiance à cet appareil » est coché par défaut ; la personne le décoche sur
  un ordinateur partagé.
- Convention : une convention s'ajoute toujours avec son document signé. Le taux retenu
  pour un client confié est celui de la dernière convention qui en fixe un, en vigueur
  le jour où le client est confié ; il est ensuite figé sur ce client.
- Ancienneté d'une réservation pour le poids double : de sa saisie à son annulation.
