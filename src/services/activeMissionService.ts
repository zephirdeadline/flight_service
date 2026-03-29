import { invoke } from '@tauri-apps/api/core';
import { ActiveMission, Mission } from '../types';

export const activeMissionService = {
  // Accepter une mission
  async acceptMission(
    playerId: string,
    mission: Mission,
    aircraftId: string
  ): Promise<string> {
    return await invoke('accept_mission', {
      playerId,
      fromAirportId: mission.fromAirport.id,
      toAirportId: mission.toAirport.id,
      missionType: mission.type,
      distance: mission.distance,
      reward: mission.reward,
      cargoWeight: mission.cargo?.weight || null,
      cargoDescription: mission.cargo?.description || null,
      passengerCount: mission.passengers?.count || null,
      aircraftId,
    });
  },

  // Récupérer toutes les missions actives
  async getActiveMissions(playerId: string): Promise<ActiveMission[]> {
    return await invoke('get_active_missions', { playerId });
  },

  // Compléter une mission active
  async completeMission(
    playerId: string,
    activeMissionId: string
  ): Promise<number> {
    return await invoke('complete_active_mission', {
      playerId,
      activeMissionId,
    });
  },

  // Annuler une mission active (retourne la pénalité déduite)
  async cancelMission(
    playerId: string,
    activeMissionId: string,
    progressPercentage: number
  ): Promise<number> {
    return await invoke('cancel_active_mission', {
      playerId,
      activeMissionId,
      progressPercentage,
    });
  },
};
