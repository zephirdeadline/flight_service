import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { Airport, Aircraft } from '../types';
import { airportService } from '../services/airportService';
import { aircraftService } from '../services/aircraftService';
import './Setup.css';

const Setup: React.FC = () => {
  const navigate = useNavigate();
  const { initializePlayer } = usePlayer();

  const [step, setStep] = useState(1);
  const [playerName, setPlayerName] = useState('');
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [airportSearch, setAirportSearch] = useState('');
  const [hasSearchedAirports, setHasSearchedAirports] = useState(false);

  useEffect(() => {
    loadAircraft();
  }, []);

  // Recherche d'aéroports avec debounce
  useEffect(() => {
    if (step !== 2) return;

    if (airportSearch.trim().length === 0) {
      setAirports([]);
      setHasSearchedAirports(false);
      return;
    }

    if (airportSearch.trim().length < 2) {
      return;
    }

    const timeoutId = setTimeout(() => {
      searchAirports();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [airportSearch, step]);

  const loadAircraft = async () => {
    setLoading(true);
    try {
      const aircraftData = await aircraftService.getAllAircraft();
      // Filtrer uniquement les avions de départ (petits avions)
      setAircraft(aircraftData.filter(a => a.price <= 250000));
    } catch (error) {
      console.error('Error loading aircraft:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchAirports = async () => {
    setLoading(true);
    setHasSearchedAirports(true);
    try {
      const airportsData = await airportService.searchAirports(airportSearch);
      setAirports(airportsData);
    } catch (error) {
      console.error('Error searching airports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!selectedAirport || !selectedAircraft) return;

    setLoading(true);
    try {
      await initializePlayer(playerName || 'Pilot', selectedAirport.id, selectedAircraft.id);
      navigate('/');
    } catch (error) {
      console.error('Error initializing player:', error);
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = playerName.trim().length > 0;
  const canProceedStep2 = selectedAirport !== null;
  const canProceedStep3 = selectedAircraft !== null;

  return (
    <div className="setup-container">
      <div className="setup-card">
        <h1 className="setup-title">✈️ Welcome to Flight Service Career</h1>
        <p className="setup-subtitle">Start your aviation journey</p>

        <div className="steps-indicator">
          <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`step-line ${step >= 2 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`step-line ${step >= 3 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {step === 1 && (
          <div className="setup-step">
            <h2>What's your name, pilot?</h2>
            <input
              type="text"
              className="name-input"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              autoFocus
            />
            <button
              className="next-button"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="setup-step">
            <h2>Choose your starting airport</h2>
            <div className="search-container">
              <input
                type="text"
                className="airport-search-input"
                placeholder="Search by name, ICAO, IATA, city, or country..."
                value={airportSearch}
                onChange={(e) => setAirportSearch(e.target.value)}
                autoFocus
              />
              <span className="search-icon">🔍</span>
            </div>

            {!hasSearchedAirports && airportSearch.trim().length === 0 && (
              <div className="search-prompt">
                <p>🔍 Start typing to search for airports</p>
                <p className="search-hint">Search by name, ICAO code, IATA code, city, or country</p>
              </div>
            )}

            {loading && (
              <div className="loading-message">Searching airports...</div>
            )}

            {airportSearch.trim().length > 0 && airportSearch.trim().length < 2 && (
              <div className="search-prompt">
                <p>Please enter at least 2 characters</p>
              </div>
            )}

            {hasSearchedAirports && !loading && airports.length === 0 && airportSearch.trim().length >= 2 && (
              <div className="search-prompt">
                <p>No airports found matching "{airportSearch}"</p>
                <p className="search-hint">Try a different search term</p>
              </div>
            )}

            {hasSearchedAirports && !loading && airports.length > 0 && (
              <div className="airport-grid">
                {airports.map((airport) => (
                  <div
                    key={airport.id}
                    className={`airport-option ${selectedAirport?.id === airport.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAirport(airport)}
                  >
                    <div className="airport-icao">{airport.icao}</div>
                    <div className="airport-name">{airport.name}</div>
                    <div className="airport-location">
                      {airport.city}, {airport.country}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="step-actions">
              <button className="back-button" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="next-button"
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="setup-step">
            <h2>Choose your starting aircraft</h2>
            <div className="starting-budget">
              Starting budget: <span className="budget-amount">$100,000</span>
            </div>
            <div className="aircraft-grid">
              {aircraft.map((ac) => (
                <div
                  key={ac.id}
                  className={`aircraft-option ${selectedAircraft?.id === ac.id ? 'selected' : ''}`}
                  onClick={() => setSelectedAircraft(ac)}
                >
                  <div className="aircraft-name">{ac.name}</div>
                  <div className="aircraft-manufacturer">{ac.manufacturer}</div>
                  <div className="aircraft-specs-mini">
                    <span>Range: {ac.range} NM</span>
                    <span>Capacity: {ac.capacity}</span>
                  </div>
                  <div className="aircraft-price">${ac.price.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="step-actions">
              <button className="back-button" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="start-button"
                onClick={handleStart}
                disabled={!canProceedStep3 || loading}
              >
                {loading ? 'Starting...' : 'Start Career'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;
