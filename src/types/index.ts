export interface Airport {
  id: string;
  icao: string;
  iataCode: string | null;
  name: string;
  type: 'large_airport' | 'medium_airport' | 'small_airport';
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation: number;
  scheduledService: boolean;
}

export interface Aircraft {
  id: string;
  name: string;
  manufacturer: string;
  type: 'passenger' | 'cargo' | 'both';
  price: number;
  capacity: number; // passengers or cargo weight in kg
  range: number; // in nautical miles
  cruiseSpeed: number; // in knots
  imageUrl?: string;
  maintenanceCostPerHour: number; // coût de maintenance par heure de vol
  maxFlightHoursBeforeMaintenance: number; // heures max avant révision obligatoire
  maxSpeed: number; // vitesse maximale en knots
  fuelCapacity: number; // capacité de carburant en litres
  fuelConsumption: number; // consommation de carburant en litres/heure
  emptyWeight: number; // poids à vide en kg
  maxTakeoffWeight: number; // poids max au décollage en kg
  serviceCeiling: number; // plafond de service en pieds
  rateOfClimb: number; // taux de montée en pieds/minute
  wingspan: number; // envergure en mètres
  length: number; // longueur en mètres
}

export interface OwnedAircraft {
  id: string; // ID unique de l'avion possédé
  playerId: string;
  currentAirportId: string; // Où se trouve l'avion
  purchaseDate: string;
  purchasePrice: number;
  aircraft: Aircraft; // Informations complètes du catalogue
}

export interface MarketAircraft {
  id: string; // ID unique de l'offre (généré depuis seed)
  aircraft: Aircraft; // Informations du catalogue
  location: Airport; // Où se trouve l'avion
  distance: number; // Distance depuis la position du joueur (NM)
  price: number; // Prix de vente (peut être réduit si occasion)
  condition: number; // État 60-100% (100 = neuf)
  flightHours: number; // Heures de vol accumulées
}

export interface Mission {
  id: string;
  type: 'passenger' | 'cargo';
  fromAirport: Airport;
  toAirport: Airport;
  distance: number; // in nautical miles
  reward: number;
  cargo?: {
    weight: number;
    description: string;
  };
  passengers?: {
    count: number;
  };
  deadline?: string; // ISO date
  requiredAircraftType?: 'passenger' | 'cargo' | 'both';
}

export interface Player {
  id: string;
  name: string;
  money: number;
  currentAirportId: string;
  ownedAircraftIds: string[];
  selectedAircraftId?: string;
  completedMissions: string[];
  totalFlightHours: number;
  aircraftMaintenances: Record<string, AircraftMaintenance>; // aircraftId -> maintenance
  maintenanceHistory: MaintenanceRecord[];
}

export interface MissionCompletion {
  missionId: string;
  reward: number;
  completedAt: string;
}

export interface ActiveMission {
  id: string;
  mission: Mission;
  aircraftId: string;
  acceptedAt: string; // ISO date
  status: 'in_progress' | 'ready_to_complete';
}

export interface AircraftMaintenance {
  aircraftId: string;
  flightHours: number; // heures de vol accumulées depuis la dernière maintenance
  condition: number; // état de santé en % (100 = parfait, 0 = hors service)
  isUnderMaintenance: boolean;
  maintenanceEndDate?: string; // ISO date - quand la maintenance sera terminée
  lastMaintenanceDate?: string; // ISO date
}

export interface MaintenanceRecord {
  id: string;
  aircraftId: string;
  date: string; // ISO date
  type: 'routine' | 'repair' | 'inspection';
  cost: number;
  flightHoursAtMaintenance: number;
  description: string;
}

export interface SimData {
  aircraft_title: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  airspeed_indicated: number;
  vertical_speed: number;
  sim_on_ground: boolean;
  ground_velocity: number;
  crash_flag: boolean;
  fuel_total_quantity: number;
  fuel_tank_left_main: number;
  fuel_tank_right_main: number;
  fuel_tank_center: number;
  number_of_engines: number;
  engine_1_rpm: number;
  engine_2_rpm: number;
  engine_3_rpm: number;
  engine_4_rpm: number;
  engine_5_rpm: number;
  engine_6_rpm: number;
  engine_7_rpm: number;
  engine_8_rpm: number;
  engine_1_fuel_flow: number;
  engine_2_fuel_flow: number;
  engine_3_fuel_flow: number;
  engine_4_fuel_flow: number;
  engine_5_fuel_flow: number;
  engine_6_fuel_flow: number;
  engine_7_fuel_flow: number;
  engine_8_fuel_flow: number;
  plane_alt_above_ground: number;
  airspeed_true: number;
  total_weight: number;
  empty_weight: number;
  fuel_weight: number;
  payload_station_count: number;
  payload_station_weight_1: number;
  payload_station_weight_2: number;
  payload_station_weight_3: number;
  payload_station_weight_4: number;
  payload_station_weight_5: number;
  payload_station_weight_6: number;
  payload_station_weight_7: number;
  payload_station_weight_8: number;
  payload_station_weight_9: number;
  payload_station_weight_10: number;
  stall_warning: boolean;
  overspeed_warning: boolean;
  gear_handle_position: boolean;
}

export type PopupType = 'info' | 'warning' | 'error' | 'success' | 'confirm';

export interface PopupButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface PopupConfig {
  type: PopupType;
  title: string;
  message: string;
  buttons?: PopupButton[];
  onClose?: () => void;
}
