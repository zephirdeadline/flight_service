import { invoke } from '@tauri-apps/api/core';

export interface AirspaceLimit {
  value: number;
  unit: number;  // 1 = ft, 0 = m
  datum: number; // 0 = GND, 1 = MSL, 2 = FL
}

export interface Airspace {
  name: string;
  airspaceType: number;
  icaoClass: number;
  upper: AirspaceLimit;
  lower: AirspaceLimit;
  coordinates: [number, number][][]; // [ring][point] = [lon, lat]
}

// Noms des types d'espace aérien OpenAIP
export const AIRSPACE_TYPE_NAMES: Record<number, string> = {
  1: 'Restricted', 2: 'Danger', 3: 'Prohibited',
  4: 'CTR', 5: 'TMZ', 6: 'RMZ', 7: 'ATZ',
  8: 'TMA', 9: 'TRA', 10: 'TSA', 11: 'FIR',
  12: 'UIR', 14: 'ATD', 15: 'MATZ', 27: 'CTA',
};

export const ICAO_CLASS_NAMES: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G',
};

export const formatLimit = (l: AirspaceLimit): string => {
  if (l.datum === 0) return 'GND';
  if (l.datum === 2) return `FL ${Math.round(l.value / 100).toString().padStart(3, '0')}`;
  return `${Math.round(l.value).toLocaleString()} ft`;
};

export interface AirspaceCrossing {
  name: string;
  airspaceType: number;
  icaoClass: number;
  entryDistNm: number;
  exitDistNm: number;
  lowerFt: number;
  upperFt: number;
  color: string;
}

const ASP_COLORS: Record<number, string> = {
  1: '#ff6400', 2: '#ffaa00', 3: '#dc0000',
  4: '#3498db', 5: '#8250c8', 6: '#8250c8',
  8: '#2980b9', 27: '#2980b9', 11: '#666666',
};
export const airspaceColor = (type: number) => ASP_COLORS[type] ?? '#446688';

export const limitToFt = (l: AirspaceLimit): number => {
  if (l.datum === 2) return l.value * 100;           // FL → ft
  if (l.unit === 0) return Math.round(l.value * 3.28084); // m → ft
  return Math.round(l.value);                         // ft
};

export const getAirspaces = (
  lat1: number, lon1: number, lat2: number, lon2: number,
): Promise<Airspace[]> =>
  invoke<Airspace[]>('get_airspaces', { lat1, lon1, lat2, lon2 });
