// Service SimConnect pour interagir avec Flight Simulator 2024
use simconnect;
use std::sync::{Mutex, Arc};
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use std::thread;
use std::time::Duration;
use tauri::Emitter;

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
    pub fuel_total_quantity: f64,
    pub fuel_tank_left_main: f64,
    pub fuel_tank_right_main: f64,
    pub fuel_tank_center: f64,
    // Moteurs
    pub number_of_engines: f64,
    pub engine_1_rpm: f64,
    pub engine_2_rpm: f64,
    pub engine_3_rpm: f64,
    pub engine_4_rpm: f64,
    pub engine_5_rpm: f64,
    pub engine_6_rpm: f64,
    pub engine_7_rpm: f64,
    pub engine_8_rpm: f64,
    pub engine_1_fuel_flow: f64,
    pub engine_2_fuel_flow: f64,
    pub engine_3_fuel_flow: f64,
    pub engine_4_fuel_flow: f64,
    pub engine_5_fuel_flow: f64,
    pub engine_6_fuel_flow: f64,
    pub engine_7_fuel_flow: f64,
    pub engine_8_fuel_flow: f64,
    // Navigation/Vol
    pub vertical_speed: f64,
    pub plane_alt_above_ground: f64,
    pub airspeed_true: f64,
    pub airspeed_indicated: f64,
    // Poids
    pub total_weight: f64,
    pub empty_weight: f64,
    pub fuel_weight: f64,
    pub payload_station_count: f64,
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
    // Détail poids par slot
    pub payload_station_weight_1: f64,
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
    // Warnings
    pub stall_warning: bool,
    pub overspeed_warning: bool,
    pub gear_handle_position: bool,
}

pub struct SimConnectService {
    connection: Mutex<Option<simconnect::SimConnector>>,
    streaming: Arc<AtomicBool>,
}

unsafe impl Send for SimConnectService {}
unsafe impl Sync for SimConnectService {}

impl SimConnectService {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
            streaming: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn is_streaming(&self) -> bool {
        self.streaming.load(Ordering::Relaxed)
    }

    pub fn start_streaming(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
        if self.streaming.load(Ordering::Relaxed) {
            return Err("Already streaming".to_string());
        }

        if !self.is_connected() {
            return Err("Not connected to SimConnect".to_string());
        }

        self.streaming.store(true, Ordering::Relaxed);
        let streaming = self.streaming.clone();

        thread::spawn(move || {
            while streaming.load(Ordering::Relaxed) {
                // Créer une connexion locale pour ce thread
                let mut sim = simconnect::SimConnector::new();

                // Setup definitions
                const DEF_ID: u32 = 0;
                const REQ_ID: u32 = 0;
                Self::setup_data_definitions(&mut sim);

                // Requête
                if sim.request_data_on_sim_object(REQ_ID, DEF_ID, 0, simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_ONCE, 0, 0, 0, 0) {
                    // Attendre réponse (max 500ms)
                    for _ in 0..50 {
                        match sim.get_next_message() {
                            Ok(simconnect::DispatchResult::SimObjectData(data)) => {
                                unsafe {
                                    let data_ptr = std::ptr::addr_of!(data.dwData) as *const u8;
                                    let position = Self::parse_data(data_ptr);

                                    // Émettre l'événement Tauri
                                    let _ = app_handle.emit("simconnect-data", position);
                                }
                                break;
                            }
                            Ok(_) => {}
                            Err(_) => {}
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                }

                // Attendre 1 seconde avant la prochaine itération
                thread::sleep(Duration::from_secs(1));
            }
        });

        Ok(())
    }

    pub fn stop_streaming(&self) {
        self.streaming.store(false, Ordering::Relaxed);
    }

    pub fn get_available_events() -> HashMap<String, String> {
        let mut events = HashMap::new();
        events.insert("AP_MASTER".to_string(), "Autopilot Master Toggle".to_string());
        events.insert("AP_ALT_HOLD".to_string(), "Autopilot Altitude Hold".to_string());
        events.insert("AP_HDG_HOLD".to_string(), "Autopilot Heading Hold".to_string());
        events.insert("HEADING_BUG_SET".to_string(), "Set Heading Bug (0-359°)".to_string());
        events.insert("PARKING_BRAKES".to_string(), "Parking Brake (0=OFF, 1=ON)".to_string());
        events.insert("GEAR_TOGGLE".to_string(), "Toggle Landing Gear".to_string());
        events.insert("FLAPS_INCR".to_string(), "Increase Flaps".to_string());
        events.insert("FLAPS_DECR".to_string(), "Decrease Flaps".to_string());
        events.insert("THROTTLE_SET".to_string(), "Set Throttle (0-16384)".to_string());
        events.insert("THROTTLE_FULL".to_string(), "Full Throttle".to_string());
        events.insert("MIXTURE_SET".to_string(), "Set Mixture (0-16384)".to_string());
        events.insert("TOGGLE_BEACON_LIGHTS".to_string(), "Toggle Beacon Lights".to_string());
        events.insert("LANDING_LIGHTS_TOGGLE".to_string(), "Toggle Landing Lights".to_string());
        events.insert("PAUSE_TOGGLE".to_string(), "Toggle Pause".to_string());
        events
    }

    pub fn connect(&self) -> Result<(), String> {
        let mut conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;
        let sim = simconnect::SimConnector::new();
        *conn = Some(sim);
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        if let Ok(conn) = self.connection.lock() {
            conn.is_some()
        } else {
            false
        }
    }

    pub fn disconnect(&self) {
        if let Ok(mut conn) = self.connection.lock() {
            *conn = None;
        }
    }

    pub fn send_event(&self, event_name: &str, value: u32) -> Result<(), String> {
        let mut conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        if let Some(sim) = conn.as_mut() {
            let mapped = sim.map_client_event_to_sim_event(0, event_name);
            if !mapped {
                return Err(format!("Failed to map event: {}", event_name));
            }

            let transmitted = sim.transmit_client_event(0, 0, value, 0, 0);
            if !transmitted {
                return Err(format!("Failed to transmit event: {}", event_name));
            }

            Ok(())
        } else {
            Err("Not connected to SimConnect".to_string())
        }
    }

    fn setup_data_definitions(sim: &mut simconnect::SimConnector) {
        const DEF_ID: u32 = 0;

        // Position & Navigation (7 variables)
        sim.add_data_definition(DEF_ID, "PLANE LATITUDE", "degrees", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE LONGITUDE", "degrees", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE ALTITUDE", "feet", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE HEADING DEGREES TRUE", "degrees", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "SIM ON GROUND", "bool", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32, 0, 0.0);
        sim.add_data_definition(DEF_ID, "GROUND VELOCITY", "knots", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "CRASH FLAG", "bool", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32, 0, 0.0);

        // Fuel (4 variables)
        sim.add_data_definition(DEF_ID, "FUEL TOTAL QUANTITY", "gallons", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TANK LEFT MAIN QUANTITY", "gallons", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TANK RIGHT MAIN QUANTITY", "gallons", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TANK CENTER QUANTITY", "gallons", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);

        // Moteurs (17 variables: 1 count + 8 rpm + 8 fuel flow)
        sim.add_data_definition(DEF_ID, "NUMBER OF ENGINES", "number", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        for i in 1..=8 {
            sim.add_data_definition(DEF_ID, &format!("GENERAL ENG RPM:{}", i), "rpm", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        }
        for i in 1..=8 {
            sim.add_data_definition(DEF_ID, &format!("ENG FUEL FLOW GPH:{}", i), "gallons per hour", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        }

        // Navigation/Vol (4 variables)
        sim.add_data_definition(DEF_ID, "VERTICAL SPEED", "feet per minute", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE ALT ABOVE GROUND", "feet", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "AIRSPEED TRUE", "knots", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "AIRSPEED INDICATED", "knots", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);

        // Poids (4 variables)
        sim.add_data_definition(DEF_ID, "TOTAL WEIGHT", "kilograms", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "EMPTY WEIGHT", "kilograms", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TOTAL QUANTITY WEIGHT", "kilograms", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        sim.add_data_definition(DEF_ID, "PAYLOAD STATION COUNT", "number", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);

        // Noms stations (20 variables string256)
        for i in 1..=20 {
            sim.add_data_definition(DEF_ID, &format!("PAYLOAD STATION NAME:{}", i), "string", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_STRING256, 0, 0.0);
        }

        // Poids stations (20 variables)
        for i in 1..=20 {
            sim.add_data_definition(DEF_ID, &format!("PAYLOAD STATION WEIGHT:{}", i), "kilograms", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64, 0, 0.0);
        }

        // Warnings (3 variables)
        sim.add_data_definition(DEF_ID, "STALL WARNING", "bool", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32, 0, 0.0);
        sim.add_data_definition(DEF_ID, "OVERSPEED WARNING", "bool", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32, 0, 0.0);
        sim.add_data_definition(DEF_ID, "GEAR HANDLE POSITION", "bool", simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32, 0, 0.0);
    }

    unsafe fn parse_data(ptr: *const u8) -> AircraftPosition {
        let mut offset = 0;

        // Helper pour lire f64
        let read_f64 = |ptr: *const u8, offset: &mut usize| -> f64 {
            let value = *(ptr.add(*offset) as *const f64);
            *offset += 8;
            value
        };

        // Helper pour lire i32
        let read_i32 = |ptr: *const u8, offset: &mut usize| -> i32 {
            let value = *(ptr.add(*offset) as *const i32);
            *offset += 4;
            value
        };

        // Helper pour lire string256
        let read_string256 = |ptr: *const u8, offset: &mut usize| -> String {
            let bytes = std::slice::from_raw_parts(ptr.add(*offset), 256);
            *offset += 256;
            let null_pos = bytes.iter().position(|&b| b == 0).unwrap_or(256);
            String::from_utf8_lossy(&bytes[..null_pos]).to_string()
        };

        AircraftPosition {
            // Position & Navigation (7)
            latitude: read_f64(ptr, &mut offset),
            longitude: read_f64(ptr, &mut offset),
            altitude: read_f64(ptr, &mut offset),
            heading: read_f64(ptr, &mut offset),
            sim_on_ground: read_i32(ptr, &mut offset) != 0,
            ground_velocity: read_f64(ptr, &mut offset),
            crash_flag: read_i32(ptr, &mut offset) != 0,
            // Fuel (4)
            fuel_total_quantity: read_f64(ptr, &mut offset),
            fuel_tank_left_main: read_f64(ptr, &mut offset),
            fuel_tank_right_main: read_f64(ptr, &mut offset),
            fuel_tank_center: read_f64(ptr, &mut offset),
            // Moteurs (17)
            number_of_engines: read_f64(ptr, &mut offset),
            engine_1_rpm: read_f64(ptr, &mut offset),
            engine_2_rpm: read_f64(ptr, &mut offset),
            engine_3_rpm: read_f64(ptr, &mut offset),
            engine_4_rpm: read_f64(ptr, &mut offset),
            engine_5_rpm: read_f64(ptr, &mut offset),
            engine_6_rpm: read_f64(ptr, &mut offset),
            engine_7_rpm: read_f64(ptr, &mut offset),
            engine_8_rpm: read_f64(ptr, &mut offset),
            engine_1_fuel_flow: read_f64(ptr, &mut offset),
            engine_2_fuel_flow: read_f64(ptr, &mut offset),
            engine_3_fuel_flow: read_f64(ptr, &mut offset),
            engine_4_fuel_flow: read_f64(ptr, &mut offset),
            engine_5_fuel_flow: read_f64(ptr, &mut offset),
            engine_6_fuel_flow: read_f64(ptr, &mut offset),
            engine_7_fuel_flow: read_f64(ptr, &mut offset),
            engine_8_fuel_flow: read_f64(ptr, &mut offset),
            // Navigation/Vol (4)
            vertical_speed: read_f64(ptr, &mut offset),
            plane_alt_above_ground: read_f64(ptr, &mut offset),
            airspeed_true: read_f64(ptr, &mut offset),
            airspeed_indicated: read_f64(ptr, &mut offset),
            // Poids (4)
            total_weight: read_f64(ptr, &mut offset),
            empty_weight: read_f64(ptr, &mut offset),
            fuel_weight: read_f64(ptr, &mut offset),
            payload_station_count: read_f64(ptr, &mut offset),
            // Noms stations (20)
            payload_station_name_1: read_string256(ptr, &mut offset),
            payload_station_name_2: read_string256(ptr, &mut offset),
            payload_station_name_3: read_string256(ptr, &mut offset),
            payload_station_name_4: read_string256(ptr, &mut offset),
            payload_station_name_5: read_string256(ptr, &mut offset),
            payload_station_name_6: read_string256(ptr, &mut offset),
            payload_station_name_7: read_string256(ptr, &mut offset),
            payload_station_name_8: read_string256(ptr, &mut offset),
            payload_station_name_9: read_string256(ptr, &mut offset),
            payload_station_name_10: read_string256(ptr, &mut offset),
            payload_station_name_11: read_string256(ptr, &mut offset),
            payload_station_name_12: read_string256(ptr, &mut offset),
            payload_station_name_13: read_string256(ptr, &mut offset),
            payload_station_name_14: read_string256(ptr, &mut offset),
            payload_station_name_15: read_string256(ptr, &mut offset),
            payload_station_name_16: read_string256(ptr, &mut offset),
            payload_station_name_17: read_string256(ptr, &mut offset),
            payload_station_name_18: read_string256(ptr, &mut offset),
            payload_station_name_19: read_string256(ptr, &mut offset),
            payload_station_name_20: read_string256(ptr, &mut offset),
            // Poids stations (20)
            payload_station_weight_1: read_f64(ptr, &mut offset),
            payload_station_weight_2: read_f64(ptr, &mut offset),
            payload_station_weight_3: read_f64(ptr, &mut offset),
            payload_station_weight_4: read_f64(ptr, &mut offset),
            payload_station_weight_5: read_f64(ptr, &mut offset),
            payload_station_weight_6: read_f64(ptr, &mut offset),
            payload_station_weight_7: read_f64(ptr, &mut offset),
            payload_station_weight_8: read_f64(ptr, &mut offset),
            payload_station_weight_9: read_f64(ptr, &mut offset),
            payload_station_weight_10: read_f64(ptr, &mut offset),
            payload_station_weight_11: read_f64(ptr, &mut offset),
            payload_station_weight_12: read_f64(ptr, &mut offset),
            payload_station_weight_13: read_f64(ptr, &mut offset),
            payload_station_weight_14: read_f64(ptr, &mut offset),
            payload_station_weight_15: read_f64(ptr, &mut offset),
            payload_station_weight_16: read_f64(ptr, &mut offset),
            payload_station_weight_17: read_f64(ptr, &mut offset),
            payload_station_weight_18: read_f64(ptr, &mut offset),
            payload_station_weight_19: read_f64(ptr, &mut offset),
            payload_station_weight_20: read_f64(ptr, &mut offset),
            // Warnings (3)
            stall_warning: read_i32(ptr, &mut offset) != 0,
            overspeed_warning: read_i32(ptr, &mut offset) != 0,
            gear_handle_position: read_i32(ptr, &mut offset) != 0,
        }
    }

    pub fn get_aircraft_position(&self) -> Result<AircraftPosition, String> {
        let mut conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        if let Some(sim) = conn.as_mut() {
            const DEF_ID: u32 = 0;
            const REQ_ID: u32 = 0;

            // Setup definitions (une seule fois)
            static SETUP_DONE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
            if !SETUP_DONE.load(std::sync::atomic::Ordering::Relaxed) {
                Self::setup_data_definitions(sim);
                SETUP_DONE.store(true, std::sync::atomic::Ordering::Relaxed);
            }

            // Requête
            if !sim.request_data_on_sim_object(REQ_ID, DEF_ID, 0, simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_ONCE, 0, 0, 0, 0) {
                return Err("Failed to request data".to_string());
            }

            // Attendre réponse (max 1 sec)
            for _ in 0..100 {
                match sim.get_next_message() {
                    Ok(simconnect::DispatchResult::SimObjectData(data)) => {
                        unsafe {
                            // Utiliser addr_of! pour éviter l'unaligned reference
                            let data_ptr = std::ptr::addr_of!(data.dwData) as *const u8;
                            return Ok(Self::parse_data(data_ptr));
                        }
                    }
                    Ok(_) => {
                        // Autre type de message, continuer
                    }
                    Err(_) => {
                        // Pas de message disponible
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(10));
            }

            Err("Timeout waiting for data".to_string())
        } else {
            Err("Not connected".to_string())
        }
    }
}
