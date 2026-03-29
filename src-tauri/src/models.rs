// Convention Rust 2018+ : pas de mod.rs, juste models.rs qui déclare les sous-modules

pub mod airport;
pub mod aircraft;
pub mod mission;
pub mod player;
pub mod maintenance;
pub mod active_mission;

// Re-export des types principaux pour faciliter l'utilisation
pub use airport::Airport;
pub use aircraft::{Aircraft, AircraftType};
pub use mission::{Mission, MissionType, CargoDetails, PassengerDetails};
pub use player::Player;
pub use maintenance::{AircraftMaintenance, AircraftMaintenances, MaintenanceRecord, MaintenanceType};
pub use active_mission::{ActiveMission, ActiveMissionStatus};
