use serde::{Deserialize, Serialize};
use super::Mission;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActiveMissionStatus {
    InProgress,
    ReadyToComplete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveMission {
    pub id: String,
    pub mission: Mission,
    #[serde(rename = "aircraftId")]
    pub aircraft_id: String,
    #[serde(rename = "acceptedAt")]
    pub accepted_at: String,
    pub status: ActiveMissionStatus,
}

impl ActiveMission {
    pub fn new(
        id: String,
        mission: Mission,
        aircraft_id: String,
        accepted_at: String,
    ) -> Self {
        Self {
            id,
            mission,
            aircraft_id,
            accepted_at,
            status: ActiveMissionStatus::InProgress,
        }
    }
}
