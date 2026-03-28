import React, { useState, useEffect } from 'react';
import { Airport } from '../types';
import { airportService } from '../services/airportService';
import './Airports.css';

const Airports: React.FC = () => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Recherche avec debounce
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setAirports([]);
      setHasSearched(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchAirports();
    }, 300); // Attendre 300ms après la dernière frappe

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchAirports = async () => {
    if (searchQuery.trim().length < 2) {
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const data = await airportService.searchAirports(searchQuery);

      // Filtre par type si nécessaire
      let filtered = data;
      if (typeFilter !== 'all') {
        filtered = data.filter((airport) => airport.type === typeFilter);
      }

      setAirports(filtered);
    } catch (error) {
      console.error('Error searching airports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Appliquer le filtre de type quand il change
  useEffect(() => {
    if (hasSearched && searchQuery.trim().length >= 2) {
      searchAirports();
    }
  }, [typeFilter]);

  const getAirportTypeLabel = (type: string) => {
    switch (type) {
      case 'large_airport':
        return '🏢 Large';
      case 'medium_airport':
        return '🏪 Medium';
      case 'small_airport':
        return '🏠 Small';
      default:
        return type;
    }
  };

  return (
    <div className="airports-container">
      <div className="airports-header">
        <h1>✈️ Airport Explorer</h1>
        <p className="airports-subtitle">
          Search airports by name, ICAO, IATA, city, or country
        </p>
      </div>

      <div className="airports-filters">
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, ICAO, IATA, city, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="type-filters">
          <button
            className={`filter-btn ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All Types
          </button>
          <button
            className={`filter-btn ${typeFilter === 'large_airport' ? 'active' : ''}`}
            onClick={() => setTypeFilter('large_airport')}
          >
            🏢 Large
          </button>
          <button
            className={`filter-btn ${typeFilter === 'medium_airport' ? 'active' : ''}`}
            onClick={() => setTypeFilter('medium_airport')}
          >
            🏪 Medium
          </button>
          <button
            className={`filter-btn ${typeFilter === 'small_airport' ? 'active' : ''}`}
            onClick={() => setTypeFilter('small_airport')}
          >
            🏠 Small
          </button>
        </div>
      </div>

      <div className="airports-results">
        {!hasSearched && searchQuery.trim().length === 0 && (
          <div className="no-results">
            <p>🔍 Start typing to search for airports</p>
            <p>Search by name, ICAO code, IATA code, city, or country</p>
          </div>
        )}

        {loading && (
          <div className="loading">Searching airports...</div>
        )}

        {hasSearched && !loading && airports.length > 0 && (
          <>
            <div className="results-count">
              {airports.length} airport{airports.length !== 1 ? 's' : ''} found
            </div>

            <div className="airports-grid">
              {airports.map((airport) => (
            <div
              key={airport.id}
              className="airport-card"
              onClick={() => setSelectedAirport(airport)}
            >
              <div className="airport-card-header">
                <div className="airport-codes">
                  <span className="airport-icao">{airport.icao}</span>
                  {airport.iataCode && (
                    <span className="airport-iata">{airport.iataCode}</span>
                  )}
                </div>
                <span className="airport-type-badge">
                  {getAirportTypeLabel(airport.type)}
                </span>
              </div>

              <h3 className="airport-name">{airport.name}</h3>

              <div className="airport-location">
                📍 {airport.city}, {airport.country}
              </div>

              <div className="airport-details">
                <div className="airport-detail">
                  <span className="detail-label">Elevation:</span>
                  <span className="detail-value">{airport.elevation} ft</span>
                </div>
                <div className="airport-detail">
                  <span className="detail-label">Scheduled:</span>
                  <span className="detail-value">
                    {airport.scheduledService ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
              </div>

              <div className="airport-coordinates">
                {airport.latitude.toFixed(4)}°, {airport.longitude.toFixed(4)}°
              </div>
            </div>
          ))}
            </div>
          </>
        )}

        {hasSearched && !loading && airports.length === 0 && searchQuery.trim().length >= 2 && (
          <div className="no-results">
            <p>No airports found matching "{searchQuery}"</p>
            <p>Try a different search term or adjust your filters.</p>
          </div>
        )}

        {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
          <div className="no-results">
            <p>Please enter at least 2 characters to search</p>
          </div>
        )}
      </div>

      {selectedAirport && (
        <div className="airport-modal" onClick={() => setSelectedAirport(null)}>
          <div className="airport-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAirport(null)}>
              ✕
            </button>

            <div className="modal-header">
              <div className="modal-codes">
                <span className="modal-icao">{selectedAirport.icao}</span>
                {selectedAirport.iataCode && (
                  <span className="modal-iata">{selectedAirport.iataCode}</span>
                )}
              </div>
              <span className="modal-type-badge">
                {getAirportTypeLabel(selectedAirport.type)}
              </span>
            </div>

            <h2 className="modal-title">{selectedAirport.name}</h2>

            <div className="modal-info">
              <div className="info-row">
                <span className="info-label">📍 Location:</span>
                <span className="info-value">
                  {selectedAirport.city}, {selectedAirport.country}
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">🗺️ Coordinates:</span>
                <span className="info-value">
                  {selectedAirport.latitude.toFixed(6)}°, {selectedAirport.longitude.toFixed(6)}°
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">⛰️ Elevation:</span>
                <span className="info-value">{selectedAirport.elevation} ft</span>
              </div>

              <div className="info-row">
                <span className="info-label">✈️ Scheduled Service:</span>
                <span className="info-value">
                  {selectedAirport.scheduledService ? '✅ Yes' : '❌ No'}
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">🏷️ Type:</span>
                <span className="info-value">
                  {selectedAirport.type.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Airports;
