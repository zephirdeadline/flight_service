import { invoke } from '@tauri-apps/api/core';

/**
 * Retourne l'altitude du terrain en mètres au point donné.
 * Télécharge la tuile SRTM si nécessaire (mis en cache localement).
 * Retourne null si pas de données (océan, zone sans couverture).
 */
export const getElevation = (lat: number, lon: number): Promise<number | null> =>
  invoke<number | null>('get_elevation', { lat, lon });
