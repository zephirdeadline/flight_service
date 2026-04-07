use serde::{Deserialize, Serialize};
use super::AircraftCatalog;

/// Représente un avion possédé avec toutes ses informations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedAircraft {
    pub id: String,
    pub player_id: String,
    pub current_airport_id: String,
    pub purchase_date: String,
    pub purchase_price: i64,
    pub aircraft: AircraftCatalog,
}
