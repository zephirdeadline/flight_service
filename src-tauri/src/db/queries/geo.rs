use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub fn is_within_3km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> bool {
    let r = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();

    let a = (d_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    r * c < 3.0
}

pub(super) fn calculate_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 3440.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();

    let a = (d_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    r * c
}

pub(super) fn generate_mission_seed(airport_id: &str) -> u64 {
    let now = chrono::Utc::now();
    let hour_timestamp = now.timestamp() / 3600;

    let mut hasher = DefaultHasher::new();
    airport_id.hash(&mut hasher);
    let airport_hash = hasher.finish();

    hour_timestamp as u64 ^ airport_hash
}

pub(super) fn generate_daily_market_seed() -> u64 {
    let now = chrono::Utc::now();
    let day_timestamp = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    day_timestamp as u64
}
