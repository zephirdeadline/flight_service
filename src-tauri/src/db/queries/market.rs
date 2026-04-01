use rusqlite::{params, Connection, Result};
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use crate::models::{Airport, MarketAircraft};
use super::aircraft::get_all_aircraft;
use super::geo::{calculate_distance, generate_daily_market_seed};

pub fn get_market_aircraft(conn: &Connection, player_id: &str) -> Result<Vec<MarketAircraft>> {
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

    let seed = generate_daily_market_seed();
    let mut rng = StdRng::seed_from_u64(seed);

    let max_distance = 1000.0;
    let lat_delta = max_distance / 60.0;
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
        calculate_distance(
            player_airport.latitude,
            player_airport.longitude,
            airport.latitude,
            airport.longitude,
        ) <= max_distance
    })
    .collect();

    let all_aircraft = get_all_aircraft(conn)?;
    let mut market_offers: Vec<MarketAircraft> = Vec::new();

    for airport in nearby_airports {
        let num_offers = (rng.gen::<u32>() % 3) + 1;

        for _ in 0..num_offers {
            let aircraft_index = rng.gen_range(0..all_aircraft.len());
            let aircraft = all_aircraft[aircraft_index].clone();

            let is_new = rng.gen::<f64>() < 0.3;

            let (condition, flight_hours) = if is_new {
                (100, 0.0)
            } else {
                let cond = rng.gen_range(60..100);
                let max_hours = aircraft.max_flight_hours_before_maintenance as f64;
                let flight_hours_ratio = (100 - cond) as f64 / 100.0;
                let hours = max_hours * flight_hours_ratio * rng.gen::<f64>();
                (cond, hours)
            };

            let condition_factor = condition as f64 / 100.0;
            let price = (aircraft.price as f64 * (0.5 + condition_factor * 0.5)) as i64;

            let distance = calculate_distance(
                player_airport.latitude,
                player_airport.longitude,
                airport.latitude,
                airport.longitude,
            ) as i32;

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

    market_offers.sort_by_key(|offer| offer.distance);

    Ok(market_offers)
}
