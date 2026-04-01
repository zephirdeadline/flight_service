use rusqlite::{Connection, Result, Row};
use crate::models::{Aircraft, AircraftType};

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

const AIRCRAFT_SELECT: &str =
    "SELECT id, name, manufacturer, type, price, capacity, range, cruise_speed,
            maintenance_cost_per_hour, max_flight_hours_before_maintenance, image_url,
            max_speed, fuel_capacity, fuel_consumption, empty_weight, max_takeoff_weight,
            service_ceiling, rate_of_climb, wingspan, length
     FROM aircraft_catalog";

pub fn get_all_aircraft(conn: &Connection) -> Result<Vec<Aircraft>> {
    let mut stmt = conn.prepare(&format!("{} ORDER BY price", AIRCRAFT_SELECT))?;
    let aircraft = stmt.query_map([], map_aircraft_row)?;
    aircraft.collect()
}

pub fn get_aircraft_by_id(conn: &Connection, id: &str) -> Result<Option<Aircraft>> {
    let mut stmt = conn.prepare(&format!("{} WHERE id = ?1", AIRCRAFT_SELECT))?;
    let mut rows = stmt.query([id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(map_aircraft_row(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_aircraft_by_type(conn: &Connection, aircraft_type: &str) -> Result<Vec<Aircraft>> {
    let mut stmt = conn.prepare(&format!(
        "{} WHERE type = ?1 OR type = 'both' ORDER BY price",
        AIRCRAFT_SELECT
    ))?;
    let aircraft = stmt.query_map([aircraft_type], map_aircraft_row)?;
    aircraft.collect()
}

pub fn get_aircraft_by_budget(conn: &Connection, max_price: i64) -> Result<Vec<Aircraft>> {
    let mut stmt = conn.prepare(&format!(
        "{} WHERE price <= ?1 ORDER BY price DESC",
        AIRCRAFT_SELECT
    ))?;
    let aircraft = stmt.query_map([max_price], map_aircraft_row)?;
    aircraft.collect()
}
