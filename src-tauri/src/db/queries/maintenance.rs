use rusqlite::{params, Connection, Result};
use std::collections::HashMap;
use crate::models::{AircraftMaintenance, AircraftMaintenances, MaintenanceRecord, MaintenanceType};

pub(super) fn get_aircraft_maintenances(conn: &Connection, player_id: &str) -> Result<AircraftMaintenances> {
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

pub(super) fn get_maintenance_history(conn: &Connection, player_id: &str) -> Result<Vec<MaintenanceRecord>> {
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

pub(super) fn auto_complete_finished_maintenances(conn: &Connection, player_id: &str) -> Result<()> {
    let now = chrono::Utc::now();

    let mut stmt = conn.prepare(
        "SELECT player_aircraft_id, maintenance_end_date
         FROM aircraft_maintenances
         WHERE player_id = ?1 AND is_under_maintenance = 1 AND maintenance_end_date IS NOT NULL"
    )?;

    let maintenances: Vec<(String, String)> = stmt
        .query_map([player_id], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>>>()?;

    for (player_aircraft_id, end_date) in maintenances {
        if let Ok(end_datetime) = chrono::DateTime::parse_from_rfc3339(&end_date) {
            if end_datetime.with_timezone(&chrono::Utc) <= now {
                complete_maintenance(conn, player_id, &player_aircraft_id)?;
            }
        }
    }

    Ok(())
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
