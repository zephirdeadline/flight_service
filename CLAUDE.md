# Flight Service Career - Instructions pour Claude

## 📋 Description du Projet

Application desktop Tauri + React + TypeScript simulant un mode carrière pour Flight Simulator 2024.
L'utilisateur gère sa carrière de pilote : achète des avions, accepte des missions, gagne de l'argent.

## 🛠️ Stack Technique

- **Frontend** : React 19 + TypeScript
- **Desktop** : Tauri 2
- **Build** : Vite 7
- **Routing** : React Router 7
- **Gestionnaire de paquets** : **pnpm uniquement** (ne JAMAIS utiliser npm)
- **Styling** : CSS vanilla (pas de framework CSS)

## 📁 Structure du Projet

```
src/
├── types/index.ts           # Types TypeScript globaux
│                           # (Airport, Aircraft, Mission, Player,
│                           #  AircraftMaintenance, MaintenanceRecord)
├── services/                # Services API (actuellement mockés)
│   ├── airportService.ts
│   ├── aircraftService.ts
│   ├── missionService.ts
│   ├── playerService.ts
│   └── maintenanceService.ts  # Système de maintenance
├── context/                 # Context React
│   └── PlayerContext.tsx    # État global du joueur
├── components/              # Composants réutilisables
│   ├── Header.tsx
│   ├── MissionCard.tsx
│   └── AircraftCard.tsx    # Affiche état de maintenance
├── pages/                   # Pages de l'application
│   ├── Setup.tsx           # Configuration initiale (3 étapes)
│   ├── Dashboard.tsx       # Tableau de bord
│   ├── MissionList.tsx     # Liste des missions
│   ├── Hangar.tsx          # Gestion de la flotte + maintenance
│   └── Shop.tsx            # Boutique d'avions
└── App.tsx                 # Point d'entrée + routing
```

## 🎯 Fonctionnalités Actuelles

### Frontend complet (sans backend)
- ✅ Setup initial (nom, aéroport, avion de départ)
- ✅ Dashboard avec statistiques
- ✅ Système de missions (passagers/cargo)
- ✅ Gestion du hangar (sélection/vente d'avions)
- ✅ **Système de maintenance/révision des avions**
  - État de santé (condition en %)
  - Heures de vol accumulées
  - Maintenance préventive
  - Coût et durée de maintenance
  - Historique de maintenance
  - Blocage de vol si avion en mauvais état
- ✅ Shop d'avions avec filtres
- ✅ Navigation avec React Router
- ✅ Context API pour l'état global

### Backend (à implémenter)
- ❌ Toutes les fonctions des services sont **mockées**
- ❌ Les données sont stockées en mémoire (perdues au refresh)
- 🎯 **Objectif** : Remplacer les mocks par de vrais appels API

## 📐 Conventions de Code

### TypeScript
- **Mode strict activé** : tous les types doivent être explicites
- **Pas de `any`** sauf dans les cas exceptionnels justifiés
- Préfixer les paramètres non utilisés avec `_` (ex: `_playerId`)
- Utiliser des interfaces pour les objets complexes

### React
- **Functional Components** uniquement (pas de class components)
- Hooks : `useState`, `useEffect`, `useContext`
- Context API pour l'état global (pas de Redux)
- Props typées avec TypeScript

### Services
- Toutes les fonctions sont `async` et retournent des `Promise`
- Simuler un délai réseau avec `setTimeout` (100-500ms)
- Les fonctions mockées doivent avoir la même signature que la future API

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
- ✅ Garder les services mockés jusqu'à ce que le backend soit prêt
- ✅ Respecter la séparation composants/pages/services
- ✅ Typer toutes les props et states

## 🔧 Commandes Utiles

```bash
# Développement
pnpm install              # Installer les dépendances
pnpm run dev              # Lancer le serveur dev (http://localhost:1420)
pnpm exec tsc --noEmit    # Vérifier TypeScript
pnpm run build            # Build de production

# Tauri
pnpm tauri dev            # Lancer l'app Tauri
pnpm tauri build          # Build de l'app desktop

# Nettoyage (en cas de problème)
rm -rf node_modules pnpm-lock.yaml && pnpm install
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

## 🔮 Prochaines Étapes (Backend)

1. **API REST** : Créer un backend (Node.js/Python/Rust)
2. **Base de données** : PostgreSQL ou SQLite
3. **Endpoints à créer** :
   - `GET /airports` - Liste des aéroports
   - `GET /aircraft` - Catalogue d'avions
   - `GET /missions?airportId=X` - Missions disponibles
   - `GET /player` - Données du joueur
   - `POST /player` - Créer un joueur
   - `POST /purchase` - Acheter un avion
   - `POST /mission/accept` - Accepter une mission
   - `POST /mission/complete` - Compléter une mission

4. **Remplacer les mocks** : Modifier les services pour faire de vrais appels `fetch()`

## 💡 Notes Importantes

- Les **données mockées** sont dans chaque service (tableaux en dur)
- Le **PlayerContext** gère tout l'état global (pas besoin de Redux)
- Les **missions** sont générées dynamiquement mais toujours les mêmes
- Le **refresh** de la page perd toutes les données (normal, pas de backend)
- La **simulation de vol** n'est pas implémentée (mission complétée instantanément)

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

**Dernière mise à jour** : Mars 2026
**Version** : 0.1.0 (Frontend uniquement)
