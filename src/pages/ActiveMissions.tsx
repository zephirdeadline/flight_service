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
const PILOT_WEIGHT = 80;

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
    const aircraftOk = (simData?.aircraft_title ?? '') === aircraft.id;
    const expectedPayload = PILOT_WEIGHT + (mission.cargo
      ? mission.cargo.weight
      : mission.passengers ? mission.passengers.count * PILOT_WEIGHT : 0);
    const actualPayload = Math.max(0, Math.round(
      simPosition.total_weight - simPosition.empty_weight - simPosition.fuel_weight
    ));
    const tolerance = Math.max(10, expectedPayload * 0.05);
    const payloadOk = Math.abs(actualPayload - expectedPayload) <= tolerance;
    return { aircraftOk, payloadOk, actualPayload, expectedPayload, ready: aircraftOk && payloadOk };
  };

  const calculateMissionProgress = (activeMission: ActiveMission): { progress: number; distanceRemaining: number; canComplete: boolean } => {
    const mission = activeMission.mission;

    if (simConnected && simPosition) {
      const distToDestKm = haversineKm(
        simPosition.latitude, simPosition.longitude,
        mission.toAirport.latitude, mission.toAirport.longitude,
      );
      if (distToDestKm <= 3) return { progress: 100, distanceRemaining: 0, canComplete: true };
      const distToDestNm = Math.round(distToDestKm * KM_TO_NM);
      const progress = Math.max(0, Math.min(99, Math.round(
        ((mission.distance - distToDestNm) / mission.distance) * 100
      )));
      return { progress, distanceRemaining: distToDestNm, canComplete: false };
    }

    if (!currentAirport) return { progress: 0, distanceRemaining: mission.distance, canComplete: false };
    if (currentAirport.id === mission.toAirport.id) return { progress: 100, distanceRemaining: 0, canComplete: true };
    if (currentAirport.id === mission.fromAirport.id) return { progress: 0, distanceRemaining: mission.distance, canComplete: false };

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
      await activeMissionService.completeMission(player.id, activeMissionId);
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
    const { progress } = calculateMissionProgress(activeMission);
    const penalty = Math.round((activeMission.mission.reward * progress) / 100);
    const confirmMessage = progress > 0
      ? `You will lose $${penalty.toLocaleString()} (${progress}% of the $${activeMission.mission.reward.toLocaleString()} reward)\n\nThis action cannot be undone.`
      : 'No penalty since you haven\'t started the mission yet.';

    popup.showConfirm(
      progress > 0 ? 'Cancel Mission with Penalty?' : 'Cancel Mission?',
      confirmMessage,
      async () => {
        try {
          const actualPenalty = await activeMissionService.cancelMission(player.id, activeMissionId, progress);
          if (actualPenalty > 0) {
            popup.showWarning('Mission Cancelled', `Penalty of $${actualPenalty.toLocaleString()} has been deducted.`);
          } else {
            popup.showInfo('Mission Cancelled', 'The mission has been cancelled without penalty.');
          }
          await loadActiveMissions();
          await refreshPlayer();
        } catch (error) {
          console.error('Error cancelling mission:', error);
          popup.showError('Cancellation Failed', 'Failed to cancel the mission. Please try again.');
        }
      }
    );
  };

  const calculatePayloadWeights = (activeMission: ActiveMission, stationCount: number): number[] => {
    const mission = activeMission.mission;
    if (stationCount <= 0) return [];
    if (mission.passengers) {
      const passengerStations = Math.min(mission.passengers.count, stationCount - 1, 9);
      return [PILOT_WEIGHT, ...Array.from({ length: passengerStations }, () => PILOT_WEIGHT)];
    }
    if (mission.cargo) {
      const cargoStations = stationCount - 1;
      if (cargoStations <= 0) return [PILOT_WEIGHT];
      const perStation = Math.round((mission.cargo.weight / cargoStations) * 10) / 10;
      return [PILOT_WEIGHT, ...Array.from({ length: cargoStations }, () => perStation)];
    }
    return [PILOT_WEIGHT];
  };

  const handleSendPayload = async (activeMissionId: string, activeMission: ActiveMission) => {
    if (!simConnected || !simPosition) return;
    const stationCount = Math.max(1, Math.floor(simPosition.payload_station_count));
    const weights = calculatePayloadWeights(activeMission, stationCount);
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

  if (loading) return <div className="loading">Loading active missions...</div>;

  return (
    <div className="active-missions-container">
{activeMissions.length === 0 ? (
        <div className="no-active-missions">
          <div className="no-missions-icon">📋</div>
          <h2>No active missions</h2>
          <p>Accept a mission from the missions page to get started!</p>
        </div>
      ) : (
        <div className="missions-list">
          {activeMissions.map((activeMission) => {
            const mission = activeMission.mission;
            const aircraft = ownedAircraft.find(o => o.id === activeMission.aircraftId)?.aircraft;
            const preflight = checkPreflight(activeMission, aircraft);
            const { progress, distanceRemaining, canComplete } = calculateMissionProgress(activeMission);
            const expectedPayload = PILOT_WEIGHT + (mission.cargo
              ? mission.cargo.weight
              : mission.passengers ? mission.passengers.count * PILOT_WEIGHT : 0);
            const total = simConnected && simPosition
              ? Math.round(simPosition.total_weight)
              : aircraft ? aircraft.emptyWeight + expectedPayload : 0;
            const margin = aircraft ? aircraft.maxTakeoffWeight - total : 0;
            const stationCount = simConnected && simPosition
              ? Math.max(1, Math.floor(simPosition.payload_station_count)) : 0;
            const payloadWeights = stationCount > 0 ? calculatePayloadWeights(activeMission, stationCount) : [];
            const displayWeights = [
              ...payloadWeights,
              ...Array(Math.max(0, stationCount - payloadWeights.length)).fill(0),
            ];
            const wasSent = payloadSentMap[activeMission.id] ?? false;

            return (
              <div key={activeMission.id} className="mission-card">

                {/* ── TOP BAR ── */}
                <div style={{
                  backgroundColor: '#1a3a6b',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}>
                  {/* Route */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Départ */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white', fontFamily: 'monospace', lineHeight: 1 }}>
                        {mission.fromAirport.icao}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.2rem' }}>
                        {mission.fromAirport.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                        {mission.fromAirport.city}, {mission.fromAirport.country}
                      </div>
                    </div>

                    {/* Flèche centrale */}
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)', minWidth: '100px' }}>
                      <div style={{ fontSize: '0.78rem', marginBottom: '0.3rem', fontWeight: 600 }}>
                        {mission.distance} NM
                      </div>
                      <div style={{ borderTop: '2px solid rgba(255,255,255,0.3)', position: 'relative', marginTop: '0.5rem' }}>
                        <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.2rem' }}>✈️</span>
                      </div>
                    </div>

                    {/* Arrivée */}
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white', fontFamily: 'monospace', lineHeight: 1 }}>
                        {mission.toAirport.icao}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.2rem' }}>
                        {mission.toAirport.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                        {mission.toAirport.city}, {mission.toAirport.country}
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {[
                      { label: mission.type === 'passenger' ? '👥 Passenger' : '📦 Cargo', bg: 'rgba(255,255,255,0.15)' },
                      { label: `💰 $${mission.reward.toLocaleString()}`, bg: 'rgba(39,174,96,0.35)' },
                      mission.passengers ? { label: `👤 ${mission.passengers.count} pax`, bg: 'rgba(255,255,255,0.12)' } : null,
                      mission.cargo ? { label: `📦 ${mission.cargo.weight} kg — ${mission.cargo.description}`, bg: 'rgba(255,255,255,0.12)' } : null,
                      aircraft ? { label: `✈️ ${aircraft.name}`, bg: 'rgba(255,255,255,0.12)' } : null,
                      { label: canComplete ? '✅ Ready to complete' : '🛫 In Progress', bg: canComplete ? 'rgba(39,174,96,0.4)' : 'rgba(52,152,219,0.35)' },
                    ].filter(Boolean).map((badge, i) => (
                      <span key={i} style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'white',
                        backgroundColor: badge!.bg,
                      }}>
                        {badge!.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── MAIN CONTENT ── */}
                <div className="mission-body">

                  {/* COL 1 — Progress + Preflight + Actions */}
                  <div className="mission-col mission-col--left">

                    {/* Progress */}
                    <div className="section-block">
                      <div className="section-title">
                        {simConnected ? '📡 Live Progress' : '🗺️ Estimated Progress'}
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="progress-labels">
                        <span className="progress-pct">{progress}%</span>
                        <span className="progress-remaining">{distanceRemaining} NM remaining</span>
                      </div>
                    </div>

                    {/* Preflight */}
                    {simConnected && (
                      <div className={`section-block preflight-block ${preflight.ready ? 'preflight-ready' : 'preflight-pending'}`}>
                        <div className="section-title">Pre-flight Checklist</div>
                        <div className={`preflight-row ${preflight.aircraftOk ? 'ok' : 'fail'}`}>
                          <span>{preflight.aircraftOk ? '✅' : '❌'} Aircraft</span>
                          {!preflight.aircraftOk && aircraft && (
                            <span className="preflight-sub">Load: {aircraft.name}</span>
                          )}
                        </div>
                        <div className={`preflight-row ${preflight.payloadOk ? 'ok' : 'fail'}`}>
                          <span>{preflight.payloadOk ? '✅' : '❌'} Payload</span>
                          <span className="preflight-sub">{preflight.actualPayload} / {preflight.expectedPayload} kg</span>
                        </div>
                      </div>
                    )}

                    {/* Payload setup */}
                    <div className="section-block payload-block">
                      <div className="section-title">
                        {mission.type === 'passenger' ? '👥' : '📦'} Payload Setup
                        {wasSent && <span className="sent-badge">✓ Loaded</span>}
                      </div>
                      <div className="payload-summary">
                        <span>Total: <strong>{expectedPayload} kg</strong></span>
                        <span className="payload-sub">pilot + {mission.cargo ? `${mission.cargo.weight} kg cargo` : mission.passengers ? `${mission.passengers.count} pax` : '—'}</span>
                      </div>
                      {simConnected && simPosition ? (
                        <>
                          <div className="payload-stations">
                            {displayWeights.map((w, i) => (
                              <div key={i} className={`payload-chip ${w === 0 ? 'payload-chip--empty' : i === 0 ? 'payload-chip--pilot' : ''}`}>
                                <span>{i === 0 ? '👤' : 'Sta.'} {i === 0 ? '' : i + 1}</span>
                                <strong>{w} kg</strong>
                              </div>
                            ))}
                          </div>
                          <button
                            className={`payload-btn ${wasSent ? 'payload-btn--sent' : ''}`}
                            onClick={() => handleSendPayload(activeMission.id, activeMission)}
                          >
                            {wasSent ? '✓ Re-send to MSFS' : '📤 Load in MSFS'}
                          </button>
                        </>
                      ) : (
                        <p className="payload-nosim">Connect MSFS to configure payload</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mission-actions">
                      {canComplete || activeMission.status === 'ready_to_complete' ? (
                        <button className="complete-btn" onClick={() => handleCompleteMission(activeMission.id)}>
                          ✅ Complete Mission
                        </button>
                      ) : simConnected && !preflight.ready ? (
                        <div className="preflight-blocked">Complete pre-flight checklist to start</div>
                      ) : (
                        <div className="in-progress-label">Mission in progress…</div>
                      )}
                      <button className="cancel-btn" onClick={() => handleCancelMission(activeMission.id)}>
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* COL 2 — Live Aircraft Data */}
                  {aircraft && (
                    <div className="mission-col mission-col--right">
                      <div className="live-header">
                        <span>✈️ {aircraft.manufacturer} {aircraft.name}</span>
                        {simConnected
                          ? <span className="live-badge">📡 LIVE</span>
                          : <span className="est-badge">🗺️ Est.</span>}
                      </div>

                      <div className="live-grid">
                        {/* Performance */}
                        <div className="live-section">
                          <div className="live-section-title">Performance</div>
                          <div className="live-metric">
                            <span>Speed (IAS)</span>
                            <strong>{simConnected && simPosition ? `${Math.round(simPosition.airspeed_indicated)} kts` : `${aircraft.cruiseSpeed} kts`}</strong>
                          </div>
                          <div className="live-metric">
                            <span>Altitude</span>
                            <strong>{simConnected && simPosition ? `${Math.round(simPosition.altitude).toLocaleString()} ft` : '— ft'}</strong>
                          </div>
                          <div className="live-metric">
                            <span>Vertical Speed</span>
                            <strong>{simConnected && simPosition ? `${Math.round(simPosition.vertical_speed)} ft/min` : `${aircraft.rateOfClimb} ft/min`}</strong>
                          </div>
                          <div className="live-metric">
                            <span>On Ground</span>
                            <strong>{simConnected && simPosition ? (simPosition.sim_on_ground ? 'Yes' : 'No') : '—'}</strong>
                          </div>
                        </div>

                        {/* Fuel */}
                        <div className="live-section">
                          <div className="live-section-title">Fuel</div>
                          <div className="live-metric">
                            <span>Remaining</span>
                            <strong className="metric-green">
                              {simConnected && simPosition ? `${Math.round(simPosition.fuel_total_quantity)} L` : `${aircraft.fuelCapacity} L`}
                            </strong>
                          </div>
                          <div className="live-metric">
                            <span>Consumption</span>
                            <strong>{aircraft.fuelConsumption} L/h</strong>
                          </div>
                          <div className="live-metric">
                            <span>Endurance</span>
                            <strong>
                              {simConnected && simPosition
                                ? `${(simPosition.fuel_total_quantity / aircraft.fuelConsumption).toFixed(1)} h`
                                : `${(aircraft.fuelCapacity / aircraft.fuelConsumption).toFixed(1)} h`}
                            </strong>
                          </div>
                        </div>

                        {/* Weight — section mise en avant */}
                        <div className="live-section live-section--weight">
                          <div className="live-section-title">Weight</div>
                          <div className="live-metric">
                            <span>Empty</span>
                            <strong>{aircraft.emptyWeight.toLocaleString()} kg</strong>
                          </div>
                          <div className="live-metric">
                            <span>Payload (pilot incl.)</span>
                            <strong>{expectedPayload.toLocaleString()} kg</strong>
                          </div>
                          <div className="live-metric">
                            <span>Fuel</span>
                            <strong className="metric-green">
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.fuel_weight).toLocaleString()} kg`
                                : `~${Math.round(aircraft.fuelCapacity * 0.8).toLocaleString()} kg`}
                            </strong>
                          </div>
                          <div className="live-metric">
                            <span>Total</span>
                            <strong>{total.toLocaleString()} kg</strong>
                          </div>
                          <div className="live-metric">
                            <span>Max Takeoff</span>
                            <strong>{aircraft.maxTakeoffWeight.toLocaleString()} kg</strong>
                          </div>
                          <div className="live-metric weight-margin">
                            <span>Margin</span>
                            <strong style={{ color: margin < 0 ? '#e74c3c' : margin < aircraft.maxTakeoffWeight * 0.05 ? '#e67e22' : '#27ae60' }}>
                              {margin >= 0 ? '+' : ''}{margin.toLocaleString()} kg
                            </strong>
                          </div>
                          {margin < 0 && (
                            <div className="overweight-warning">⚠️ OVERWEIGHT</div>
                          )}
                        </div>

                        {/* Specs */}
                        <div className="live-section">
                          <div className="live-section-title">Specs</div>
                          <div className="live-metric">
                            <span>Range</span>
                            <strong>{aircraft.range} NM</strong>
                          </div>
                          <div className="live-metric">
                            <span>Ceiling</span>
                            <strong>{aircraft.serviceCeiling.toLocaleString()} ft</strong>
                          </div>
                          <div className="live-metric">
                            <span>Wingspan</span>
                            <strong>{aircraft.wingspan} m</strong>
                          </div>
                          <div className="live-metric">
                            <span>Length</span>
                            <strong>{aircraft.length} m</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
