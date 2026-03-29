// Commandes Tauri - Exemples d'utilisation du State DB

use std::sync::Mutex;
use crate::db::{Database, queries};
use crate::models::*;

// ============= EXEMPLE : Get All Airports =============

#[tauri::command]
pub fn get_all_airports(
    db: tauri::State<Mutex<Database>>
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
    db: tauri::State<Mutex<Database>>,
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
    db: tauri::State<Mutex<Database>>,
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
        // Vérifier que le joueur a assez d'argent
        let player_money: i64 = tx.query_row(
            "SELECT money FROM players WHERE id = ?1",
            [&player_id],
            |row| row.get(0),
        )?;

        if player_money < price {
            return Err(rusqlite::Error::InvalidQuery);
        }

        // Débiter l'argent
        tx.execute(
            "UPDATE players SET money = money - ?1 WHERE id = ?2",
            rusqlite::params![price, &player_id],
        )?;

        // Ajouter l'avion
        tx.execute(
            "INSERT INTO player_aircraft (player_id, aircraft_id, purchase_price)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![&player_id, &aircraft_id, price],
        )?;

        // Initialiser la maintenance
        tx.execute(
            "INSERT INTO aircraft_maintenances (player_id, aircraft_id)
             VALUES (?1, ?2)",
            rusqlite::params![&player_id, &aircraft_id],
        )?;

        Ok(())
    })
    .map_err(|e| format!("Transaction failed: {}", e))
}

// ============= EXEMPLE : Create Player =============

#[tauri::command]
pub fn create_player(
    db: tauri::State<Mutex<Database>>,
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
    db: tauri::State<Mutex<Database>>,
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
    db_state: &tauri::State<Mutex<Database>>,
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
    db: tauri::State<Mutex<Database>>
) -> Result<Vec<Aircraft>, String> {
    // Plus simple avec le helper
    with_db(&db, |conn| queries::get_all_aircraft(conn))
}

#[tauri::command]
pub fn search_airports(
    db: tauri::State<Mutex<Database>>,
    query: String,
) -> Result<Vec<Airport>, String> {
    with_db(&db, |conn| queries::search_airports(conn, &query))
}

// ============= Mission Commands =============

#[tauri::command]
pub fn get_missions_by_airport(
    db: tauri::State<Mutex<Database>>,
    airport_id: String,
) -> Result<Vec<Mission>, String> {
    with_db(&db, |conn| queries::get_missions_by_airport(conn, &airport_id))
}

#[tauri::command]
pub fn search_missions_to_airport(
    db: tauri::State<Mutex<Database>>,
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
    db: tauri::State<Mutex<Database>>,
    id: String,
) -> Result<Option<Aircraft>, String> {
    with_db(&db, |conn| queries::get_aircraft_by_id(conn, &id))
}

#[tauri::command]
pub fn get_aircraft_by_type(
    db: tauri::State<Mutex<Database>>,
    aircraft_type: String,
) -> Result<Vec<Aircraft>, String> {
    with_db(&db, |conn| queries::get_aircraft_by_type(conn, &aircraft_type))
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
])
*/
