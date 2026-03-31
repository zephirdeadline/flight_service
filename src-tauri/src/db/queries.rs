use rusqlite::{params, Connection, Result, Row};
use crate::models::*;
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

// Vérifier si deux positions sont à moins de 3 km l'une de l'autre
pub fn is_within_3km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> bool {
    let r = 6371.0; // Rayon de la Terre en km
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();

    let a = (d_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    r * c < 3.0
}

// Calculer la distance entre deux points (formule haversine)
fn calculate_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 3440.0; // Rayon de la Terre en miles nautiques
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();

    let a = (d_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    r * c
}

// Générer un seed déterministe basé sur l'heure actuelle et l'airport_id
// Le seed change toutes les heures
fn generate_mission_seed(airport_id: &str) -> u64 {
    // Obtenir l'heure actuelle arrondie à l'heure
    let now = chrono::Utc::now();
    let hour_timestamp = now.timestamp() / 3600; // Arrondi à l'heure

    // Hasher l'airport_id
    let mut hasher = DefaultHasher::new();
    airport_id.hash(&mut hasher);
    let airport_hash = hasher.finish();

    // Combiner les deux pour créer un seed unique
    hour_timestamp as u64 ^ airport_hash
}

// Générer un seed déterministe basé sur la date du jour
// Le seed change chaque jour (utilisé pour le marché d'avions)
fn generate_daily_market_seed() -> u64 {
    let now = chrono::Utc::now();
    // Arrondi au jour (timestamp du début de la journée)
    let day_timestamp = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    day_timestamp as u64
}

// ============= AIRPORTS =============

fn map_airport_row(row: &Row) -> Result<Airport> {
    Ok(Airport {
        id: row.get(0)?,
        icao: row.get(1)?,
        iata_code: row.get(2)?,
        name: row.get(3)?,
        airport_type: row.get(4)?,
        city: row.get(5)?,
        country: row.get(6)?,
        latitude: row.get(7)?,
        longitude: row.get(8)?,
        elevation: row.get(9)?,
        scheduled_service: row.get(10)?,
    })
}

pub fn get_all_airports(conn: &Connection) -> Result<Vec<Airport>> {
    let mut stmt = conn.prepare(
        "SELECT id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service
         FROM airports ORDER BY name"
    )?;

    let airports = stmt.query_map([], map_airport_row)?;
    airports.collect()
}

pub fn get_airport_by_id(conn: &Connection, id: &str) -> Result<Option<Airport>> {
    let mut stmt = conn.prepare(
        "SELECT id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service
         FROM airports WHERE id = ?1"
    )?;

    let mut rows = stmt.query([id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(map_airport_row(row)?))
    } else {
        Ok(None)
    }
}

pub fn search_airports(conn: &Connection, query: &str) -> Result<Vec<Airport>> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service
         FROM airports
         WHERE name LIKE ?1 OR icao LIKE ?1 OR iata_code LIKE ?1 OR city LIKE ?1
         ORDER BY name
         LIMIT 50"
    )?;

    let airports = stmt.query_map([&pattern], map_airport_row)?;
    airports.collect()
}

// ============= AIRCRAFT CATALOG =============

pub fn get_all_aircraft(conn: &Connection) -> Result<Vec<Aircraft>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, manufacturer, type, price, capacity, range, cruise_speed,
                maintenance_cost_per_hour, max_flight_hours_before_maintenance, image_url,
                max_speed, fuel_capacity, fuel_consumption, empty_weight, max_takeoff_weight,
                service_ceiling, rate_of_climb, wingspan, length
         FROM aircraft_catalog
         ORDER BY price"
    )?;

    let aircraft = stmt.query_map([], map_aircraft_row)?;
    aircraft.collect()
}

pub fn get_aircraft_by_id(conn: &Connection, id: &str) -> Result<Option<Aircraft>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, manufacturer, type, price, capacity, range, cruise_speed,
                maintenance_cost_per_hour, max_flight_hours_before_maintenance, image_url,
                max_speed, fuel_capacity, fuel_consumption, empty_weight, max_takeoff_weight,
                service_ceiling, rate_of_climb, wingspan, length
         FROM aircraft_catalog
         WHERE id = ?1"
    )?;

    let mut rows = stmt.query([id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(map_aircraft_row(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_aircraft_by_type(conn: &Connection, aircraft_type: &str) -> Result<Vec<Aircraft>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, manufacturer, type, price, capacity, range, cruise_speed,
                maintenance_cost_per_hour, max_flight_hours_before_maintenance, image_url,
                max_speed, fuel_capacity, fuel_consumption, empty_weight, max_takeoff_weight,
                service_ceiling, rate_of_climb, wingspan, length
         FROM aircraft_catalog
         WHERE type = ?1 OR type = 'both'
         ORDER BY price"
    )?;

    let aircraft = stmt.query_map([aircraft_type], map_aircraft_row)?;
    aircraft.collect()
}

pub fn get_aircraft_by_budget(conn: &Connection, max_price: i64) -> Result<Vec<Aircraft>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, manufacturer, type, price, capacity, range, cruise_speed,
                maintenance_cost_per_hour, max_flight_hours_before_maintenance, image_url,
                max_speed, fuel_capacity, fuel_consumption, empty_weight, max_takeoff_weight,
                service_ceiling, rate_of_climb, wingspan, length
         FROM aircraft_catalog
         WHERE price <= ?1
         ORDER BY price DESC"
    )?;

    let aircraft = stmt.query_map([max_price], map_aircraft_row)?;
    aircraft.collect()
}

fn map_aircraft_row(row: &Row) -> Result<Aircraft> {
    let type_str: String = row.get(3)?;
    let aircraft_type = match type_str.as_str() {
        "passenger" => AircraftType::Passenger,
        "cargo" => AircraftType::Cargo,
        "both" => AircraftType::Both,
        _ => AircraftType::Passenger,
    };

    Ok(Aircraft {
        id: row.get(0)?,
        name: row.get(1)?,
        manufacturer: row.get(2)?,
        aircraft_type,
        price: row.get(4)?,
        capacity: row.get(5)?,
        range: row.get(6)?,
        cruise_speed: row.get(7)?,
        maintenance_cost_per_hour: row.get(8)?,
        max_flight_hours_before_maintenance: row.get(9)?,
        image_url: row.get(10)?,
        max_speed: row.get(11)?,
        fuel_capacity: row.get(12)?,
        fuel_consumption: row.get(13)?,
        empty_weight: row.get(14)?,
        max_takeoff_weight: row.get(15)?,
        service_ceiling: row.get(16)?,
        rate_of_climb: row.get(17)?,
        wingspan: row.get(18)?,
        length: row.get(19)?,
    })
}

// ============= PLAYER =============

pub fn create_player(
    conn: &Connection,
    name: &str,
    starting_airport_id: &str,
    starting_aircraft_id: &str,
) -> Result<String> {
    // Utiliser un ID fixe car c'est une app monoposte
    let player_id = "1".to_string();

    // Supprimer le joueur existant s'il y en a un (nouvelle partie)
    conn.execute("DELETE FROM players WHERE id = ?1", [&player_id])?;

    // Récupérer le prix de l'avion de départ
    let aircraft_price: i64 = conn.query_row(
        "SELECT price FROM aircraft_catalog WHERE id = ?1",
        [starting_aircraft_id],
        |row| row.get(0),
    )?;

    // Générer un ID unique pour l'avion possédé
    let player_aircraft_id = uuid::Uuid::new_v4().to_string();

    // 1. Créer le joueur SANS selected_aircraft_id (on le mettra à jour après)
    conn.execute(
        "INSERT INTO players (id, name, current_airport_id)
         VALUES (?1, ?2, ?3)",
        params![&player_id, name, starting_airport_id],
    )?;

    // 2. Ajouter l'avion au joueur (instance unique) à l'aéroport de départ
    conn.execute(
        "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&player_aircraft_id, &player_id, starting_aircraft_id, starting_airport_id, aircraft_price],
    )?;

    // 3. Initialiser la maintenance pour cette instance
    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id)
         VALUES (?1, ?2)",
        params![&player_id, &player_aircraft_id],
    )?;

    // 4. Maintenant qu'on a créé l'avion, on peut le sélectionner
    conn.execute(
        "UPDATE players SET selected_aircraft_id = ?1 WHERE id = ?2",
        params![&player_aircraft_id, &player_id],
    )?;

    Ok(player_id)
}

pub fn get_player(conn: &Connection, player_id: &str) -> Result<Option<Player>> {
    // D'abord, compléter automatiquement les maintenances terminées
    auto_complete_finished_maintenances(conn, player_id)?;

    let mut stmt = conn.prepare(
        "SELECT id, name, money, current_airport_id, selected_aircraft_id, total_flight_hours
         FROM players
         WHERE id = ?1"
    )?;

    let mut rows = stmt.query([player_id])?;

    if let Some(row) = rows.next()? {
        let id: String = row.get(0)?;

        // Récupérer les avions possédés
        let owned_aircraft_ids = get_player_aircraft_ids(conn, &id)?;

        // Récupérer les missions complétées
        let completed_missions = get_completed_mission_ids(conn, &id)?;

        // Récupérer les maintenances
        let aircraft_maintenances = get_aircraft_maintenances(conn, &id)?;

        // Récupérer l'historique de maintenance
        let maintenance_history = get_maintenance_history(conn, &id)?;

        Ok(Some(Player {
            id,
            name: row.get(1)?,
            money: row.get(2)?,
            current_airport_id: row.get(3)?,
            selected_aircraft_id: row.get(4)?,
            total_flight_hours: row.get(5)?,
            owned_aircraft_ids,
            completed_missions,
            aircraft_maintenances,
            maintenance_history,
        }))
    } else {
        Ok(None)
    }
}

fn get_player_aircraft_ids(conn: &Connection, player_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM player_aircraft WHERE player_id = ?1 ORDER BY purchase_date"
    )?;

    let ids = stmt.query_map([player_id], |row| row.get(0))?;
    ids.collect()
}

// Récupérer les avions possédés avec leurs détails complets
pub fn get_owned_aircraft(conn: &Connection, player_id: &str) -> Result<Vec<crate::models::OwnedAircraft>> {
    let mut stmt = conn.prepare(
        "SELECT
            pa.id, pa.player_id, pa.current_airport_id, pa.purchase_date, pa.purchase_price,
            ac.id, ac.name, ac.manufacturer, ac.type, ac.price, ac.capacity,
            ac.range, ac.cruise_speed, ac.maintenance_cost_per_hour,
            ac.max_flight_hours_before_maintenance, ac.image_url,
            ac.max_speed, ac.fuel_capacity, ac.fuel_consumption,
            ac.empty_weight, ac.max_takeoff_weight, ac.service_ceiling,
            ac.rate_of_climb, ac.wingspan, ac.length
         FROM player_aircraft pa
         JOIN aircraft_catalog ac ON pa.aircraft_catalog_id = ac.id
         WHERE pa.player_id = ?1
         ORDER BY pa.purchase_date"
    )?;

    let owned = stmt.query_map([player_id], |row| {
        use crate::models::{Aircraft, PlayerAircraft, OwnedAircraft, AircraftType};

        let player_aircraft = PlayerAircraft {
            id: row.get(0)?,
            player_id: row.get(1)?,
            aircraft_catalog_id: row.get(5)?,
            current_airport_id: row.get(2)?,
            purchase_date: row.get(3)?,
            purchase_price: row.get(4)?,
        };

        let aircraft_type_str: String = row.get(8)?;
        let aircraft_type = match aircraft_type_str.as_str() {
            "passenger" => AircraftType::Passenger,
            "cargo" => AircraftType::Cargo,
            "both" => AircraftType::Both,
            _ => AircraftType::Both,
        };

        let aircraft = Aircraft {
            id: row.get(5)?,
            name: row.get(6)?,
            manufacturer: row.get(7)?,
            aircraft_type,
            price: row.get(9)?,
            capacity: row.get(10)?,
            range: row.get(11)?,
            cruise_speed: row.get(12)?,
            maintenance_cost_per_hour: row.get(13)?,
            max_flight_hours_before_maintenance: row.get(14)?,
            image_url: row.get(15)?,
            max_speed: row.get(16)?,
            fuel_capacity: row.get(17)?,
            fuel_consumption: row.get(18)?,
            empty_weight: row.get(19)?,
            max_takeoff_weight: row.get(20)?,
            service_ceiling: row.get(21)?,
            rate_of_climb: row.get(22)?,
            wingspan: row.get(23)?,
            length: row.get(24)?,
        };

        Ok(OwnedAircraft::new(player_aircraft, aircraft))
    })?;

    owned.collect()
}

fn get_completed_mission_ids(conn: &Connection, player_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT mission_id FROM completed_missions WHERE player_id = ?1 ORDER BY completed_at"
    )?;

    let ids = stmt.query_map([player_id], |row| row.get(0))?;
    ids.collect()
}

pub fn update_player_money(conn: &Connection, player_id: &str, amount: i64) -> Result<()> {
    conn.execute(
        "UPDATE players SET money = money + ?1 WHERE id = ?2",
        params![amount, player_id],
    )?;
    Ok(())
}

pub fn update_player_airport(conn: &Connection, player_id: &str, airport_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE players SET current_airport_id = ?1 WHERE id = ?2",
        params![airport_id, player_id],
    )?;
    Ok(())
}

pub fn set_player_airport(conn: &Connection, player_id: &str, airport_id: &str) -> Result<()> {
    // Mettre à jour l'aéroport du joueur
    update_player_airport(conn, player_id, airport_id)?;

    // Mettre à jour l'aéroport de l'avion sélectionné
    let selected_aircraft_id: Option<String> = conn.query_row(
        "SELECT selected_aircraft_id FROM players WHERE id = ?1",
        params![player_id],
        |row| row.get(0),
    ).ok().flatten();

    if let Some(aircraft_id) = selected_aircraft_id {
        if !aircraft_id.is_empty() {
            conn.execute(
                "UPDATE player_aircraft SET current_airport_id = ?1 WHERE id = ?2 AND player_id = ?3",
                params![airport_id, &aircraft_id, player_id],
            )?;
        }
    }

    Ok(())
}

pub fn find_airport_near_position(conn: &Connection, lat: f64, lon: f64) -> Result<Option<Airport>> {
    // Bounding box ±0.05° ≈ 5km pour pré-filtrer
    let lat_delta = 0.05_f64;
    let lon_delta = 0.05_f64;

    let mut stmt = conn.prepare(
        "SELECT id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service
         FROM airports
         WHERE latitude BETWEEN ?1 AND ?2
           AND longitude BETWEEN ?3 AND ?4
         LIMIT 10"
    )?;

    let candidates = stmt.query_map(
        params![lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta],
        map_airport_row,
    )?.collect::<Result<Vec<_>>>()?;

    Ok(candidates.into_iter().find(|airport| {
        is_within_3km(lat, lon, airport.latitude, airport.longitude)
    }))
}

pub fn add_player_aircraft(
    conn: &Connection,
    player_id: &str,
    aircraft_catalog_id: &str,
    current_airport_id: &str,
    purchase_price: i64,
) -> Result<()> {
    // Générer un ID unique pour l'avion possédé
    let player_aircraft_id = uuid::Uuid::new_v4().to_string();

    // Ajouter l'avion (instance unique) à l'aéroport actuel
    conn.execute(
        "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&player_aircraft_id, player_id, aircraft_catalog_id, current_airport_id, purchase_price],
    )?;

    // Initialiser la maintenance pour cette instance
    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id)
         VALUES (?1, ?2)",
        params![player_id, &player_aircraft_id],
    )?;

    Ok(())
}

pub fn remove_player_aircraft(conn: &Connection, player_id: &str, player_aircraft_id: &str) -> Result<()> {
    // Supprimer l'avion possédé (cascade supprimera la maintenance grâce à ON DELETE CASCADE)
    conn.execute(
        "DELETE FROM player_aircraft WHERE player_id = ?1 AND id = ?2",
        params![player_id, player_aircraft_id],
    )?;

    Ok(())
}

pub fn select_player_aircraft(conn: &Connection, player_id: &str, player_aircraft_id: &str) -> Result<()> {
    // Vérifier que l'avion appartient au joueur et est au même aéroport
    let (aircraft_airport, player_airport): (String, String) = conn.query_row(
        "SELECT pa.current_airport_id, p.current_airport_id
         FROM player_aircraft pa
         JOIN players p ON p.id = pa.player_id
         WHERE pa.id = ?1 AND pa.player_id = ?2",
        params![player_aircraft_id, player_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    // Vérifier que l'avion est au même aéroport que le joueur
    if aircraft_airport != player_airport {
        return Err(rusqlite::Error::QueryReturnedNoRows); // Erreur: avion pas au bon aéroport
    }

    // Sélectionner l'avion
    conn.execute(
        "UPDATE players SET selected_aircraft_id = ?1 WHERE id = ?2",
        params![player_aircraft_id, player_id],
    )?;
    Ok(())
}

// ============= MAINTENANCE =============

use std::collections::HashMap;

fn get_aircraft_maintenances(conn: &Connection, player_id: &str) -> Result<AircraftMaintenances> {
    let mut stmt = conn.prepare(
        "SELECT player_aircraft_id, flight_hours, condition, is_under_maintenance,
                maintenance_end_date, last_maintenance_date
         FROM aircraft_maintenances
         WHERE player_id = ?1"
    )?;

    let maintenances = stmt.query_map([player_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            AircraftMaintenance {
                aircraft_id: row.get(0)?, // aircraft_id = player_aircraft_id maintenant
                flight_hours: row.get(1)?,
                condition: row.get(2)?,
                is_under_maintenance: row.get(3)?,
                maintenance_end_date: row.get(4)?,
                last_maintenance_date: row.get(5)?,
            },
        ))
    })?;

    let mut map = HashMap::new();
    for result in maintenances {
        let (id, maintenance) = result?;
        map.insert(id, maintenance);
    }

    Ok(map)
}

fn get_maintenance_history(conn: &Connection, player_id: &str) -> Result<Vec<MaintenanceRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, player_aircraft_id, date, type, cost, flight_hours_at_maintenance, description
         FROM maintenance_records
         WHERE player_id = ?1
         ORDER BY date DESC"
    )?;

    let records = stmt.query_map([player_id], |row| {
        let type_str: String = row.get(3)?;
        let maintenance_type = match type_str.as_str() {
            "routine" => MaintenanceType::Routine,
            "repair" => MaintenanceType::Repair,
            "inspection" => MaintenanceType::Inspection,
            _ => MaintenanceType::Routine,
        };

        Ok(MaintenanceRecord {
            id: row.get(0)?,
            aircraft_id: row.get(1)?, // Note: aircraft_id dans le modèle = player_aircraft_id en DB
            date: row.get(2)?,
            maintenance_type,
            cost: row.get(4)?,
            flight_hours_at_maintenance: row.get(5)?,
            description: row.get(6)?,
        })
    })?;

    records.collect()
}

pub fn update_aircraft_maintenance(
    conn: &Connection,
    player_id: &str,
    player_aircraft_id: &str,
    flight_hours: f64,
    condition: i32,
) -> Result<()> {
    conn.execute(
        "UPDATE aircraft_maintenances
         SET flight_hours = ?1, condition = ?2
         WHERE player_id = ?3 AND player_aircraft_id = ?4",
        params![flight_hours, condition, player_id, player_aircraft_id],
    )?;
    Ok(())
}

pub fn start_maintenance(
    conn: &Connection,
    player_id: &str,
    player_aircraft_id: &str,
    end_date: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE aircraft_maintenances
         SET is_under_maintenance = 1, maintenance_end_date = ?1
         WHERE player_id = ?2 AND player_aircraft_id = ?3",
        params![end_date, player_id, player_aircraft_id],
    )?;
    Ok(())
}

pub fn complete_maintenance(conn: &Connection, player_id: &str, player_aircraft_id: &str) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE aircraft_maintenances
         SET is_under_maintenance = 0,
             maintenance_end_date = NULL,
             last_maintenance_date = ?1,
             flight_hours = 0,
             condition = 100
         WHERE player_id = ?2 AND player_aircraft_id = ?3",
        params![now, player_id, player_aircraft_id],
    )?;
    Ok(())
}

// Auto-compléter les maintenances dont la date de fin est passée
fn auto_complete_finished_maintenances(conn: &Connection, player_id: &str) -> Result<()> {
    let now = chrono::Utc::now();

    // Récupérer toutes les maintenances en cours avec leur date de fin
    let mut stmt = conn.prepare(
        "SELECT player_aircraft_id, maintenance_end_date
         FROM aircraft_maintenances
         WHERE player_id = ?1 AND is_under_maintenance = 1 AND maintenance_end_date IS NOT NULL"
    )?;

    let maintenances: Vec<(String, String)> = stmt
        .query_map([player_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?
        .collect::<Result<Vec<_>>>()?;

    // Compléter celles dont la date est passée
    for (player_aircraft_id, end_date) in maintenances {
        if let Ok(end_datetime) = chrono::DateTime::parse_from_rfc3339(&end_date) {
            if end_datetime.with_timezone(&chrono::Utc) <= now {
                // La maintenance est terminée, la compléter automatiquement
                complete_maintenance(conn, player_id, &player_aircraft_id)?;
            }
        }
    }

    Ok(())
}

pub fn add_maintenance_record(conn: &Connection, player_id: &str, record: &MaintenanceRecord) -> Result<()> {
    let type_str = match record.maintenance_type {
        MaintenanceType::Routine => "routine",
        MaintenanceType::Repair => "repair",
        MaintenanceType::Inspection => "inspection",
    };

    conn.execute(
        "INSERT INTO maintenance_records
         (id, player_id, player_aircraft_id, date, type, cost, flight_hours_at_maintenance, description)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            &record.id,
            player_id,
            &record.aircraft_id,
            &record.date,
            type_str,
            record.cost,
            record.flight_hours_at_maintenance,
            &record.description
        ],
    )?;
    Ok(())
}

// ============= MISSIONS =============

pub fn get_missions_by_airport(conn: &Connection, airport_id: &str) -> Result<Vec<Mission>> {
    // Récupérer l'aéroport de départ
    let from_airport = get_airport_by_id(conn, airport_id)?
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

    let from_lat = from_airport.latitude;
    let from_lon = from_airport.longitude;

    // Calculer un carré approximatif de ±5 degrés (≈300 NM)
    // 1 degré ≈ 60 NM, donc 5 degrés ≈ 300 NM
    let lat_delta = 5.0;
    let lon_delta = 5.0 / from_lat.to_radians().cos().max(0.1); // Ajusté selon la latitude

    let min_lat = from_lat - lat_delta;
    let max_lat = from_lat + lat_delta;
    let min_lon = from_lon - lon_delta;
    let max_lon = from_lon + lon_delta;

    // Récupérer les aéroports dans la zone approximative
    let mut stmt = conn.prepare(
        "SELECT id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service
         FROM airports
         WHERE id != ?1
           AND latitude BETWEEN ?2 AND ?3
           AND longitude BETWEEN ?4 AND ?5
        LIMIT 50"
    )?;

    let candidates = stmt.query_map(
        params![airport_id, min_lat, max_lat, min_lon, max_lon],
        map_airport_row
    )?.collect::<Result<Vec<_>>>()?;

    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    // Créer un RNG déterministe basé sur l'heure et l'airport_id
    let seed = generate_mission_seed(airport_id);
    let mut rng: StdRng = StdRng::seed_from_u64(seed);

    let mut missions = Vec::new();

    // Générer entre 4 et 10 missions
    let mission_count = rng.gen_range(4..=10);

    for i in 0..mission_count {
        // Choisir une destination aléatoire (peut être répétée)
        let dest = &candidates[rng.gen_range(0..candidates.len())];

        let distance = calculate_distance(
            from_airport.latitude,
            from_airport.longitude,
            dest.latitude,
            dest.longitude,
        ).round() as i32;

        // 50% de chance pour passagers ou cargo
        if rng.gen_bool(0.5) {
            // Mission passagers
            let passenger_count = rng.gen_range(1..=8);
            let passenger_reward = ((distance as i64) * 20) * (passenger_count as i64);

            missions.push(Mission::new_passenger(
                format!("mission-{}-{}-pax-{}", airport_id, dest.id, i),
                from_airport.clone(),
                dest.clone(),
                distance,
                passenger_reward,
                passenger_count,
            ));
        } else {
            // Mission cargo
            let cargo_weight = rng.gen_range(20..=800) as i32;
            let cargo_reward = (distance as i64) * 25 * (cargo_weight as i64 / 10);

            // Liste de types de cargo
            let cargo_types = [
                "Electronics",
                "Medical supplies",
                "Automotive parts",
                "Pharmaceuticals",
                "Fresh produce",
                "Perishable goods",
                "Industrial equipment",
                "Machinery",
                "Documents",
                "Mail & parcels",
                "Textiles",
                "Fashion goods",
                "Sporting equipment",
                "Musical instruments",
                "Computer hardware",
                "Food & beverages",
                "Chemicals",
                "Building materials",
                "Scientific instruments",
                "Emergency supplies",
            ];

            let cargo_description = cargo_types[rng.gen_range(0..cargo_types.len())].to_string();

            missions.push(Mission::new_cargo(
                format!("mission-{}-{}-cargo-{}", airport_id, dest.id, i),
                from_airport.clone(),
                dest.clone(),
                distance,
                cargo_reward,
                cargo_weight,
                cargo_description,
            ));
        }
    }

    Ok(missions)
}

pub fn complete_mission(
    conn: &Connection,
    player_id: &str,
    mission_id: &str,
    reward: i64,
    flight_hours: f64,
    aircraft_used: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO completed_missions
         (player_id, mission_id, reward_earned, flight_hours, aircraft_used)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![player_id, mission_id, reward, flight_hours, aircraft_used],
    )?;

    // Mettre à jour l'argent du joueur
    update_player_money(conn, player_id, reward)?;

    // Mettre à jour les heures de vol totales
    conn.execute(
        "UPDATE players SET total_flight_hours = total_flight_hours + ?1 WHERE id = ?2",
        params![flight_hours, player_id],
    )?;

    Ok(())
}

// ============= ACTIVE MISSIONS =============

use uuid::Uuid;

pub fn accept_mission(
    conn: &Connection,
    player_id: &str,
    from_airport_id: &str,
    to_airport_id: &str,
    mission_type: &str,
    distance: i32,
    reward: i64,
    cargo_weight: Option<i32>,
    cargo_description: Option<String>,
    passenger_count: Option<i32>,
    aircraft_id: &str,
) -> Result<String> {
    // Vérifier qu'il n'y a pas déjà une mission active
    let active_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM active_missions WHERE player_id = ?1",
        params![player_id],
        |row| row.get(0),
    )?;

    if active_count > 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }

    let active_mission_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO active_missions
         (id, player_id, from_airport_id, to_airport_id, type, distance, reward,
          cargo_weight, cargo_description, passenger_count, aircraft_id, accepted_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'in_progress')",
        params![
            active_mission_id,
            player_id,
            from_airport_id,
            to_airport_id,
            mission_type,
            distance,
            reward,
            cargo_weight,
            cargo_description,
            passenger_count,
            aircraft_id,
            now,
        ],
    )?;

    Ok(active_mission_id)
}

pub fn get_active_missions(conn: &Connection, player_id: &str) -> Result<Vec<ActiveMission>> {
    let mut stmt = conn.prepare(
        "SELECT id, from_airport_id, to_airport_id, type, distance, reward,
                cargo_weight, cargo_description, passenger_count, aircraft_id, accepted_at, status
         FROM active_missions
         WHERE player_id = ?1
         ORDER BY accepted_at DESC"
    )?;

    let missions = stmt.query_map([player_id], |row| {
        let active_mission_id: String = row.get(0)?;
        let from_airport_id: String = row.get(1)?;
        let to_airport_id: String = row.get(2)?;
        let mission_type: String = row.get(3)?;
        let distance: i32 = row.get(4)?;
        let reward: i64 = row.get(5)?;
        let cargo_weight: Option<i32> = row.get(6)?;
        let cargo_description: Option<String> = row.get(7)?;
        let passenger_count: Option<i32> = row.get(8)?;
        let aircraft_id: String = row.get(9)?;
        let accepted_at: String = row.get(10)?;
        let status_str: String = row.get(11)?;

        // Charger les aéroports
        let from_airport = get_airport_by_id(conn, &from_airport_id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
        let to_airport = get_airport_by_id(conn, &to_airport_id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

        // Créer la mission
        let mission = if mission_type == "passenger" {
            Mission::new_passenger(
                format!("active-{}", active_mission_id),
                from_airport,
                to_airport,
                distance,
                reward,
                passenger_count.unwrap_or(0),
            )
        } else {
            Mission::new_cargo(
                format!("active-{}", active_mission_id),
                from_airport,
                to_airport,
                distance,
                reward,
                cargo_weight.unwrap_or(0),
                cargo_description.clone().unwrap_or_default(),
            )
        };

        let status = if status_str == "ready_to_complete" {
            ActiveMissionStatus::ReadyToComplete
        } else {
            ActiveMissionStatus::InProgress
        };

        Ok(ActiveMission {
            id: active_mission_id,
            mission,
            aircraft_id,
            accepted_at,
            status,
        })
    })?;

    missions.collect()
}

pub fn complete_active_mission(
    conn: &Connection,
    player_id: &str,
    active_mission_id: &str,
) -> Result<i64> {
    // Récupérer la mission active
    let mut stmt = conn.prepare(
        "SELECT reward, aircraft_id, to_airport_id FROM active_missions WHERE id = ?1 AND player_id = ?2"
    )?;

    let (reward, aircraft_id, to_airport_id): (i64, String, String) = stmt.query_row(
        params![active_mission_id, player_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    )?;

    // Supprimer la mission active
    conn.execute(
        "DELETE FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
    )?;

    // Ajouter à l'argent du joueur
    update_player_money(conn, player_id, reward)?;

    // Déplacer le joueur vers l'aéroport de destination
    update_player_airport(conn, player_id, &to_airport_id)?;

    // Déplacer l'avion utilisé vers l'aéroport de destination
    conn.execute(
        "UPDATE player_aircraft SET current_airport_id = ?1 WHERE id = ?2 AND player_id = ?3",
        params![&to_airport_id, &aircraft_id, player_id],
    )?;

    // TODO: Mettre à jour les heures de vol et la maintenance de l'avion

    Ok(reward)
}

pub fn cancel_active_mission(
    conn: &Connection,
    player_id: &str,
    active_mission_id: &str,
    progress_percentage: i32,
) -> Result<i64> {
    // Récupérer la récompense de la mission
    let reward: i64 = conn.query_row(
        "SELECT reward FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
        |row| row.get(0),
    )?;

    // Calculer la pénalité (pourcentage de progression * récompense)
    let penalty = (reward * progress_percentage as i64) / 100;

    // Supprimer la mission active
    conn.execute(
        "DELETE FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
    )?;

    // Déduire la pénalité de l'argent du joueur
    if penalty > 0 {
        update_player_money(conn, player_id, -penalty)?;
    }

    Ok(penalty)
}

pub fn mark_mission_ready_to_complete(
    conn: &Connection,
    active_mission_id: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE active_missions SET status = 'ready_to_complete' WHERE id = ?1",
        params![active_mission_id],
    )?;

    Ok(())
}

// ============= MARKET (Shop d'occasion) =============

pub fn get_market_aircraft(
    conn: &Connection,
    player_id: &str,
) -> Result<Vec<MarketAircraft>> {
    // 1. Récupérer la position du joueur
    let player_airport = conn.query_row(
        "SELECT a.id, a.icao, a.iata_code, a.name, a.type, a.city, a.country,
                a.latitude, a.longitude, a.elevation, a.scheduled_service
         FROM players p
         JOIN airports a ON p.current_airport_id = a.id
         WHERE p.id = ?1",
        params![player_id],
        |row| {
            Ok(Airport {
                id: row.get(0)?,
                icao: row.get(1)?,
                iata_code: row.get(2)?,
                name: row.get(3)?,
                airport_type: row.get(4)?,
                city: row.get(5)?,
                country: row.get(6)?,
                latitude: row.get(7)?,
                longitude: row.get(8)?,
                elevation: row.get(9)?,
                scheduled_service: row.get(10)?,
            })
        },
    )?;

    // 2. Générer le seed du jour
    let seed = generate_daily_market_seed();
    let mut rng = StdRng::seed_from_u64(seed);

    // 3. Trouver les aéroports dans un rayon de 1000 NM (bounding box)
    let max_distance = 1000.0;
    let lat_delta = max_distance / 60.0; // 1 degré ≈ 60 NM
    let lon_delta = max_distance / (60.0 * player_airport.latitude.to_radians().cos().abs());

    let min_lat = player_airport.latitude - lat_delta;
    let max_lat = player_airport.latitude + lat_delta;
    let min_lon = player_airport.longitude - lon_delta;
    let max_lon = player_airport.longitude + lon_delta;

    let mut stmt = conn.prepare(
        "SELECT id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service
         FROM airports
         WHERE latitude BETWEEN ?1 AND ?2
           AND longitude BETWEEN ?3 AND ?4
           AND id != ?5
         ORDER BY RANDOM()
         LIMIT 20"
    )?;

    let nearby_airports: Vec<Airport> = stmt.query_map(
        params![min_lat, max_lat, min_lon, max_lon, &player_airport.id],
        |row| {
            Ok(Airport {
                id: row.get(0)?,
                icao: row.get(1)?,
                iata_code: row.get(2)?,
                name: row.get(3)?,
                airport_type: row.get(4)?,
                city: row.get(5)?,
                country: row.get(6)?,
                latitude: row.get(7)?,
                longitude: row.get(8)?,
                elevation: row.get(9)?,
                scheduled_service: row.get(10)?,
            })
        },
    )?
    .filter_map(|r| r.ok())
    .filter(|airport| {
        let dist = calculate_distance(
            player_airport.latitude,
            player_airport.longitude,
            airport.latitude,
            airport.longitude,
        );
        dist <= max_distance
    })
    .collect();

    // 4. Récupérer tous les avions du catalogue
    let all_aircraft = get_all_aircraft(conn)?;

    // 5. Générer les offres du marché
    let mut market_offers: Vec<MarketAircraft> = Vec::new();

    for airport in nearby_airports {
        // Nombre d'offres par aéroport: 1 à 3
        let num_offers = (rng.gen::<u32>() % 3) + 1;

        for _ in 0..num_offers {
            // Sélectionner un avion aléatoire du catalogue
            let aircraft_index = rng.gen_range(0..all_aircraft.len());
            let aircraft = all_aircraft[aircraft_index].clone();

            // 30% de chance d'avoir un avion neuf
            let is_new = rng.gen::<f64>() < 0.3;

            let (condition, flight_hours) = if is_new {
                // Avion neuf: 100% condition, 0 heures de vol
                (100, 0.0)
            } else {
                // Avion d'occasion: 60-99% condition
                let cond = rng.gen_range(60..100);

                // Générer heures de vol basées sur la condition
                let max_hours = aircraft.max_flight_hours_before_maintenance as f64;
                let flight_hours_ratio = (100 - cond) as f64 / 100.0;
                let hours = max_hours * flight_hours_ratio * rng.gen::<f64>();

                (cond, hours)
            };

            // Calculer le prix: réduction basée sur la condition
            let condition_factor = condition as f64 / 100.0;
            let price_factor = 0.5 + (condition_factor * 0.5); // 50% à 100% du prix
            let price = (aircraft.price as f64 * price_factor) as i64;

            // Calculer la distance
            let distance = calculate_distance(
                player_airport.latitude,
                player_airport.longitude,
                airport.latitude,
                airport.longitude,
            ) as i32;

            // Générer un ID unique pour cette offre
            let offer_id = format!("market-{}-{}-{}", seed, airport.id, aircraft.id);

            market_offers.push(MarketAircraft {
                id: offer_id,
                aircraft,
                location: airport.clone(),
                distance,
                price,
                condition,
                flight_hours,
            });
        }
    }

    // Trier par distance (plus proche en premier)
    market_offers.sort_by_key(|offer| offer.distance);

    Ok(market_offers)
}

// ============= CHEAT COMMANDS (Debug) =============

pub fn cheat_teleport_to_airport(
    conn: &Connection,
    player_id: &str,
    airport_id: &str,
) -> Result<()> {
    // Vérifier que l'aéroport existe
    let airport_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM airports WHERE id = ?1",
        params![airport_id],
        |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        },
    )?;

    if !airport_exists {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    // Téléporter le joueur
    conn.execute(
        "UPDATE players SET current_airport_id = ?1 WHERE id = ?2",
        params![airport_id, player_id],
    )?;

    Ok(())
}

pub fn cheat_teleport_aircraft(
    conn: &Connection,
    player_aircraft_id: &str,
    airport_id: &str,
) -> Result<()> {
    // Vérifier que l'aéroport existe
    let airport_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM airports WHERE id = ?1",
        params![airport_id],
        |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        },
    )?;

    if !airport_exists {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    // Téléporter l'avion
    conn.execute(
        "UPDATE player_aircraft SET current_airport_id = ?1 WHERE id = ?2",
        params![airport_id, player_aircraft_id],
    )?;

    Ok(())
}

pub fn cheat_force_complete_mission(
    conn: &Connection,
    player_id: &str,
    active_mission_id: &str,
) -> Result<i64> {
    // Simplement utiliser la fonction complete_active_mission existante
    // mais sans vérifier la position géographique
    complete_active_mission(conn, player_id, active_mission_id)
}

pub fn cheat_set_aircraft_wear(
    conn: &Connection,
    player_aircraft_id: &str,
    flight_hours: f64,
    condition: i32,
) -> Result<()> {
    // Mettre à jour la maintenance de l'avion
    conn.execute(
        "UPDATE aircraft_maintenances
         SET flight_hours = ?1, condition = ?2
         WHERE player_aircraft_id = ?3",
        params![flight_hours, condition, player_aircraft_id],
    )?;

    Ok(())
}

pub fn cheat_give_aircraft(
    conn: &Connection,
    player_id: &str,
    aircraft_catalog_id: &str,
) -> Result<()> {
    // Vérifier que l'avion existe dans le catalogue
    let aircraft_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM aircraft_catalog WHERE id = ?1",
        params![aircraft_catalog_id],
        |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        },
    )?;

    if !aircraft_exists {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    // Récupérer l'aéroport actuel du joueur
    let current_airport_id: String = conn.query_row(
        "SELECT current_airport_id FROM players WHERE id = ?1",
        params![player_id],
        |row| row.get(0),
    )?;

    // Générer un ID unique pour l'avion possédé
    let player_aircraft_id = uuid::Uuid::new_v4().to_string();

    // Ajouter l'avion gratuitement (price = 0) à l'aéroport du joueur
    // On peut avoir plusieurs fois le même modèle
    conn.execute(
        "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
         VALUES (?1, ?2, ?3, ?4, 0)",
        params![&player_aircraft_id, player_id, aircraft_catalog_id, &current_airport_id],
    )?;

    // Initialiser la maintenance pour cette instance
    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id)
         VALUES (?1, ?2)",
        params![player_id, &player_aircraft_id],
    )?;

    Ok(())
}
