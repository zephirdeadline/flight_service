use serde::{Deserialize, Serialize};
use super::{Aircraft, PlayerAircraft};

/// Représente un avion possédé avec toutes ses informations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedAircraft {
    pub id: String, // ID unique de l'avion possédé
    pub player_id: String,
    pub current_airport_id: String, // Où se trouve l'avion
    pub purchase_date: String,
    pub purchase_price: i64,
    // Informations du catalogue
    pub aircraft: Aircraft,
}

impl OwnedAircraft {
    pub fn new(player_aircraft: PlayerAircraft, aircraft: Aircraft) -> Self {
        Self {
            id: player_aircraft.id,
            player_id: player_aircraft.player_id,
            current_airport_id: player_aircraft.current_airport_id,
            purchase_date: player_aircraft.purchase_date,
            purchase_price: player_aircraft.purchase_price,
            aircraft,
        }
    }
}
