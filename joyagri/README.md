# JOYAGRI — Ventes, stock et comptabilité

Application hors ligne pour une entreprise à **deux activités suivies séparément partout** :

1. **Services agricoles** : prestations sans stock, prix selon une unité propre à chaque service.
2. **Crème glacée** : achat-revente avec un prix de **gros** et un prix de **détail**.

Le même code fonctionne sur trois supports :

- dans un navigateur, en ouvrant `index.html` ;
- sur Windows, avec Electron (dossier `electron/`) ;
- sur Android, dans une WebView (à venir).

> **Confidentialité.** Le code ne contient **aucune donnée réelle**. Les informations de l'entreprise (NIF, NINU, adresse…) se saisissent au premier démarrage ou s'importent depuis un fichier « profil ». Ne publiez jamais une sauvegarde ni un profil dans un dépôt public.

## Démarrer

| Support | Comment |
|---|---|
| Essai rapide | Ouvrir `index.html` dans Chrome ou Edge |
| Windows | `npm install`, puis `npm start` (développement) ou `npm run dist:win` (installateur `.exe`) |
| Tests | `npm test` : 31 tests (calculs, écritures équilibrées, amortissements, scénario complet) |

**Au premier démarrage** :

1. Saisir l'entreprise, puis créer le compte du propriétaire. Aucun mot de passe n'est fourni d'avance.
2. Remplir le **Catalogue** : produits de crème glacée et services agricoles.
3. Saisir le **Bilan d'ouverture** (Comptabilité). Cela crée le stock de départ et les immobilisations.
4. Créer les comptes des vendeurs (**Utilisateurs**).

Pour un essai, le bouton *Sauvegarde → Charger les données d'exemple* remplit l'application avec des données fictives.

## Modules

| Module | Ce qu'il fait |
|---|---|
| Nouvelle vente | Fiche mixte (glace et services), prix gros ou détail appliqué automatiquement avec sa raison, réduction par ligne et sur toute la fiche (en % ou en HTG), 5 modes de paiement, paiement complet, partiel ou à crédit, monnaie rendue, date promise |
| Fiches | Liste et recherche ; réimpression ; ticket 58/80 mm, facture A5/A4 ; WhatsApp (texte ou image) ; annulation avec motif, sans suppression |
| Crédits | Ancienneté des dettes (0-7, 8-30, plus de 30 jours), encaissement sur une fiche ancienne, rappel WhatsApp prêt à envoyer, relevé de compte |
| Clients | Particulier ou grossiste, plafond de crédit, historique, montant dû, points de fidélité |
| Catalogue | Glaces (prix d'achat, de gros et de détail, quantité minimale pour le gros, seuil d'alerte) et services (unité, prix, coût estimé, matériel) |
| Stock | Coût moyen pondéré, pertes avec motif (fonte, coupure de courant…), inventaire physique avec écarts, alerte de stock bas, alerte « produits qui dorment » (risque de fonte), prévision d'achat |
| Achats | Fournisseurs, achat payé, partiel ou à crédit, photo de la pièce justificative, paiement des fournisseurs |
| Caisse | Ouverture, mouvements, comptage par billets et pièces, clôture, écart passé en comptabilité |
| Dépenses | Catégorie, activité concernée, photo du reçu |
| Comptabilité | Bilan d'ouverture, **immobilisations et amortissements**, journal, grand livre, balance, bilan, compte de résultat par activité, trésorerie, plan comptable modifiable |
| Rapports | Par période ; par activité, produit, client et vendeur ; marges ; graphiques ; export CSV |
| Utilisateurs | Rôles propriétaire et vendeur, journal des actions |
| Sauvegarde | Export et import, copie automatique chaque jour (14 jours sur l'appareil, 30 jours dans `Documents/JOYAGRI` sur Windows) |

## Amortissement linéaire

- **Base** : coût d'achat − valeur résiduelle.
- **Dotation mensuelle** : base ÷ durée en mois. Elle commence le **mois de mise en service**.
- **Dernier mois** : il absorbe l'écart d'arrondi, pour que le bien finisse exactement à sa valeur résiduelle.
- **Biens du bilan d'ouverture** : les amortissements déjà faits avant la date de départ sont calculés automatiquement, et restent modifiables.
- **Achat d'un équipement** (payé, partiel ou à crédit) : écriture 218x / trésorerie ou 401. Si la mise en service est déjà passée, l'amortissement rattrape les mois manquants.
- **Écriture mensuelle** : 681 Dotations / 28xx Amortissements, passée avec le bouton « Passer les amortissements ». Un même mois n'est jamais amorti deux fois.
- **Sortie d'un bien** (vente ou mise au rebut) : l'amortissement est d'abord passé jusqu'au mois de sortie. Ensuite :
  - 28xx (débit) et 675 VNC (débit) / 218x (crédit) ;
  - si le bien est vendu : trésorerie (débit) / 775 Produit de cession (crédit) ;
  - la plus-value ou la moins-value est affichée.
- **Tableau d'amortissement** : année par année pour chaque bien, imprimable.

**Durées proposées, à valider** :

| Bien | Durée |
|---|---|
| Installation solaire | 10 ans |
| Matériel agricole | 8 ans |
| Congélateurs | 5 ans |
| Transport | 5 ans |
| Mobilier | 5 ans |
| Glacières | 3 ans |
| Informatique et téléphone | 3 ans |

## Plan comptable proposé (à valider)

**Classe 1 — Capitaux** : 101 Capital (apport) · 108 Compte de l'exploitant · 164 Emprunts.

**Classe 2 — Immobilisations** :

- 2154 Matériel agricole
- 2181 Installation solaire
- 2182 Transport
- 2183 Informatique
- 2184 Mobilier
- 2185 Congélateurs
- 2186 Glacières
- 2188 Autres

À chacune correspond un compte d'amortissement 28xxx.

**Classe 3 — Stock** : 37 Stock de crème glacée, en inventaire permanent au coût moyen pondéré.

**Classe 4 — Tiers** : 401 Fournisseurs · 411 Clients · 421 Personnel.

**Classe 5 — Trésorerie** : 512 Banque (virements, chèques) · 5141 MonCash · 5142 NatCash · 531 Caisse.

**Classe 6 — Charges** :

- 6045 Coûts directs des services agricoles
- 6061 Électricité
- 6062 Carburant
- 6063 Glace
- 6064 Fournitures
- 6071 Coût des glaces vendues
- 613 Loyer
- 615 Entretien
- 6241 Transport
- 626 Téléphone
- 627 Frais MonCash et banque
- 641 Salaires
- 658 Charges diverses
- 6587 Pertes sur stock
- 6588 Manquants de caisse
- 675 VNC des biens sortis
- 681 Dotations aux amortissements

**Classe 7 — Produits** : 7061 **Prestations de services agricoles** · 7071 **Ventes de glace en gros** · 7072 **Ventes de glace au détail** · 7587 Excédents d'inventaire · 7588 Excédents de caisse · 775 Cessions d'immobilisations.

Chaque ligne de charge ou de produit porte une **activité** (Services, Crème glacée ou Commun), ce qui donne le **résultat par activité**.

Les réductions sont enregistrées en déduction directe du produit. La réduction sur toute la fiche est répartie au prorata entre les lignes : chaque compte de produit reçoit ainsi son montant net exact.

## Écritures automatiques

| Opération | Écriture |
|---|---|
| Vente | 531/5141/5142/512 (part payée) + 411 (reste) / 7061, 7071, 7072 ; et 6071 / 37 au coût moyen |
| Encaissement d'un crédit | Trésorerie / 411 |
| Annulation | Contre-passation complète ; le stock est remis |
| Achat de glace | 37 / trésorerie + 401 |
| Paiement fournisseur | 401 / trésorerie |
| Dépense | 6xxx / trésorerie |
| Perte | 6587 / 37 |
| Inventaire | 6587 / 37 (manquant) ou 37 / 7587 (excédent) |
| Écart de caisse | 6588 / 531 (manquant) ou 531 / 7588 (excédent) |
| Bilan d'ouverture | Actifs / dettes ; le capital (101) est l'écart, donc le bilan est toujours équilibré |

Toute écriture déséquilibrée est **refusée** par le programme.

## Imprimer

| Appareil | Méthode |
|---|---|
| PC Windows | Pilote de l'imprimante, puis impression du système (ticket 58/80 mm, A5 ou A4) |
| Android avec imprimante Bluetooth ESC/POS | Application gratuite **RawBT**, puis *Paramètres → Mode d'impression → ESC/POS* |

En mode ESC/POS, le ticket est généré par JOYAGRI : logo tramé en noir et blanc, accents français (page de code PC858), coupe du papier. L'APK Android pourra aussi imprimer directement par le pont `AndroidPrinter.printBase64`.

## Ce qu'il reste à faire

- **APK Android signé** (WebView, avec le pont d'impression et l'écriture dans `Documents/JOYAGRI`).
- **Synchronisation Firebase** (en option), en respectant les règles du cahier des charges :
  - un appareil qui n'a jamais été synchronisé reçoit d'abord les données du serveur ;
  - aucun mot de passe par défaut ;
  - pas de nouvelles tentatives en boucle.
- **Module « Production »** (récoltes, intrants, coûts de culture) : la structure par activité est prête à le recevoir.
