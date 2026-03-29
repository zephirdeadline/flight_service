use rusqlite::{params, Connection, Result, Row};
use crate::models::*;
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

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

    // Créer le joueur avec selected_aircraft_id = aircraft du catalogue
    conn.execute(
        "INSERT INTO players (id, name, current_airport_id, selected_aircraft_id)
         VALUES (?1, ?2, ?3, ?4)",
        params![&player_id, name, starting_airport_id, starting_aircraft_id],
    )?;

    // Ajouter l'avion au joueur
    conn.execute(
        "INSERT INTO player_aircraft (player_id, aircraft_id, purchase_price)
         VALUES (?1, ?2, ?3)",
        params![&player_id, starting_aircraft_id, aircraft_price],
    )?;

    // Initialiser la maintenance
    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, aircraft_id)
         VALUES (?1, ?2)",
        params![&player_id, starting_aircraft_id],
    )?;

    Ok(player_id)
}

pub fn get_player(conn: &Connection, player_id: &str) -> Result<Option<Player>> {
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
        "SELECT aircraft_id FROM player_aircraft WHERE player_id = ?1 ORDER BY purchase_date"
    )?;

    let ids = stmt.query_map([player_id], |row| row.get(0))?;
    ids.collect()
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

pub fn add_player_aircraft(
    conn: &Connection,
    player_id: &str,
    aircraft_id: &str,
    purchase_price: i64,
) -> Result<()> {
    // Ajouter l'avion
    conn.execute(
        "INSERT INTO player_aircraft (player_id, aircraft_id, purchase_price)
         VALUES (?1, ?2, ?3)",
        params![player_id, aircraft_id, purchase_price],
    )?;

    // Initialiser la maintenance
    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, aircraft_id)
         VALUES (?1, ?2)",
        params![player_id, aircraft_id],
    )?;

    Ok(())
}

pub fn remove_player_aircraft(conn: &Connection, player_id: &str, aircraft_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM player_aircraft WHERE player_id = ?1 AND aircraft_id = ?2",
        params![player_id, aircraft_id],
    )?;

    // Supprimer la maintenance
    conn.execute(
        "DELETE FROM aircraft_maintenances WHERE player_id = ?1 AND aircraft_id = ?2",
        params![player_id, aircraft_id],
    )?;

    Ok(())
}

pub fn select_player_aircraft(conn: &Connection, player_id: &str, aircraft_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE players SET selected_aircraft_id = ?1 WHERE id = ?2",
        params![aircraft_id, player_id],
    )?;
    Ok(())
}

// ============= MAINTENANCE =============

use std::collections::HashMap;

fn get_aircraft_maintenances(conn: &Connection, player_id: &str) -> Result<AircraftMaintenances> {
    let mut stmt = conn.prepare(
        "SELECT aircraft_id, flight_hours, condition, is_under_maintenance,
                maintenance_end_date, last_maintenance_date
         FROM aircraft_maintenances
         WHERE player_id = ?1"
    )?;

    let maintenances = stmt.query_map([player_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            AircraftMaintenance {
                aircraft_id: row.get(0)?,
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
        "SELECT id, aircraft_id, date, type, cost, flight_hours_at_maintenance, description
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
            aircraft_id: row.get(1)?,
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
    aircraft_id: &str,
    flight_hours: f64,
    condition: i32,
) -> Result<()> {
    conn.execute(
        "UPDATE aircraft_maintenances
         SET flight_hours = ?1, condition = ?2
         WHERE player_id = ?3 AND aircraft_id = ?4",
        params![flight_hours, condition, player_id, aircraft_id],
    )?;
    Ok(())
}

pub fn start_maintenance(
    conn: &Connection,
    player_id: &str,
    aircraft_id: &str,
    end_date: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE aircraft_maintenances
         SET is_under_maintenance = 1, maintenance_end_date = ?1
         WHERE player_id = ?2 AND aircraft_id = ?3",
        params![end_date, player_id, aircraft_id],
    )?;
    Ok(())
}

pub fn complete_maintenance(conn: &Connection, player_id: &str, aircraft_id: &str) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE aircraft_maintenances
         SET is_under_maintenance = 0,
             maintenance_end_date = NULL,
             last_maintenance_date = ?1,
             flight_hours = 0,
             condition = 100
         WHERE player_id = ?2 AND aircraft_id = ?3",
        params![now, player_id, aircraft_id],
    )?;
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
         (id, player_id, aircraft_id, date, type, cost, flight_hours_at_maintenance, description)
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
        "SELECT reward, aircraft_id FROM active_missions WHERE id = ?1 AND player_id = ?2"
    )?;

    let (reward, _aircraft_id): (i64, String) = stmt.query_row(
        params![active_mission_id, player_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    )?;

    // Supprimer la mission active
    conn.execute(
        "DELETE FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
    )?;

    // Ajouter à l'argent du joueur
    update_player_money(conn, player_id, reward)?;

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
