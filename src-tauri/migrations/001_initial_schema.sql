-- Schéma initial complet
-- Le catalogue d'avions est géré par aircraft.yaml (pas de table aircraft_catalog)

-- Aéroports
CREATE TABLE IF NOT EXISTS airports (
    id TEXT PRIMARY KEY,
    icao TEXT,
    iata_code TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('large_airport', 'medium_airport', 'small_airport')),
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation INTEGER NOT NULL DEFAULT 0,
    scheduled_service BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_airports_icao ON airports(icao);
CREATE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata_code);
CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(country);
CREATE INDEX IF NOT EXISTS idx_airports_type ON airports(type);

-- Joueur
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    money INTEGER NOT NULL DEFAULT 55000,
    current_airport_id TEXT NOT NULL,
    selected_aircraft_id TEXT,
    total_flight_hours REAL NOT NULL DEFAULT 0.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_airport_id) REFERENCES airports(id)
);

-- Avions possédés par le joueur (instances uniques)
-- aircraft_catalog_id référence l'id dans aircraft.yaml (SimConnect title)
CREATE TABLE IF NOT EXISTS player_aircraft (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    aircraft_catalog_id TEXT NOT NULL,
    current_airport_id TEXT NOT NULL,
    purchase_date TEXT DEFAULT CURRENT_TIMESTAMP,
    purchase_price INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (current_airport_id) REFERENCES airports(id)
);

CREATE INDEX IF NOT EXISTS idx_player_aircraft_player ON player_aircraft(player_id);
CREATE INDEX IF NOT EXISTS idx_player_aircraft_airport ON player_aircraft(current_airport_id);

-- Maintenance des avions
CREATE TABLE IF NOT EXISTS aircraft_maintenances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    player_aircraft_id TEXT NOT NULL,
    flight_hours REAL NOT NULL DEFAULT 0.0,
    condition INTEGER NOT NULL DEFAULT 100 CHECK(condition >= 0 AND condition <= 100),
    is_under_maintenance BOOLEAN NOT NULL DEFAULT 0,
    maintenance_end_date TEXT,
    last_maintenance_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player_aircraft_id) REFERENCES player_aircraft(id) ON DELETE CASCADE,
    UNIQUE(player_id, player_aircraft_id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_player ON aircraft_maintenances(player_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_aircraft ON aircraft_maintenances(player_aircraft_id);

-- Historique de maintenance
CREATE TABLE IF NOT EXISTS maintenance_records (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    player_aircraft_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('routine', 'repair', 'inspection')),
    cost INTEGER NOT NULL,
    flight_hours_at_maintenance REAL NOT NULL,
    description TEXT NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (player_aircraft_id) REFERENCES player_aircraft(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_maintenance_records_player ON maintenance_records(player_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_aircraft ON maintenance_records(player_aircraft_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_date ON maintenance_records(date);

-- Missions (générées dynamiquement, stockées temporairement)
CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('passenger', 'cargo')),
    from_airport_id TEXT NOT NULL,
    to_airport_id TEXT NOT NULL,
    distance INTEGER NOT NULL,
    reward INTEGER NOT NULL,
    cargo_weight INTEGER,
    cargo_description TEXT,
    passenger_count INTEGER,
    deadline TEXT,
    required_aircraft_type TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_airport_id) REFERENCES airports(id),
    FOREIGN KEY (to_airport_id) REFERENCES airports(id),
    CHECK (
        (type = 'cargo' AND cargo_weight IS NOT NULL AND cargo_description IS NOT NULL) OR
        (type = 'passenger' AND passenger_count IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_missions_from_airport ON missions(from_airport_id);
CREATE INDEX IF NOT EXISTS idx_missions_type ON missions(type);
CREATE INDEX IF NOT EXISTS idx_missions_active ON missions(is_active);

-- Missions complétées
CREATE TABLE IF NOT EXISTS completed_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    reward_earned INTEGER NOT NULL,
    flight_hours REAL NOT NULL,
    aircraft_used TEXT NOT NULL, -- aircraft_catalog_id (YAML)
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_completed_missions_player ON completed_missions(player_id);
CREATE INDEX IF NOT EXISTS idx_completed_missions_date ON completed_missions(completed_at);

-- Missions actives (en cours)
CREATE TABLE IF NOT EXISTS active_missions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    from_airport_id TEXT NOT NULL,
    to_airport_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('passenger', 'cargo')),
    distance INTEGER NOT NULL,
    reward INTEGER NOT NULL,
    cargo_weight INTEGER,
    cargo_description TEXT,
    passenger_count INTEGER,
    aircraft_id TEXT NOT NULL,
    accepted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'ready_to_complete')),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (from_airport_id) REFERENCES airports(id),
    FOREIGN KEY (to_airport_id) REFERENCES airports(id),
    FOREIGN KEY (aircraft_id) REFERENCES player_aircraft(id),
    CHECK (
        (type = 'cargo' AND cargo_weight IS NOT NULL AND cargo_description IS NOT NULL) OR
        (type = 'passenger' AND passenger_count IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_active_missions_player ON active_missions(player_id);
CREATE INDEX IF NOT EXISTS idx_active_missions_status ON active_missions(status);

-- Triggers updated_at
CREATE TRIGGER IF NOT EXISTS update_players_timestamp
AFTER UPDATE ON players
BEGIN
    UPDATE players SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_maintenance_timestamp
AFTER UPDATE ON aircraft_maintenances
BEGIN
    UPDATE aircraft_maintenances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
