import { invoke } from '@tauri-apps/api/core';
import { Player, AircraftMaintenance, MaintenanceRecord } from '../types';

// Mock data temporaire - pour les fonctionnalités pas encore implémentées backend
let mockPlayer: Player | null = null;

export const playerService = {
  // Récupérer les informations du joueur
  async getPlayer(playerId: string = '1'): Promise<Player | null> {
    try {
      const player = await invoke<Player | null>('get_player', { playerId });
      if (player) {
        mockPlayer = player;
        return player;
      }
      // Si pas de player en DB, retourner null (pas de fallback)
      return null;
    } catch (error) {
      console.error('Error fetching player:', error);
      return null;
    }
  },

  // Créer un nouveau joueur (setup initial)
  async createPlayer(name: string, startingAirportId: string, startingAircraftId: string): Promise<Player> {
    const playerId = await invoke<string>('create_player', {
      name,
      startingAirportId,
      startingAircraftId,
    });

    // Récupérer le joueur créé
    const player = await invoke<Player | null>('get_player', { playerId });
    if (player) {
      mockPlayer = player;
      return player;
    }

    throw new Error('Failed to create player');
  },

  // Mettre à jour l'argent du joueur
  async updateMoney(amount: number): Promise<Player | null> {
    if (!mockPlayer) return null;
    await new Promise(resolve => setTimeout(resolve, 200));
    mockPlayer.money += amount;
    return { ...mockPlayer };
  },

  // Changer l'aéroport actuel
  async changeAirport(airportId: string): Promise<Player> {
    await new Promise(resolve => setTimeout(resolve, 200));
    mockPlayer.currentAirportId = airportId;
    return { ...mockPlayer };
  },

  // Ajouter un avion au hangar
  async addAircraft(aircraftId: string): Promise<Player> {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!mockPlayer.ownedAircraftIds.includes(aircraftId)) {
      mockPlayer.ownedAircraftIds.push(aircraftId);
      // Initialiser la maintenance pour le nouvel avion
      mockPlayer.aircraftMaintenances[aircraftId] = {
        aircraftId,
        flightHours: 0,
        condition: 100,
        isUnderMaintenance: false,
      };
    }
    return { ...mockPlayer };
  },

  // Retirer un avion du hangar
  async removeAircraft(aircraftId: string): Promise<Player> {
    await new Promise(resolve => setTimeout(resolve, 300));
    mockPlayer.ownedAircraftIds = mockPlayer.ownedAircraftIds.filter(id => id !== aircraftId);

    // Supprimer la maintenance de l'avion vendu
    delete mockPlayer.aircraftMaintenances[aircraftId];

    // Si l'avion sélectionné est vendu, sélectionner le premier disponible
    if (mockPlayer.selectedAircraftId === aircraftId) {
      mockPlayer.selectedAircraftId = mockPlayer.ownedAircraftIds[0] || undefined;
    }

    return { ...mockPlayer };
  },

  // Sélectionner un avion
  async selectAircraft(playerAircraftId: string): Promise<void> {
    const playerId = '1'; // ID fixe pour mode solo
    await invoke('select_aircraft', {
      playerId,
      playerAircraftId
    });
  },

  // Ajouter une mission complétée
  async completeMission(missionId: string, reward: number, flightHours: number): Promise<Player> {
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!mockPlayer.completedMissions.includes(missionId)) {
      mockPlayer.completedMissions.push(missionId);
      mockPlayer.money += reward;
      mockPlayer.totalFlightHours += flightHours;
    }

    return { ...mockPlayer };
  },

  // Vérifier si le joueur peut acheter un avion
  async canAffordAircraft(price: number): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockPlayer.money >= price;
  },

  // Réinitialiser le joueur (nouvelle partie)
  async resetPlayer(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    mockPlayer = {
      id: '1',
      name: 'Pilot',
      money: 100000,
      currentAirportId: '1',
      ownedAircraftIds: ['1'],
      selectedAircraftId: '1',
      completedMissions: [],
      totalFlightHours: 0,
      aircraftMaintenances: {
        '1': {
          aircraftId: '1',
          flightHours: 0,
          condition: 100,
          isUnderMaintenance: false,
        },
      },
      maintenanceHistory: [],
    };
  },

  // Mettre à jour la maintenance d'un avion après un vol
  async updateAircraftMaintenance(aircraftId: string, flightHours: number, maxHours: number): Promise<Player> {
    await new Promise(resolve => setTimeout(resolve, 200));

    if (mockPlayer.aircraftMaintenances[aircraftId]) {
      mockPlayer.aircraftMaintenances[aircraftId].flightHours += flightHours;

      // Calculer la condition
      const totalHours = mockPlayer.aircraftMaintenances[aircraftId].flightHours;
      const condition = Math.max(0, 100 - Math.floor((totalHours / maxHours) * 100));
      mockPlayer.aircraftMaintenances[aircraftId].condition = condition;
    }

    return { ...mockPlayer };
  },

  // Démarrer une maintenance
  async startMaintenance(playerId: string, aircraftId: string, endDate: string, cost: number): Promise<void> {
    await invoke('start_aircraft_maintenance', {
      playerId,
      playerAircraftId: aircraftId,
      endDate,
      cost,
    });
  },

  // Terminer une maintenance
  async completeMaintenance(playerId: string, aircraftId: string): Promise<void> {
    await invoke('complete_aircraft_maintenance', {
      playerId,
      playerAircraftId: aircraftId,
    });
  },

  // Ajouter un record de maintenance à l'historique
  async addMaintenanceRecord(playerId: string, record: MaintenanceRecord): Promise<void> {
    await invoke('add_maintenance_record', {
      playerId,
      record,
    });
  },

  // Récupérer la maintenance d'un avion
  async getAircraftMaintenance(aircraftId: string): Promise<AircraftMaintenance | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockPlayer.aircraftMaintenances[aircraftId] || null;
  },
};
