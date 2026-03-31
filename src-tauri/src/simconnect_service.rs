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
    pub airspeed_indicated: f64,
    pub vertical_speed: f64,
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
    pub plane_alt_above_ground: f64,
    pub airspeed_true: f64,
    // Poids
    pub total_weight: f64,
    pub empty_weight: f64,
    pub fuel_weight: f64,
    pub payload_station_count: f64,
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
    // Warnings
    pub stall_warning: bool,
    pub overspeed_warning: bool,
    pub gear_handle_position: bool,
}

struct SendableSimConnector(simconnect::SimConnector);
// SAFETY: SimConnect est utilisé exclusivement depuis Windows, thread-safe en pratique
unsafe impl Send for SendableSimConnector {}
unsafe impl Sync for SendableSimConnector {}

impl std::ops::Deref for SendableSimConnector {
    type Target = simconnect::SimConnector;
    fn deref(&self) -> &Self::Target { &self.0 }
}
impl std::ops::DerefMut for SendableSimConnector {
    fn deref_mut(&mut self) -> &mut Self::Target { &mut self.0 }
}

pub struct SimConnectService {
    connection: Arc<Mutex<Option<SendableSimConnector>>>,
    streaming: Arc<AtomicBool>,
    db: Arc<Mutex<crate::db::Database>>,
}

unsafe impl Send for SimConnectService {}
unsafe impl Sync for SimConnectService {}

impl SimConnectService {
    pub fn new(db: Arc<Mutex<crate::db::Database>>) -> Self {
        Self {
            connection: Arc::new(Mutex::new(None::<SendableSimConnector>)),
            streaming: Arc::new(AtomicBool::new(false)),
            db,
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
        let connection = self.connection.clone();
        let db = self.db.clone();

        thread::spawn(move || {
            const DEF_ID: u32 = 0;
            const REQ_ID: u32 = 0;

            // Dernier aéroport détecté pour éviter les écritures répétées
            let mut last_airport_id: Option<String> = None;

            while streaming.load(Ordering::Relaxed) {
                // Récupérer la position SimConnect (isolé dans catch_unwind)
                let maybe_position = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let mut conn = connection.lock().ok()?;
                    let sim = conn.as_mut()?;

                    if !sim.request_data_on_sim_object(REQ_ID, DEF_ID, 0, simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_ONCE, 0, 0, 0, 0) {
                        return None;
                    }

                    for _ in 0..50 {
                        if let Ok(simconnect::DispatchResult::SimObjectData(data)) = sim.get_next_message() {
                            unsafe {
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const u8;
                                let position = Self::parse_data(data_ptr);
                                let _ = app_handle.emit("simconnect-data", position.clone());
                                return Some(position);
                            }
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                    None
                }));

                match maybe_position {
                    Err(_) => {
                        // Panic SimConnect, on arrête
                        eprintln!("[SimConnect] Panic caught in streaming thread, stopping.");
                        streaming.store(false, Ordering::Relaxed);
                        break;
                    }
                    Ok(Some(position)) => {
                        // Auto-détection d'aéroport quand au sol
                        if position.sim_on_ground {
                            if let Ok(db_guard) = db.lock() {
                                if let Ok(Some(airport)) = crate::db::queries::find_airport_near_position(
                                    db_guard.conn(),
                                    position.latitude,
                                    position.longitude,
                                ) {
                                    if last_airport_id.as_deref() != Some(&airport.id) {
                                        let _ = crate::db::queries::set_player_airport(
                                            db_guard.conn(),
                                            "1",
                                            &airport.id,
                                        );
                                        last_airport_id = Some(airport.id);
                                    }
                                }
                            }
                        } else {
                            last_airport_id = None;
                        }
                    }
                    Ok(None) => {}
                }

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
        let mut sim = simconnect::SimConnector::new();
        let connected = sim.connect("Flight Service");
        if !connected {
            return Err("Failed to connect to Flight Simulator. Is MSFS running?".to_string());
        }
        Self::setup_data_definitions(&mut sim);
        *conn = Some(SendableSimConnector(sim));
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.connection.lock().map(|c| c.is_some()).unwrap_or(false)
    }

    pub fn disconnect(&self) {
        self.stop_streaming();
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

    pub fn set_payload_stations(&self, weights: Vec<f64>) -> Result<(), String> {
        let conn = self.connection.lock()
            .map_err(|e| format!("Failed to lock connection: {}", e))?;

        if let Some(sim) = conn.as_ref() {
            let count = weights.len().min(10);
            for i in 0..count {
                // DEF_IDs 1-10 reserved for writable payload stations
                let def_id = (i + 1) as u32;
                let mut weight = weights[i];
                unsafe {
                    sim.set_data_on_sim_object(
                        def_id,
                        0, // SIMCONNECT_OBJECT_ID_USER
                        0, // SIMCONNECT_DATA_SET_FLAG_DEFAULT
                        0, // not an array
                        std::mem::size_of::<f64>() as u32,
                        &mut weight as *mut f64 as *mut std::os::raw::c_void,
                    );
                }
            }
            Ok(())
        } else {
            Err("Not connected to SimConnect".to_string())
        }
    }

    fn setup_data_definitions(sim: &mut simconnect::SimConnector) {
        const DEF_ID: u32 = 0;
        let f64_type = simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64;
        // SIMCONNECT_UNUSED = 0xFFFFFFFF : groupe toutes les variables en un seul message
        const UNUSED: u32 = 0xFFFFFFFF;

        // IMPORTANT : ordre identique au struct AircraftPosition et à parse_data
        sim.add_data_definition(DEF_ID, "PLANE LATITUDE", "degrees", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE LONGITUDE", "degrees", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE ALTITUDE", "feet", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE HEADING DEGREES TRUE", "degrees", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "AIRSPEED INDICATED", "knots", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "VERTICAL SPEED", "feet per minute", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "SIM ON GROUND", "number", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GROUND VELOCITY", "knots", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "CRASH FLAG", "number", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TOTAL QUANTITY", "gallons", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TANK LEFT MAIN QUANTITY", "gallons", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TANK RIGHT MAIN QUANTITY", "gallons", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TANK CENTER QUANTITY", "gallons", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "NUMBER OF ENGINES", "number", f64_type, UNUSED, 0.0);
        for i in 1..=8 {
            sim.add_data_definition(DEF_ID, &format!("GENERAL ENG RPM:{}", i), "rpm", f64_type, UNUSED, 0.0);
        }
        for i in 1..=8 {
            sim.add_data_definition(DEF_ID, &format!("ENG FUEL FLOW GPH:{}", i), "gallons per hour", f64_type, UNUSED, 0.0);
        }
        sim.add_data_definition(DEF_ID, "PLANE ALT ABOVE GROUND", "feet", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "AIRSPEED TRUE", "knots", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "TOTAL WEIGHT", "kilograms", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "EMPTY WEIGHT", "kilograms", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TOTAL QUANTITY WEIGHT", "kilograms", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "PAYLOAD STATION COUNT", "number", f64_type, UNUSED, 0.0);
        for i in 1..=10 {
            sim.add_data_definition(DEF_ID, &format!("PAYLOAD STATION WEIGHT:{}", i), "kilograms", f64_type, UNUSED, 0.0);
        }
        sim.add_data_definition(DEF_ID, "STALL WARNING", "number", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "OVERSPEED WARNING", "number", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GEAR HANDLE POSITION", "number", f64_type, UNUSED, 0.0);

        // DEF_IDs 1-10 : variables d'écriture pour les payload stations
        // Chaque DEF_ID correspond à une station (DEF_ID 1 = station 1, etc.)
        for i in 1u32..=10 {
            sim.add_data_definition(i, &format!("PAYLOAD STATION WEIGHT:{}", i), "kilograms", f64_type, 0, 0.0);
        }
    }

    unsafe fn parse_data(ptr: *const u8) -> AircraftPosition {
        let mut offset = 0;

        // Tout est FLOAT64 : 8 bytes par champ, même ordre que setup_data_definitions
        let r = |i: usize| std::ptr::read_unaligned(ptr.add(i * 8) as *const f64);


        AircraftPosition {
            latitude:                   r(0),
            longitude:                  r(1),
            altitude:                   r(2),
            heading:                    r(3),
            airspeed_indicated:         r(4),
            vertical_speed:             r(5),
            sim_on_ground:              r(6) != 0.0,
            ground_velocity:            r(7),
            crash_flag:                 r(8) != 0.0,
            fuel_total_quantity:        r(9),
            fuel_tank_left_main:        r(10),
            fuel_tank_right_main:       r(11),
            fuel_tank_center:           r(12),
            number_of_engines:          r(13),
            engine_1_rpm:               r(14),
            engine_2_rpm:               r(15),
            engine_3_rpm:               r(16),
            engine_4_rpm:               r(17),
            engine_5_rpm:               r(18),
            engine_6_rpm:               r(19),
            engine_7_rpm:               r(20),
            engine_8_rpm:               r(21),
            engine_1_fuel_flow:         r(22),
            engine_2_fuel_flow:         r(23),
            engine_3_fuel_flow:         r(24),
            engine_4_fuel_flow:         r(25),
            engine_5_fuel_flow:         r(26),
            engine_6_fuel_flow:         r(27),
            engine_7_fuel_flow:         r(28),
            engine_8_fuel_flow:         r(29),
            plane_alt_above_ground:     r(30),
            airspeed_true:              r(31),
            total_weight:               r(32),
            empty_weight:               r(33),
            fuel_weight:                r(34),
            payload_station_count:      r(35),
            payload_station_weight_1:   r(36),
            payload_station_weight_2:   r(37),
            payload_station_weight_3:   r(38),
            payload_station_weight_4:   r(39),
            payload_station_weight_5:   r(40),
            payload_station_weight_6:   r(41),
            payload_station_weight_7:   r(42),
            payload_station_weight_8:   r(43),
            payload_station_weight_9:   r(44),
            payload_station_weight_10:  r(45),
            stall_warning:              r(46) != 0.0,
            overspeed_warning:          r(47) != 0.0,
            gear_handle_position:       r(48) != 0.0,
        }
    }

    pub fn get_aircraft_position(&self) -> Result<AircraftPosition, String> {
        let mut conn = self.connection.lock()
            .map_err(|_| "Failed to lock connection".to_string())?;

        if let Some(sim) = conn.as_mut() {
            const DEF_ID: u32 = 0;
            const REQ_ID: u32 = 0;

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
