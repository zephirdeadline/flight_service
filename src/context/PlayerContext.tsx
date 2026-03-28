import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player, Aircraft, Airport, AircraftMaintenance } from '../types';
import { playerService } from '../services/playerService';
import { aircraftService } from '../services/aircraftService';
import { airportService } from '../services/airportService';
import { maintenanceService } from '../services/maintenanceService';

interface PlayerContextType {
  player: Player | null;
  currentAirport: Airport | null;
  selectedAircraft: Aircraft | null;
  ownedAircraft: Aircraft[];
  loading: boolean;
  refreshPlayer: () => Promise<void>;
  updateMoney: (amount: number) => Promise<void>;
  purchaseAircraft: (aircraftId: string, price: number) => Promise<boolean>;
  sellAircraft: (aircraftId: string) => Promise<void>;
  selectAircraft: (aircraftId: string) => Promise<void>;
  changeAirport: (airportId: string) => Promise<void>;
  completeMission: (missionId: string, reward: number, flightHours: number) => Promise<void>;
  initializePlayer: (name: string, airportId: string, aircraftId: string) => Promise<void>;
  startMaintenance: (aircraftId: string, type: 'routine' | 'repair' | 'inspection') => Promise<boolean>;
  getAircraftMaintenance: (aircraftId: string) => AircraftMaintenance | undefined;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [currentAirport, setCurrentAirport] = useState<Airport | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [ownedAircraft, setOwnedAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPlayer = async () => {
    try {
      setLoading(true);
      const playerData = await playerService.getPlayer();

      // Si pas de joueur, on arrête le loading
      if (!playerData) {
        setPlayer(null);
        setCurrentAirport(null);
        setOwnedAircraft([]);
        setSelectedAircraft(null);
        setLoading(false);
        return;
      }

      setPlayer(playerData);

      // Charger l'aéroport actuel
      const airport = await airportService.getAirportById(playerData.currentAirportId);
      setCurrentAirport(airport);

      // Charger les avions possédés
      const aircraft = await aircraftService.getAircraftByIds(playerData.ownedAircraftIds);
      setOwnedAircraft(aircraft);

      // Charger l'avion sélectionné
      if (playerData.selectedAircraftId) {
        const selected = await aircraftService.getAircraftById(playerData.selectedAircraftId);
        setSelectedAircraft(selected);
      }
    } catch (error) {
      console.error('Error refreshing player data:', error);
      setPlayer(null);
      setCurrentAirport(null);
      setOwnedAircraft([]);
      setSelectedAircraft(null);
    } finally {
      setLoading(false);
    }
  };

  const updateMoney = async (amount: number) => {
    const updatedPlayer = await playerService.updateMoney(amount);
    setPlayer(updatedPlayer);
  };

  const purchaseAircraft = async (aircraftId: string, price: number): Promise<boolean> => {
    if (!player || player.money < price) {
      return false;
    }

    try {
      await aircraftService.purchaseAircraft(aircraftId, player.id);
      await playerService.updateMoney(-price);
      await playerService.addAircraft(aircraftId);
      await refreshPlayer();
      return true;
    } catch (error) {
      console.error('Error purchasing aircraft:', error);
      return false;
    }
  };

  const sellAircraft = async (aircraftId: string) => {
    if (!player) return;

    try {
      const sellPrice = await aircraftService.sellAircraft(aircraftId, player.id);
      await playerService.updateMoney(sellPrice);
      await playerService.removeAircraft(aircraftId);
      await refreshPlayer();
    } catch (error) {
      console.error('Error selling aircraft:', error);
    }
  };

  const selectAircraft = async (aircraftId: string) => {
    await playerService.selectAircraft(aircraftId);
    await refreshPlayer();
  };

  const changeAirport = async (airportId: string) => {
    await playerService.changeAirport(airportId);
    await refreshPlayer();
  };

  const completeMission = async (missionId: string, reward: number, flightHours: number) => {
    await playerService.completeMission(missionId, reward, flightHours);

    // Mettre à jour la maintenance de l'avion sélectionné
    if (selectedAircraft && player) {
      await playerService.updateAircraftMaintenance(
        selectedAircraft.id,
        flightHours,
        selectedAircraft.maxFlightHoursBeforeMaintenance
      );
    }

    await refreshPlayer();
  };

  const initializePlayer = async (name: string, airportId: string, aircraftId: string) => {
    await playerService.createPlayer(name, airportId, aircraftId);
    await refreshPlayer();
  };

  const startMaintenance = async (aircraftId: string, type: 'routine' | 'repair' | 'inspection'): Promise<boolean> => {
    if (!player) return false;

    const aircraft = ownedAircraft.find(a => a.id === aircraftId);
    const maintenance = player.aircraftMaintenances[aircraftId];

    if (!aircraft || !maintenance) return false;

    // Calculer le coût et la durée
    const cost = maintenanceService.calculateMaintenanceCost(aircraft, maintenance);

    if (player.money < cost) {
      return false;
    }

    try {
      const result = await maintenanceService.startMaintenance(aircraftId, player.id, type);

      if (result.success) {
        await playerService.startMaintenance(aircraftId, result.endDate, result.cost);

        // Ajouter au historique
        const record = maintenanceService.createMaintenanceRecord(
          aircraftId,
          type,
          result.cost,
          maintenance.flightHours,
          `${type} maintenance started`
        );
        await playerService.addMaintenanceRecord(record);

        await refreshPlayer();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error starting maintenance:', error);
      return false;
    }
  };

  const getAircraftMaintenance = (aircraftId: string): AircraftMaintenance | undefined => {
    return player?.aircraftMaintenances[aircraftId];
  };

  useEffect(() => {
    refreshPlayer();
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        player,
        currentAirport,
        selectedAircraft,
        ownedAircraft,
        loading,
        refreshPlayer,
        updateMoney,
        purchaseAircraft,
        sellAircraft,
        selectAircraft,
        changeAirport,
        completeMission,
        initializePlayer,
        startMaintenance,
        getAircraftMaintenance,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
