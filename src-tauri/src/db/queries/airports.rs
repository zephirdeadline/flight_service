use rusqlite::{params, Connection, Result, Row};
use crate::models::Airport;

pub(super) fn map_airport_row(row: &Row) -> Result<Airport> {
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

pub fn find_airport_near_position(conn: &Connection, lat: f64, lon: f64) -> Result<Option<Airport>> {
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
        super::geo::is_within_3km(lat, lon, airport.latitude, airport.longitude)
    }))
}
