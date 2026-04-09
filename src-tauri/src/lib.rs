// Modules
pub mod models;
pub mod db;
pub mod commands;
pub mod simconnect_service;
pub mod elevation;
pub mod airspace;

use std::sync::{Arc, Mutex};
use db::Database;
use simconnect_service::SimConnectService;
use tauri::Manager;

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

            // Toujours écraser aircraft.yaml avec la version embarquée dans le binaire
            let yaml_path = app_data_dir.join("aircraft.yaml");
            std::fs::write(&yaml_path, include_bytes!("aircraft.yaml"))
                .expect("Failed to write aircraft.yaml");

            // Chemin de la base de données
            let db_path = app_data_dir.join("flight_service.db");

            // Créer et initialiser la base de données
            let db = Database::new(db_path)
                .expect("Failed to create database");

            db.init()
                .expect("Failed to initialize database");

            // Wraper la DB dans Arc pour la partager avec le thread SimConnect
            let db_arc = Arc::new(Mutex::new(db));

            // Ajouter la DB au State Tauri (accessible dans toutes les commandes)
            app.manage(db_arc.clone());

            // Initialiser le service SimConnect (avec accès DB pour auto-détection d'aéroport)
            let simconnect = SimConnectService::new(db_arc);
            app.manage(simconnect);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Commandes Airport
            commands::get_all_airports,
            commands::get_airport_by_id,
            commands::search_airports,
            commands::get_all_navaids,
            commands::search_navaids,
            // Commandes Aircraft
            commands::get_all_aircraft,
            commands::get_aircraft_by_id,
            commands::get_aircraft_by_type,
            commands::get_owned_aircraft,
            commands::select_aircraft,
            // Commandes Market
            commands::get_market_aircraft,
            commands::purchase_market_aircraft,
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
            // Commandes Maintenance
            commands::start_aircraft_maintenance,
            commands::complete_aircraft_maintenance,
            commands::add_maintenance_record,
            // Commandes SimConnect
            commands::simconnect_connect,
            commands::simconnect_is_connected,
            commands::simconnect_disconnect,
            commands::simconnect_get_position,
            commands::simconnect_send_event,
            commands::simconnect_get_available_events,
            commands::simconnect_start_streaming,
            commands::simconnect_stop_streaming,
            commands::simconnect_is_streaming,
            commands::simconnect_set_payload,
            // Commandes Cheat (Debug)
            commands::cheat_teleport_to_airport,
            commands::cheat_give_aircraft,
            commands::cheat_add_money,
            commands::cheat_teleport_aircraft,
            commands::cheat_force_complete_mission,
            commands::cheat_set_aircraft_wear,
            commands::cheat_complete_maintenance,
            // Commandes Geo
            commands::is_within_3km,
            commands::find_airport_near_position,
            commands::set_player_airport,
            // Commandes Élévation terrain
            commands::get_elevation,
            // Commandes Espaces aériens
            commands::get_airspaces,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
