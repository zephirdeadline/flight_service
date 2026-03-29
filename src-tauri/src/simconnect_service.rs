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
    // Fuel
    pub fuel_total_quantity: f64,
    // Moteurs
    pub number_of_engines: f64,
    pub engine_1_rpm: f64,
    pub engine_2_rpm: f64,
    pub engine_3_rpm: f64,
    pub engine_4_rpm: f64,
    // Navigation/Vol
    pub ground_velocity: f64,
    pub plane_alt_above_ground: f64,
    pub airspeed_true: f64,
    // Poids
    pub total_weight: f64,
    pub empty_weight: f64,
    pub fuel_weight: f64,
    // Warnings
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
}

unsafe impl Send for SimConnectService {}
unsafe impl Sync for SimConnectService {}

impl SimConnectService {
    pub fn new() -> Self {
        Self {
            connection: Arc::new(Mutex::new(None::<SendableSimConnector>)),
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
        let connection = self.connection.clone();

        thread::spawn(move || {
            const DEF_ID: u32 = 0;
            const REQ_ID: u32 = 0;

            while streaming.load(Ordering::Relaxed) {
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let mut conn = match connection.lock() {
                        Ok(c) => c,
                        Err(_) => return,
                    };
                    let sim = match conn.as_mut() {
                        Some(s) => s,
                        None => return,
                    };

                    if !sim.request_data_on_sim_object(REQ_ID, DEF_ID, 0, simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_ONCE, 0, 0, 0, 0) {
                        return;
                    }

                    // Attendre réponse (max 500ms)
                    for _ in 0..50 {
                        match sim.get_next_message() {
                            Ok(simconnect::DispatchResult::SimObjectData(data)) => {
                                unsafe {
                                    let data_ptr = std::ptr::addr_of!(data.dwData) as *const u8;
                                    let position = Self::parse_data(data_ptr);
                                    let _ = app_handle.emit("simconnect-data", position);
                                }
                                break;
                            }
                            Ok(_) => {}
                            Err(_) => {}
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                }));

                if result.is_err() {
                    eprintln!("[SimConnect] Panic caught in streaming thread, stopping.");
                    streaming.store(false, Ordering::Relaxed);
                    break;
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
        sim.add_data_definition(DEF_ID, "FUEL TOTAL QUANTITY", "gallons", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "NUMBER OF ENGINES", "number", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GENERAL ENG RPM:1", "rpm", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GENERAL ENG RPM:2", "rpm", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GENERAL ENG RPM:3", "rpm", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GENERAL ENG RPM:4", "rpm", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GROUND VELOCITY", "knots", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "PLANE ALT ABOVE GROUND", "feet", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "AIRSPEED TRUE", "knots", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "TOTAL WEIGHT", "kilograms", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "EMPTY WEIGHT", "kilograms", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "FUEL TOTAL QUANTITY WEIGHT", "kilograms", f64_type, UNUSED, 0.0);
        sim.add_data_definition(DEF_ID, "GEAR HANDLE POSITION", "number", f64_type, UNUSED, 0.0);
    }

    unsafe fn parse_data(ptr: *const u8) -> AircraftPosition {
        let mut offset = 0;

        // Tout est FLOAT64 : 8 bytes par champ, même ordre que setup_data_definitions
        let r = |i: usize| std::ptr::read_unaligned(ptr.add(i * 8) as *const f64);


        AircraftPosition {
            latitude:             r(0),
            longitude:            r(1),
            altitude:             r(2),
            heading:              r(3),
            airspeed_indicated:   r(4),
            vertical_speed:       r(5),
            sim_on_ground:        r(6) != 0.0,
            fuel_total_quantity:  r(7),
            number_of_engines:    r(8),
            engine_1_rpm:         r(9),
            engine_2_rpm:         r(10),
            engine_3_rpm:         r(11),
            engine_4_rpm:         r(12),
            ground_velocity:      r(13),
            plane_alt_above_ground: r(14),
            airspeed_true:        r(15),
            total_weight:         r(16),
            empty_weight:         r(17),
            fuel_weight:          r(18),
            gear_handle_position: r(19) != 0.0,
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
