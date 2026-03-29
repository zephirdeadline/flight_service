import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { usePopup } from '../context/PopupContext';
import { maintenanceService } from '../services/maintenanceService';
import { airportService } from '../services/airportService';
import AircraftCard from '../components/AircraftCard';
import type { Airport } from '../types';
import './Hangar.css';

const Hangar: React.FC = () => {
  const {
    ownedAircraft,
    selectedAircraft,
    selectAircraft,
    sellAircraft,
    startMaintenance,
    getAircraftMaintenance,
    player,
    currentAirport,
    loading,
    refreshPlayer,
  } = usePlayer();
  const popup = usePopup();

  const [airportCache, setAirportCache] = React.useState<Map<string, Airport>>(new Map());

  // Refresh player au montage pour vérifier les maintenances terminées
  React.useEffect(() => {
    refreshPlayer();
  }, []);

  // Charger les aéroports où sont garés les avions
  React.useEffect(() => {
    async function loadAirports() {
      const airportIds = [...new Set(ownedAircraft.map(a => a.currentAirportId))];
      const cache = new Map<string, Airport>();

      for (const airportId of airportIds) {
        if (!airportCache.has(airportId)) {
          try {
            const airport = await airportService.getAirportById(airportId);
            if (airport) {
              cache.set(airportId, airport);
            }
          } catch (error) {
            console.error(`Failed to load airport ${airportId}:`, error);
          }
        } else {
          cache.set(airportId, airportCache.get(airportId)!);
        }
      }
      setAirportCache(cache);
    }

    if (ownedAircraft.length > 0) {
      loadAirports();
    }
  }, [ownedAircraft]);

  // Fonction pour calculer la distance entre deux aéroports (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3440; // Rayon de la Terre en nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Enrichir chaque avion avec ses infos de localisation
  const enrichedAircraft = ownedAircraft.map(owned => {
    const aircraftAirport = airportCache.get(owned.currentAirportId);
    const isAtCurrentLocation = owned.currentAirportId === player?.currentAirportId;

    let distance = 0;
    if (!isAtCurrentLocation && currentAirport && aircraftAirport) {
      distance = calculateDistance(
        currentAirport.latitude,
        currentAirport.longitude,
        aircraftAirport.latitude,
        aircraftAirport.longitude
      );
    }

    return {
      ...owned,
      isAtCurrentLocation,
      aircraftAirport,
      distance,
    };
  });

  const handleSelect = async (aircraftId: string) => {
    // Vérifier si l'avion est en maintenance
    const maintenance = getAircraftMaintenance(aircraftId);
    if (maintenance && maintenance.isUnderMaintenance) {
      popup.showError(
        'Aircraft Under Maintenance',
        'This aircraft is currently undergoing maintenance and cannot be selected.'
      );
      return;
    }

    await selectAircraft(aircraftId);
  };

  const handleSell = async (aircraftId: string) => {
    const ownedAircraft_instance = ownedAircraft.find(a => a.id === aircraftId);
    if (!ownedAircraft_instance) return;

    const sellPrice = Math.floor(ownedAircraft_instance.aircraft.price * 0.7);
    const confirmMessage = `You'll get $${sellPrice.toLocaleString()} (70% of original price).\n\nThis action cannot be undone.`;

    popup.showConfirm(
      `Sell ${ownedAircraft_instance.aircraft.name}?`,
      confirmMessage,
      async () => {
        await sellAircraft(aircraftId);
        popup.showSuccess(
          'Aircraft Sold',
          `${ownedAircraft_instance.aircraft.name} has been sold for $${sellPrice.toLocaleString()}`
        );
      }
    );
  };

  const handleMaintenance = async (aircraftId: string) => {
    const ownedAircraft_instance = ownedAircraft.find(a => a.id === aircraftId);
    const maintenance = getAircraftMaintenance(aircraftId);

    if (!ownedAircraft_instance || !maintenance || !player) return;

    const cost = maintenanceService.calculateMaintenanceCost(ownedAircraft_instance.aircraft, maintenance);
    const maintenanceHours = maintenanceService.calculateMaintenanceTime(maintenance.flightHours);

    if (player.money < cost) {
      popup.showError(
        'Not Enough Money',
        `You need $${cost.toLocaleString()} for maintenance but only have $${player.money.toLocaleString()}`
      );
      return;
    }

    const confirmMessage = `Cost: $${cost.toLocaleString()}\nEstimated time: ${maintenanceHours} hours\n\nYour balance: $${player.money.toLocaleString()}\nAfter payment: $${(player.money - cost).toLocaleString()}`;

    popup.showConfirm(
      `Start Maintenance for ${ownedAircraft_instance.aircraft.name}?`,
      confirmMessage,
      async () => {
        const success = await startMaintenance(aircraftId, 'routine');
        if (success) {
          popup.showSuccess(
            'Maintenance Started',
            `Your ${ownedAircraft_instance.aircraft.name} will be ready in ${maintenanceHours} hours!`
          );
        } else {
          popup.showError(
            'Maintenance Failed',
            'Failed to start maintenance. Please try again.'
          );
        }
      }
    );
  };

  if (loading) {
    return <div className="loading">Loading hangar...</div>;
  }

  return (
    <div className="hangar-container">
      <div className="hangar-header">
        <h1>🏠 My Hangar</h1>
        <p className="subtitle">Manage your fleet of aircraft</p>
      </div>

      <div className="hangar-stats">
        <div className="hangar-stat">
          <span className="stat-label">Total Aircraft:</span>
          <span className="stat-value">{ownedAircraft.length}</span>
        </div>
        <div className="hangar-stat">
          <span className="stat-label">Fleet Value:</span>
          <span className="stat-value">
            ${ownedAircraft.reduce((sum, a) => sum + a.aircraft.price, 0).toLocaleString()}
          </span>
        </div>
      </div>

      {selectedAircraft && (
        <div className="selected-aircraft-banner">
          <div className="banner-icon">✈️</div>
          <div className="banner-content">
            <div className="banner-label">Currently Selected:</div>
            <div className="banner-aircraft">{selectedAircraft.name}</div>
          </div>
        </div>
      )}

      {ownedAircraft.length === 0 ? (
        <div className="empty-hangar">
          <div className="empty-icon">🏗️</div>
          <h2>Your hangar is empty</h2>
          <p>Visit the shop to purchase your first aircraft!</p>
        </div>
      ) : (
        <div className="aircraft-grid">
          {enrichedAircraft.map((enriched) => {
            const isDisabled = !enriched.isAtCurrentLocation;

            return (
              <div
                key={enriched.id}
                className={`aircraft-card-container ${isDisabled ? 'disabled' : ''}`}
              >
                <AircraftCard
                  aircraft={enriched.aircraft}
                  isOwned={true}
                  isSelected={player?.selectedAircraftId === enriched.id}
                  onSelect={isDisabled ? () => {} : () => handleSelect(enriched.id)}
                  onSell={isDisabled ? () => {} : () => handleSell(enriched.id)}
                  onMaintenance={isDisabled ? () => {} : () => handleMaintenance(enriched.id)}
                  maintenance={getAircraftMaintenance(enriched.id)}
                />

                {!enriched.isAtCurrentLocation && enriched.aircraftAirport && (
                  <div className="aircraft-remote-overlay">
                    <div className="remote-info">
                      <div className="remote-location">
                        📍 Parked at {enriched.aircraftAirport.icao} - {enriched.aircraftAirport.name}
                      </div>
                      <div className="remote-distance">
                        ✈️ {enriched.distance} NM away
                      </div>
                      <div className="remote-hint">
                        Travel to {enriched.aircraftAirport.icao} to use this aircraft
                      </div>
                    </div>
                  </div>
                )}

                {enriched.isAtCurrentLocation && player?.selectedAircraftId !== enriched.id && (
                  <div className="aircraft-available-badge">
                    ✅ Available
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Hangar;
