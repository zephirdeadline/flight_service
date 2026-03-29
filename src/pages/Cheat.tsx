import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { airportService } from '../services/airportService';
import { aircraftService } from '../services/aircraftService';
import { activeMissionService } from '../services/activeMissionService';
import { cheatService } from '../services/cheatService';
import type { Airport, Aircraft, ActiveMission } from '../types';
import './Cheat.css';

export default function Cheat() {
  const { player, currentAirport, ownedAircraft, refreshPlayer } = usePlayer();
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aircraftSearchQuery, setAircraftSearchQuery] = useState('');
  const [aircraftTeleportAirports, setAircraftTeleportAirports] = useState<Airport[]>([]);
  const [moneyAmount, setMoneyAmount] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Rechercher des aéroports (debounced)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setAirports([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await airportService.searchAirports(searchQuery);
        setAirports(results);
      } catch (error) {
        console.error('Failed to search airports:', error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Charger tous les avions
  useEffect(() => {
    async function loadAircraft() {
      try {
        const allAircraft = await aircraftService.getAllAircraft();
        setAircraft(allAircraft);
      } catch (error) {
        console.error('Failed to load aircraft:', error);
      }
    }
    loadAircraft();
  }, []);

  // Charger les missions actives
  useEffect(() => {
    async function loadActiveMissions() {
      if (!player) return;
      try {
        const missions = await activeMissionService.getActiveMissions(player.id);
        setActiveMissions(missions);
      } catch (error) {
        console.error('Failed to load active missions:', error);
      }
    }
    loadActiveMissions();
  }, [player]);

  // Rechercher des aéroports pour téléporter un avion (debounced)
  useEffect(() => {
    if (aircraftSearchQuery.length < 2) {
      setAircraftTeleportAirports([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await airportService.searchAirports(aircraftSearchQuery);
        setAircraftTeleportAirports(results);
      } catch (error) {
        console.error('Failed to search airports:', error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [aircraftSearchQuery]);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleTeleport = async (airport: Airport) => {
    if (!player) return;
    setLoading(true);
    try {
      await cheatService.teleportToAirport(player.id, airport.id);
      await refreshPlayer();
      showMessage('success', `Teleported to ${airport.name} (${airport.icao})`);
      setSearchQuery('');
      setAirports([]);
    } catch (error) {
      showMessage('error', `Failed to teleport: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGiveAircraft = async (aircraft: Aircraft) => {
    if (!player) return;
    setLoading(true);
    try {
      await cheatService.giveAircraft(player.id, aircraft.id);
      await refreshPlayer();
      showMessage('success', `Added ${aircraft.name} to your hangar`);
    } catch (error) {
      showMessage('error', `Failed to add aircraft: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMoney = async () => {
    if (!player) return;
    setLoading(true);
    try {
      await cheatService.addMoney(player.id, moneyAmount);
      await refreshPlayer();
      showMessage('success', `Added $${moneyAmount.toLocaleString()}`);
    } catch (error) {
      showMessage('error', `Failed to add money: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTeleportAircraft = async (playerAircraftId: string, airport: Airport) => {
    if (!player) return;
    setLoading(true);
    try {
      await cheatService.teleportAircraft(playerAircraftId, airport.id);
      await refreshPlayer();
      showMessage('success', `Aircraft teleported to ${airport.name} (${airport.icao})`);
      setAircraftSearchQuery('');
      setAircraftTeleportAirports([]);
    } catch (error) {
      showMessage('error', `Failed to teleport aircraft: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForceCompleteMission = async (activeMission: ActiveMission) => {
    if (!player) return;
    setLoading(true);
    try {
      const reward = await cheatService.forceCompleteMission(player.id, activeMission.id);
      await refreshPlayer();
      // Recharger les missions actives
      const missions = await activeMissionService.getActiveMissions(player.id);
      setActiveMissions(missions);
      showMessage('success', `Mission completed! Earned $${reward.toLocaleString()}`);
    } catch (error) {
      showMessage('error', `Failed to complete mission: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetAircraftWear = async (playerAircraftId: string, flightHours: number, condition: number) => {
    if (!player) return;
    setLoading(true);
    try {
      await cheatService.setAircraftWear(playerAircraftId, flightHours, condition);
      await refreshPlayer();
      showMessage('success', `Aircraft wear updated: ${condition}% condition, ${flightHours.toFixed(1)}h`);
    } catch (error) {
      showMessage('error', `Failed to set wear: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMaintenance = async (playerAircraftId: string, aircraftName: string) => {
    if (!player) return;
    setLoading(true);
    try {
      await cheatService.completeMaintenance(player.id, playerAircraftId);
      await refreshPlayer();
      showMessage('success', `${aircraftName} maintenance completed instantly!`);
    } catch (error) {
      showMessage('error', `Failed to complete maintenance: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  if (!player) {
    return <div className="cheat-page">Loading...</div>;
  }

  return (
    <div className="cheat-page">
      <h1>🎮 Cheat Menu</h1>
      <p className="cheat-warning">⚠️ Debug mode - Use for testing only</p>

      {message && (
        <div className={`cheat-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Section Money */}
      <section className="cheat-section">
        <h2>💰 Add Money</h2>
        <div className="cheat-money-controls">
          <input
            type="number"
            value={moneyAmount}
            onChange={(e) => setMoneyAmount(Number(e.target.value))}
            min="1"
            step="1000"
          />
          <button
            onClick={handleAddMoney}
            disabled={loading}
            className="cheat-btn money"
          >
            Add ${moneyAmount.toLocaleString()}
          </button>
        </div>
      </section>

      {/* Section Teleport */}
      <section className="cheat-section">
        <h2>📍 Teleport to Airport</h2>
        <p className="current-location">
          Current: {currentAirport?.name} ({currentAirport?.icao})
        </p>
        <input
          type="text"
          placeholder="Search airport (name, ICAO, city)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="cheat-search"
        />
        {airports.length > 0 && (
          <div className="cheat-airport-results">
            {airports.map((airport) => (
              <div key={airport.id} className="cheat-airport-card">
                <div className="cheat-airport-info">
                  <strong>{airport.icao || 'N/A'}</strong>
                  <span>{airport.name}</span>
                  <span className="cheat-airport-location">
                    {airport.city}, {airport.country}
                  </span>
                </div>
                <button
                  onClick={() => handleTeleport(airport)}
                  disabled={loading || currentAirport?.id === airport.id}
                  className="cheat-btn teleport"
                >
                  {currentAirport?.id === airport.id ? 'Current' : 'Teleport'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section Active Missions */}
      {activeMissions.length > 0 && (
        <section className="cheat-section">
          <h2>🎯 Active Missions</h2>
          <div className="cheat-missions-list">
            {activeMissions.map((mission) => (
              <div key={mission.id} className="cheat-mission-card">
                <div className="cheat-mission-info">
                  <strong>
                    {mission.mission.fromAirport.icao} → {mission.mission.toAirport.icao}
                  </strong>
                  <span>
                    {mission.mission.type === 'passenger'
                      ? `${mission.mission.passengers?.count} passengers`
                      : `${mission.mission.cargo?.weight} kg cargo`}
                  </span>
                  <span className="cheat-mission-reward">
                    Reward: ${mission.mission.reward.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleForceCompleteMission(mission)}
                  disabled={loading}
                  className="cheat-btn complete-mission"
                >
                  ⚡ Force Complete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section Teleport Aircraft */}
      <section className="cheat-section">
        <h2>✈️ Teleport Aircraft</h2>
        {ownedAircraft.length === 0 ? (
          <p className="cheat-no-data">No aircraft owned yet</p>
        ) : (
          <div className="cheat-teleport-aircraft-section">
            {ownedAircraft.map((owned) => (
              <div key={owned.id} className="cheat-owned-aircraft">
                <div className="cheat-aircraft-header">
                  <h3>{owned.aircraft.name}</h3>
                  <p className="cheat-current-location">
                    Currently at: {owned.currentAirportId}
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Search destination airport..."
                  onChange={(e) => setAircraftSearchQuery(e.target.value)}
                  className="cheat-search small"
                />
                {aircraftSearchQuery.length >= 2 && aircraftTeleportAirports.length > 0 && (
                  <div className="cheat-airport-mini-results">
                    {aircraftTeleportAirports.slice(0, 5).map((airport) => (
                      <div key={airport.id} className="cheat-airport-mini-card">
                        <span>
                          <strong>{airport.icao}</strong> - {airport.name}
                        </span>
                        <button
                          onClick={() => handleTeleportAircraft(owned.id, airport)}
                          disabled={loading || owned.currentAirportId === airport.id}
                          className="cheat-btn-mini"
                        >
                          {owned.currentAirportId === airport.id ? 'Current' : 'Teleport'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section Complete Maintenance */}
      {ownedAircraft.some(owned => player?.aircraftMaintenances?.[owned.id]?.isUnderMaintenance) && (
        <section className="cheat-section">
          <h2>⚡ Complete Maintenance Instantly</h2>
          <div className="cheat-maintenance-list">
            {ownedAircraft
              .filter(owned => player?.aircraftMaintenances?.[owned.id]?.isUnderMaintenance)
              .map((owned) => {
                const maintenance = player?.aircraftMaintenances?.[owned.id];
                const endDate = maintenance?.maintenanceEndDate
                  ? new Date(maintenance.maintenanceEndDate)
                  : null;
                const timeLeft = endDate
                  ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60))
                  : 0;

                return (
                  <div key={owned.id} className="cheat-maintenance-card">
                    <div className="cheat-maintenance-info">
                      <strong>{owned.aircraft.name}</strong>
                      <span className="maintenance-status">
                        🔧 In Maintenance
                        {timeLeft > 0 && ` - ${timeLeft}h remaining`}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCompleteMaintenance(owned.id, owned.aircraft.name)}
                      disabled={loading}
                      className="cheat-btn complete-maintenance"
                    >
                      ⚡ Complete Now
                    </button>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Section Aircraft Wear/Maintenance */}
      <section className="cheat-section">
        <h2>🔧 Set Aircraft Wear (Maintenance Testing)</h2>
        {ownedAircraft.length === 0 ? (
          <p className="cheat-no-data">No aircraft owned yet</p>
        ) : (
          <div className="cheat-wear-section">
            {ownedAircraft.map((owned) => {
              const maintenance = player?.aircraftMaintenances?.[owned.id];
              const currentCondition = maintenance?.condition ?? 100;
              const currentFlightHours = maintenance?.flightHours ?? 0;
              const maxHours = owned.aircraft.maxFlightHoursBeforeMaintenance;

              return (
                <div key={owned.id} className="cheat-wear-card">
                  <div className="cheat-wear-header">
                    <h3>{owned.aircraft.name}</h3>
                    <div className="cheat-wear-current">
                      <span className={`wear-condition ${
                        currentCondition >= 80 ? 'good' :
                        currentCondition >= 50 ? 'fair' : 'poor'
                      }`}>
                        {currentCondition}%
                      </span>
                      <span className="wear-hours">
                        {currentFlightHours.toFixed(1)}h / {maxHours}h
                      </span>
                    </div>
                  </div>

                  <div className="cheat-wear-presets">
                    <button
                      onClick={() => handleSetAircraftWear(owned.id, 0, 100)}
                      disabled={loading}
                      className="cheat-preset-btn excellent"
                    >
                      ✨ Like New (100%)
                    </button>
                    <button
                      onClick={() => handleSetAircraftWear(owned.id, maxHours * 0.5, 75)}
                      disabled={loading}
                      className="cheat-preset-btn good"
                    >
                      ✅ Good (75%)
                    </button>
                    <button
                      onClick={() => handleSetAircraftWear(owned.id, maxHours * 0.7, 50)}
                      disabled={loading}
                      className="cheat-preset-btn fair"
                    >
                      ⚠️ Fair (50%)
                    </button>
                    <button
                      onClick={() => handleSetAircraftWear(owned.id, maxHours * 0.85, 30)}
                      disabled={loading}
                      className="cheat-preset-btn poor"
                    >
                      🔴 Poor (30%)
                    </button>
                    <button
                      onClick={() => handleSetAircraftWear(owned.id, maxHours * 0.95, 15)}
                      disabled={loading}
                      className="cheat-preset-btn critical"
                    >
                      💀 Critical (15%)
                    </button>
                  </div>

                  <div className="cheat-wear-custom">
                    <div className="wear-input-group">
                      <label>Condition (%):</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        defaultValue={currentCondition}
                        onMouseUp={(e) => {
                          const newCondition = parseInt((e.target as HTMLInputElement).value);
                          const newHours = maxHours * ((100 - newCondition) / 100);
                          handleSetAircraftWear(owned.id, newHours, newCondition);
                        }}
                        className="cheat-wear-slider"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section Aircraft */}
      <section className="cheat-section">
        <h2>🎁 Get Free Aircraft</h2>
        <div className="cheat-aircraft-grid">
          {aircraft.map((craft) => {
            const ownedCount = ownedAircraft.filter((pa) => pa.aircraft.id === craft.id).length;
            return (
              <div key={craft.id} className="cheat-aircraft-card">
                <h3>{craft.name}</h3>
                <p className="cheat-aircraft-manufacturer">{craft.manufacturer}</p>
                <div className="cheat-aircraft-specs">
                  <span>Type: {craft.type}</span>
                  <span>Range: {craft.range} NM</span>
                  <span>Capacity: {craft.capacity}</span>
                </div>
                <p className="cheat-aircraft-price">Value: ${craft.price.toLocaleString()}</p>
                {ownedCount > 0 && (
                  <p className="cheat-aircraft-owned-count">✓ {ownedCount} owned</p>
                )}
                <button
                  onClick={() => handleGiveAircraft(craft)}
                  disabled={loading}
                  className="cheat-btn aircraft"
                >
                  Get Free
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
