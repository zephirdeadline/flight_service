# Flight Service - Backend Rust

## 🚀 Binaires disponibles

### 1. Application principale

Lance l'application Tauri complète (backend + frontend) :

```bash
# Développement (avec hot reload frontend)
cargo tauri dev

# Ou juste le backend
cargo run --bin flight_service

# Ou simplement
cargo run
```

### 2. Import des aéroports

Utilitaire pour importer les données depuis `airports.csv` :

```bash
cargo run --bin import_airports
```

Voir [IMPORT_AIRPORTS.md](./IMPORT_AIRPORTS.md) pour plus de détails.

## 📁 Structure

```
src-tauri/
├── src/
│   ├── main.rs              # Point d'entrée de l'application
│   ├── lib.rs               # Configuration Tauri + State management
│   ├── models.rs            # Déclaration des modules de modèles
│   ├── models/              # Modèles de données
│   │   ├── airport.rs
│   │   ├── aircraft.rs
│   │   ├── player.rs
│   │   ├── mission.rs
│   │   └── maintenance.rs
│   ├── db.rs                # Gestion de la base de données
│   ├── db/
│   │   └── queries.rs       # Requêtes SQL
│   ├── commands.rs          # Commandes Tauri (API backend)
│   └── bin/
│       └── import_airports.rs  # Utilitaire d'import CSV
├── migrations/
│   ├── 001_initial_schema.sql  # Schéma de base de données
│   └── 002_seed_data.sql       # Données de départ
└── Cargo.toml
```

## 🗄️ Base de données

- **Développement** : `flight_service.db` (local au répertoire `src-tauri/`)
- **Production** :
  - Linux : `~/.local/share/com.flight-service.dev/flight_service.db`
  - macOS : `~/Library/Application Support/com.flight-service.dev/flight_service.db`
  - Windows : `C:\Users\{username}\AppData\Roaming\com.flight-service.dev\flight_service.db`

## 🔧 Commandes utiles

```bash
# Vérifier la compilation
cargo check

# Builder en mode release
cargo build --release

# Lancer les tests
cargo test

# Builder l'application desktop
cargo tauri build
```

## 📚 Documentation

- [IMPORT_AIRPORTS.md](./IMPORT_AIRPORTS.md) - Import des aéroports depuis CSV
- [../BACKEND_SUMMARY.md](../BACKEND_SUMMARY.md) - Architecture du backend
- [../DB_STATE_MANAGEMENT.md](../DB_STATE_MANAGEMENT.md) - Gestion du State Tauri
- [../FRONTEND_BACKEND_INTEGRATION.md](../FRONTEND_BACKEND_INTEGRATION.md) - Appels frontend ↔ backend

---

**Version** : 0.2.0
