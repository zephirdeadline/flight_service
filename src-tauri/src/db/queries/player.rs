use rusqlite::{params, Connection, Result};
use crate::models::{Aircraft, AircraftType, OwnedAircraft, Player};
use super::maintenance::{auto_complete_finished_maintenances, get_aircraft_maintenances, get_maintenance_history};

pub fn create_player(
    conn: &Connection,
    name: &str,
    starting_airport_id: &str,
    starting_aircraft_id: &str,
) -> Result<String> {
    let player_id = "1".to_string();

    conn.execute("DELETE FROM players WHERE id = ?1", [&player_id])?;

    let aircraft_price: i64 = conn.query_row(
        "SELECT price FROM aircraft_catalog WHERE id = ?1",
        [starting_aircraft_id],
        |row| row.get(0),
    )?;

    let player_aircraft_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO players (id, name, current_airport_id) VALUES (?1, ?2, ?3)",
        params![&player_id, name, starting_airport_id],
    )?;

    conn.execute(
        "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&player_aircraft_id, &player_id, starting_aircraft_id, starting_airport_id, aircraft_price],
    )?;

    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id) VALUES (?1, ?2)",
        params![&player_id, &player_aircraft_id],
    )?;

    conn.execute(
        "UPDATE players SET selected_aircraft_id = ?1 WHERE id = ?2",
        params![&player_aircraft_id, &player_id],
    )?;

    Ok(player_id)
}

pub fn get_player(conn: &Connection, player_id: &str) -> Result<Option<Player>> {
    auto_complete_finished_maintenances(conn, player_id)?;

    let mut stmt = conn.prepare(
        "SELECT id, name, money, current_airport_id, selected_aircraft_id, total_flight_hours
         FROM players WHERE id = ?1"
    )?;

    let mut rows = stmt.query([player_id])?;

    if let Some(row) = rows.next()? {
        let id: String = row.get(0)?;

        let owned_aircraft_ids = get_player_aircraft_ids(conn, &id)?;
        let completed_missions = get_completed_mission_ids(conn, &id)?;
        let aircraft_maintenances = get_aircraft_maintenances(conn, &id)?;
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

fn get_completed_mission_ids(conn: &Connection, player_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT mission_id FROM completed_missions WHERE player_id = ?1 ORDER BY completed_at"
    )?;
    let ids = stmt.query_map([player_id], |row| row.get(0))?;
    ids.collect()
}

pub fn get_owned_aircraft(conn: &Connection, player_id: &str) -> Result<Vec<OwnedAircraft>> {
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
        let aircraft_type_str: String = row.get(8)?;
        let aircraft_type = match aircraft_type_str.as_str() {
            "passenger" => AircraftType::Passenger,
            "cargo" => AircraftType::Cargo,
            "both" => AircraftType::Both,
            _ => AircraftType::Both,
        };

        Ok(OwnedAircraft {
            id: row.get(0)?,
            player_id: row.get(1)?,
            current_airport_id: row.get(2)?,
            purchase_date: row.get(3)?,
            purchase_price: row.get(4)?,
            aircraft: Aircraft {
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
            },
        })
    })?;

    owned.collect()
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
    update_player_airport(conn, player_id, airport_id)?;

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

pub fn add_player_aircraft(
    conn: &Connection,
    player_id: &str,
    aircraft_catalog_id: &str,
    current_airport_id: &str,
    purchase_price: i64,
) -> Result<()> {
    let player_aircraft_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&player_aircraft_id, player_id, aircraft_catalog_id, current_airport_id, purchase_price],
    )?;

    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id) VALUES (?1, ?2)",
        params![player_id, &player_aircraft_id],
    )?;

    Ok(())
}

pub fn remove_player_aircraft(conn: &Connection, player_id: &str, player_aircraft_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM player_aircraft WHERE player_id = ?1 AND id = ?2",
        params![player_id, player_aircraft_id],
    )?;
    Ok(())
}

pub fn select_player_aircraft(conn: &Connection, player_id: &str, player_aircraft_id: &str) -> Result<()> {
    let (aircraft_airport, player_airport): (String, String) = conn.query_row(
        "SELECT pa.current_airport_id, p.current_airport_id
         FROM player_aircraft pa
         JOIN players p ON p.id = pa.player_id
         WHERE pa.id = ?1 AND pa.player_id = ?2",
        params![player_aircraft_id, player_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    if aircraft_airport != player_airport {
        return Err(rusqlite::Error::InvalidParameterName(
            "Aircraft is not at your current airport".to_string()
        ));
    }

    conn.execute(
        "UPDATE players SET selected_aircraft_id = ?1 WHERE id = ?2",
        params![player_aircraft_id, player_id],
    )?;
    Ok(())
}
