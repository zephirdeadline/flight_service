use serde::{Deserialize, Serialize};

/// Représente un avion possédé par un joueur (instance unique)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerAircraft {
    pub id: String, // ID unique de l'avion possédé
    pub player_id: String,
    pub aircraft_catalog_id: String, // Référence au catalogue
    pub current_airport_id: String, // Où se trouve l'avion
    pub purchase_date: String,
    pub purchase_price: i64,
}
