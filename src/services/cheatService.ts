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
};
