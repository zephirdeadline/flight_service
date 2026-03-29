import { invoke } from '@tauri-apps/api/core';

export interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
}

export const simConnectService = {
  /**
   * Se connecter à Flight Simulator via SimConnect
   */
  async connect(): Promise<void> {
    await invoke('simconnect_connect');
  },

  /**
   * Vérifier si connecté à Flight Simulator
   */
  async isConnected(): Promise<boolean> {
    return await invoke('simconnect_is_connected');
  },

  /**
   * Se déconnecter de Flight Simulator
   */
  async disconnect(): Promise<void> {
    await invoke('simconnect_disconnect');
  },

  /**
   * Récupérer la position actuelle de l'avion dans Flight Simulator
   */
  async getPosition(): Promise<AircraftPosition> {
    return await invoke('simconnect_get_position');
  },
};
