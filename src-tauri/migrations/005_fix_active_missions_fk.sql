-- Migration 005: Fix active_missions.aircraft_id FK to reference player_aircraft instead of aircraft_catalog
-- Active missions are cleared since existing ones had invalid aircraft_id references anyway

DROP TABLE IF EXISTS active_missions;

CREATE TABLE active_missions (
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
