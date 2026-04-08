use serde::{Deserialize, Serialize};
use super::airport::Airport;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MissionType {
    Passenger,
    Cargo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CargoDetails {
    pub weight: i32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Passenger {
    pub weight: i32,   // poids corporel en kg
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassengerDetails {
    pub count: i32,
    pub list: Vec<Passenger>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mission {
    pub id: String,
    #[serde(rename = "type")]
    pub mission_type: MissionType,
    #[serde(rename = "fromAirport")]
    pub from_airport: Airport,
    #[serde(rename = "toAirport")]
    pub to_airport: Airport,
    pub distance: i32,
    pub reward: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cargo: Option<CargoDetails>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passengers: Option<PassengerDetails>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deadline: Option<String>,
    #[serde(rename = "requiredAircraftType", skip_serializing_if = "Option::is_none")]
    pub required_aircraft_type: Option<String>,
}

impl Mission {
    pub fn new_passenger(
        id: String,
        from_airport: Airport,
        to_airport: Airport,
        distance: i32,
        reward: i64,
        passenger_list: Vec<Passenger>,
    ) -> Self {
        let count = passenger_list.len() as i32;
        Self {
            id,
            mission_type: MissionType::Passenger,
            from_airport,
            to_airport,
            distance,
            reward,
            cargo: None,
            passengers: Some(PassengerDetails {
                count,
                list: passenger_list,
            }),
            deadline: None,
            required_aircraft_type: Some("passenger".to_string()),
        }
    }

    pub fn new_cargo(
        id: String,
        from_airport: Airport,
        to_airport: Airport,
        distance: i32,
        reward: i64,
        weight: i32,
        description: String,
    ) -> Self {
        Self {
            id,
            mission_type: MissionType::Cargo,
            from_airport,
            to_airport,
            distance,
            reward,
            cargo: Some(CargoDetails {
                weight,
                description,
            }),
            passengers: None,
            deadline: None,
            required_aircraft_type: Some("cargo".to_string()),
        }
    }
}
