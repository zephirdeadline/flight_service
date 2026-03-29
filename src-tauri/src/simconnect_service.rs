// Service SimConnect pour interagir avec Flight Simulator 2024
use simconnect;
use std::sync::Mutex;

pub struct SimConnectService {
    // Connection SimConnect (Option car peut ne pas être connecté)
    connection: Mutex<Option<simconnect::SimConnector>>,
}

impl SimConnectService {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
        }
    }

    /// Tenter de se connecter à Flight Simulator
    pub fn connect(&self) -> Result<(), String> {
        let mut conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        match simconnect::SimConnector::new() {
            Ok(sim) => {
                *conn = Some(sim);
                Ok(())
            }
            Err(e) => Err(format!("Failed to connect to SimConnect: {:?}", e)),
        }
    }

    /// Vérifier si connecté à Flight Simulator
    pub fn is_connected(&self) -> bool {
        if let Ok(conn) = self.connection.lock() {
            conn.is_some()
        } else {
            false
        }
    }

    /// Déconnecter de Flight Simulator
    pub fn disconnect(&self) {
        if let Ok(mut conn) = self.connection.lock() {
            *conn = None;
        }
    }

    /// Récupérer la position actuelle de l'avion
    pub fn get_aircraft_position(&self) -> Result<AircraftPosition, String> {
        let conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        if let Some(_sim) = conn.as_ref() {
            // TODO: Implémenter la récupération de position via SimConnect
            // Pour l'instant, retourner des données mockées
            Ok(AircraftPosition {
                latitude: 0.0,
                longitude: 0.0,
                altitude: 0.0,
                heading: 0.0,
            })
        } else {
            Err("Not connected to SimConnect".to_string())
        }
    }
}

#[derive(Debug, Clone)]
pub struct AircraftPosition {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
    pub heading: f64,
}
