import { invoke } from '@tauri-apps/api/core';
import { Aircraft } from '../types';

export const aircraftService = {
  // Récupérer tous les avions disponibles à l'achat
  async getAllAircraft(): Promise<Aircraft[]> {
    return await invoke('get_all_aircraft');
  },

  // Récupérer un avion par ID
  async getAircraftById(id: string): Promise<Aircraft | null> {
    return await invoke('get_aircraft_by_id', { id });
  },

  // Récupérer plusieurs avions par leurs IDs
  async getAircraftByIds(ids: string[]): Promise<Aircraft[]> {
    const allAircraft = await invoke<Aircraft[]>('get_all_aircraft');
    return allAircraft.filter(aircraft => ids.includes(aircraft.id));
  },

  // Filtrer les avions par type
  async getAircraftByType(type: 'passenger' | 'cargo' | 'both'): Promise<Aircraft[]> {
    return await invoke('get_aircraft_by_type', { aircraftType: type });
  },

  // Filtrer les avions par budget
  async getAircraftByBudget(maxPrice: number): Promise<Aircraft[]> {
    const allAircraft = await invoke<Aircraft[]>('get_all_aircraft');
    return allAircraft.filter(aircraft => aircraft.price <= maxPrice);
  },

  // Acheter un avion
  async purchaseAircraft(aircraftId: string, playerId: string): Promise<boolean> {
    try {
      await invoke('purchase_aircraft', { playerId, aircraftId });
      return true;
    } catch (error) {
      console.error('Purchase failed:', error);
      return false;
    }
  },

  // Vendre un avion
  async sellAircraft(aircraftId: string, _playerId: string): Promise<number> {
    const aircraft = await invoke<Aircraft | null>('get_aircraft_by_id', { id: aircraftId });
    // Retourne 70% du prix d'origine
    return aircraft ? Math.floor(aircraft.price * 0.7) : 0;
  },
};
