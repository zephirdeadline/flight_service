import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { ActiveMission, Aircraft } from '../types';
import { aircraftService } from '../services/aircraftService';
import { activeMissionService } from '../services/activeMissionService';
import './ActiveMissions.css';

// Calculer la distance entre deux points (formule haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3440; // Rayon de la Terre en miles nautiques
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const ActiveMissions: React.FC = () => {
  const { player, refreshPlayer, currentAirport } = usePlayer();
  const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
  const [aircraftMap, setAircraftMap] = useState<Record<string, Aircraft>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveMissions();
  }, [player]);

  const calculateMissionProgress = (activeMission: ActiveMission) => {
    if (!currentAirport) return { progress: 0, distanceRemaining: activeMission.mission.distance };

    const mission = activeMission.mission;

    // Si on est à l'aéroport de destination, mission terminée
    if (currentAirport.id === mission.toAirport.id) {
      return { progress: 100, distanceRemaining: 0 };
    }

    // Si on est à l'aéroport de départ, mission non commencée
    if (currentAirport.id === mission.fromAirport.id) {
      return { progress: 0, distanceRemaining: mission.distance };
    }

    // Calculer la distance restante depuis la position actuelle
    const distanceRemaining = calculateDistance(
      currentAirport.latitude,
      currentAirport.longitude,
      mission.toAirport.latitude,
      mission.toAirport.longitude
    );

    // Calculer la progression en %
    const progress = Math.max(0, Math.min(100, ((mission.distance - distanceRemaining) / mission.distance) * 100));

    return { progress: Math.round(progress), distanceRemaining: Math.round(distanceRemaining) };
  };

  const loadActiveMissions = async () => {
    if (!player) return;

    setLoading(true);
    try {
      const missions = await activeMissionService.getActiveMissions(player.id);
      setActiveMissions(missions);

      // Charger les avions utilisés
      const aircraftIds = [...new Set(missions.map(m => m.aircraftId))];
      if (aircraftIds.length > 0) {
        const aircraft = await aircraftService.getAircraftByIds(aircraftIds);
        const map: Record<string, Aircraft> = {};
        aircraft.forEach(a => map[a.id] = a);
        setAircraftMap(map);
      }
    } catch (error) {
      console.error('Error loading active missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMission = async (activeMissionId: string) => {
    if (!player) return;

    try {
      const reward = await activeMissionService.completeMission(player.id, activeMissionId);
      console.log('Mission completed! Reward:', reward);

      // Recharger les missions et le joueur
      await loadActiveMissions();
      await refreshPlayer();
    } catch (error) {
      console.error('Error completing mission:', error);
    }
  };

  const handleCancelMission = async (activeMissionId: string) => {
    if (!player) return;

    const activeMission = activeMissions.find(m => m.id === activeMissionId);
    if (!activeMission) return;

    // Calculer la progression actuelle
    const { progress } = calculateMissionProgress(activeMission);
    const penalty = Math.round((activeMission.mission.reward * progress) / 100);

    // Confirmation avec affichage de la pénalité
    const confirmMessage = progress > 0
      ? `Cancel this mission?\n\nPenalty: $${penalty.toLocaleString()} (${progress}% of reward)`
      : 'Cancel this mission?\n\nNo penalty (mission not started yet)';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const actualPenalty = await activeMissionService.cancelMission(
        player.id,
        activeMissionId,
        progress
      );

      console.log('Mission cancelled. Penalty:', actualPenalty);

      // Recharger les missions et le joueur
      await loadActiveMissions();
      await refreshPlayer();
    } catch (error) {
      console.error('Error cancelling mission:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading active missions...</div>;
  }

  return (
    <div className="active-missions-container">
      <div className="active-missions-header">
        <h1>Active Missions</h1>
        <p className="subtitle">
          Missions currently in progress ({activeMissions.length})
        </p>
      </div>

      {activeMissions.length === 0 ? (
        <div className="no-active-missions">
          <div className="no-missions-icon">📋</div>
          <h2>No active missions</h2>
          <p>Accept a mission from the missions page to get started!</p>
        </div>
      ) : (
        <div className="active-missions-grid">
          {activeMissions.map((activeMission) => {
            const mission = activeMission.mission;
            const aircraft = aircraftMap[activeMission.aircraftId];
            const { progress, distanceRemaining } = calculateMissionProgress(activeMission);

            return (
              <div key={activeMission.id} className="active-mission-card">
                <div className="mission-header">
                  <div className="mission-type">
                    {mission.type === 'passenger' ? '👥' : '📦'} {mission.type}
                  </div>
                  <div className="mission-status">
                    {activeMission.status === 'ready_to_complete' ? '✅ Ready' : '✈️ In Progress'}
                  </div>
                </div>

                <div className="mission-route">
                  <div className="airport">
                    <strong>{mission.fromAirport.icao}</strong>
                    <div className="airport-name">{mission.fromAirport.name}</div>
                  </div>
                  <div className="route-arrow">→</div>
                  <div className="airport">
                    <strong>{mission.toAirport.icao}</strong>
                    <div className="airport-name">{mission.toAirport.name}</div>
                  </div>
                </div>

                <div className="mission-details">
                  <div className="detail-item">
                    <span className="detail-label">Distance:</span>
                    <span className="detail-value">{mission.distance} NM</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Reward:</span>
                    <span className="detail-value reward">${mission.reward.toLocaleString()}</span>
                  </div>
                  {mission.passengers && (
                    <div className="detail-item">
                      <span className="detail-label">Passengers:</span>
                      <span className="detail-value">{mission.passengers.count}</span>
                    </div>
                  )}
                  {mission.cargo && (
                    <div className="detail-item">
                      <span className="detail-label">Cargo:</span>
                      <span className="detail-value">{mission.cargo.weight} kg - {mission.cargo.description}</span>
                    </div>
                  )}
                </div>

                {aircraft && (
                  <>
                    <div className="mission-aircraft">
                      <span className="aircraft-label">Aircraft:</span>
                      <span className="aircraft-name">{aircraft.manufacturer} {aircraft.name}</span>
                    </div>

                    {/* Aircraft Dashboard */}
                    <div className="aircraft-dashboard">
                      <h3 className="dashboard-title">✈️ Aircraft Status</h3>

                      <div className="dashboard-grid">
                        {/* Performance Metrics */}
                        <div className="dashboard-section">
                          <h4>Performance</h4>
                          <div className="metric">
                            <span className="metric-label">Current Speed:</span>
                            <span className="metric-value">{aircraft.cruiseSpeed} kts</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Max Speed:</span>
                            <span className="metric-value">{aircraft.maxSpeed} kts</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Altitude:</span>
                            <span className="metric-value">{Math.round(aircraft.serviceCeiling * 0.7).toLocaleString()} ft</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Rate of Climb:</span>
                            <span className="metric-value">{aircraft.rateOfClimb} ft/min</span>
                          </div>
                        </div>

                        {/* Fuel Status */}
                        <div className="dashboard-section">
                          <h4>Fuel</h4>
                          <div className="metric">
                            <span className="metric-label">Capacity:</span>
                            <span className="metric-value">{aircraft.fuelCapacity} L</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Consumption:</span>
                            <span className="metric-value">{aircraft.fuelConsumption} L/h</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Flight Time:</span>
                            <span className="metric-value">
                              {Math.round(aircraft.fuelCapacity / aircraft.fuelConsumption * 10) / 10}h
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Remaining:</span>
                            <span className="metric-value fuel-remaining">
                              {Math.round(aircraft.fuelCapacity * (1 - progress / 100))} L ({Math.round(100 - progress)}%)
                            </span>
                          </div>
                        </div>

                        {/* Weight Information */}
                        <div className="dashboard-section">
                          <h4>Weight</h4>
                          <div className="metric">
                            <span className="metric-label">Empty Weight:</span>
                            <span className="metric-value">{aircraft.emptyWeight.toLocaleString()} kg</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Payload:</span>
                            <span className="metric-value">
                              {mission.cargo
                                ? `${mission.cargo.weight.toLocaleString()} kg`
                                : mission.passengers
                                  ? `${(mission.passengers.count * 80).toLocaleString()} kg`
                                  : '0 kg'}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Current Weight:</span>
                            <span className="metric-value">
                              {(aircraft.emptyWeight + (mission.cargo?.weight || (mission.passengers ? mission.passengers.count * 80 : 0))).toLocaleString()} kg
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Max Takeoff:</span>
                            <span className="metric-value">{aircraft.maxTakeoffWeight.toLocaleString()} kg</span>
                          </div>
                        </div>

                        {/* Aircraft Dimensions */}
                        <div className="dashboard-section">
                          <h4>Dimensions</h4>
                          <div className="metric">
                            <span className="metric-label">Wingspan:</span>
                            <span className="metric-value">{aircraft.wingspan} m</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Length:</span>
                            <span className="metric-value">{aircraft.length} m</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Range:</span>
                            <span className="metric-value">{aircraft.range} NM</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Service Ceiling:</span>
                            <span className="metric-value">{aircraft.serviceCeiling.toLocaleString()} ft</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="mission-actions">
                  {progress === 100 || activeMission.status === 'ready_to_complete' ? (
                    <button
                      className="complete-btn"
                      onClick={() => handleCompleteMission(activeMission.id)}
                    >
                      Complete Mission
                    </button>
                  ) : (
                    <div className="mission-progress">
                      <div className="progress-info">
                        <span>In Progress ({progress}%)</span>
                        <span className="distance-remaining">
                          {distanceRemaining} NM remaining
                        </span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  )}
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancelMission(activeMission.id)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveMissions;
