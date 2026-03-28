use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AircraftMaintenance {
    #[serde(rename = "aircraftId")]
    pub aircraft_id: String,
    #[serde(rename = "flightHours")]
    pub flight_hours: f64,
    pub condition: i32,
    #[serde(rename = "isUnderMaintenance")]
    pub is_under_maintenance: bool,
    #[serde(rename = "maintenanceEndDate", skip_serializing_if = "Option::is_none")]
    pub maintenance_end_date: Option<String>,
    #[serde(rename = "lastMaintenanceDate", skip_serializing_if = "Option::is_none")]
    pub last_maintenance_date: Option<String>,
}

impl AircraftMaintenance {
    pub fn new(aircraft_id: String) -> Self {
        Self {
            aircraft_id,
            flight_hours: 0.0,
            condition: 100,
            is_under_maintenance: false,
            maintenance_end_date: None,
            last_maintenance_date: None,
        }
    }

    pub fn update_condition(&mut self, max_hours: i32) {
        let percentage = (self.flight_hours / max_hours as f64) * 100.0;
        self.condition = ((100.0 - percentage).max(0.0)).round() as i32;
    }

    pub fn add_flight_hours(&mut self, hours: f64, max_hours: i32) {
        self.flight_hours += hours;
        self.update_condition(max_hours);
    }

    pub fn start_maintenance(&mut self, end_date: String) {
        self.is_under_maintenance = true;
        self.maintenance_end_date = Some(end_date);
    }

    pub fn complete_maintenance(&mut self) {
        self.is_under_maintenance = false;
        self.maintenance_end_date = None;
        self.last_maintenance_date = Some(chrono::Utc::now().to_rfc3339());
        self.flight_hours = 0.0;
        self.condition = 100;
    }

    pub fn can_fly(&self) -> bool {
        !self.is_under_maintenance && self.condition >= 10
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MaintenanceType {
    Routine,
    Repair,
    Inspection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceRecord {
    pub id: String,
    #[serde(rename = "aircraftId")]
    pub aircraft_id: String,
    pub date: String,
    #[serde(rename = "type")]
    pub maintenance_type: MaintenanceType,
    pub cost: i64,
    #[serde(rename = "flightHoursAtMaintenance")]
    pub flight_hours_at_maintenance: f64,
    pub description: String,
}

impl MaintenanceRecord {
    pub fn new(
        aircraft_id: String,
        maintenance_type: MaintenanceType,
        cost: i64,
        flight_hours_at_maintenance: f64,
        description: String,
    ) -> Self {
        let id = format!("maint_{}_{}", chrono::Utc::now().timestamp(), uuid::Uuid::new_v4());
        Self {
            id,
            aircraft_id,
            date: chrono::Utc::now().to_rfc3339(),
            maintenance_type,
            cost,
            flight_hours_at_maintenance,
            description,
        }
    }
}

// Type alias pour les maintenances par avion
pub type AircraftMaintenances = HashMap<String, AircraftMaintenance>;
