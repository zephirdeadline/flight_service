use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AircraftType {
    Passenger,
    Cargo,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aircraft {
    pub id: String,
    pub name: String,
    pub manufacturer: String,
    #[serde(rename = "type")]
    pub aircraft_type: AircraftType,
    pub price: i64,
    pub capacity: i32,
    pub range: i32,
    #[serde(rename = "cruiseSpeed")]
    pub cruise_speed: i32,
    #[serde(rename = "maintenanceCostPerHour")]
    pub maintenance_cost_per_hour: i32,
    #[serde(rename = "maxFlightHoursBeforeMaintenance")]
    pub max_flight_hours_before_maintenance: i32,
    #[serde(rename = "imageUrl", skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

impl Aircraft {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: String,
        name: String,
        manufacturer: String,
        aircraft_type: AircraftType,
        price: i64,
        capacity: i32,
        range: i32,
        cruise_speed: i32,
        maintenance_cost_per_hour: i32,
        max_flight_hours_before_maintenance: i32,
    ) -> Self {
        Self {
            id,
            name,
            manufacturer,
            aircraft_type,
            price,
            capacity,
            range,
            cruise_speed,
            maintenance_cost_per_hour,
            max_flight_hours_before_maintenance,
            image_url: None,
        }
    }
}
