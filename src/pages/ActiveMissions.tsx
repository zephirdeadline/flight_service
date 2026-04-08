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
  const [payloadModeMap, setPayloadModeMap] = useState<Record<string, 'equal' | 'custom'>>({});
  const [customPctMap, setCustomPctMap] = useState<Record<string, number[]>>({});
  // paxStationMap: pour chaque mission, tableau indexé par passager → index de station siège (parmi seatIndices)
  const [paxStationMap, setPaxStationMap] = useState<Record<string, number[]>>({});
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
      return { aircraftOk: false, simTitle: '', payloadOk: false, actualPayload: 0, expectedPayload: 0, ready: false };
    }
    const simTitle = simData?.aircraft_title?.trim() ?? '';
    // aircraft.id = titre SimConnect exact (cf. aircraft.yaml)
    const aircraftOk = simTitle !== '' && simTitle === aircraft.id.trim();
    const expectedPayload = PILOT_WEIGHT + getMissionPayload(activeMission);
    // Somme directe des stations SimConnect — évite les 11 kg d'huile/fluides internes MSFS
    const stationCount = Math.max(1, Math.floor(simPosition.payload_station_count));
    const actualPayload = Math.round([
      simPosition.payload_station_weight_1,  simPosition.payload_station_weight_2,
      simPosition.payload_station_weight_3,  simPosition.payload_station_weight_4,
      simPosition.payload_station_weight_5,  simPosition.payload_station_weight_6,
      simPosition.payload_station_weight_7,  simPosition.payload_station_weight_8,
      simPosition.payload_station_weight_9,  simPosition.payload_station_weight_10,
      simPosition.payload_station_weight_11, simPosition.payload_station_weight_12,
      simPosition.payload_station_weight_13, simPosition.payload_station_weight_14,
      simPosition.payload_station_weight_15, simPosition.payload_station_weight_16,
      simPosition.payload_station_weight_17, simPosition.payload_station_weight_18,
      simPosition.payload_station_weight_19, simPosition.payload_station_weight_20,
    ].slice(0, stationCount).reduce((s, w) => s + w, 0));
    const tolerance = Math.max(10, expectedPayload * 0.05);
    const payloadOk = Math.abs(actualPayload - expectedPayload) <= tolerance;
    return { aircraftOk, simTitle, payloadOk, actualPayload, expectedPayload, ready: aircraftOk && payloadOk };
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

  // Payload total hors pilote
  const getMissionPayload = (activeMission: ActiveMission): number => {
    const mission = activeMission.mission;
    if (mission.cargo) return mission.cargo.weight;
    if (mission.passengers) return mission.passengers.list.reduce((s, p) => s + p.weight + p.baggage, 0);
    return 0;
  };

  const isSeatStationName = (name: string): boolean => {
    if (!name) return false;
    return /pax|passenger|seat|crew|pilot|pilote|person|adult|child|infant|occupant|passager|copilote/i.test(name);
  };

  const getStationTypes = (simPos: typeof simPosition, stationCount: number): ('seat' | 'cargo')[] => {
    const names = simPos ? [
      simPos.payload_station_name_1,  simPos.payload_station_name_2,
      simPos.payload_station_name_3,  simPos.payload_station_name_4,
      simPos.payload_station_name_5,  simPos.payload_station_name_6,
      simPos.payload_station_name_7,  simPos.payload_station_name_8,
      simPos.payload_station_name_9,  simPos.payload_station_name_10,
      simPos.payload_station_name_11, simPos.payload_station_name_12,
      simPos.payload_station_name_13, simPos.payload_station_name_14,
      simPos.payload_station_name_15, simPos.payload_station_name_16,
      simPos.payload_station_name_17, simPos.payload_station_name_18,
      simPos.payload_station_name_19, simPos.payload_station_name_20,
    ] : [];
    return Array.from({ length: stationCount }, (_, i) =>
      isSeatStationName(names[i] ?? '') ? 'seat' : 'cargo'
    ) as ('seat' | 'cargo')[];
  };

  const calculateEqualWeights = (activeMissionId: string, activeMission: ActiveMission, stationCount: number, _aircraftId: string): number[] => {
    if (stationCount <= 0) return [];
    const isPassenger = activeMission.mission.type === 'passenger';
    const stationTypes = getStationTypes(simPosition, stationCount);

    if (isPassenger && activeMission.mission.passengers) {
      const paxList = activeMission.mission.passengers.list;
      const seatIndices = Array.from({ length: stationCount - 1 }, (_, i) => i + 1).filter(i => stationTypes[i] === 'seat');
      const assignment = getPaxAssignment(activeMissionId, paxList.length, seatIndices.length);
      const seatWeights: Record<number, number> = {};
      seatIndices.forEach(si => { seatWeights[si] = 0; });
      paxList.forEach((pax, i) => {
        const si = seatIndices[assignment[i] ?? 0] ?? seatIndices[0];
        if (si !== undefined) seatWeights[si] = (seatWeights[si] ?? 0) + pax.weight + pax.baggage;
      });
      return Array.from({ length: stationCount }, (_, i) => {
        if (i === 0) return PILOT_WEIGHT;
        return seatWeights[i] ?? 0;
      });
    }

    // Cargo mission : tout distribué sur toutes les stations non-pilote
    const payload = getMissionPayload(activeMission);
    const allIndices = Array.from({ length: stationCount - 1 }, (_, i) => i + 1);
    const perStation = allIndices.length > 0 ? Math.round((payload / allIndices.length) * 10) / 10 : 0;
    return Array.from({ length: stationCount }, (_, i) => i === 0 ? PILOT_WEIGHT : perStation);
  };

  // Retourne l'assignation passager→station (index dans seatIndices), initialisée cycliquement
  const getPaxAssignment = (missionId: string, paxCount: number, seatCount: number): number[] => {
    const saved = paxStationMap[missionId];
    if (saved && saved.length === paxCount) return saved;
    return Array.from({ length: paxCount }, (_, i) => i % Math.max(1, seatCount));
  };

  const getCustomWeights = (activeMissionId: string, activeMission: ActiveMission, stationCount: number, _aircraftId: string): number[] => {
    const isPassenger = activeMission.mission.type === 'passenger';
    const stationTypes = getStationTypes(simPosition, stationCount);

    if (isPassenger && activeMission.mission.passengers) {
      const paxList = activeMission.mission.passengers.list;
      const seatIndices = Array.from({ length: stationCount - 1 }, (_, i) => i + 1).filter(i => stationTypes[i] === 'seat');
      const assignment = getPaxAssignment(activeMissionId, paxList.length, seatIndices.length);
      const seatWeights: Record<number, number> = {};
      seatIndices.forEach(si => { seatWeights[si] = 0; });
      paxList.forEach((pax, i) => {
        const seatIdx = seatIndices[assignment[i] ?? 0] ?? seatIndices[0];
        if (seatIdx !== undefined) seatWeights[seatIdx] = (seatWeights[seatIdx] ?? 0) + pax.weight + pax.baggage;
      });
      return Array.from({ length: stationCount }, (_, i) => {
        if (i === 0) return PILOT_WEIGHT;
        return seatWeights[i] ?? 0;
      });
    }

    const pcts = customPctMap[activeMissionId] ?? Array(Math.max(0, stationCount - 1)).fill(0);
    const payload = getMissionPayload(activeMission);
    return Array.from({ length: stationCount }, (_, i) => {
      if (i === 0) return PILOT_WEIGHT;
      return Math.round(((pcts[i - 1] ?? 0) / 100) * payload * 10) / 10;
    });
  };

  const handleSetPayloadMode = (activeMissionId: string, mode: 'equal' | 'custom', stationCount: number) => {
    setPayloadModeMap(prev => ({ ...prev, [activeMissionId]: mode }));
    if (mode === 'custom' && !customPctMap[activeMissionId]) {
      setCustomPctMap(prev => ({
        ...prev,
        [activeMissionId]: Array(Math.max(0, stationCount - 1)).fill(0),
      }));
    }
  };

  const handleCustomPctChange = (activeMissionId: string, stationIndex: number, value: number) => {
    setCustomPctMap(prev => {
      const pcts = [...(prev[activeMissionId] ?? [])];
      pcts[stationIndex] = Math.max(0, Math.min(100, value));
      return { ...prev, [activeMissionId]: pcts };
    });
  };

  const handlePaxStationChange = (missionId: string, paxIndex: number, seatSlot: number, paxCount: number, seatCount: number) => {
    setPaxStationMap(prev => {
      const current = getPaxAssignment(missionId, paxCount, seatCount);
      const updated = [...current];
      updated[paxIndex] = seatSlot;
      return { ...prev, [missionId]: updated };
    });
  };

  const handleSendPayload = async (activeMissionId: string, activeMission: ActiveMission, aircraftId: string) => {
    if (!simConnected || !simPosition) return;
    const stationCount = Math.max(1, Math.floor(simPosition.payload_station_count));
    const mode = payloadModeMap[activeMissionId] ?? 'equal';
    const weights = mode === 'custom'
      ? getCustomWeights(activeMissionId, activeMission, stationCount, aircraftId)
      : calculateEqualWeights(activeMissionId, activeMission, stationCount, aircraftId);
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
            const expectedPayload = PILOT_WEIGHT + getMissionPayload(activeMission);
            const total = simConnected && simPosition
              ? Math.round(simPosition.total_weight)
              : aircraft ? aircraft.emptyWeight + expectedPayload : 0;
            const mtow = simConnected && simPosition && simPosition.max_gross_weight > 0
              ? Math.round(simPosition.max_gross_weight)
              : aircraft?.maxTakeoffWeight ?? 0;
            const margin = mtow - total;
            const stationCount = simConnected && simPosition
              ? Math.max(1, Math.floor(simPosition.payload_station_count)) : 0;
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
                          <span className="preflight-sub">
                            {preflight.simTitle
                              ? preflight.simTitle
                              : 'Waiting for SimConnect data…'}
                          </span>
                          {!preflight.aircraftOk && aircraft && preflight.simTitle && (
                            <span className="preflight-sub preflight-sub--expected">Expected: {aircraft.name} — <em>{aircraft.id}</em></span>
                          )}
                        </div>
                        <div className={`preflight-row ${preflight.payloadOk ? 'ok' : 'fail'}`}>
                          <span>{preflight.payloadOk ? '✅' : '❌'} Payload</span>
                          <span className="preflight-sub">
                            {preflight.actualPayload} / {preflight.expectedPayload} kg
                            {preflight.payloadOk && preflight.actualPayload !== preflight.expectedPayload && (
                              <> (Δ {preflight.actualPayload - preflight.expectedPayload} kg MSFS)</>
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Payload setup */}
                    {(() => {
                      const aircraftId = aircraft?.id ?? '';
                      const mode = payloadModeMap[activeMission.id] ?? 'equal';
                      const missionPayload = getMissionPayload(activeMission);
                      const isPassenger = mission.type === 'passenger';
                      const stationTypes = stationCount > 0 ? getStationTypes(simPosition, stationCount) : [];
                      const equalWeights = stationCount > 0 ? calculateEqualWeights(activeMission.id, activeMission, stationCount, aircraftId) : [];
                      const customPcts = customPctMap[activeMission.id] ?? Array(Math.max(0, stationCount - 1)).fill(0);
                      const customTotal = customPcts.reduce((s: number, p: number) => s + p, 0);
                      const customOverLimit = customTotal > 100;
                      const displayEqualWeights = [
                        ...equalWeights,
                        ...Array(Math.max(0, stationCount - equalWeights.length)).fill(0),
                      ];

                      return (
                        <div className="section-block payload-block">
                          <div className="section-title">
                            {isPassenger ? '👥' : '📦'} Payload Setup
                            {wasSent && <span className="sent-badge">✓ Loaded</span>}
                          </div>
                          <div className="payload-summary">
                            <span>Total: <strong>{expectedPayload} kg</strong></span>
                            <span className="payload-sub">
                              {mission.cargo
                                ? `pilot + ${mission.cargo.weight} kg cargo`
                                : mission.passengers
                                  ? `pilot + ${mission.passengers.list.reduce((s, p) => s + p.weight + p.baggage, 0)} kg pax (bagages inclus)`
                                  : '—'}
                            </span>
                          </div>
                          {mission.passengers && (
                            <div className="pax-list">
                              {mission.passengers.list.map((p, i) => (
                                <div key={i} className="pax-row">
                                  <span>👤 Pax {i + 1}</span>
                                  <span>{p.weight} kg</span>
                                  <span className="pax-baggage">🧳 {p.baggage} kg</span>
                                  <span className="pax-total">= {p.weight + p.baggage} kg</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {simConnected && simPosition ? (
                            <>
                              {/* Mode toggle */}
                              <div className="payload-mode-toggle">
                                <button
                                  className={`payload-mode-btn ${mode === 'equal' ? 'active' : ''}`}
                                  onClick={() => handleSetPayloadMode(activeMission.id, 'equal', stationCount)}
                                >
                                  Equal
                                </button>
                                <button
                                  className={`payload-mode-btn ${mode === 'custom' ? 'active' : ''}`}
                                  onClick={() => handleSetPayloadMode(activeMission.id, 'custom', stationCount)}
                                >
                                  Custom
                                </button>
                              </div>

                              {/* Equal mode */}
                              {mode === 'equal' && (
                                <div className="payload-stations">
                                  {displayEqualWeights.map((w, i) => {
                                    const sType = stationTypes[i] ?? 'cargo';
                                    const isPilot = i === 0;
                                    return (
                                      <div
                                        key={i}
                                        className={[
                                          'payload-chip',
                                          isPilot ? 'payload-chip--pilot' : '',
                                          w === 0 ? 'payload-chip--empty' : '',
                                        ].join(' ')}
                                        title={isPilot ? 'Pilot' : `${sType === 'seat' ? 'Siège' : 'Cargo'}`}
                                      >
                                        <span className="payload-chip-type">{isPilot ? '👤' : sType === 'seat' ? '🪑' : '📦'}</span>
                                        <span>{isPilot ? 'Pilot' : `Sta. ${i}`}</span>
                                        <strong>{w} kg</strong>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Custom mode */}
                              {mode === 'custom' && (() => {
                                const seatIndices = Array.from({ length: stationCount - 1 }, (_, i) => i + 1).filter(i => stationTypes[i] === 'seat');
                                const paxList = mission.passengers?.list ?? [];
                                const assignment = getPaxAssignment(activeMission.id, paxList.length, seatIndices.length);

                                return (
                                  <div className="payload-custom">
                                    <div className="payload-chip payload-chip--pilot">
                                      <span className="payload-chip-type">👤</span>
                                      <span>Pilot</span>
                                      <strong>{PILOT_WEIGHT} kg</strong>
                                    </div>

                                    {isPassenger ? (
                                      <>
                                        {/* Liste passagers compacte */}
                                        <div className="pax-list-compact">
                                          {paxList.map((pax, i) => (
                                            <div key={i} className="pax-list-compact-row">
                                              <span className="plc-name">Pax {i + 1}</span>
                                              <span className="plc-weight">{pax.weight} kg</span>
                                              <span className="plc-baggage">🧳 {pax.baggage} kg</span>
                                              <span className="plc-total">{pax.weight + pax.baggage} kg</span>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Assignation sièges — pleine largeur */}
                                        <div className="seat-assignment-grid">
                                          <div className="seat-assignment-title">Assignation des sièges</div>
                                          <div className="seat-slots">
                                            {seatIndices.map((si, slot) => {
                                              const paxHere = paxList.filter((_, i) => assignment[i] === slot);
                                              const totalW = paxHere.reduce((s, p) => s + p.weight + p.baggage, 0);
                                              return (
                                                <div key={si} className="seat-slot">
                                                  <div className="seat-slot-label">🪑 Sta. {si}</div>
                                                  <div className="seat-slot-pax">
                                                    {paxList.map((_, i) => (
                                                      <button
                                                        key={i}
                                                        className={`seat-pax-btn ${assignment[i] === slot ? 'assigned' : ''}`}
                                                        onClick={() => handlePaxStationChange(activeMission.id, i, slot, paxList.length, seatIndices.length)}
                                                        title={`Assigner Pax ${i + 1} ici`}
                                                      >
                                                        {i + 1}
                                                      </button>
                                                    ))}
                                                  </div>
                                                  {totalW > 0 && <div className="seat-slot-weight">{totalW} kg</div>}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      /* Cargo : inputs % par station */
                                      <div className="payload-custom-stations">
                                        {customPcts.map((pct: number, i: number) => {
                                          const kg = Math.round((pct / 100) * missionPayload * 10) / 10;
                                          return (
                                            <div key={i} className="payload-custom-row">
                                              <span className="station-type-icon">📦</span>
                                              <span className="payload-custom-label">Sta. {i + 1}</span>
                                              <input
                                                type="number" min={0} max={100} value={pct}
                                                className="payload-custom-input"
                                                onChange={e => handleCustomPctChange(activeMission.id, i, Number(e.target.value))}
                                              />
                                              <span className="payload-custom-unit">%</span>
                                              <span className="payload-custom-kg">{kg} kg</span>
                                            </div>
                                          );
                                        })}
                                        <div className={`payload-custom-total ${customTotal > 100 ? 'over' : customTotal === 100 ? 'ok' : ''}`}>
                                          Total: {customTotal}% ({Math.round(customTotal / 100 * missionPayload)} / {missionPayload} kg)
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {simPosition && stationCount > 0 && (
                                <details className="payload-station-names-debug">
                                  <summary>Noms bruts SimConnect</summary>
                                  {[
                                    simPosition.payload_station_name_1,  simPosition.payload_station_name_2,
                                    simPosition.payload_station_name_3,  simPosition.payload_station_name_4,
                                    simPosition.payload_station_name_5,  simPosition.payload_station_name_6,
                                    simPosition.payload_station_name_7,  simPosition.payload_station_name_8,
                                    simPosition.payload_station_name_9,  simPosition.payload_station_name_10,
                                    simPosition.payload_station_name_11, simPosition.payload_station_name_12,
                                    simPosition.payload_station_name_13, simPosition.payload_station_name_14,
                                    simPosition.payload_station_name_15, simPosition.payload_station_name_16,
                                    simPosition.payload_station_name_17, simPosition.payload_station_name_18,
                                    simPosition.payload_station_name_19, simPosition.payload_station_name_20,
                                  ].slice(0, stationCount).map((name, i) => (
                                    <div key={i}><code>Sta. {i + 1}: "{name}"</code></div>
                                  ))}
                                </details>
                              )}
                              {isPassenger && stationCount > 1 && (
                                <p className="payload-station-hint">🪑 siège · 📦 cargo (depuis SimConnect)</p>
                              )}

                              <button
                                className={`payload-btn ${wasSent ? 'payload-btn--sent' : ''}`}
                                disabled={mode === 'custom' && customOverLimit}
                                onClick={() => handleSendPayload(activeMission.id, activeMission, aircraftId)}
                              >
                                {wasSent ? '✓ Re-send to MSFS' : '📤 Load in MSFS'}
                              </button>
                            </>
                          ) : (
                            <p className="payload-nosim">Connect MSFS to configure payload</p>
                          )}
                        </div>
                      );
                    })()}

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
                            <strong>
                              {simConnected && simPosition
                                ? `${Math.round(simPosition.empty_weight).toLocaleString()} kg`
                                : `${aircraft.emptyWeight.toLocaleString()} kg`}
                            </strong>
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
                            <strong>{mtow.toLocaleString()} kg</strong>
                          </div>
                          <div className="live-metric weight-margin">
                            <span>Margin</span>
                            <strong style={{ color: margin < 0 ? '#e74c3c' : margin < mtow * 0.05 ? '#e67e22' : '#27ae60' }}>
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
