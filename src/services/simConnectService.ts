import { invoke } from '@tauri-apps/api/core';
import type { AircraftPosition } from '../types';

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

  /**
   * Envoyer un événement au simulateur
   * @param eventName - Nom de l'événement SimConnect (ex: "AP_MASTER", "HEADING_BUG_SET")
   * @param value - Valeur de l'événement (0 pour toggle, ou valeur spécifique)
   *
   * Exemples:
   * - sendEvent("AP_MASTER", 1) - Active l'autopilot
   * - sendEvent("HEADING_BUG_SET", 270) - Set heading à 270°
   * - sendEvent("PARKING_BRAKES", 1) - Active le frein de parking
   */
  async sendEvent(eventName: string, value: number = 0): Promise<void> {
    await invoke('simconnect_send_event', { eventName, value });
  },

  /**
   * Récupérer la liste des événements SimConnect disponibles
   * @returns Map avec clé = nom de l'événement, valeur = description friendly
   */
  async getAvailableEvents(): Promise<Record<string, string>> {
    return await invoke('simconnect_get_available_events');
  },

  /**
   * Démarrer le streaming de données (push depuis le backend)
   * Les données seront émises via l'événement "simconnect-data"
   */
  async startStreaming(): Promise<void> {
    await invoke('simconnect_start_streaming');
  },

  /**
   * Arrêter le streaming de données
   */
  async stopStreaming(): Promise<void> {
    await invoke('simconnect_stop_streaming');
  },

  /**
   * Vérifier si le streaming est actif
   */
  async isStreaming(): Promise<boolean> {
    return await invoke('simconnect_is_streaming');
  },

  /**
   * Configurer les payload stations de l'avion dans Flight Simulator
   * @param weights - Poids en kg pour chaque station (max 10), dans l'ordre des stations
   *
   * Exemples:
   * - setPayload([150, 150]) - 2 stations à 150 kg chacune
   * - setPayload([80, 80, 80, 0]) - 3 stations de 80 kg, 4ème vide
   */
  async setPayload(weights: number[]): Promise<void> {
    await invoke('simconnect_set_payload', { weights });
  },
};
