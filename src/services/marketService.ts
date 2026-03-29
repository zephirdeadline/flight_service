import { invoke } from '@tauri-apps/api/core';
import { MarketAircraft } from '../types';

export const marketService = {
  /**
   * Récupère les offres d'avions du marché (générées quotidiennement)
   * Les offres sont déterministes et changent chaque jour
   */
  async getMarketAircraft(playerId: string): Promise<MarketAircraft[]> {
    return await invoke<MarketAircraft[]>('get_market_aircraft', { playerId });
  },

  /**
   * Achète un avion du marché
   * L'avion sera placé à l'aéroport de l'offre (pas à la position du joueur)
   */
  async purchaseMarketAircraft(
    playerId: string,
    aircraftId: string,
    price: number,
    airportId: string,
    condition: number,
    flightHours: number
  ): Promise<void> {
    return await invoke<void>('purchase_market_aircraft', {
      playerId,
      aircraftId,
      price,
      airportId,
      condition,
      flightHours,
    });
  },
};
