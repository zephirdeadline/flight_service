import { invoke } from '@tauri-apps/api/core';

export const cheatService = {
  /**
   * Téléporte le joueur à un aéroport spécifique (cheat)
   */
  async teleportToAirport(playerId: string, airportId: string): Promise<void> {
    await invoke('cheat_teleport_to_airport', { playerId, airportId });
  },

  /**
   * Donne un avion gratuitement au joueur (cheat)
   */
  async giveAircraft(playerId: string, aircraftId: string): Promise<void> {
    await invoke('cheat_give_aircraft', { playerId, aircraftId });
  },

  /**
   * Ajoute de l'argent au joueur (cheat)
   */
  async addMoney(playerId: string, amount: number): Promise<void> {
    await invoke('cheat_add_money', { playerId, amount });
  },

  /**
   * Téléporte un avion vers un aéroport (cheat)
   */
  async teleportAircraft(playerAircraftId: string, airportId: string): Promise<void> {
    await invoke('cheat_teleport_aircraft', { playerAircraftId, airportId });
  },

  /**
   * Force le complete d'une mission active (cheat)
   */
  async forceCompleteMission(playerId: string, activeMissionId: string): Promise<number> {
    return await invoke('cheat_force_complete_mission', { playerId, activeMissionId });
  },

  /**
   * Définit l'usure d'un avion (heures de vol et condition) (cheat)
   */
  async setAircraftWear(playerAircraftId: string, flightHours: number, condition: number): Promise<void> {
    await invoke('cheat_set_aircraft_wear', { playerAircraftId, flightHours, condition });
  },

  /**
   * Termine instantanément une maintenance en cours (cheat)
   */
  async completeMaintenance(playerId: string, playerAircraftId: string): Promise<void> {
    await invoke('cheat_complete_maintenance', { playerId, playerAircraftId });
  },
};
