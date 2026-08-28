# Suivi Heures Supp — version hors Google Apps Script

Réécriture complète de l'application (auparavant sur Google Apps Script) en dehors de Google, tout en gardant :
- **Google Sheets** comme base de données (la même feuille que vous utilisez déjà),
- **les adresses email de l'établissement** pour identifier les gens (connexion Google restreinte à votre domaine),
- **l'envoi d'emails** de confirmation et de validation.

Le principal bénéfice recherché : plus de navigation quasi instantanée entre les pages (une vraie application web, pas de rechargement complet à chaque clic comme avec Apps Script), et un import/déploiement piloté par un vrai dépôt de code (Git/GitHub) plutôt que du copier-coller dans un éditeur en ligne.

**⚠️ Important** : ce guide suppose que vous n'avez jamais fait ça. Suivez les étapes dans l'ordre, une par une. Ça prend du temps (compter une bonne heure la première fois), mais chaque étape est autonome — si vous bloquez sur l'une d'elles, dites-moi laquelle et où exactement.

---

## Sommaire

1. [Ce dont vous avez besoin](#1-ce-dont-vous-avez-besoin)
2. [Créer le projet Google Cloud](#2-créer-le-projet-google-cloud)
3. [Créer le compte de service (accès à Sheets et Drive)](#3-créer-le-compte-de-service-accès-à-sheets-et-drive)
4. [Autoriser l'envoi de mails au nom de l'établissement](#4-autoriser-lenvoi-de-mails-au-nom-de-létablissement)
5. [Créer l'identifiant de connexion (Google Sign-In)](#5-créer-lidentifiant-de-connexion-google-sign-in)
6. [Préparer la feuille Google Sheets](#6-préparer-la-feuille-google-sheets)
7. [Récupérer le projet et l'installer en local](#7-récupérer-le-projet-et-linstaller-en-local)
8. [Configurer les variables d'environnement](#8-configurer-les-variables-denvironnement)
9. [Premier lancement en local](#9-premier-lancement-en-local)
10. [Mettre le projet sur GitHub](#10-mettre-le-projet-sur-github)
11. [Déployer en ligne (Render)](#11-déployer-en-ligne-render)
12. [Tester sur téléphone](#12-tester-sur-téléphone)
13. [Ce qui diffère de la version Apps Script](#13-ce-qui-diffère-de-la-version-apps-script)
14. [Maintenance courante](#14-maintenance-courante)

---

## 1. Ce dont vous avez besoin

- Un accès **administrateur** à votre Google Workspace (pour l'étape 4 — délégation d'emails). Si vous ne l'avez pas, il faudra l'aide de votre IT/administrateur Workspace pour cette seule étape.
- **Node.js** installé sur votre ordinateur (version 20 ou plus). Téléchargez-le sur [nodejs.org](https://nodejs.org) (bouton "LTS"), installez-le normalement (Suivant, Suivant, Terminer). Vérifiez ensuite dans un terminal :
  ```bash
  node --version
  ```
  Ça doit afficher quelque chose comme `v20.x.x` ou plus.
- Un compte **GitHub** (gratuit) — [github.com](https://github.com) si vous n'en avez pas.
- Un compte sur une plateforme d'hébergement — ce guide utilise **[Render](https://render.com)** (gratuit pour démarrer, simple, se connecte directement à GitHub).

---

## 2. Créer le projet Google Cloud

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com), connectez-vous avec votre compte @établissement.
2. En haut, cliquez sur le sélecteur de projet → **Nouveau projet**.
3. Nom du projet : `Suivi Heures Supp` (ou ce que vous voulez). Laissez l'organisation par défaut. Cliquez **Créer**.
4. Une fois le projet créé, sélectionnez-le (en haut, vérifiez que c'est bien lui qui est actif).
5. Dans le menu de gauche (☰) → **APIs et services** → **Bibliothèque**. Activez ces 3 API une par une (cherchez leur nom, cliquez dessus, bouton **Activer**) :
   - **Google Sheets API**
   - **Google Drive API**
   - **Gmail API**

---

## 3. Créer le compte de service (accès à Sheets et Drive)

Un "compte de service" est une identité robot que votre application utilise pour parler à Google Sheets/Drive, sans dépendre d'un compte personnel.

1. Menu ☰ → **APIs et services** → **Identifiants**.
2. **Créer des identifiants** → **Compte de service**.
3. Nom : `suivi-hse-backend`. Cliquez **Créer et continuer**, puis **Continuer**, puis **OK** (pas besoin de rôle particulier ici).
4. Dans la liste des comptes de service, cliquez sur celui que vous venez de créer.
5. Onglet **Clés** → **Ajouter une clé** → **Créer une clé** → format **JSON** → **Créer**.

   > ⚠️ **Si un écran "Gérer les règles d'administration" apparaît au lieu de télécharger la clé** (ou un message bloquant la création) : les organisations Google Workspace appliquent parfois par défaut une règle de sécurité qui interdit la création de clés JSON pour les comptes de service (règle `iam.disableServiceAccountKeyCreation`). Pour l'autoriser sur ce projet uniquement :
   > 1. Allez dans **IAM et administration** → **Règles d'administration** (ou cliquez sur le lien affiché dans le message).
   > 2. Cherchez **"Désactiver la création de clés de compte de service"** et cliquez dessus.
   > 3. En haut, vérifiez que le sélecteur de ressource pointe bien sur **ce projet précis** (pas toute l'organisation, pour ne pas affaiblir la sécurité ailleurs).
   > 4. **Gérer la règle** → **Remplacer la règle du parent** → ajoutez une règle **Appliquée : Non** → **Définir la règle**.
   > 5. Revenez à l'étape 5 ci-dessus et recréez la clé (patientez une ou deux minutes si ça ne fonctionne pas immédiatement).
   >
   > Il faut un compte avec le rôle **Administrateur des règles d'administration** au niveau de l'organisation pour faire ça — si ce n'est pas votre cas, demandez à la personne qui administre votre Google Workspace.

6. Un fichier `.json` se télécharge automatiquement. **Renommez-le `service-account.json`** et gardez-le de côté (vous le placerez dans le projet à l'étape 7). **Ne le partagez jamais publiquement** (pas sur GitHub, pas par email) — c'est l'équivalent d'un mot de passe.
7. Notez aussi l'**adresse email** de ce compte de service, visible sur sa page (ressemble à `suivi-hse-backend@votre-projet.iam.gserviceaccount.com`) — vous en aurez besoin à l'étape 6.

---

## 4. Autoriser l'envoi de mails au nom de l'établissement

Cette étape nécessite un accès **administrateur Workspace** (pas juste le projet Google Cloud). Si ce n'est pas vous, transmettez ces instructions à votre IT.

1. Retournez sur la page du compte de service (étape 3), onglet général. Notez son **ID unique** (une longue suite de chiffres, différente de son adresse email).
2. Allez sur [admin.google.com](https://admin.google.com) → **Sécurité** → **Accès aux données et contrôle** → **Contrôles des API** → **Délégation à l'échelle du domaine**.
3. **Ajouter un nouveau** :
   - ID client : l'ID unique noté en 1.
   - Champs d'application OAuth : `https://www.googleapis.com/auth/gmail.send`
4. **Autoriser**.
5. Choisissez l'adresse email qui enverra les mails (ex : `suivi-heures@votre-établissement.fr`, une adresse existante ou une nouvelle boîte que vous créez pour l'occasion) — vous la renseignerez dans `GMAIL_SENDER_ADDRESS` à l'étape 8.

---

## 5. Créer l'identifiant de connexion (Google Sign-In)

C'est ce qui permet à vos utilisateurs de se connecter avec leur compte @établissement (remplace `Session.getActiveUser()` d'Apps Script).

1. Menu ☰ → **APIs et services** → **Écran de consentement OAuth**.
2. Type d'utilisateur : choisissez **Interne** si l'option est proposée (réserve la connexion aux comptes de votre organisation — sinon, ne vous inquiétez pas, une vérification supplémentaire est déjà faite dans le code, voir `ALLOWED_WORKSPACE_DOMAIN`).
3. Remplissez le nom de l'app (`Suivi Heures Supp`) et un email de contact. Enregistrez.
4. Menu ☰ → **APIs et services** → **Identifiants** → **Créer des identifiants** → **ID client OAuth**.
5. Type d'application : **Application Web**.
6. Nom : `Suivi Heures Supp - Web`.
7. **Origines JavaScript autorisées** — ajoutez (vous complèterez avec l'URL définitive à l'étape 11) :
   - `http://localhost:5173` (pour tester en local)
   - votre future URL Render, ex. `https://suivi-hse.onrender.com` (vous pourrez revenir la modifier après le déploiement)
8. **Créer**. Copiez le **Client ID** affiché (ressemble à `123456-abc.apps.googleusercontent.com`) — vous en aurez besoin à l'étape 8 (deux fois : côté serveur et côté frontend).

---

## 6. Préparer la feuille Google Sheets

Vous pouvez réutiliser votre feuille actuelle telle quelle.

1. Ouvrez votre feuille Google Sheets, bouton **Partager**.
2. Ajoutez l'**adresse email du compte de service** (notée à l'étape 3.7), rôle **Éditeur**.
3. Copiez l'**ID de la feuille** dans son URL : `https://docs.google.com/spreadsheets/d/`**`CET_ID_ICI`**`/edit`.

Si votre logo est un fichier Google Drive : partagez-le aussi avec l'adresse du compte de service (rôle **Lecteur** suffit), et notez son ID (entre `/d/` et `/view` dans son lien de partage), comme avec Apps Script.

---

## 7. Récupérer le projet et l'installer en local

1. Placez le fichier `service-account.json` (téléchargé à l'étape 3) directement à la racine de ce dossier de projet (`SuiviHSE-HorsGoogle/service-account.json`).
2. Ouvrez un terminal dans ce dossier (`C:\Users\leger\Documents\Claude\SuiviHSE-HorsGoogle`), puis installez les dépendances du serveur :
   ```bash
   npm install
   ```
3. Faites la même chose pour le frontend :
   ```bash
   cd client
   npm install
   cd ..
   ```

---

## 8. Configurer les variables d'environnement

1. À la racine du projet, copiez `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
   (sous Windows PowerShell : `Copy-Item .env.example .env`)
2. Ouvrez `.env` et remplissez chaque valeur avec ce que vous avez noté aux étapes précédentes :
   - `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` → laissez `./service-account.json` si vous avez suivi l'étape 7.
   - `GOOGLE_OAUTH_CLIENT_ID` → le Client ID de l'étape 5.8.
   - `ALLOWED_WORKSPACE_DOMAIN` → votre domaine (ex. `lsv77.fr`, sans @).
   - `SPREADSHEET_ID` → l'ID noté à l'étape 6.3.
   - `GMAIL_SENDER_ADDRESS` → l'adresse choisie à l'étape 4.5.
   - `LOGO_FILE_ID` → l'ID du logo (étape 6), ou laissez vide.
   - `DEPLOY_NOTIF_EMAILS` → les adresses qui reçoivent la notification de déploiement.
3. Dans le dossier `client/`, copiez aussi `.env.example` en `.env` :
   ```bash
   cd client
   cp .env.example .env
   cd ..
   ```
4. Ouvrez `client/.env` et remplissez :
   - `VITE_GOOGLE_OAUTH_CLIENT_ID` → **le même** Client ID qu'à l'étape 8.2.
   - `VITE_SPREADSHEET_URL` → l'URL complète de votre feuille (optionnel, pour le bouton dans la page Admin).

---

## 9. Premier lancement en local

1. Créez les onglets manquants sur votre feuille (ConfigAdmin, BudgetHSE, HSE/PACTE/HNF + onglets de workflow) :
   ```bash
   npm run setup
   ```
   Ça n'écrase rien d'existant, ça ne fait qu'ajouter ce qui manque.
2. Remplissez à la main, comme avant, les onglets `ConfigAdmin` (emails admins, à partir de la ligne 2 — colonne "Rôle" optionnelle : laissez vide, ou `Directeur` / `Direction` / `Secrétariat` pour les notifications spéciales), `ConfigPersonnel` (Nom Prénom / Email), `ConfigHSE` (Catégorie / Mission), `ConfigPACTE` (Mission).
3. Lancez le serveur (dans un premier terminal, à la racine) :
   ```bash
   npm run dev
   ```
4. Lancez le frontend (dans un **second** terminal, dans `client/`) :
   ```bash
   cd client
   npm run dev
   ```
5. Ouvrez `http://localhost:5173` dans votre navigateur. Vous devriez voir l'écran de connexion Google, puis le menu après connexion.

Si quelque chose ne fonctionne pas, regardez les messages d'erreur dans les deux terminaux — ils sont généralement explicites (variable manquante, accès refusé sur la feuille, etc.).

---

## 10. Mettre le projet sur GitHub

1. Sur [github.com](https://github.com), bouton **New repository**. Nom : `suivi-hse` (ou ce que vous voulez). Laissez-le **privé**. Ne cochez rien d'autre (pas de README/gitignore, on les a déjà). **Create repository**.
2. Dans le terminal, à la racine du projet :
   ```bash
   git init
   git add .
   git commit -m "Version initiale"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/suivi-hse.git
   git push -u origin main
   ```
   (remplacez l'URL par celle affichée sur la page GitHub après création du dépôt)

**Vérifiez bien** que `service-account.json` et les fichiers `.env` ne sont PAS partis sur GitHub (le `.gitignore` fourni les exclut déjà normalement) — tapez `git status` avant le premier commit et assurez-vous qu'ils n'apparaissent pas dans la liste.

---

## 11. Déployer en ligne (Render)

1. Sur [render.com](https://render.com), créez un compte (vous pouvez vous connecter directement avec GitHub).
2. **New** → **Web Service**. Connectez votre dépôt GitHub `suivi-hse`.
3. Renseignez :
   - **Name** : `suivi-hse`
   - **Region** : Frankfurt (le plus proche de la France)
   - **Build Command** :
     ```
     npm install && cd client && npm install && npm run build && cd ..
     ```
   - **Start Command** :
     ```
     node server/index.js
     ```
   - **Instance Type** : Free (suffisant pour démarrer)
4. Section **Environment Variables** : ajoutez toutes les variables de votre fichier `.env` racine (une par une : clé + valeur), **sauf** `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`.
5. Section **Secret Files** (dans les réglages avancés) : ajoutez un fichier avec :
   - **Filename** : `service-account.json`
   - **Contents** : collez tout le contenu de votre fichier `service-account.json` local (ouvrez-le avec le Bloc-notes, copiez tout).
6. Remettez `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=service-account.json` dans les variables d'environnement (Render place les fichiers secrets à la racine du service).
7. **Create Web Service**. Render installe, construit et démarre l'app (comptez quelques minutes la première fois). Une URL du type `https://suivi-hse.onrender.com` vous est attribuée.
8. Retournez dans Google Cloud Console (étape 5) → votre identifiant OAuth → ajoutez cette URL Render dans **Origines JavaScript autorisées**.
9. Sur Render, ajoutez aussi `VITE_GOOGLE_OAUTH_CLIENT_ID` et `VITE_SPREADSHEET_URL` en variables d'environnement (le build du frontend en a besoin au moment du `npm run build`).
10. Redéployez (**Manual Deploy** → **Deploy latest commit**) pour prendre en compte les nouvelles variables.

**Note sur le plan gratuit Render** : le service s'endort après 15 minutes d'inactivité et met quelques secondes à se réveiller au premier accès suivant. Si c'est gênant pour vos utilisateurs, passez à un plan payant (~7$/mois) une fois l'app validée.

---

## 12. Tester sur téléphone

L'interface est déjà pensée pour le mobile (boutons larges, pas de zoom intempestif, tableaux avec défilement horizontal). Ouvrez simplement l'URL Render sur votre téléphone — vous pouvez aussi l'ajouter à l'écran d'accueil (menu du navigateur → "Ajouter à l'écran d'accueil") pour qu'elle se comporte comme une application.

---

## 13. Ce qui diffère de la version Apps Script

Cette version couvre l'essentiel du flux (connexion, 3 formulaires, tableau de bord personnel, administration complète avec budget/statistiques/validation). Quelques différences à connaître :

- **Statistiques** : graphiques en barres simples (fiables partout) au lieu des donuts Google Charts, avec boutons d'export **PNG**/**PDF** directement depuis la fenêtre de stats.
- **Notification de déploiement** : désormais déclenchée manuellement depuis la page Admin (bouton dans l'encadré du lien de partage), plus fiable qu'un déclenchement automatique.
- **Rôles dans ConfigAdmin** : une colonne "Rôle" optionnelle permet de désigner un **Directeur** (notifié à la création et sur validation/refus), une **Direction** et un **Secrétariat** (notifiés uniquement quand une déclaration d'heures non faites est traitée) — voir le détail dans le code (`server/service.js`, section "Destinataires spéciaux").

---

## 14. Maintenance courante

- **Modifier le code** : je vous donnerai les fichiers à changer ; committez et poussez (`git add . && git commit -m "..." && git push`) — Render redéploie automatiquement à chaque push sur `main`.
- **Ajouter un admin** : modifiez directement l'onglet `ConfigAdmin` sur Google Sheets, aucune action technique nécessaire.
- **Voir les erreurs serveur** : sur Render, onglet **Logs** du service.
