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

/// Résout les merge keys YAML (<<: *anchor) que serde_yaml 0.9 ne résout pas automatiquement.
/// Les clés du mapping courant ont priorité sur les clés mergées (comportement YAML standard).
fn resolve_merge_keys(value: serde_yaml::Value) -> serde_yaml::Value {
    use serde_yaml::Value;
    let Value::Mapping(mut map) = value else { return value; };

    let merge_key = Value::String("<<".to_string());
    if let Some(base) = map.remove(&merge_key) {
        if let Value::Mapping(base_map) = base {
            for (k, v) in base_map {
                map.entry(k).or_insert(v);
            }
        }
    }
    Value::Mapping(map)
}

static AIRCRAFT_CACHE: std::sync::OnceLock<Vec<AircraftCatalog>> = std::sync::OnceLock::new();

impl AircraftCatalog {
    /// Charge la liste des aéronefs depuis aircraft.yaml dans AppData (mis en cache au premier appel).
    pub fn load_from_file() -> Result<&'static [AircraftCatalog], String> {
        if let Some(cached) = AIRCRAFT_CACHE.get() {
            return Ok(cached);
        }
        let path = dirs::data_dir()
            .ok_or("Impossible de trouver le répertoire AppData")?
            .join("com.petrocchim.flight_service")
            .join("aircraft.yaml");
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Impossible de lire aircraft.yaml : {}", e))?;
        // Passer par Value puis résoudre manuellement les merge keys (<<: *anchor)
        // car serde_yaml 0.9 ne les résout pas lors de la désérialisation en struct
        let values: Vec<serde_yaml::Value> = serde_yaml::from_str(&content)
            .map_err(|e| format!("aircraft.yaml invalide : {}", e))?;
        let list: Vec<AircraftCatalog> = values
            .into_iter()
            .enumerate()
            .map(|(i, v)| {
                let merged = resolve_merge_keys(v);
                serde_yaml::from_value(merged)
                    .map_err(|e| format!("aircraft.yaml invalide à l'entrée {} : {}", i, e))
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(AIRCRAFT_CACHE.get_or_init(|| list))
    }
}
