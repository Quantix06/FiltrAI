# 🔍 FiltrAI — Assistant de Fact-Checking en Temps Réel

**FiltrAI** est une application web mobile-first conçue pour écouter les conversations en direct et vérifier l'exactitude des affirmations énoncées en temps réel grâce à l'Intelligence Artificielle et à la recherche web instantanée.

L'application capture l'audio du microphone, transcrit la parole en texte, identifie les affirmations factuelles vérifiables, effectue des recherches en ligne automatiques et présente des verdicts sourcés et clairs.

---

## 🚀 Fonctionnalités Clés

*   🎙️ **Transcription Multi-Mode en Direct** :
    *   **Web Speech API** : Solution native, gratuite et sans clé API requise, idéale pour une transcription rapide.
    *   **Deepgram WebSocket** : Transcription haute fidélité avec gestion avancée de la ponctuation et du formatage.
*   👥 **Diarisation et Identification des Locuteurs** :
    *   Reconnaissance automatique des différents intervenants (avec Deepgram).
    *   Interface interactive permettant de renommer les locuteurs en temps réel (ex. *Intervenant 1* ➔ *Alice*), mettant à jour rétroactivement les transcriptions et les verdicts associés.
*   📊 **Visualiseur Audio Dynamique** :
    *   Oscilloscope basé sur l'API Web Audio et rendu en temps réel sur un `<canvas>` pour une rétroaction visuelle du volume.
*   🧠 **Pipeline de Fact-Checking Intelligent** :
    *   **Extraction** : Analyse continue du flux par un LLM (via **OpenRouter** ou **Anthropic**) pour repérer les déclarations factuelles vérifiables en ignorant les opinions ou jugements subjectifs.
    *   **Vérification Web (RAG)** : Recherche automatique sur internet via l'API **Serper** en appliquant des filtres stricts (exclusion des réseaux sociaux et blogs non fiables).
    *   **Génération du Verdict** : Confrontation des sources web et de l'affirmation pour prononcer un verdict étayé : `TRUE` (Vrai), `SUBSTANTIALLY TRUE` (Plutôt Vrai), `MISLEADING` (Trompeur) ou `FALSE` (Faux).
*   🔄 **Persistance des Sessions & Séparateurs** :
    *   L'historique des transcriptions et des fact-checks est préservé d'une session d'écoute à l'autre.
    *   Des **séparateurs de session** (ex. `Nouvelle session — 23:28`) s'insèrent automatiquement pour séparer clairement les différents enregistrements.
*   👁️ **Filtres d'Affichage & Purge** :
    *   Possibilité de masquer ou afficher les phrases jugées "non intéressantes" (sans affirmation factuelle) à l'aide d'un bouton d'action doté d'un œil dynamique (`👁️` / `🙈`).
    *   Un bouton de **purge** (`🗑️ Purger les inutiles`) permet de supprimer définitivement ces phrases non pertinentes de la liste de transcription en cours.
*   📋 **Exportation & Copie Rapide** :
    *   **Téléchargement** : Génération et téléchargement d'un rapport complet au format Markdown (`.md`) contenant le journal de transcription horodaté par locuteur ainsi que la liste des verdicts détaillés avec leurs liens sources cliquables.
    *   **Copie Clipboard** : Un bouton de copie (`📋`) dans l'en-tête permet de copier directement ce rapport Markdown dans votre presse-papier pour un partage instantané.
*   🌐 **Internationalisation (i18n)** :
    *   Gestion multilingue complète à partir d'un système de dictionnaires.
    *   Support de 6 langues : **Français** 🇫🇷, **English** 🇺🇸, **Español** 🇪🇸, **Italiano** 🇮🇹, **Português** 🇧🇷 et **Deutsch** 🇩🇪.
    *   Traduction dynamique de l'interface, des paramètres, du guide utilisateur ainsi que des statuts renvoyés par les moteurs de capture audio.
*   💡 **Guide Utilisateur Intégré** :
    *   Un bouton flottant latéral **TUTO 💡** ouvre un guide interactif pas-à-pas affichant les explications de configuration (mentionnant que des clés gratuites sont disponibles pour **Google Serper** et **OpenRouter**) et d'utilisation.
*   📱 **Design Premium Mobile-First** :
    *   Interface sombre élégante avec effets de verre trempé (glassmorphism), animations de chargement de vérification IA et polices modernes (*Outfit* & *Inter*), optimisée spécifiquement pour l'utilisation sur smartphone.

---

## 🛠️ Stack Technique & Architecture

*   **Framework** : [React 19](https://react.dev/) + [Vite](https://vite.dev/)
*   **Architecture Modulaire (Clean Code)** : Le code a été entièrement réfactorisé en composants indépendants à responsabilité unique (Single Responsibility Principle) situés dans `src/components/` :
    *   `Header` : En-tête de l'application et actions (Export, Copie, Paramètres).
    *   `VisualizerCard` : Visualiseur de volume et contrôles de capture audio.
    *   `SpeakersDashboard` : Tableau de bord de gestion des locuteurs actifs.
    *   `NewSpeakerPrompt` : Dialogue d'identification vocale rapide.
    *   `TranscriptBubble` : Bulle de transcription avec indicateurs de pertinence.
    *   `VerdictCard` : Carte résumé d'évaluation factuelle.
    *   `TranscriptToolbar` : Filtres de masquage et bouton de purge.
    *   `SessionDivider` : Séparateurs de sessions d'écoute.
    *   `RenameSpeakerModal` : Dialogue de modification de nom.
    *   `VerdictDetailsModal` : Tiroir de détails des verdicts et liens sources.
    *   `TutorialModal` : Modal d'aide interactive.
    *   `SettingsModal` : Configuration des clés d'API et langues.
*   **Audio** : Web Audio API (visualisation) et Web Speech API / WebSockets (transcription)
*   **Style** : CSS Vanilla moderne avec variables personnalisées, flexbox/grid et responsive mobile-first
*   **Linter** : [Oxlint](https://github.com/oxc-project/oxc) pour des performances d'analyse de code ultra-rapides

---

## 🔑 Configuration des API

Pour fonctionner pleinement, l'application nécessite des clés d'API configurables directement dans le panneau de paramètres de l'application (les clés sont sauvegardées de manière sécurisée en local dans le `localStorage` de votre navigateur).

1.  **Moteur de recherche (Obligatoire pour le Fact-Checking)** :
    *   **Serper API Key** : Utilisée pour effectuer des recherches Google en arrière-plan. Des **clés gratuites** (2500 requêtes gratuites à l'inscription) sont disponibles sur [Serper.dev](https://serper.dev/).
2.  **Modèle de Langage (LLM - Au moins un requis)** :
    *   **OpenRouter API Key** : Accès à des dizaines de modèles (par défaut `cohere/north-mini-code:free` ou des modèles plus puissants). **Des modèles gratuits et performants** sont utilisables sans surcoût. Créez un compte sur [OpenRouter.ai](https://openrouter.ai/).
    *   **Anthropic API Key** : Accès direct aux modèles Claude (ex. `claude-haiku-4-5-20251001`). Obtenez uma clé sur la [console Anthropic](https://console.anthropic.com/).
3.  **Transcription Avancée (Optionnelle)** :
    *   **Deepgram API Key** : Permet d'activer la transcription haute fidélité avec diarisation (détection de qui parle). Créez un compte sur [Deepgram.com](https://deepgram.com/).

---

## 💻 Démarrage Rapide

### 1. Installation des Dépendances
Lancez la commande suivante à la racine du dossier `FiltrAI` :
```bash
npm install
```

### 2. Lancement du Serveur de Développement
Démarrez l'application localement :
```bash
npm run dev
```
Ouvrez l'adresse locale indiquée dans votre terminal (généralement `http://localhost:5173`).

### 3. Build pour la Production
Pour compiler l'application de façon optimisée pour le déploiement :
```bash
npm run build
```

### 4. Analyse Statistique (Linter)
Vérifiez la qualité du code avec Oxlint :
```bash
npm run lint
```

---

## 🛡️ Sécurité & Confidentialité

*   **Stockage local** : Toutes vos clés d'API et configurations sont enregistrées dans le `localStorage` de votre propre navigateur. Elles ne transitent par aucun serveur intermédiaire propre à FiltrAI.
*   **Appels directes** : Les requêtes vers OpenRouter, Anthropic, Deepgram et Serper s'effectuent directement depuis votre navigateur.
*   **Filtrage des sources** : Le pipeline exclut automatiquement les plateformes communautaires et réseaux sociaux (Reddit, Twitter/X, Facebook, TikTok, etc.) afin de garantir une vérification basée sur des sources d'information fiables.
