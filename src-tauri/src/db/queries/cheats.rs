use rusqlite::{params, Connection, Result};
use super::active_missions::complete_active_mission;

pub fn cheat_teleport_to_airport(conn: &Connection, player_id: &str, airport_id: &str) -> Result<()> {
    let airport_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM airports WHERE id = ?1",
        params![airport_id],
        |row| { let count: i64 = row.get(0)?; Ok(count > 0) },
    )?;

    if !airport_exists {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    conn.execute(
        "UPDATE players SET current_airport_id = ?1 WHERE id = ?2",
        params![airport_id, player_id],
    )?;

    Ok(())
}

pub fn cheat_teleport_aircraft(conn: &Connection, player_aircraft_id: &str, airport_id: &str) -> Result<()> {
    let airport_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM airports WHERE id = ?1",
        params![airport_id],
        |row| { let count: i64 = row.get(0)?; Ok(count > 0) },
    )?;

    if !airport_exists {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

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
    complete_active_mission(conn, player_id, active_mission_id)
}

pub fn cheat_set_aircraft_wear(
    conn: &Connection,
    player_aircraft_id: &str,
    flight_hours: f64,
    condition: i32,
) -> Result<()> {
    conn.execute(
        "UPDATE aircraft_maintenances
         SET flight_hours = ?1, condition = ?2
         WHERE player_aircraft_id = ?3",
        params![flight_hours, condition, player_aircraft_id],
    )?;
    Ok(())
}

pub fn cheat_give_aircraft(conn: &Connection, player_id: &str, aircraft_catalog_id: &str) -> Result<()> {
    let current_airport_id: String = conn.query_row(
        "SELECT current_airport_id FROM players WHERE id = ?1",
        params![player_id],
        |row| row.get(0),
    )?;

    let player_aircraft_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO player_aircraft (id, player_id, aircraft_catalog_id, current_airport_id, purchase_price)
         VALUES (?1, ?2, ?3, ?4, 0)",
        params![&player_aircraft_id, player_id, aircraft_catalog_id, &current_airport_id],
    )?;

    conn.execute(
        "INSERT INTO aircraft_maintenances (player_id, player_aircraft_id) VALUES (?1, ?2)",
        params![player_id, &player_aircraft_id],
    )?;

    Ok(())
}
