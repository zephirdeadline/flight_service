use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Airport {
    pub id: String,
    pub icao: String,
    #[serde(rename = "iataCode")]
    pub iata_code: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub airport_type: String,
    pub city: String,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
    pub elevation: i32,
    #[serde(rename = "scheduledService")]
    pub scheduled_service: bool,
}
