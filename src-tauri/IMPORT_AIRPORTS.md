# 🛫 Import des Aéroports depuis le CSV

## 📋 Prérequis

Le fichier `airports.csv` doit être à la racine du projet (`../airports.csv` par rapport à `src-tauri/`).

## 🚀 Comment importer les données

### 1. Lancer le script d'import

Le script utilise automatiquement le **même emplacement de base de données** que l'application Tauri :

```bash
cd src-tauri
cargo run --bin import_airports
```

Par défaut, la DB est créée dans :
- **Windows** : `C:\Users\{username}\AppData\Roaming\com.petrocchim.flight_service\flight_service.db`
- **Linux** : `~/.local/share/com.petrocchim.flight_service/flight_service.db`
- **macOS** : `~/Library/Application Support/com.petrocchim.flight_service/flight_service.db`

### 2. Arguments personnalisés (optionnel)

Vous pouvez spécifier le chemin du CSV et de la DB :

```bash
cargo run --bin import_airports -- /path/to/airports.csv /path/to/database.db
```

### 3. Vérifier l'import

Le script affichera :
- Le nombre d'aéroports importés
- Le nombre d'aéroports ignorés

## 🔧 Critères de filtrage

Le script importe uniquement les aéroports qui respectent ce critère :
- ✅ Code ICAO non vide

Les héliports et aéroports sans ICAO sont ignorés.

## 📊 Statistiques attendues

- **Total dans le CSV** : ~70 000 entrées
- **Avec code ICAO** : ~40 000+ aéroports
- **Importés** : ~40 000+ aéroports (tous types confondus)

## 🗂️ Structure des données importées

Chaque aéroport contient :
- `id` : Code ICAO (ex: "LFPG")
- `icao` : Code ICAO (ex: "LFPG")
- `iata_code` : Code IATA si disponible (ex: "CDG"), sinon NULL
- `name` : Nom complet (ex: "Paris Charles de Gaulle")
- `type` : "large_airport" ou "medium_airport"
- `city` : Ville (municipality)
- `country` : Code pays ISO (ex: "FR")
- `latitude` : Latitude en degrés décimaux
- `longitude` : Longitude en degrés décimaux
- `elevation` : Altitude en pieds
- `scheduled_service` : Boolean (vols commerciaux réguliers)

## 🔄 Réimporter les données

Pour réimporter (écrasera les données existantes) :

```bash
# Windows (PowerShell)
Remove-Item "$env:APPDATA\com.petrocchim.flight_service\flight_service.db"

# Linux
rm ~/.local/share/com.petrocchim.flight_service/flight_service.db

# macOS
rm ~/Library/Application\ Support/com.petrocchim.flight_service/flight_service.db

# Puis réimporter
cd src-tauri
cargo run --bin import_airports
```

## ⚠️ Notes

- Le script utilise `INSERT OR IGNORE`, donc si un aéroport existe déjà (même ICAO), il ne sera pas dupliqué
- L'import prend environ 10-30 secondes selon votre machine
- La base de données finale pèse environ 5-10 MB

---

**Date** : Mars 2026
