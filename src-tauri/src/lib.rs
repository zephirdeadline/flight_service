// Modules
pub mod models;
pub mod db;
pub mod commands;

use std::sync::Mutex;
use db::Database;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Obtenir le chemin du répertoire de données de l'app
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");

            // Créer le répertoire s'il n'existe pas
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            // Chemin de la base de données
            let db_path = app_data_dir.join("flight_service.db");

            // Créer et initialiser la base de données
            let db = Database::new(db_path)
                .expect("Failed to create database");

            db.init()
                .expect("Failed to initialize database");

            // Ajouter la DB au State Tauri (accessible dans toutes les commandes)
            app.manage(Mutex::new(db));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // Commandes Airport
            commands::get_all_airports,
            commands::get_airport_by_id,
            commands::search_airports,
            // Commandes Aircraft
            commands::get_all_aircraft,
            commands::get_aircraft_by_id,
            commands::get_aircraft_by_type,
            // Commandes Mission
            commands::get_missions_by_airport,
            commands::search_missions_to_airport,
            // Commandes Active Mission
            commands::accept_mission,
            commands::get_active_missions,
            commands::complete_active_mission,
            commands::cancel_active_mission,
            // Commandes Player
            commands::create_player,
            commands::get_player,
            // Commandes Transactions
            commands::purchase_aircraft,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
