use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AircraftType {
    Passenger,
    Cargo,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AircraftCatalog {
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
    #[serde(rename = "maxSpeed")]
    pub max_speed: i32,
    #[serde(rename = "fuelCapacity")]
    pub fuel_capacity: i32,
    #[serde(rename = "fuelConsumption")]
    pub fuel_consumption: f64,
    #[serde(rename = "emptyWeight")]
    pub empty_weight: i32,
    #[serde(rename = "maxTakeoffWeight")]
    pub max_takeoff_weight: i32,
    #[serde(rename = "serviceCeiling")]
    pub service_ceiling: i32,
    #[serde(rename = "rateOfClimb")]
    pub rate_of_climb: i32,
    pub wingspan: f64,
    pub length: f64,
    #[serde(rename = "maintenanceCostPerHour")]
    pub maintenance_cost_per_hour: i32,
    #[serde(rename = "maxFlightHoursBeforeMaintenance")]
    pub max_flight_hours_before_maintenance: i32,
    #[serde(rename = "imageUrl", skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

impl AircraftCatalog {
    /// Retourne la liste complète des aéronefs, parsée depuis aircraft.yaml (embarqué à la compilation).
    pub fn load_aircraft_list() -> Vec<AircraftCatalog> {
        let yaml = include_str!("../aircraft.yaml");
        serde_yaml::from_str(yaml).expect("aircraft.yaml invalide")
    }
}
