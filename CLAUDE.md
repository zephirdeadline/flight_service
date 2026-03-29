# Flight Service Career - Instructions pour Claude

## 📋 Description du Projet

Application desktop Tauri + React + TypeScript simulant un mode carrière pour Flight Simulator 2024.
L'utilisateur gère sa carrière de pilote : achète des avions, accepte des missions, gagne de l'argent.

## 🛠️ Stack Technique

- **Frontend** : React 19 + TypeScript
- **Backend** : Rust + Tauri 2
- **Database** : SQLite (via rusqlite)
- **Build** : Vite 7
- **Routing** : React Router 7
- **Gestionnaire de paquets** : **pnpm uniquement** (ne JAMAIS utiliser npm)
- **Styling** : CSS vanilla (pas de framework CSS)

## 📁 Structure du Projet

```
src/                         # Frontend React
├── types/index.ts           # Types TypeScript globaux
│                           # (Airport, Aircraft, Mission, Player,
│                           #  ActiveMission, AircraftMaintenance)
├── services/                # Services API Tauri
│   ├── airportService.ts
│   ├── aircraftService.ts
│   ├── missionService.ts
│   ├── activeMissionService.ts
│   ├── playerService.ts
│   └── maintenanceService.ts
├── context/                 # Context React
│   └── PlayerContext.tsx    # État global du joueur
├── components/              # Composants réutilisables
│   ├── Header.tsx
│   ├── MissionCard.tsx
│   └── AircraftCard.tsx
├── pages/                   # Pages de l'application
│   ├── Setup.tsx           # Configuration initiale (3 étapes)
│   ├── Dashboard.tsx       # Tableau de bord
│   ├── MissionList.tsx     # Liste et recherche de missions
│   ├── ActiveMissions.tsx  # Missions en cours
│   ├── Airports.tsx        # Recherche d'aéroports
│   ├── Hangar.tsx          # Gestion de la flotte
│   └── Shop.tsx            # Boutique d'avions
└── App.tsx                 # Point d'entrée + routing

src-tauri/                   # Backend Rust
├── migrations/
│   └── 001_initial_schema.sql  # Schéma SQLite
├── src/
│   ├── models/              # Structures Rust
│   │   ├── airport.rs
│   │   ├── aircraft.rs
│   │   ├── mission.rs
│   │   ├── active_mission.rs
│   │   ├── player.rs
│   │   └── maintenance.rs
│   ├── db/
│   │   ├── database.rs      # Gestion SQLite
│   │   └── queries.rs       # Requêtes SQL
│   ├── commands.rs          # Commandes Tauri
│   ├── lib.rs               # Point d'entrée
│   └── main.rs
└── bin/
    └── import_airports.rs   # Script d'import CSV
```

## 🎯 Fonctionnalités Actuelles

### ✅ Backend Complet (Tauri + SQLite)
- ✅ Base de données SQLite persistante
- ✅ **40,000+ aéroports réels** importés depuis CSV
- ✅ Catalogue d'avions
- ✅ Système de joueur (ID fixe "1" pour mode solo)
- ✅ Gestion des avions possédés
- ✅ **Système de missions actives**
  - Accepter une mission
  - Annuler avec pénalité proportionnelle à la progression
  - Compléter une mission
  - Calcul de progression géographique en temps réel
- ✅ **Génération de missions déterministe**
  - Seed basé sur l'heure + airport_id
  - Missions identiques pendant 1h, puis renouvellement
  - 4-10 missions par aéroport
  - 50/50 passagers/cargo
  - Destinations dans un rayon de 50-300 NM
  - Optimisation SQL avec bounding box
- ✅ **Recherche de missions** depuis d'autres aéroports (100$)
- ✅ Système de maintenance des avions
- ✅ Historique de maintenance
- ✅ Transactions atomiques (achats, maintenance, missions)

### ✅ Frontend Complet
- ✅ Setup initial (nom, aéroport, avion de départ)
- ✅ Dashboard avec statistiques
- ✅ **Page Missions** :
  - Liste des missions disponibles à l'aéroport actuel
  - Recherche de missions depuis d'autres aéroports (coût 100$)
  - Mode visualisation (impossible d'accepter si pas à l'aéroport)
  - Filtres (all/passagers/cargo)
- ✅ **Page Active Missions** :
  - Liste des missions en cours
  - Barre de progression géographique en temps réel
  - Distance restante calculée dynamiquement
  - Bouton Complete (visible à 100%)
  - Annulation avec pénalité (% progression × reward)
- ✅ **Page Airports** : Recherche avec debounce (300ms)
- ✅ Gestion du hangar (sélection/vente d'avions)
- ✅ Shop d'avions avec filtres
- ✅ Navigation avec React Router
- ✅ Context API pour l'état global

## 📐 Conventions de Code

### TypeScript
- **Mode strict activé** : tous les types doivent être explicites
- **Pas de `any`** sauf dans les cas exceptionnels justifiés
- Préfixer les paramètres non utilisés avec `_` (ex: `_playerId`)
- Utiliser des interfaces pour les objets complexes

### React
- **Functional Components** uniquement (pas de class components)
- Hooks : `useState`, `useEffect`, `useContext`, `useRef`
- Context API pour l'état global (pas de Redux)
- Props typées avec TypeScript
- **useRef** pour stocker des valeurs sans causer de re-render (ex: flags, timers)

### Rust/Tauri
- **Convention Rust 2018+** : Pas de `mod.rs`, modules déclarés dans le fichier parent
- **Tauri State** : `Mutex<Database>` pour thread-safety
- **Serde** : Serialization/Deserialization entre Rust ↔ TypeScript
- **Commandes Tauri** : Décorées avec `#[tauri::command]`
- **Helper `with_db`** : Simplifie lock du Mutex + gestion erreurs
- **Transactions** : Utiliser `db.transaction()` pour opérations atomiques

### Services (Frontend)
- Toutes les fonctions sont `async` et retournent des `Promise`
- Utilisent `invoke()` de Tauri pour appeler le backend Rust
- Conversion des noms : camelCase (TS) ↔ snake_case (Rust) via serde

### Styling
- **CSS vanilla** (un fichier .css par composant/page)
- Pas de CSS-in-JS
- Utiliser des classes sémantiques (`.mission-card`, `.aircraft-grid`)
- Design responsive (mobile-first)

### Nommage
- Composants : PascalCase (`MissionCard.tsx`)
- Services : camelCase avec suffix Service (`aircraftService.ts`)
- Fichiers CSS : même nom que le composant (`MissionCard.css`)
- Variables : camelCase (`selectedAircraft`)
- Constantes : UPPER_SNAKE_CASE si vraiment constantes

## 🚫 Règles Importantes

### Ne JAMAIS faire
- ❌ Utiliser `npm` (toujours `pnpm`)
- ❌ Modifier la structure des `node_modules` manuellement
- ❌ Ajouter des fichiers `.d.ts` de patch (sauf `vite-env.d.ts`)
- ❌ Utiliser `any` sans justification
- ❌ Créer des composants class-based
- ❌ Ajouter des dépendances lourdes sans accord

### Toujours faire
- ✅ Vérifier avec `pnpm exec tsc --noEmit` avant de commit
- ✅ Tester dans le navigateur après chaque modification
- ✅ Respecter la séparation composants/pages/services
- ✅ Typer toutes les props et states
- ✅ Utiliser `useRef` pour les flags au lieu de `useState` quand pas besoin de re-render
- ✅ Préférer `updateMoney()` à `refreshPlayer()` quand seul l'argent change (évite re-renders)

## 🔧 Commandes Utiles

```bash
# Développement Frontend
pnpm install              # Installer les dépendances
pnpm run dev              # Lancer le serveur dev (http://localhost:1420)
pnpm exec tsc --noEmit    # Vérifier TypeScript
pnpm run build            # Build de production

# Tauri
pnpm tauri dev            # Lancer l'app Tauri (Rust + React)
pnpm tauri build          # Build de l'app desktop

# Backend Rust (depuis src-tauri/)
cargo build               # Compiler le backend
cargo check               # Vérifier sans compiler
cargo run --bin import_airports  # Importer les aéroports depuis CSV

# Base de données
# La DB est créée automatiquement dans AppData au premier lancement
# Chemin : ~/.local/share/com.petrocchim.flight_service/flight_service.db (Linux/Mac)
#          AppData/Roaming/com.petrocchim.flight_service/flight_service.db (Windows)

# Nettoyage (en cas de problème)
rm -rf node_modules pnpm-lock.yaml && pnpm install
cargo clean  # Nettoyer le build Rust
```

## 🐛 Résolution de Problèmes

### Erreurs TypeScript JSX
**Cause** : Cache TypeScript ou installation corrompue
**Solution** :
1. `rm -rf node_modules pnpm-lock.yaml`
2. `pnpm install`
3. Dans VSCode : `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

### Port 1420 déjà utilisé
**Solution** : `pkill -f vite` puis relancer `pnpm run dev`

### Types React non trouvés
**Vérifier** :
- `tsconfig.json` contient `"jsx": "react-jsx"`
- `src/vite-env.d.ts` existe avec `/// <reference types="vite/client" />`
- Packages installés : `@types/react` et `@types/react-dom`

## 🔧 Système de Maintenance

### Concept
Chaque avion possédé a un état de santé qui se dégrade avec les heures de vol. La maintenance est nécessaire pour restaurer l'avion à 100%.

### Données de Maintenance

**`AircraftMaintenance`** (par avion possédé)
- `flightHours` : heures accumulées depuis la dernière maintenance
- `condition` : état de santé en % (100 = parfait, 0 = hors service)
- `isUnderMaintenance` : en cours de maintenance
- `maintenanceEndDate` : date de fin de maintenance (ISO)
- `lastMaintenanceDate` : date de la dernière maintenance

**`Aircraft`** (propriétés ajoutées)
- `maintenanceCostPerHour` : coût de maintenance par heure de vol
- `maxFlightHoursBeforeMaintenance` : heures max avant révision obligatoire

### Règles de Fonctionnement

1. **Dégradation** : Après chaque mission, l'avion accumule des heures de vol
   - Formule : `condition = 100 - (flightHours / maxHours) * 100`

2. **Interdictions de vol** :
   - Avion en maintenance : ❌ Cannot fly
   - Condition < 10% : ❌ Grounded (hors service)
   - Condition < 30% : ⚠️ Can fly but critical
   - Condition < 60% : ⚡ Can fly but warning

3. **Coût de maintenance** :
   - Coût de base : `maintenanceCostPerHour * flightHours`
   - Pénalité si condition < 30% : +50% du coût

4. **Durée de maintenance** :
   - Min 2 heures, max 48 heures
   - Formule : `min(48, max(2, flightHours / 10))`

5. **Après maintenance** :
   - `flightHours = 0`
   - `condition = 100%`
   - Ajout dans l'historique

### Services

**`maintenanceService`** :
- `calculateCondition()` - Calculer l'état de santé
- `calculateMaintenanceCost()` - Calculer le coût
- `calculateMaintenanceTime()` - Calculer la durée
- `startMaintenance()` - Démarrer une maintenance
- `completeMaintenance()` - Terminer une maintenance
- `canFly()` - Vérifier si l'avion peut voler
- `getMaintenanceStatus()` - Obtenir le statut détaillé

**`playerService`** (méthodes ajoutées) :
- `updateAircraftMaintenance()` - Mettre à jour après un vol
- `startMaintenance()` - Démarrer maintenance et débiter le joueur
- `completeMaintenance()` - Restaurer l'avion à 100%
- `addMaintenanceRecord()` - Ajouter à l'historique
- `getAircraftMaintenance()` - Récupérer la maintenance d'un avion

### UI

**`AircraftCard`** :
- Barre de condition colorée (rouge → jaune → vert)
- Heures de vol / Heures max
- Icône d'état (🔧 ✅ ⚠️ ⚡)
- Bouton "Maintenance" (désactivé si condition > 90%)

**`Hangar`** :
- Vue complète de l'état de chaque avion
- Bouton de maintenance avec confirmation
- Affichage du coût et de la durée estimée

### Exemple de Flux

1. **Achat d'un avion** → Maintenance initialisée à 100%, 0h de vol
2. **Compléter une mission** → Ajout des heures de vol, recalcul de la condition
3. **Condition < 60%** → Affichage d'un warning
4. **Démarrer maintenance** → Débiter le joueur, bloquer l'avion
5. **Fin de maintenance** → Restaurer à 100%, débloquer l'avion

## 🎯 Système de Missions

### Génération Déterministe

Les missions sont générées **dynamiquement** avec un **seed déterministe** :

```rust
seed = (timestamp / 3600) ^ hash(airport_id)
```

**Caractéristiques** :
- Missions **identiques pendant 1 heure** pour un même aéroport
- Se **renouvellent automatiquement** toutes les heures
- Chaque aéroport a ses propres missions
- **4 à 10 missions** générées aléatoirement
- **50/50** entre passagers et cargo

**Sélection des destinations** :
1. **Bounding box SQL** : Pré-filtre ±5° lat/lon (≈300 NM)
2. **Distance exacte** : Haversine pour filtrer 50-300 NM
3. **Sélection aléatoire** : Peut répéter la même destination

**Détails des missions** :
- **Passagers** : 1-8 passagers, reward = distance × 20 × passenger_count
- **Cargo** : 20-800 kg, description aléatoire parmi 20 types, reward = distance × 25 × (weight/10)

### Recherche de Missions

**Fonctionnalité** : Voir les missions disponibles depuis d'autres aéroports

```typescript
// Coût : 100$ par recherche
activeMissionService.searchMissionsFromAirport(playerId, airportId)
```

**UI** :
- Barre de recherche avec debounce (300ms, min 2 caractères)
- Résultats affichant les aéroports trouvés
- Bouton "View Missions ($100)" pour chaque aéroport
- Affichage des missions avec bannière bleue : "Viewing missions from [ICAO]"
- Impossible d'accepter (boutons disabled) si pas à cet aéroport
- Bouton "← Back to [ICAO] missions" pour revenir

**Backend** :
- Débite 100$ du joueur
- Retourne les missions générées pour cet aéroport
- Utilise `updateMoney()` au lieu de `refreshPlayer()` pour éviter de recharger toutes les missions

### Missions Actives

**Type** : `ActiveMission`
```typescript
{
  id: string,
  mission: Mission,
  aircraftId: string,
  acceptedAt: string,
  status: 'in_progress' | 'ready_to_complete'
}
```

**Table SQLite** : `active_missions`
- Stocke les missions en cours
- Associe un avion spécifique
- Track le statut de progression

**Accepter une mission** :
```typescript
activeMissionService.acceptMission(playerId, mission, aircraftId)
```

**Vérifications** (frontend + backend) :
- **Une seule mission à la fois** : Impossible d'accepter si déjà une mission active ⚠️
- Joueur doit être à l'aéroport de départ
- Avion sélectionné requis
- Vérification du type d'avion (passenger/cargo/both)
- Vérification de la portée (range ≥ distance)
- Vérification de la capacité (capacity ≥ passengers/cargo)

**UI** :
- Bannière orange si mission déjà active
- Boutons "Accept" désactivés
- Message : "Complete or cancel current mission first"

**Calcul de Progression** (temps réel) :
```typescript
distanceRemaining = haversine(currentAirport, toAirport)
progress = ((totalDistance - distanceRemaining) / totalDistance) × 100
```

**UI** :
- Barre de progression visuelle avec gradient bleu → vert
- Animation pulse pendant le vol
- Distance restante affichée en NM
- Pourcentage de progression
- Bouton "Complete" visible à 100%

**Annuler une mission** :
```typescript
penalty = (reward × progression) / 100
activeMissionService.cancelMission(playerId, activeMissionId, progression)
```

**Pénalités d'annulation** :
- 0% progression → Gratuit ✅
- 30% progression, 10,000$ reward → Pénalité 3,000$ ⚠️
- 100% progression → Autant compléter la mission ❌
- Popup de confirmation affichant le montant exact

**Compléter une mission** :
```typescript
reward = activeMissionService.completeMission(playerId, activeMissionId)
```

**Actions** :
- Supprime la mission active de la DB
- Ajoute le reward au joueur
- Refresh le joueur et la liste des missions actives

## 🔌 Commandes Tauri Disponibles

### Airports
- `get_all_airports()` - Liste tous les aéroports (40k+, utiliser avec précaution)
- `get_airport_by_id(id: string)` - Récupérer un aéroport par ID
- `search_airports(query: string)` - Rechercher (LIKE sur name, icao, iata, city)

### Aircraft
- `get_all_aircraft()` - Catalogue complet des avions
- `get_aircraft_by_id(id: string)` - Détails d'un avion
- `get_aircraft_by_type(type: string)` - Filtrer par type (passenger/cargo/both)

### Player
- `create_player(name, startingAirportId, startingAircraftId)` - Créer/reset joueur
- `get_player(playerId)` - Récupérer toutes les données du joueur
- `purchase_aircraft(playerId, aircraftId)` - Acheter un avion (transaction atomique)

### Missions
- `get_missions_by_airport(airportId)` - Missions disponibles (seed déterministe)
- `search_missions_to_airport(playerId, airportId)` - Recherche payante (100$)

### Active Missions
- `accept_mission(playerId, fromAirportId, toAirportId, ...)` - Accepter une mission
- `get_active_missions(playerId)` - Liste des missions en cours
- `complete_active_mission(playerId, activeMissionId)` - Compléter (reward)
- `cancel_active_mission(playerId, activeMissionId, progressPercentage)` - Annuler (pénalité)

### Exemple d'utilisation

```typescript
// Frontend
import { invoke } from '@tauri-apps/api/core';

// Rechercher des aéroports
const results = await invoke<Airport[]>('search_airports', {
  query: 'paris'
});

// Accepter une mission
const activeMissionId = await invoke<string>('accept_mission', {
  playerId: '1',
  fromAirportId: 'LFPG',
  toAirportId: 'EGLL',
  missionType: 'passenger',
  distance: 250,
  reward: 5000,
  passengerCount: 4,
  aircraftId: 'cessna-172',
});
```

## 🎨 Design System

### Couleurs principales
- **Bleu primaire** : `#3498db` (boutons, liens)
- **Vert succès** : `#27ae60` (missions acceptées, argent)
- **Orange** : `#e67e22` (prix, cargo)
- **Rouge** : `#e74c3c` (vente, danger)
- **Gris texte** : `#2c3e50` (titres), `#7f8c8d` (sous-titres)
- **Background** : `#f5f7fa`

### Emojis utilisés
- ✈️ Avions
- 💰 Argent
- 👥 Passagers
- 📦 Cargo
- 🏠 Hangar
- 🛒 Shop
- 📍 Position/Aéroport
- ✅ Validé/Complété

## 🔮 Prochaines Étapes

### Fonctionnalités à implémenter
1. **Simulation de vol réaliste**
   - Timer basé sur distance / cruise speed
   - Mise à jour automatique du `currentAirportId` à l'arrivée
   - Passage auto de `in_progress` à `ready_to_complete`

2. **Système économique avancé**
   - Prêts bancaires avec intérêts
   - Système de réputation par aéroport
   - Bonus/malus selon performances

3. **Événements dynamiques**
   - Météo impactant les missions (délais, surcoûts)
   - Événements aléatoires (bonus, pénalités)
   - Missions urgentes avec multiplicateur de reward

4. **Multi-joueur local**
   - Support de plusieurs profils joueurs
   - Système de sauvegarde/chargement
   - Comparaison de statistiques

### Améliorations techniques
1. **Optimisations performance**
   - Lazy loading des composants
   - Virtualisation des listes longues (40k aéroports)
   - Cache des calculs de distance

2. **Tests**
   - Tests unitaires (Vitest) pour les services
   - Tests E2E (Playwright) pour les flux critiques
   - Tests Rust avec `cargo test`

3. **DevOps**
   - CI/CD avec GitHub Actions
   - Auto-release avec tauri-action
   - Versioning sémantique

## 💡 Notes Importantes

### Architecture
- **Backend Rust/Tauri** : Toutes les données sont persistées en SQLite
- **PlayerContext** : Gère l'état global (pas besoin de Redux)
- **Mode solo** : ID joueur fixe "1" (multi-joueur possible plus tard)
- **Refresh safe** : Les données survivent au reload (SQLite persistante)

### Missions
- **Génération déterministe** : Seed = heure + airport_id
- **Renouvellement horaire** : Missions changent toutes les heures
- **Pas de stockage** : Générées à la volée (économie d'espace)
- **40,000+ aéroports** : Données réelles importées

### Performance
- **Bounding box SQL** : Pré-filtre géographique avant calcul exact
- **Debounce** : Évite requêtes excessives (recherche à 300ms)
- **useRef** : Évite re-renders inutiles (flags, compteurs)
- **updateMoney vs refreshPlayer** : Préférer updateMoney quand seul l'argent change

### Rust/Tauri
- **Thread-safety** : `Mutex<Database>` pour accès concurrent
- **Transactions** : Opérations atomiques (ex: achat avion)
- **Serde** : Conversion auto Rust ↔ TypeScript
- **Helper `with_db`** : Simplifie gestion des locks et erreurs

## 📝 Améliorations Possibles

### UX/UI
- Animations de transition entre pages
- Feedback visuel lors des achats/ventes
- Graphiques pour les statistiques
- Mode sombre
- Sons/notifications

### Fonctionnalités
- Système de prêt bancaire
- Maintenance des avions
- Météo impactant les missions
- Système de réputation
- Événements aléatoires
- Sauvegarde locale (localStorage ou IndexedDB)

### Technique
- Tests unitaires (Vitest)
- Tests E2E (Playwright)
- CI/CD
- Internationalisation (i18n)
- Performance optimization (lazy loading)

---

**Dernière mise à jour** : 29 Mars 2026
**Version** : 0.5.0 (Backend Tauri + Frontend complet)
**État** : Backend SQLite opérationnel, missions actives fonctionnelles, 40k+ aéroports réels
