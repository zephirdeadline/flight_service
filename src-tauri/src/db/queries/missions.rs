use rusqlite::{params, Connection, Result};
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use crate::models::{Mission, mission::Passenger};
use super::airports::get_airport_by_id;
use super::geo::{calculate_distance, generate_mission_seed};
use super::player::update_player_money;

pub fn get_missions_by_airport(conn: &Connection, airport_id: &str) -> Result<Vec<Mission>> {
    use rand::seq::SliceRandom;

    let from_airport = get_airport_by_id(conn, airport_id)?
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

    let from_lat = from_airport.latitude;
    let from_lon = from_airport.longitude;

    // Wide bounding box to capture long-range candidates too
    let lat_delta = 10.0_f64;
    let lon_delta = 10.0_f64 / from_lat.to_radians().cos().max(0.1);

    let mut stmt = conn.prepare(
        "SELECT id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service
         FROM airports
         WHERE id != ?1
           AND latitude BETWEEN ?2 AND ?3
           AND longitude BETWEEN ?4 AND ?5
         LIMIT 300"
    )?;

    let all_candidates = stmt.query_map(
        params![
            airport_id,
            from_lat - lat_delta, from_lat + lat_delta,
            from_lon - lon_delta, from_lon + lon_delta
        ],
        super::airports::map_airport_row,
    )?.collect::<Result<Vec<_>>>()?;

    // Categorize by Haversine distance
    let mut short_range: Vec<(_, i32)> = Vec::new();  // 50–149 NM
    let mut medium_range: Vec<(_, i32)> = Vec::new(); // 150–299 NM
    let mut long_range: Vec<(_, i32)> = Vec::new();   // 300–600 NM

    for airport in all_candidates {
        let dist = calculate_distance(from_lat, from_lon, airport.latitude, airport.longitude)
            .round() as i32;
        match dist {
            50..=149  => short_range.push((airport, dist)),
            150..=299 => medium_range.push((airport, dist)),
            300..=600 => long_range.push((airport, dist)),
            _ => {}
        }
    }

    let seed = generate_mission_seed(airport_id);
    let mut rng: StdRng = StdRng::seed_from_u64(seed);

    // Shuffle each category independently then take 4 from each
    short_range.shuffle(&mut rng);
    medium_range.shuffle(&mut rng);
    long_range.shuffle(&mut rng);

    let mut selected: Vec<(_, i32)> = Vec::new();
    selected.extend(short_range.into_iter().take(4));
    selected.extend(medium_range.into_iter().take(4));
    selected.extend(long_range.into_iter().take(4));

    if selected.is_empty() {
        return Ok(Vec::new());
    }

    // Shuffle combined list for varied ordering
    selected.shuffle(&mut rng);

    let cargo_types = [
        "Electronics", "Medical supplies", "Automotive parts", "Pharmaceuticals",
        "Fresh produce", "Perishable goods", "Industrial equipment", "Machinery",
        "Documents", "Mail & parcels", "Textiles", "Fashion goods",
        "Sporting equipment", "Musical instruments", "Computer hardware",
        "Food & beverages", "Chemicals", "Building materials",
        "Scientific instruments", "Emergency supplies",
    ];

    let mut missions = Vec::new();

    for (i, (dest, distance)) in selected.into_iter().enumerate() {
        if rng.gen_bool(0.5) {
            let passenger_count = rng.gen_range(1..=8);
            let passengers: Vec<Passenger> = (0..passenger_count).map(|_| Passenger {
                weight: rng.gen_range(55..=110),
                baggage: rng.gen_range(0..=32),
            }).collect();
            let reward = (distance as i64) * 20 * (passenger_count as i64);

            missions.push(Mission::new_passenger(
                format!("mission-{}-{}-pax-{}", airport_id, dest.id, i),
                from_airport.clone(),
                dest,
                distance,
                reward,
                passengers,
            ));
        } else {
            let cargo_weight = rng.gen_range(20..=800) as i32;
            let reward = (distance as i64) * 25 * (cargo_weight as i64 / 10);
            let cargo_description = cargo_types[rng.gen_range(0..cargo_types.len())].to_string();

            missions.push(Mission::new_cargo(
                format!("mission-{}-{}-cargo-{}", airport_id, dest.id, i),
                from_airport.clone(),
                dest,
                distance,
                reward,
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

    update_player_money(conn, player_id, reward)?;

    conn.execute(
        "UPDATE players SET total_flight_hours = total_flight_hours + ?1 WHERE id = ?2",
        params![flight_hours, player_id],
    )?;

    Ok(())
}
