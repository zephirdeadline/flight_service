import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { usePopup } from '../context/PopupContext';
import { useSimConnect } from '../context/SimConnectContext';
import { ActiveMission, Aircraft, SimData } from '../types';
import { activeMissionService } from '../services/activeMissionService';
import { simConnectService } from '../services/simConnectService';
import './ActiveMissions.css';

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const KM_TO_NM = 0.539957;

const ActiveMissions: React.FC = () => {
  const { player, refreshPlayer, currentAirport, ownedAircraft } = usePlayer();
  const { isConnected: simConnected, lastData: simData } = useSimConnect();
  const popup = usePopup();
  const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [simPosition, setSimPosition] = useState<SimData | null>(null);
  const [payloadSentMap, setPayloadSentMap] = useState<Record<string, boolean>>({});
  const simPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadActiveMissions();
  }, [player]);

  // Polling position pour la progression (getPosition = données complètes)
  useEffect(() => {
    const poll = async () => {
      if (!simConnected) { setSimPosition(null); return; }
      try {
        const pos = await simConnectService.getPosition();
        setSimPosition(pos);
      } catch {
        setSimPosition(null);
      }
    };

    poll();
    simPollRef.current = setInterval(poll, 3000);
    return () => {
      if (simPollRef.current) clearInterval(simPollRef.current);
    };
  }, [simConnected]);

  const checkPreflight = (activeMission: ActiveMission, aircraft: Aircraft | undefined) => {
    if (!simConnected || !simPosition || !aircraft) {
      return { aircraftOk: false, payloadOk: false, actualPayload: 0, expectedPayload: 0, ready: false };
    }

    const mission = activeMission.mission;

    // Vérif avion : TITLE SimConnect (depuis lastData du context) === ID YAML (catalog ID)
    const aircraftOk = (simData?.aircraft_title ?? '') === aircraft.id;

    // Payload attendu
    const expectedPayload = mission.cargo
      ? mission.cargo.weight
      : mission.passengers ? mission.passengers.count * 80 : 0;

    // Payload réel : total - empty - fuel
    const actualPayload = Math.max(0, Math.round(
      simPosition.total_weight - simPosition.empty_weight - simPosition.fuel_weight
    ));

    // Tolérance 5%
    const tolerance = Math.max(10, expectedPayload * 0.05);
    const payloadOk = Math.abs(actualPayload - expectedPayload) <= tolerance;

    return { aircraftOk, payloadOk, actualPayload, expectedPayload, ready: aircraftOk && payloadOk };
  };

  const calculateMissionProgress = (activeMission: ActiveMission): { progress: number; distanceRemaining: number; canComplete: boolean } => {
    const mission = activeMission.mission;

    // Priorité : position SimConnect réelle
    if (simConnected && simPosition) {
      const distToDestKm = haversineKm(
        simPosition.latitude, simPosition.longitude,
        mission.toAirport.latitude, mission.toAirport.longitude,
      );

      if (distToDestKm <= 3) {
        return { progress: 100, distanceRemaining: 0, canComplete: true };
      }

      const distToDestNm = Math.round(distToDestKm * KM_TO_NM);
      const progress = Math.max(0, Math.min(99, Math.round(
        ((mission.distance - distToDestNm) / mission.distance) * 100
      )));

      return { progress, distanceRemaining: distToDestNm, canComplete: false };
    }

    // Fallback : aéroport actuel en DB
    if (!currentAirport) return { progress: 0, distanceRemaining: mission.distance, canComplete: false };

    if (currentAirport.id === mission.toAirport.id) {
      return { progress: 100, distanceRemaining: 0, canComplete: true };
    }

    if (currentAirport.id === mission.fromAirport.id) {
      return { progress: 0, distanceRemaining: mission.distance, canComplete: false };
    }

    const distKm = haversineKm(
      currentAirport.latitude, currentAirport.longitude,
      mission.toAirport.latitude, mission.toAirport.longitude,
    );
    const distNm = Math.round(distKm * KM_TO_NM);
    const progress = Math.max(0, Math.min(99, Math.round(
      ((mission.distance - distNm) / mission.distance) * 100
    )));

    return { progress, distanceRemaining: distNm, canComplete: false };
  };

  const loadActiveMissions = async () => {
    if (!player) return;

    setLoading(true);
    try {
      const missions = await activeMissionService.getActiveMissions(player.id);
      setActiveMissions(missions);

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
      ? `You will lose $${penalty.toLocaleString()} (${progress}% of the $${activeMission.mission.reward.toLocaleString()} reward)\n\nThis action cannot be undone.`
      : 'No penalty since you haven\'t started the mission yet.';

    const title = progress > 0 ? 'Cancel Mission with Penalty?' : 'Cancel Mission?';

    popup.showConfirm(
      title,
      confirmMessage,
      async () => {
        try {
          const actualPenalty = await activeMissionService.cancelMission(
            player.id,
            activeMissionId,
            progress
          );

          console.log('Mission cancelled. Penalty:', actualPenalty);

          if (actualPenalty > 0) {
            popup.showWarning(
              'Mission Cancelled',
              `Penalty of $${actualPenalty.toLocaleString()} has been deducted from your balance.`
            );
          } else {
            popup.showInfo('Mission Cancelled', 'The mission has been cancelled without penalty.');
          }

          // Recharger les missions et le joueur
          await loadActiveMissions();
          await refreshPlayer();
        } catch (error) {
          console.error('Error cancelling mission:', error);
          popup.showError(
            'Cancellation Failed',
            'Failed to cancel the mission. Please try again.'
          );
        }
      }
    );
  };

  const calculatePayloadWeights = (activeMission: ActiveMission, stationCount: number): number[] => {
    const mission = activeMission.mission;
    if (stationCount <= 0) return [];

    if (mission.passengers) {
      // 1 passager = 1 station, chaque station = 80 kg
      const usedStations = Math.min(mission.passengers.count, stationCount, 10);
      return Array.from({ length: usedStations }, () => 80);
    }

    if (mission.cargo) {
      // Cargo : poids réparti équitablement sur tous les slots
      const perStation = Math.round((mission.cargo.weight / stationCount) * 10) / 10;
      return Array.from({ length: stationCount }, () => perStation);
    }

    return [];
  };

  const handleSendPayload = async (activeMissionId: string, activeMission: ActiveMission) => {
    if (!simConnected || !simPosition) return;
    const stationCount = Math.max(1, Math.floor(simPosition.payload_station_count));
    const weights = calculatePayloadWeights(activeMission, stationCount);
    // Remettre à 0 les stations inutilisées (jusqu'à stationCount)
    const paddedWeights = [
      ...weights,
      ...Array(Math.max(0, stationCount - weights.length)).fill(0),
    ];
    try {
      await simConnectService.setPayload(paddedWeights);
      setPayloadSentMap(prev => ({ ...prev, [activeMissionId]: true }));
    } catch (error) {
      console.error('Error sending payload to MSFS:', error);
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
            const aircraft = ownedAircraft.find(o => o.id === activeMission.aircraftId)?.aircraft;
            const preflight = checkPreflight(activeMission, aircraft);
            const { progress, distanceRemaining, canComplete } = calculateMissionProgress(activeMission);

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

                {/* Payload Setup */}
                {(mission.passengers || mission.cargo) && (() => {
                  const stationCount = simConnected && simPosition
                    ? Math.max(1, Math.floor(simPosition.payload_station_count))
                    : 0;
                  const totalKg = mission.cargo
                    ? mission.cargo.weight
                    : (mission.passengers ? mission.passengers.count * 80 : 0);
                  const activeWeights = stationCount > 0
                    ? calculatePayloadWeights(activeMission, stationCount)
                    : [];
                  // Stations affichées = actives + vides pour compléter jusqu'à stationCount
                  const displayWeights = [
                    ...activeWeights,
                    ...Array(Math.max(0, stationCount - activeWeights.length)).fill(0),
                  ];
                  const wasSent = payloadSentMap[activeMission.id] ?? false;

                  return (
                    <div className="payload-setup">
                      <div className="payload-setup-header">
                        <h3 className="payload-setup-title">
                          {mission.type === 'passenger' ? '👥' : '📦'} Payload Setup
                        </h3>
                        {wasSent && <span className="payload-sent-badge">✓ Loaded</span>}
                      </div>

                      <div className="payload-setup-body">
                        <div className="payload-total-row">
                          <span className="payload-label">Total payload:</span>
                          <span className="payload-value">{totalKg.toLocaleString()} kg</span>
                        </div>

                        {simConnected && simPosition ? (
                          <>
                            <div className="payload-total-row">
                              <span className="payload-label">Stations:</span>
                              <span className="payload-value">{stationCount}</span>
                            </div>
                            <div className="payload-stations-grid">
                              {displayWeights.map((w, i) => (
                                <div key={i} className={`payload-station-item${w === 0 ? ' payload-station-item--empty' : ''}`}>
                                  <span className="station-label">Sta. {i + 1}</span>
                                  <span className="station-weight">{w} kg</span>
                                </div>
                              ))}
                            </div>
                            <button
                              className={`payload-send-btn${wasSent ? ' payload-send-btn--sent' : ''}`}
                              onClick={() => handleSendPayload(activeMission.id, activeMission)}
                            >
                              {wasSent ? '✓ Re-send to MSFS' : '📤 Load in MSFS'}
                            </button>
                          </>
                        ) : (
                          <p className="payload-no-sim">Connect MSFS to auto-configure payload stations</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {aircraft && (
                  <>
                    <div className="mission-aircraft">
                      <span className="aircraft-label">Aircraft:</span>
                      <span className="aircraft-name">{aircraft.manufacturer} {aircraft.name}</span>
                    </div>

                    {/* Aircraft Dashboard */}
                    <div className="aircraft-dashboard">
                      <h3 className="dashboard-title">
                        ✈️ Aircraft Status
                        {simConnected
                          ? <span className="dashboard-live-badge">📡 LIVE</span>
                          : <span className="dashboard-sim-badge">🗺️ Estimated</span>}
                      </h3>

                      <div className="dashboard-grid">
                        {/* Performance — données SimConnect si dispo, sinon specs */}
                        <div className="dashboard-section">
                          <h4>Performance</h4>
                          <div className="metric">
                            <span className="metric-label">Speed (IAS):</span>
                            <span className="metric-value">
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.airspeed_indicated)} kts`
                                : `${aircraft.cruiseSpeed} kts`}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Altitude:</span>
                            <span className="metric-value">
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.altitude).toLocaleString()} ft`
                                : `— ft`}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Vertical Speed:</span>
                            <span className="metric-value">
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.vertical_speed)} ft/min`
                                : `${aircraft.rateOfClimb} ft/min`}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">On Ground:</span>
                            <span className="metric-value">
                              {simConnected && simPosition
                                ? (simPosition.sim_on_ground ? 'Yes' : 'No')
                                : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Fuel — données SimConnect si dispo */}
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
                            <span className="metric-label">Remaining:</span>
                            <span className="metric-value fuel-remaining">
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.fuel_total_quantity)} L`
                                : `${Math.round(aircraft.fuelCapacity * (1 - progress / 100))} L`}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Endurance:</span>
                            <span className="metric-value">
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.fuel_total_quantity / aircraft.fuelConsumption * 10) / 10} h`
                                : `${Math.round(aircraft.fuelCapacity / aircraft.fuelConsumption * 10) / 10} h`}
                            </span>
                          </div>
                        </div>

                        {/* Weight */}
                        <div className="dashboard-section">
                          <h4>Weight</h4>
                          <div className="metric">
                            <span className="metric-label">Empty:</span>
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
                            <span className="metric-label">Total:</span>
                            <span className="metric-value">
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.total_weight).toLocaleString()} kg`
                                : `${(aircraft.emptyWeight + (mission.cargo?.weight || (mission.passengers ? mission.passengers.count * 80 : 0))).toLocaleString()} kg`}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Max Takeoff:</span>
                            <span className="metric-value">{aircraft.maxTakeoffWeight.toLocaleString()} kg</span>
                          </div>
                        </div>

                        {/* Dimensions */}
                        <div className="dashboard-section">
                          <h4>Specs</h4>
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

                {/* Checklist pré-vol — affiché uniquement si SimConnect connecté */}
                {simConnected && (
                  <div className={`preflight-checklist ${preflight.ready ? 'preflight-ready' : 'preflight-pending'}`}>
                    <div className="preflight-title">Pre-flight checklist</div>
                    <div className={`preflight-item ${preflight.aircraftOk ? 'ok' : 'fail'}`}>
                      {preflight.aircraftOk ? '✅' : '❌'} Aircraft
                      {!preflight.aircraftOk && aircraft && (
                        <span className="preflight-hint"> — Load <strong>{aircraft.name}</strong> ({aircraft.id})</span>
                      )}
                    </div>
                    <div className={`preflight-item ${preflight.payloadOk ? 'ok' : 'fail'}`}>
                      {preflight.payloadOk ? '✅' : '❌'} Payload
                      <span className="preflight-hint">
                        {' '}{preflight.actualPayload} kg / {preflight.expectedPayload} kg required
                      </span>
                    </div>
                  </div>
                )}

                <div className="mission-actions">
                  {canComplete || activeMission.status === 'ready_to_complete' ? (
                    <button
                      className="complete-btn"
                      onClick={() => handleCompleteMission(activeMission.id)}
                    >
                      ✅ Complete Mission
                    </button>
                  ) : simConnected && !preflight.ready ? (
                    <div className="preflight-blocked">
                      Complete pre-flight checklist to start mission
                    </div>
                  ) : (
                    <div className="mission-progress">
                      <div className="progress-info">
                        <span>
                          {simConnected ? '📡' : '🗺️'} {progress}%
                        </span>
                        <span className="distance-remaining">
                          {distanceRemaining} NM remaining
                        </span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }} />
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
