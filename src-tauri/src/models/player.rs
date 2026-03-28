use serde::{Deserialize, Serialize};
use super::maintenance::{AircraftMaintenance, AircraftMaintenances, MaintenanceRecord};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub money: i64,
    #[serde(rename = "currentAirportId")]
    pub current_airport_id: String,
    #[serde(rename = "ownedAircraftIds")]
    pub owned_aircraft_ids: Vec<String>,
    #[serde(rename = "selectedAircraftId", skip_serializing_if = "Option::is_none")]
    pub selected_aircraft_id: Option<String>,
    #[serde(rename = "completedMissions")]
    pub completed_missions: Vec<String>,
    #[serde(rename = "totalFlightHours")]
    pub total_flight_hours: f64,
    #[serde(rename = "aircraftMaintenances")]
    pub aircraft_maintenances: AircraftMaintenances,
    #[serde(rename = "maintenanceHistory")]
    pub maintenance_history: Vec<MaintenanceRecord>,
}

impl Player {
    pub fn new(name: String, starting_airport_id: String, starting_aircraft_id: String) -> Self {
        let mut aircraft_maintenances = HashMap::new();
        aircraft_maintenances.insert(
            starting_aircraft_id.clone(),
            AircraftMaintenance::new(starting_aircraft_id.clone()),
        );

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            money: 100_000,
            current_airport_id: starting_airport_id,
            owned_aircraft_ids: vec![starting_aircraft_id.clone()],
            selected_aircraft_id: Some(starting_aircraft_id),
            completed_missions: Vec::new(),
            total_flight_hours: 0.0,
            aircraft_maintenances,
            maintenance_history: Vec::new(),
        }
    }

    pub fn add_money(&mut self, amount: i64) {
        self.money += amount;
    }

    pub fn subtract_money(&mut self, amount: i64) -> bool {
        if self.money >= amount {
            self.money -= amount;
            true
        } else {
            false
        }
    }

    pub fn can_afford(&self, amount: i64) -> bool {
        self.money >= amount
    }

    pub fn add_aircraft(&mut self, aircraft_id: String) {
        if !self.owned_aircraft_ids.contains(&aircraft_id) {
            self.owned_aircraft_ids.push(aircraft_id.clone());
            self.aircraft_maintenances.insert(
                aircraft_id.clone(),
                AircraftMaintenance::new(aircraft_id),
            );
        }
    }

    pub fn remove_aircraft(&mut self, aircraft_id: &str) -> bool {
        if let Some(pos) = self.owned_aircraft_ids.iter().position(|id| id == aircraft_id) {
            self.owned_aircraft_ids.remove(pos);
            self.aircraft_maintenances.remove(aircraft_id);

            // Si l'avion sélectionné est vendu, sélectionner le premier disponible
            if self.selected_aircraft_id.as_deref() == Some(aircraft_id) {
                self.selected_aircraft_id = self.owned_aircraft_ids.first().cloned();
            }

            true
        } else {
            false
        }
    }

    pub fn select_aircraft(&mut self, aircraft_id: String) -> bool {
        if self.owned_aircraft_ids.contains(&aircraft_id) {
            self.selected_aircraft_id = Some(aircraft_id);
            true
        } else {
            false
        }
    }

    pub fn complete_mission(&mut self, mission_id: String, reward: i64, flight_hours: f64) {
        if !self.completed_missions.contains(&mission_id) {
            self.completed_missions.push(mission_id);
            self.money += reward;
            self.total_flight_hours += flight_hours;
        }
    }

    pub fn add_flight_hours_to_aircraft(&mut self, aircraft_id: &str, hours: f64, max_hours: i32) {
        if let Some(maintenance) = self.aircraft_maintenances.get_mut(aircraft_id) {
            maintenance.add_flight_hours(hours, max_hours);
        }
    }

    pub fn start_aircraft_maintenance(&mut self, aircraft_id: &str, end_date: String, cost: i64) -> bool {
        if self.can_afford(cost) {
            if let Some(maintenance) = self.aircraft_maintenances.get_mut(aircraft_id) {
                maintenance.start_maintenance(end_date);
                self.money -= cost;
                return true;
            }
        }
        false
    }

    pub fn complete_aircraft_maintenance(&mut self, aircraft_id: &str) {
        if let Some(maintenance) = self.aircraft_maintenances.get_mut(aircraft_id) {
            maintenance.complete_maintenance();
        }
    }

    pub fn add_maintenance_record(&mut self, record: MaintenanceRecord) {
        self.maintenance_history.push(record);
    }

    pub fn get_aircraft_maintenance(&self, aircraft_id: &str) -> Option<&AircraftMaintenance> {
        self.aircraft_maintenances.get(aircraft_id)
    }

    pub fn change_airport(&mut self, airport_id: String) {
        self.current_airport_id = airport_id;
    }
}
