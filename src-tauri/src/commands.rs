// Commandes Tauri - Exemples d'utilisation du State DB

use std::sync::{Arc, Mutex};
use crate::db::{Database, queries};
use crate::models::*;
use crate::simconnect_service::{SimConnectService, AircraftPosition};

// ============= EXEMPLE : Get All Airports =============

#[tauri::command]
pub fn get_all_airports(
    db: tauri::State<Arc<Mutex<Database>>>
) -> Result<Vec<Airport>, String> {
    // 1. Lock le Mutex pour accéder à la DB
    let db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    // 2. Obtenir la connexion
    let conn = db.conn();

    // 3. Appeler la query
    queries::get_all_airports(conn)
        .map_err(|e| format!("Database error: {}", e))
}

// ============= EXEMPLE : Get Airport by ID =============

#[tauri::command]
pub fn get_airport_by_id(
    db: tauri::State<Arc<Mutex<Database>>>,
    id: String,
) -> Result<Option<Airport>, String> {
    let db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    queries::get_airport_by_id(db.conn(), &id)
        .map_err(|e| format!("Database error: {}", e))
}

// ============= EXEMPLE : Purchase Aircraft (avec transaction) =============

#[tauri::command]
pub fn purchase_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    aircraft_id: String,
) -> Result<(), String> {
    // Lock avec mut car on va utiliser transaction()
    let mut db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    // Récupérer le prix de l'avion
    let aircraft = queries::get_aircraft_by_id(db.conn(), &aircraft_id)
        .map_err(|e| format!("Failed to get aircraft: {}", e))?
        .ok_or("Aircraft not found")?;

    let price = aircraft.price;

    // Transaction atomique
    db.transaction(|tx| {
        // Récupérer l'argent et l'aéroport du joueur
        let (player_money, current_airport_id): (i64, String) = tx.query_row(
            "SELECT money, current_airport_id FROM players WHERE id = ?1",
            [&player_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;

        if player_money < price {
            return Err(rusqlite::Error::InvalidQuery);
        }

        // Générer un ID unique pour l'avion possédé
        let player_aircraft_id = uuid::Uuid::new_v4().to_string();

        // Débiter l'argent
        tx.execute(
            "UPDATE players SET money = money - ?1 WHERE id = ?2",
            rusqlite::params![price, &player_id],
        )?;

        // Ajouter l'avion (instance unique) à l'aéroport actuel du joueur
        tx.execute(
            "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![&player_aircraft_id, &player_id, &aircraft_id, &current_airport_id, price],
        )?;

        // Initialiser la maintenance pour cette instance
        tx.execute(
            "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id)
             VALUES (?1, ?2)",
            rusqlite::params![&player_id, &player_aircraft_id],
        )?;

        Ok(())
    })
    .map_err(|e| format!("Transaction failed: {}", e))
}

// ============= EXEMPLE : Create Player =============

#[tauri::command]
pub fn create_player(
    db: tauri::State<Arc<Mutex<Database>>>,
    name: String,
    starting_airport_id: String,
    starting_aircraft_id: String,
) -> Result<String, String> {
    let db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    queries::create_player(
        db.conn(),
        &name,
        &starting_airport_id,
        &starting_aircraft_id,
    )
    .map_err(|e| format!("Failed to create player: {}", e))
}

// ============= EXEMPLE : Get Player =============

#[tauri::command]
pub fn get_player(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
) -> Result<Option<Player>, String> {
    let db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    queries::get_player(db.conn(), &player_id)
        .map_err(|e| format!("Database error: {}", e))
}

// ============= HELPER : Simplifier l'accès à la DB =============

/// Helper pour exécuter une fonction avec la connexion DB
/// Gère automatiquement le lock et les erreurs
fn with_db<F, T>(
    db_state: &tauri::State<Arc<Mutex<Database>>>,
    f: F,
) -> Result<T, String>
where
    F: FnOnce(&rusqlite::Connection) -> rusqlite::Result<T>,
{
    let db = db_state.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    f(db.conn())
        .map_err(|e| format!("Database error: {}", e))
}

// ============= EXEMPLE avec helper =============

#[tauri::command]
pub fn get_all_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>
) -> Result<Vec<Aircraft>, String> {
    // Plus simple avec le helper
    with_db(&db, |conn| queries::get_all_aircraft(conn))
}

#[tauri::command]
pub fn search_airports(
    db: tauri::State<Arc<Mutex<Database>>>,
    query: String,
) -> Result<Vec<Airport>, String> {
    with_db(&db, |conn| queries::search_airports(conn, &query))
}

// ============= Mission Commands =============

#[tauri::command]
pub fn get_missions_by_airport(
    db: tauri::State<Arc<Mutex<Database>>>,
    airport_id: String,
) -> Result<Vec<Mission>, String> {
    with_db(&db, |conn| queries::get_missions_by_airport(conn, &airport_id))
}

#[tauri::command]
pub fn search_missions_to_airport(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    airport_id: String,
) -> Result<Vec<Mission>, String> {
    let db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let conn = db.conn();

    // Vérifier que le joueur a assez d'argent
    let player = queries::get_player(conn, &player_id)
        .map_err(|e| format!("Failed to get player: {}", e))?
        .ok_or("Player not found")?;

    if player.money < 100 {
        return Err("Not enough money! Mission search costs $100".to_string());
    }

    // Débiter 100$ du joueur
    queries::update_player_money(conn, &player_id, -100)
        .map_err(|e| format!("Failed to update money: {}", e))?;

    // Récupérer les missions depuis l'aéroport spécifique
    queries::get_missions_by_airport(conn, &airport_id)
        .map_err(|e| format!("Database error: {}", e))
}

// ============= Aircraft Commands =============

#[tauri::command]
pub fn get_aircraft_by_id(
    db: tauri::State<Arc<Mutex<Database>>>,
    id: String,
) -> Result<Option<Aircraft>, String> {
    with_db(&db, |conn| queries::get_aircraft_by_id(conn, &id))
}

#[tauri::command]
pub fn get_aircraft_by_type(
    db: tauri::State<Arc<Mutex<Database>>>,
    aircraft_type: String,
) -> Result<Vec<Aircraft>, String> {
    with_db(&db, |conn| queries::get_aircraft_by_type(conn, &aircraft_type))
}

// ============= Active Mission Commands =============

#[tauri::command]
pub fn accept_mission(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    from_airport_id: String,
    to_airport_id: String,
    mission_type: String,
    distance: i32,
    reward: i64,
    cargo_weight: Option<i32>,
    cargo_description: Option<String>,
    passenger_count: Option<i32>,
    aircraft_id: String,
) -> Result<String, String> {
    with_db(&db, |conn| {
        queries::accept_mission(
            conn,
            &player_id,
            &from_airport_id,
            &to_airport_id,
            &mission_type,
            distance,
            reward,
            cargo_weight,
            cargo_description,
            passenger_count,
            &aircraft_id,
        )
    })
}

#[tauri::command]
pub fn get_active_missions(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
) -> Result<Vec<ActiveMission>, String> {
    with_db(&db, |conn| queries::get_active_missions(conn, &player_id))
}

#[tauri::command]
pub fn complete_active_mission(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    active_mission_id: String,
) -> Result<i64, String> {
    with_db(&db, |conn| {
        queries::complete_active_mission(conn, &player_id, &active_mission_id)
    })
}

#[tauri::command]
pub fn cancel_active_mission(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    active_mission_id: String,
    progress_percentage: i32,
) -> Result<i64, String> {
    with_db(&db, |conn| {
        queries::cancel_active_mission(conn, &player_id, &active_mission_id, progress_percentage)
    })
}

// ============= Owned Aircraft Commands =============

#[tauri::command]
pub fn get_owned_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
) -> Result<Vec<crate::models::OwnedAircraft>, String> {
    with_db(&db, |conn| {
        queries::get_owned_aircraft(conn, &player_id)
    })
}

#[tauri::command]
pub fn select_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    player_aircraft_id: String,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::select_player_aircraft(conn, &player_id, &player_aircraft_id)
    })
}

// ============= Market Aircraft Commands =============

#[tauri::command]
pub fn get_market_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
) -> Result<Vec<crate::models::MarketAircraft>, String> {
    with_db(&db, |conn| {
        queries::get_market_aircraft(conn, &player_id)
    })
}

#[tauri::command]
pub fn purchase_market_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    aircraft_id: String,
    price: i64,
    airport_id: String,
    condition: i32,
    flight_hours: f64,
) -> Result<(), String> {
    let mut db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    db.transaction(|tx| {
        let player_money: i64 = tx.query_row(
            "SELECT money FROM players WHERE id = ?1",
            [&player_id],
            |row| row.get(0),
        )?;

        if player_money < price {
            return Err(rusqlite::Error::InvalidQuery);
        }

        let player_aircraft_id = uuid::Uuid::new_v4().to_string();

        tx.execute(
            "UPDATE players SET money = money - ?1 WHERE id = ?2",
            rusqlite::params![price, &player_id],
        )?;

        tx.execute(
            "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![&player_aircraft_id, &player_id, &aircraft_id, &airport_id, price],
        )?;

        tx.execute(
            "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id, flight_hours, condition)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![&player_id, &player_aircraft_id, flight_hours, condition],
        )?;

        Ok(())
    })
    .map_err(|e| format!("Transaction failed: {}", e))
}

// ============= SimConnect Commands =============

#[tauri::command]
pub fn simconnect_connect(
    simconnect: tauri::State<SimConnectService>
) -> Result<(), String> {
    simconnect.inner().connect()
}

#[tauri::command]
pub fn simconnect_is_connected(
    simconnect: tauri::State<SimConnectService>
) -> Result<bool, String> {
    Ok(simconnect.inner().is_connected())
}

#[tauri::command]
pub fn simconnect_disconnect(
    simconnect: tauri::State<SimConnectService>
) -> Result<(), String> {
    simconnect.inner().disconnect();
    Ok(())
}

#[tauri::command]
pub fn simconnect_get_position(
    simconnect: tauri::State<SimConnectService>
) -> Result<AircraftPosition, String> {
    simconnect.inner().get_aircraft_position()
}

#[tauri::command]
pub fn simconnect_send_event(
    simconnect: tauri::State<SimConnectService>,
    event_name: String,
    value: u32
) -> Result<(), String> {
    simconnect.inner().send_event(&event_name, value)
}

#[tauri::command]
pub fn simconnect_get_available_events() -> Result<std::collections::HashMap<String, String>, String> {
    Ok(SimConnectService::get_available_events())
}

#[tauri::command]
pub fn simconnect_start_streaming(
    simconnect: tauri::State<SimConnectService>,
    app_handle: tauri::AppHandle
) -> Result<(), String> {
    simconnect.inner().start_streaming(app_handle)
}

#[tauri::command]
pub fn simconnect_stop_streaming(
    simconnect: tauri::State<SimConnectService>
) -> Result<(), String> {
    simconnect.inner().stop_streaming();
    Ok(())
}

#[tauri::command]
pub fn simconnect_is_streaming(
    simconnect: tauri::State<SimConnectService>
) -> Result<bool, String> {
    Ok(simconnect.inner().is_streaming())
}

#[tauri::command]
pub fn simconnect_set_payload(
    simconnect: tauri::State<SimConnectService>,
    weights: Vec<f64>,
) -> Result<(), String> {
    simconnect.inner().set_payload_stations(weights)
}

// ============= Maintenance Commands =============

#[tauri::command]
pub fn start_aircraft_maintenance(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    player_aircraft_id: String,
    end_date: String,
    cost: i64,
) -> Result<(), String> {
    let mut db = db.lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    db.transaction(|tx| {
        // Débiter le joueur
        tx.execute(
            "UPDATE players SET money = money - ?1 WHERE id = ?2",
            rusqlite::params![cost, &player_id],
        )?;

        // Mettre à jour la maintenance
        queries::start_maintenance(tx, &player_id, &player_aircraft_id, &end_date)?;

        Ok(())
    }).map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub fn complete_aircraft_maintenance(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    player_aircraft_id: String,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::complete_maintenance(conn, &player_id, &player_aircraft_id)
    })
}

#[tauri::command]
pub fn add_maintenance_record(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    record: crate::models::MaintenanceRecord,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::add_maintenance_record(conn, &player_id, &record)
    })
}

// ============= CHEAT Commands (Debug) =============

#[tauri::command]
pub fn cheat_teleport_to_airport(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    airport_id: String,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::cheat_teleport_to_airport(conn, &player_id, &airport_id)
    })
}

#[tauri::command]
pub fn cheat_give_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    aircraft_id: String,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::cheat_give_aircraft(conn, &player_id, &aircraft_id)
    })
}

#[tauri::command]
pub fn cheat_add_money(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    amount: i64,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::update_player_money(conn, &player_id, amount)
    })
}

#[tauri::command]
pub fn cheat_teleport_aircraft(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_aircraft_id: String,
    airport_id: String,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::cheat_teleport_aircraft(conn, &player_aircraft_id, &airport_id)
    })
}

#[tauri::command]
pub fn cheat_force_complete_mission(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    active_mission_id: String,
) -> Result<i64, String> {
    with_db(&db, |conn| {
        queries::cheat_force_complete_mission(conn, &player_id, &active_mission_id)
    })
}

#[tauri::command]
pub fn cheat_set_aircraft_wear(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_aircraft_id: String,
    flight_hours: f64,
    condition: i32,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::cheat_set_aircraft_wear(conn, &player_aircraft_id, flight_hours, condition)
    })
}

#[tauri::command]
pub fn cheat_complete_maintenance(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    player_aircraft_id: String,
) -> Result<(), String> {
    with_db(&db, |conn| {
        queries::complete_maintenance(conn, &player_id, &player_aircraft_id)
    })
}

// ============= GEO UTILS =============

#[tauri::command]
pub fn is_within_3km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> bool {
    queries::is_within_3km(lat1, lon1, lat2, lon2)
}

#[tauri::command]
pub fn find_airport_near_position(
    db: tauri::State<Arc<Mutex<Database>>>,
    lat: f64,
    lon: f64,
) -> Result<Option<Airport>, String> {
    with_db(&db, |conn| queries::find_airport_near_position(conn, lat, lon))
}

#[tauri::command]
pub fn set_player_airport(
    db: tauri::State<Arc<Mutex<Database>>>,
    player_id: String,
    airport_id: String,
) -> Result<(), String> {
    with_db(&db, |conn| queries::set_player_airport(conn, &player_id, &airport_id))
}

// ============= NOTE : Enregistrement des commandes =============

/*
Dans lib.rs, enregistrer les commandes :

.invoke_handler(tauri::generate_handler![
    get_all_airports,
    get_airport_by_id,
    get_all_aircraft,
    search_airports,
    create_player,
    get_player,
    purchase_aircraft,
    // Cheat commands
    cheat_teleport_to_airport,
    cheat_give_aircraft,
    cheat_add_money,
])
*/
