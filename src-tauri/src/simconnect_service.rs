// Service SimConnect pour interagir avec Flight Simulator 2024
use simconnect_sdk::{Notification, SimConnect, SimConnectObject};
use std::sync::Mutex;
use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AircraftPosition {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
    pub heading: f64,
    pub sim_on_ground: bool,
    pub ground_velocity: f64,
    pub crash_flag: bool,
    // Fuel
    pub fuel_total_quantity: f64, // gallons
    pub fuel_tank_left_main: f64, // gallons
    pub fuel_tank_right_main: f64, // gallons
    pub fuel_tank_center: f64, // gallons
    // Moteurs
    pub number_of_engines: f64, // nombre de moteurs
    pub engine_1_rpm: f64,
    pub engine_2_rpm: f64,
    pub engine_3_rpm: f64,
    pub engine_4_rpm: f64,
    pub engine_5_rpm: f64,
    pub engine_6_rpm: f64,
    pub engine_7_rpm: f64,
    pub engine_8_rpm: f64,
    pub engine_1_fuel_flow: f64, // gallons per hour
    pub engine_2_fuel_flow: f64,
    pub engine_3_fuel_flow: f64,
    pub engine_4_fuel_flow: f64,
    pub engine_5_fuel_flow: f64,
    pub engine_6_fuel_flow: f64,
    pub engine_7_fuel_flow: f64,
    pub engine_8_fuel_flow: f64,
    // Navigation/Vol
    pub vertical_speed: f64, // feet per minute
    pub plane_alt_above_ground: f64, // feet AGL
    pub airspeed_true: f64, // knots
    pub airspeed_indicated: f64, // knots
    // Poids
    pub total_weight: f64, // kg
    pub empty_weight: f64, // kg
    pub fuel_weight: f64, // kg
    // Payload stations
    pub payload_station_count: f64, // nombre de stations utilisées
    // Noms des stations
    pub payload_station_name_1: String,
    pub payload_station_name_2: String,
    pub payload_station_name_3: String,
    pub payload_station_name_4: String,
    pub payload_station_name_5: String,
    pub payload_station_name_6: String,
    pub payload_station_name_7: String,
    pub payload_station_name_8: String,
    pub payload_station_name_9: String,
    pub payload_station_name_10: String,
    pub payload_station_name_11: String,
    pub payload_station_name_12: String,
    pub payload_station_name_13: String,
    pub payload_station_name_14: String,
    pub payload_station_name_15: String,
    pub payload_station_name_16: String,
    pub payload_station_name_17: String,
    pub payload_station_name_18: String,
    pub payload_station_name_19: String,
    pub payload_station_name_20: String,
    // Détail poids par slot (stations de charge 1-20)
    pub payload_station_weight_1: f64, // kg
    pub payload_station_weight_2: f64,
    pub payload_station_weight_3: f64,
    pub payload_station_weight_4: f64,
    pub payload_station_weight_5: f64,
    pub payload_station_weight_6: f64,
    pub payload_station_weight_7: f64,
    pub payload_station_weight_8: f64,
    pub payload_station_weight_9: f64,
    pub payload_station_weight_10: f64,
    pub payload_station_weight_11: f64,
    pub payload_station_weight_12: f64,
    pub payload_station_weight_13: f64,
    pub payload_station_weight_14: f64,
    pub payload_station_weight_15: f64,
    pub payload_station_weight_16: f64,
    pub payload_station_weight_17: f64,
    pub payload_station_weight_18: f64,
    pub payload_station_weight_19: f64,
    pub payload_station_weight_20: f64,
    // Sécurité/Warnings
    pub stall_warning: bool,
    pub overspeed_warning: bool,
    pub gear_handle_position: bool, // true = down, false = up
}

/// Structure pour recevoir les données de SimConnect
#[derive(Debug, Clone, SimConnectObject)]
#[simconnect(period = "second")]
struct AirplaneData {
    #[simconnect(name = "PLANE LATITUDE", unit = "degrees")]
    latitude: f64,
    #[simconnect(name = "PLANE LONGITUDE", unit = "degrees")]
    longitude: f64,
    #[simconnect(name = "PLANE ALTITUDE", unit = "feet")]
    altitude: f64,
    #[simconnect(name = "PLANE HEADING DEGREES TRUE", unit = "degrees")]
    heading: f64,
    #[simconnect(name = "SIM ON GROUND")]
    sim_on_ground: bool,
    #[simconnect(name = "GROUND VELOCITY", unit = "knots")]
    ground_velocity: f64,
    #[simconnect(name = "CRASH FLAG")]
    crash_flag: bool,
    // Fuel
    #[simconnect(name = "FUEL TOTAL QUANTITY", unit = "gallons")]
    fuel_total_quantity: f64,
    #[simconnect(name = "FUEL TANK LEFT MAIN QUANTITY", unit = "gallons")]
    fuel_tank_left_main: f64,
    #[simconnect(name = "FUEL TANK RIGHT MAIN QUANTITY", unit = "gallons")]
    fuel_tank_right_main: f64,
    #[simconnect(name = "FUEL TANK CENTER QUANTITY", unit = "gallons")]
    fuel_tank_center: f64,
    // Moteurs
    #[simconnect(name = "NUMBER OF ENGINES", unit = "number")]
    number_of_engines: f64,
    #[simconnect(name = "GENERAL ENG RPM:1", unit = "rpm")]
    engine_1_rpm: f64,
    #[simconnect(name = "GENERAL ENG RPM:2", unit = "rpm")]
    engine_2_rpm: f64,
    #[simconnect(name = "GENERAL ENG RPM:3", unit = "rpm")]
    engine_3_rpm: f64,
    #[simconnect(name = "GENERAL ENG RPM:4", unit = "rpm")]
    engine_4_rpm: f64,
    #[simconnect(name = "GENERAL ENG RPM:5", unit = "rpm")]
    engine_5_rpm: f64,
    #[simconnect(name = "GENERAL ENG RPM:6", unit = "rpm")]
    engine_6_rpm: f64,
    #[simconnect(name = "GENERAL ENG RPM:7", unit = "rpm")]
    engine_7_rpm: f64,
    #[simconnect(name = "GENERAL ENG RPM:8", unit = "rpm")]
    engine_8_rpm: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:1", unit = "gallons per hour")]
    engine_1_fuel_flow: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:2", unit = "gallons per hour")]
    engine_2_fuel_flow: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:3", unit = "gallons per hour")]
    engine_3_fuel_flow: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:4", unit = "gallons per hour")]
    engine_4_fuel_flow: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:5", unit = "gallons per hour")]
    engine_5_fuel_flow: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:6", unit = "gallons per hour")]
    engine_6_fuel_flow: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:7", unit = "gallons per hour")]
    engine_7_fuel_flow: f64,
    #[simconnect(name = "ENG FUEL FLOW GPH:8", unit = "gallons per hour")]
    engine_8_fuel_flow: f64,
    // Navigation/Vol
    #[simconnect(name = "VERTICAL SPEED", unit = "feet per minute")]
    vertical_speed: f64,
    #[simconnect(name = "PLANE ALT ABOVE GROUND", unit = "feet")]
    plane_alt_above_ground: f64,
    #[simconnect(name = "AIRSPEED TRUE", unit = "knots")]
    airspeed_true: f64,
    #[simconnect(name = "AIRSPEED INDICATED", unit = "knots")]
    airspeed_indicated: f64,
    // Poids
    #[simconnect(name = "TOTAL WEIGHT", unit = "kilograms")]
    total_weight: f64,
    #[simconnect(name = "EMPTY WEIGHT", unit = "kilograms")]
    empty_weight: f64,
    #[simconnect(name = "FUEL TOTAL QUANTITY WEIGHT", unit = "kilograms")]
    fuel_weight: f64,
    // Payload stations
    #[simconnect(name = "PAYLOAD STATION COUNT", unit = "number")]
    payload_station_count: f64,
    // Noms des stations
    #[simconnect(name = "PAYLOAD STATION NAME:1")]
    payload_station_name_1: String,
    #[simconnect(name = "PAYLOAD STATION NAME:2")]
    payload_station_name_2: String,
    #[simconnect(name = "PAYLOAD STATION NAME:3")]
    payload_station_name_3: String,
    #[simconnect(name = "PAYLOAD STATION NAME:4")]
    payload_station_name_4: String,
    #[simconnect(name = "PAYLOAD STATION NAME:5")]
    payload_station_name_5: String,
    #[simconnect(name = "PAYLOAD STATION NAME:6")]
    payload_station_name_6: String,
    #[simconnect(name = "PAYLOAD STATION NAME:7")]
    payload_station_name_7: String,
    #[simconnect(name = "PAYLOAD STATION NAME:8")]
    payload_station_name_8: String,
    #[simconnect(name = "PAYLOAD STATION NAME:9")]
    payload_station_name_9: String,
    #[simconnect(name = "PAYLOAD STATION NAME:10")]
    payload_station_name_10: String,
    #[simconnect(name = "PAYLOAD STATION NAME:11")]
    payload_station_name_11: String,
    #[simconnect(name = "PAYLOAD STATION NAME:12")]
    payload_station_name_12: String,
    #[simconnect(name = "PAYLOAD STATION NAME:13")]
    payload_station_name_13: String,
    #[simconnect(name = "PAYLOAD STATION NAME:14")]
    payload_station_name_14: String,
    #[simconnect(name = "PAYLOAD STATION NAME:15")]
    payload_station_name_15: String,
    #[simconnect(name = "PAYLOAD STATION NAME:16")]
    payload_station_name_16: String,
    #[simconnect(name = "PAYLOAD STATION NAME:17")]
    payload_station_name_17: String,
    #[simconnect(name = "PAYLOAD STATION NAME:18")]
    payload_station_name_18: String,
    #[simconnect(name = "PAYLOAD STATION NAME:19")]
    payload_station_name_19: String,
    #[simconnect(name = "PAYLOAD STATION NAME:20")]
    payload_station_name_20: String,
    // Détail poids par slot (stations de charge)
    #[simconnect(name = "PAYLOAD STATION WEIGHT:1", unit = "kilograms")]
    payload_station_weight_1: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:2", unit = "kilograms")]
    payload_station_weight_2: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:3", unit = "kilograms")]
    payload_station_weight_3: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:4", unit = "kilograms")]
    payload_station_weight_4: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:5", unit = "kilograms")]
    payload_station_weight_5: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:6", unit = "kilograms")]
    payload_station_weight_6: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:7", unit = "kilograms")]
    payload_station_weight_7: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:8", unit = "kilograms")]
    payload_station_weight_8: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:9", unit = "kilograms")]
    payload_station_weight_9: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:10", unit = "kilograms")]
    payload_station_weight_10: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:11", unit = "kilograms")]
    payload_station_weight_11: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:12", unit = "kilograms")]
    payload_station_weight_12: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:13", unit = "kilograms")]
    payload_station_weight_13: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:14", unit = "kilograms")]
    payload_station_weight_14: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:15", unit = "kilograms")]
    payload_station_weight_15: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:16", unit = "kilograms")]
    payload_station_weight_16: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:17", unit = "kilograms")]
    payload_station_weight_17: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:18", unit = "kilograms")]
    payload_station_weight_18: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:19", unit = "kilograms")]
    payload_station_weight_19: f64,
    #[simconnect(name = "PAYLOAD STATION WEIGHT:20", unit = "kilograms")]
    payload_station_weight_20: f64,
    // Sécurité/Warnings
    #[simconnect(name = "STALL WARNING")]
    stall_warning: bool,
    #[simconnect(name = "OVERSPEED WARNING")]
    overspeed_warning: bool,
    #[simconnect(name = "GEAR HANDLE POSITION")]
    gear_handle_position: bool,
}

pub struct SimConnectService {
    connection: Mutex<Option<SimConnect>>,
}

// SAFETY: SimConnect est thread-safe quand utilisé avec un Mutex
unsafe impl Send for SimConnectService {}
unsafe impl Sync for SimConnectService {}

impl SimConnectService {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
        }
    }

    /// Récupérer la liste des événements SimConnect disponibles
    pub fn get_available_events() -> HashMap<String, String> {
        let mut events = HashMap::new();

        // Autopilot
        events.insert("AP_MASTER".to_string(), "Autopilot Master Toggle".to_string());
        events.insert("AP_ALT_HOLD".to_string(), "Autopilot Altitude Hold".to_string());
        events.insert("AP_HDG_HOLD".to_string(), "Autopilot Heading Hold".to_string());
        events.insert("AP_NAV1_HOLD".to_string(), "Autopilot NAV1 Hold".to_string());
        events.insert("AP_APR_HOLD".to_string(), "Autopilot Approach Hold".to_string());
        events.insert("HEADING_BUG_SET".to_string(), "Set Heading Bug (0-359°)".to_string());
        events.insert("AP_VS_VAR_SET_ENGLISH".to_string(), "Set Vertical Speed (ft/min)".to_string());
        events.insert("AP_ALT_VAR_SET_ENGLISH".to_string(), "Set Altitude (feet)".to_string());
        events.insert("AP_AIRSPEED_SET".to_string(), "Set Airspeed (knots)".to_string());

        // Flight Controls
        events.insert("PARKING_BRAKES".to_string(), "Parking Brake (0=OFF, 1=ON)".to_string());
        events.insert("GEAR_TOGGLE".to_string(), "Toggle Landing Gear".to_string());
        events.insert("GEAR_UP".to_string(), "Retract Landing Gear".to_string());
        events.insert("GEAR_DOWN".to_string(), "Extend Landing Gear".to_string());
        events.insert("FLAPS_INCR".to_string(), "Increase Flaps".to_string());
        events.insert("FLAPS_DECR".to_string(), "Decrease Flaps".to_string());
        events.insert("FLAPS_UP".to_string(), "Retract Flaps".to_string());
        events.insert("FLAPS_DOWN".to_string(), "Extend Flaps Fully".to_string());
        events.insert("SPOILERS_TOGGLE".to_string(), "Toggle Spoilers".to_string());

        // Engine
        events.insert("THROTTLE_SET".to_string(), "Set Throttle (0-16384)".to_string());
        events.insert("THROTTLE_FULL".to_string(), "Full Throttle".to_string());
        events.insert("THROTTLE_CUT".to_string(), "Cut Throttle".to_string());
        events.insert("THROTTLE_INCR".to_string(), "Increase Throttle".to_string());
        events.insert("THROTTLE_DECR".to_string(), "Decrease Throttle".to_string());
        events.insert("MIXTURE_SET".to_string(), "Set Mixture (0-16384)".to_string());
        events.insert("MIXTURE_RICH".to_string(), "Full Rich Mixture".to_string());
        events.insert("MIXTURE_LEAN".to_string(), "Lean Mixture".to_string());

        // Lights
        events.insert("TOGGLE_BEACON_LIGHTS".to_string(), "Toggle Beacon Lights".to_string());
        events.insert("TOGGLE_NAV_LIGHTS".to_string(), "Toggle Nav Lights".to_string());
        events.insert("LANDING_LIGHTS_TOGGLE".to_string(), "Toggle Landing Lights".to_string());
        events.insert("LANDING_LIGHTS_ON".to_string(), "Landing Lights ON".to_string());
        events.insert("LANDING_LIGHTS_OFF".to_string(), "Landing Lights OFF".to_string());
        events.insert("STROBES_TOGGLE".to_string(), "Toggle Strobe Lights".to_string());
        events.insert("PANEL_LIGHTS_TOGGLE".to_string(), "Toggle Panel Lights".to_string());

        // Fuel
        events.insert("FUEL_SELECTOR_SET".to_string(), "Set Fuel Tank Selector".to_string());
        events.insert("FUEL_SELECTOR_LEFT".to_string(), "Select Left Fuel Tank".to_string());
        events.insert("FUEL_SELECTOR_RIGHT".to_string(), "Select Right Fuel Tank".to_string());
        events.insert("FUEL_SELECTOR_ALL".to_string(), "Select All Fuel Tanks".to_string());

        // Electrical
        events.insert("TOGGLE_MASTER_BATTERY".to_string(), "Toggle Master Battery".to_string());
        events.insert("TOGGLE_MASTER_ALTERNATOR".to_string(), "Toggle Master Alternator".to_string());
        events.insert("TOGGLE_AVIONICS_MASTER".to_string(), "Toggle Avionics Master".to_string());

        // Communication
        events.insert("COM_RADIO_SET".to_string(), "Set COM Radio Frequency (Hz)".to_string());
        events.insert("NAV1_RADIO_SET".to_string(), "Set NAV1 Radio Frequency (Hz)".to_string());

        // Simulation
        events.insert("PAUSE_TOGGLE".to_string(), "Toggle Pause".to_string());
        events.insert("SIM_RATE_INCR".to_string(), "Increase Sim Rate".to_string());
        events.insert("SIM_RATE_DECR".to_string(), "Decrease Sim Rate".to_string());

        events
    }

    /// Tenter de se connecter à Flight Simulator
    pub fn connect(&self) -> Result<(), String> {
        let mut conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        match SimConnect::new("FlightService") {
            Ok(client) => {
                *conn = Some(client);
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

    /// Envoyer un événement au simulateur
    pub fn send_event(&self, event_name: &str, value: u32) -> Result<(), String> {
        let _conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        // NOTE: La version actuelle de simconnect-sdk (0.2.3) ne supporte pas l'envoi d'événements
        // Cette fonctionnalité nécessite l'accès aux fonctions natives de SimConnect qui ne sont
        // pas exposées par cette crate orientée lecture de données.
        //
        // Pour implémenter cette fonctionnalité, il faudrait :
        // 1. Utiliser une crate différente (ex: simconnect)
        // 2. Ou utiliser directement les bindings FFI avec SimConnect.dll
        // 3. Ou attendre une mise à jour de simconnect-sdk

        Err(format!(
            "Event sending not yet implemented. Event: {}, Value: {}. \
            The current SimConnect SDK wrapper doesn't support low-level event transmission.",
            event_name, value
        ))
    }

    /// Récupérer la position actuelle de l'avion
    pub fn get_aircraft_position(&self) -> Result<AircraftPosition, String> {
        let mut conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        if let Some(client) = conn.as_mut() {
            // Enregistrer la structure pour recevoir les données
            client.register_object::<AirplaneData>()
                .map_err(|e| format!("Failed to register object: {:?}", e))?;

            // Attendre les données (max 10 tentatives)
            for _ in 0..10 {
                match client.get_next_dispatch() {
                    Ok(Some(Notification::Object(data))) => {
                        // Essayer de convertir en AirplaneData
                        if let Ok(airplane_data) = AirplaneData::try_from(&data) {
                            // Désenregistrer immédiatement
                            let _ = client.unregister_object::<AirplaneData>();

                            return Ok(AircraftPosition {
                                latitude: airplane_data.latitude,
                                longitude: airplane_data.longitude,
                                altitude: airplane_data.altitude,
                                heading: airplane_data.heading,
                                sim_on_ground: airplane_data.sim_on_ground,
                                ground_velocity: airplane_data.ground_velocity,
                                crash_flag: airplane_data.crash_flag,
                                fuel_total_quantity: airplane_data.fuel_total_quantity,
                                fuel_tank_left_main: airplane_data.fuel_tank_left_main,
                                fuel_tank_right_main: airplane_data.fuel_tank_right_main,
                                fuel_tank_center: airplane_data.fuel_tank_center,
                                number_of_engines: airplane_data.number_of_engines,
                                engine_1_rpm: airplane_data.engine_1_rpm,
                                engine_2_rpm: airplane_data.engine_2_rpm,
                                engine_3_rpm: airplane_data.engine_3_rpm,
                                engine_4_rpm: airplane_data.engine_4_rpm,
                                engine_5_rpm: airplane_data.engine_5_rpm,
                                engine_6_rpm: airplane_data.engine_6_rpm,
                                engine_7_rpm: airplane_data.engine_7_rpm,
                                engine_8_rpm: airplane_data.engine_8_rpm,
                                engine_1_fuel_flow: airplane_data.engine_1_fuel_flow,
                                engine_2_fuel_flow: airplane_data.engine_2_fuel_flow,
                                engine_3_fuel_flow: airplane_data.engine_3_fuel_flow,
                                engine_4_fuel_flow: airplane_data.engine_4_fuel_flow,
                                engine_5_fuel_flow: airplane_data.engine_5_fuel_flow,
                                engine_6_fuel_flow: airplane_data.engine_6_fuel_flow,
                                engine_7_fuel_flow: airplane_data.engine_7_fuel_flow,
                                engine_8_fuel_flow: airplane_data.engine_8_fuel_flow,
                                vertical_speed: airplane_data.vertical_speed,
                                plane_alt_above_ground: airplane_data.plane_alt_above_ground,
                                airspeed_true: airplane_data.airspeed_true,
                                airspeed_indicated: airplane_data.airspeed_indicated,
                                total_weight: airplane_data.total_weight,
                                empty_weight: airplane_data.empty_weight,
                                fuel_weight: airplane_data.fuel_weight,
                                payload_station_count: airplane_data.payload_station_count,
                                payload_station_name_1: airplane_data.payload_station_name_1,
                                payload_station_name_2: airplane_data.payload_station_name_2,
                                payload_station_name_3: airplane_data.payload_station_name_3,
                                payload_station_name_4: airplane_data.payload_station_name_4,
                                payload_station_name_5: airplane_data.payload_station_name_5,
                                payload_station_name_6: airplane_data.payload_station_name_6,
                                payload_station_name_7: airplane_data.payload_station_name_7,
                                payload_station_name_8: airplane_data.payload_station_name_8,
                                payload_station_name_9: airplane_data.payload_station_name_9,
                                payload_station_name_10: airplane_data.payload_station_name_10,
                                payload_station_name_11: airplane_data.payload_station_name_11,
                                payload_station_name_12: airplane_data.payload_station_name_12,
                                payload_station_name_13: airplane_data.payload_station_name_13,
                                payload_station_name_14: airplane_data.payload_station_name_14,
                                payload_station_name_15: airplane_data.payload_station_name_15,
                                payload_station_name_16: airplane_data.payload_station_name_16,
                                payload_station_name_17: airplane_data.payload_station_name_17,
                                payload_station_name_18: airplane_data.payload_station_name_18,
                                payload_station_name_19: airplane_data.payload_station_name_19,
                                payload_station_name_20: airplane_data.payload_station_name_20,
                                payload_station_weight_1: airplane_data.payload_station_weight_1,
                                payload_station_weight_2: airplane_data.payload_station_weight_2,
                                payload_station_weight_3: airplane_data.payload_station_weight_3,
                                payload_station_weight_4: airplane_data.payload_station_weight_4,
                                payload_station_weight_5: airplane_data.payload_station_weight_5,
                                payload_station_weight_6: airplane_data.payload_station_weight_6,
                                payload_station_weight_7: airplane_data.payload_station_weight_7,
                                payload_station_weight_8: airplane_data.payload_station_weight_8,
                                payload_station_weight_9: airplane_data.payload_station_weight_9,
                                payload_station_weight_10: airplane_data.payload_station_weight_10,
                                payload_station_weight_11: airplane_data.payload_station_weight_11,
                                payload_station_weight_12: airplane_data.payload_station_weight_12,
                                payload_station_weight_13: airplane_data.payload_station_weight_13,
                                payload_station_weight_14: airplane_data.payload_station_weight_14,
                                payload_station_weight_15: airplane_data.payload_station_weight_15,
                                payload_station_weight_16: airplane_data.payload_station_weight_16,
                                payload_station_weight_17: airplane_data.payload_station_weight_17,
                                payload_station_weight_18: airplane_data.payload_station_weight_18,
                                payload_station_weight_19: airplane_data.payload_station_weight_19,
                                payload_station_weight_20: airplane_data.payload_station_weight_20,
                                stall_warning: airplane_data.stall_warning,
                                overspeed_warning: airplane_data.overspeed_warning,
                                gear_handle_position: airplane_data.gear_handle_position,
                            });
                        }
                    }
                    Ok(_) => {
                        // Autre type de notification, continuer
                    }
                    Err(e) => {
                        let _ = client.unregister_object::<AirplaneData>();
                        return Err(format!("SimConnect error: {:?}", e));
                    }
                }

                // Petit délai avant de réessayer
                std::thread::sleep(std::time::Duration::from_millis(10));
            }

            // Désenregistrer en cas de timeout
            let _ = client.unregister_object::<AirplaneData>();
            Err("Timeout waiting for SimConnect data".to_string())
        } else {
            Err("Not connected to SimConnect".to_string())
        }
    }
}
