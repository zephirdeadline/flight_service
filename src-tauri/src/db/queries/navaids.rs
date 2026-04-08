use rusqlite::{Connection, Result, Row};
use crate::models::Navaid;

pub(super) fn map_navaid_row(row: &Row) -> Result<Navaid> {
    Ok(Navaid {
        id: row.get(0)?,
        ident: row.get(1)?,
        name: row.get(2)?,
        navaid_type: row.get(3)?,
        frequency_khz: row.get(4)?,
        latitude: row.get(5)?,
        longitude: row.get(6)?,
        elevation_ft: row.get(7)?,
        iso_country: row.get(8)?,
        magnetic_variation_deg: row.get(9)?,
        usage_type: row.get(10)?,
        power: row.get(11)?,
        associated_airport: row.get(12)?,
    })
}

pub fn get_all_navaids(conn: &Connection) -> Result<Vec<Navaid>> {
    let mut stmt = conn.prepare(
        "SELECT id, ident, name, type, frequency_khz, latitude, longitude,
                elevation_ft, iso_country, magnetic_variation_deg, usage_type, power, associated_airport
         FROM navaids ORDER BY ident"
    )?;
    let navaids = stmt.query_map([], map_navaid_row)?;
    navaids.collect()
}

pub fn search_navaids(conn: &Connection, query: &str) -> Result<Vec<Navaid>> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, ident, name, type, frequency_khz, latitude, longitude,
                elevation_ft, iso_country, magnetic_variation_deg, usage_type, power, associated_airport
         FROM navaids
         WHERE ident LIKE ?1 OR name LIKE ?1 OR associated_airport LIKE ?1
         ORDER BY
             CASE WHEN ident LIKE ?2 THEN 0 ELSE 1 END,
             name
         LIMIT 50"
    )?;

    let prefix = format!("{}%", query);
    let navaids = stmt.query_map([&pattern, &prefix], map_navaid_row)?;
    navaids.collect()
}
