import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { airportService } from '../services/airportService';
import { aircraftService } from '../services/aircraftService';
import { cheatService } from '../services/cheatService';
import type { Airport, Aircraft } from '../types';
import './Cheat.css';

export default function Cheat() {
  const { player, currentAirport, ownedAircraft, refreshPlayer } = usePlayer();
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

      {/* Section Aircraft */}
      <section className="cheat-section">
        <h2>✈️ Get Free Aircraft</h2>
        <div className="cheat-aircraft-grid">
          {aircraft.map((craft) => {
            const owned = ownedAircraft.some((pa) => pa.id === craft.id);
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
                <button
                  onClick={() => handleGiveAircraft(craft)}
                  disabled={loading || owned}
                  className="cheat-btn aircraft"
                >
                  {owned ? '✓ Owned' : 'Get Free'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
