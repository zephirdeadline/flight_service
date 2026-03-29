use serde::{Deserialize, Serialize};
use super::{Aircraft, Airport};

/// Représente une offre d'avion sur le marché (occasion ou neuf)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketAircraft {
    pub id: String, // ID unique de l'offre (généré depuis seed)
    pub aircraft: Aircraft, // Informations du catalogue
    pub location: Airport, // Où se trouve l'avion
    pub distance: i32, // Distance depuis la position du joueur (NM)
    pub price: i64, // Prix de vente (peut être réduit si occasion)
    pub condition: i32, // État 60-100% (100 = neuf)
    pub flight_hours: f64, // Heures de vol accumulées
}

impl MarketAircraft {
    pub fn is_new(&self) -> bool {
        self.condition == 100 && self.flight_hours == 0.0
    }

    pub fn discount_percentage(&self, catalog_price: i64) -> i32 {
        if catalog_price == 0 {
            return 0;
        }
        let discount = ((catalog_price - self.price) as f64 / catalog_price as f64) * 100.0;
        discount.round() as i32
    }
}
