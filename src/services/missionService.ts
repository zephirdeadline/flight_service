import { invoke } from '@tauri-apps/api/core';
import { Mission } from '../types';

export const missionService = {
  // Récupérer toutes les missions disponibles depuis un aéroport
  async getMissionsByAirport(airportId: string): Promise<Mission[]> {
    return await invoke('get_missions_by_airport', { airportId });
  },

  // Récupérer toutes les missions (utilise l'aéroport par défaut)
  async getAllMissions(): Promise<Mission[]> {
    // TODO: Récupérer l'aéroport actuel depuis le contexte
    return [];
  },

  // Récupérer une mission par ID
  async getMissionById(id: string, airportId: string): Promise<Mission | null> {
    const missions = await invoke<Mission[]>('get_missions_by_airport', { airportId });
    return missions.find(mission => mission.id === id) || null;
  },

  // Filtrer les missions par type
  async getMissionsByType(type: 'passenger' | 'cargo', airportId: string): Promise<Mission[]> {
    const missions = await invoke<Mission[]>('get_missions_by_airport', { airportId });
    return missions.filter(mission => mission.type === type);
  },

  // Accepter une mission
  async acceptMission(missionId: string, playerId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`Player ${playerId} accepted mission ${missionId}`);
    return true;
  },

  // Compléter une mission
  async completeMission(missionId: string, _playerId: string, airportId: string): Promise<{
    success: boolean;
    reward: number;
  }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const mission = await this.getMissionById(missionId, airportId);

    if (!mission) {
      return { success: false, reward: 0 };
    }

    return {
      success: true,
      reward: mission.reward,
    };
  },

  // Calculer la récompense basée sur la distance
  calculateReward(distance: number, type: 'passenger' | 'cargo'): number {
    const baseRate = type === 'passenger' ? 20 : 25;
    return Math.floor(distance * baseRate);
  },
};
