import { invoke } from '@tauri-apps/api/core';
import { Airport } from '../types';

export const airportService = {
  // Récupérer tous les aéroports
  async getAllAirports(): Promise<Airport[]> {
    return await invoke('get_all_airports');
  },

  // Récupérer un aéroport par ID
  async getAirportById(id: string): Promise<Airport | null> {
    return await invoke('get_airport_by_id', { id });
  },

  // Rechercher des aéroports par nom ou ICAO
  async searchAirports(query: string): Promise<Airport[]> {
    return await invoke('search_airports', { query });
  },

  // Récupérer les aéroports à proximité
  async getNearbyAirports(airportId: string, _maxDistance: number = 500): Promise<Airport[]> {
    // Pour l'instant, on récupère tous les aéroports et on filtre
    const allAirports = await invoke<Airport[]>('get_all_airports');
    return allAirports.filter(a => a.id !== airportId);
  },
};
