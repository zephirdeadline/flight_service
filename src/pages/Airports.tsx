import React, { useState, useEffect, useRef } from 'react';
import { Airport, Navaid } from '../types';
import { airportService } from '../services/airportService';
import { navaidService } from '../services/navaidService';
import './Airports.css';

type SearchMode = 'airport' | 'navaid';

const NAVAID_TYPE_COLORS: Record<string, string> = {
  'VOR': '#8e44ad',
  'VOR-DME': '#6c3483',
  'DME': '#7d3c98',
  'NDB': '#e67e22',
  'NDB-DME': '#ca6f1e',
  'TACAN': '#1a5276',
  'VORTAC': '#154360',
};

const formatFrequency = (navaid: Navaid): string => {
  if (navaid.frequencyKhz === 0) return '—';
  if (navaid.type.includes('NDB')) {
    return `${navaid.frequencyKhz} kHz`;
  }
  return `${(navaid.frequencyKhz / 1000).toFixed(3)} MHz`;
};

const getNavaidColor = (type: string): string =>
  NAVAID_TYPE_COLORS[type] ?? '#7f8c8d';

const Airports: React.FC = () => {
  const [mode, setMode] = useState<SearchMode>('airport');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Airport state
  const [airports, setAirports] = useState<Airport[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);

  // Navaid state
  const [navaids, setNavaids] = useState<Navaid[]>([]);
  const [navaidTypeFilter, setNavaidTypeFilter] = useState<string>('all');
  const [selectedNavaid, setSelectedNavaid] = useState<Navaid | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset results when switching mode
  const switchMode = (newMode: SearchMode) => {
    setMode(newMode);
    setAirports([]);
    setNavaids([]);
    setHasSearched(false);
    setSearchQuery('');
    setSelectedAirport(null);
    setSelectedNavaid(null);
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 2) {
      setAirports([]);
      setNavaids([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, mode]);

  useEffect(() => {
    if (hasSearched && searchQuery.trim().length >= 2) runSearch();
  }, [typeFilter, navaidTypeFilter]);

  const runSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      if (mode === 'airport') {
        const data = await airportService.searchAirports(searchQuery);
        setAirports(typeFilter === 'all' ? data : data.filter(a => a.type === typeFilter));
      } else {
        const data = await navaidService.searchNavaids(searchQuery);
        setNavaids(navaidTypeFilter === 'all' ? data : data.filter(n => n.type === navaidTypeFilter));
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getAirportTypeLabel = (type: string) => {
    switch (type) {
      case 'large_airport': return '🏢 Large';
      case 'medium_airport': return '🏪 Medium';
      case 'small_airport': return '🏠 Small';
      default: return type;
    }
  };

  const resultCount = mode === 'airport' ? airports.length : navaids.length;

  return (
    <div className="airports-container">
      <div className="airports-header">
        <h1>✈️ Navigation Explorer</h1>
        <p className="airports-subtitle">
          {mode === 'airport'
            ? 'Search airports by name, ICAO, IATA or city'
            : 'Search navaids by ident, name or associated airport'}
        </p>
      </div>

      <div className="airports-filters">
        {/* Mode switch */}
        <div className="mode-switch">
          <button
            className={`mode-btn ${mode === 'airport' ? 'mode-btn--active' : ''}`}
            onClick={() => switchMode('airport')}
          >
            🛬 Airports
          </button>
          <button
            className={`mode-btn ${mode === 'navaid' ? 'mode-btn--active mode-btn--navaid' : ''}`}
            onClick={() => switchMode('navaid')}
          >
            📡 Navaids
          </button>
        </div>

        {/* Search box */}
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder={
              mode === 'airport'
                ? 'Search by name, ICAO, IATA, city...'
                : 'Search by ident (VOR, NDB...), name, airport...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* Type filters */}
        {mode === 'airport' ? (
          <div className="type-filters">
            {['all', 'large_airport', 'medium_airport', 'small_airport'].map((t) => (
              <button
                key={t}
                className={`filter-btn ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === 'all' ? 'All Types' : getAirportTypeLabel(t)}
              </button>
            ))}
          </div>
        ) : (
          <div className="type-filters">
            {['all', 'VOR', 'VOR-DME', 'VORTAC', 'DME', 'NDB', 'NDB-DME', 'TACAN'].map((t) => (
              <button
                key={t}
                className={`filter-btn ${navaidTypeFilter === t ? 'active' : ''}`}
                onClick={() => setNavaidTypeFilter(t)}
                style={navaidTypeFilter === t && t !== 'all'
                  ? { background: getNavaidColor(t), borderColor: getNavaidColor(t), color: '#fff' }
                  : {}}
              >
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="airports-results">
        {!hasSearched && searchQuery.trim().length === 0 && (
          <div className="no-results">
            <p>🔍 Start typing to search</p>
            <p>{mode === 'airport'
              ? 'Search by name, ICAO code, IATA code or city'
              : 'Search by ident (e.g. "CDG", "LGL"), name or associated airport'}
            </p>
          </div>
        )}

        {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
          <div className="no-results"><p>Please enter at least 2 characters</p></div>
        )}

        {loading && <div className="loading">Searching {mode === 'airport' ? 'airports' : 'navaids'}...</div>}

        {hasSearched && !loading && resultCount > 0 && (
          <>
            <div className="results-count">
              {resultCount} {mode === 'airport' ? 'airport' : 'navaid'}{resultCount !== 1 ? 's' : ''} found
            </div>

            <div className="airports-grid">
              {mode === 'airport'
                ? airports.map((airport) => (
                  <div key={airport.id} className="airport-card" onClick={() => setSelectedAirport(airport)}>
                    <div className="airport-card-header">
                      <div className="airport-codes">
                        <span className="airport-icao">{airport.icao}</span>
                        {airport.iataCode && <span className="airport-iata">{airport.iataCode}</span>}
                      </div>
                      <span className="airport-type-badge">{getAirportTypeLabel(airport.type)}</span>
                    </div>
                    <h3 className="airport-name">{airport.name}</h3>
                    <div className="airport-location">📍 {airport.city}, {airport.country}</div>
                    <div className="airport-details">
                      <div className="airport-detail">
                        <span className="detail-label">Elevation</span>
                        <span className="detail-value">{airport.elevation} ft</span>
                      </div>
                      <div className="airport-detail">
                        <span className="detail-label">Scheduled</span>
                        <span className="detail-value">{airport.scheduledService ? '✅ Yes' : '❌ No'}</span>
                      </div>
                    </div>
                    <div className="airport-coordinates">
                      {airport.latitude.toFixed(4)}°, {airport.longitude.toFixed(4)}°
                    </div>
                  </div>
                ))
                : navaids.map((navaid) => (
                  <div key={navaid.id} className="airport-card navaid-card" onClick={() => setSelectedNavaid(navaid)}>
                    <div className="airport-card-header">
                      <div className="airport-codes">
                        <span className="airport-icao" style={{ background: getNavaidColor(navaid.type) }}>
                          {navaid.ident}
                        </span>
                      </div>
                      <span
                        className="navaid-type-badge"
                        style={{ background: getNavaidColor(navaid.type) + '22', color: getNavaidColor(navaid.type), borderColor: getNavaidColor(navaid.type) }}
                      >
                        {navaid.type}
                      </span>
                    </div>
                    <h3 className="airport-name">{navaid.name}</h3>
                    <div className="airport-details">
                      <div className="airport-detail">
                        <span className="detail-label">Frequency</span>
                        <span className="detail-value navaid-freq">{formatFrequency(navaid)}</span>
                      </div>
                      {navaid.associatedAirport && (
                        <div className="airport-detail">
                          <span className="detail-label">Airport</span>
                          <span className="detail-value">{navaid.associatedAirport}</span>
                        </div>
                      )}
                      <div className="airport-detail">
                        <span className="detail-label">Country</span>
                        <span className="detail-value">{navaid.isoCountry}</span>
                      </div>
                    </div>
                    <div className="airport-coordinates">
                      {navaid.latitude.toFixed(4)}°, {navaid.longitude.toFixed(4)}°
                    </div>
                  </div>
                ))
              }
            </div>
          </>
        )}

        {hasSearched && !loading && resultCount === 0 && searchQuery.trim().length >= 2 && (
          <div className="no-results">
            <p>No {mode === 'airport' ? 'airports' : 'navaids'} found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Airport detail modal */}
      {selectedAirport && (
        <div className="airport-modal" onClick={() => setSelectedAirport(null)}>
          <div className="airport-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAirport(null)}>✕</button>
            <div className="modal-header">
              <div className="modal-codes">
                <span className="modal-icao">{selectedAirport.icao}</span>
                {selectedAirport.iataCode && <span className="modal-iata">{selectedAirport.iataCode}</span>}
              </div>
              <span className="modal-type-badge">{getAirportTypeLabel(selectedAirport.type)}</span>
            </div>
            <h2 className="modal-title">{selectedAirport.name}</h2>
            <div className="modal-info">
              <div className="info-row"><span className="info-label">📍 Location</span><span className="info-value">{selectedAirport.city}, {selectedAirport.country}</span></div>
              <div className="info-row"><span className="info-label">🗺️ Coordinates</span><span className="info-value">{selectedAirport.latitude.toFixed(6)}°, {selectedAirport.longitude.toFixed(6)}°</span></div>
              <div className="info-row"><span className="info-label">⛰️ Elevation</span><span className="info-value">{selectedAirport.elevation} ft</span></div>
              <div className="info-row"><span className="info-label">✈️ Scheduled Service</span><span className="info-value">{selectedAirport.scheduledService ? '✅ Yes' : '❌ No'}</span></div>
              <div className="info-row"><span className="info-label">🏷️ Type</span><span className="info-value">{selectedAirport.type.replace(/_/g, ' ')}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Navaid detail modal */}
      {selectedNavaid && (
        <div className="airport-modal" onClick={() => setSelectedNavaid(null)}>
          <div className="airport-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedNavaid(null)}>✕</button>
            <div className="modal-header">
              <span className="modal-icao" style={{ background: getNavaidColor(selectedNavaid.type) }}>
                {selectedNavaid.ident}
              </span>
              <span
                className="navaid-type-badge"
                style={{ background: getNavaidColor(selectedNavaid.type) + '22', color: getNavaidColor(selectedNavaid.type), borderColor: getNavaidColor(selectedNavaid.type) }}
              >
                {selectedNavaid.type}
              </span>
            </div>
            <h2 className="modal-title">{selectedNavaid.name}</h2>
            <div className="modal-info">
              <div className="info-row"><span className="info-label">📡 Frequency</span><span className="info-value navaid-freq-lg">{formatFrequency(selectedNavaid)}</span></div>
              <div className="info-row"><span className="info-label">🗺️ Coordinates</span><span className="info-value">{selectedNavaid.latitude.toFixed(6)}°, {selectedNavaid.longitude.toFixed(6)}°</span></div>
              {selectedNavaid.elevationFt != null && (
                <div className="info-row"><span className="info-label">⛰️ Elevation</span><span className="info-value">{selectedNavaid.elevationFt} ft</span></div>
              )}
              {selectedNavaid.associatedAirport && (
                <div className="info-row"><span className="info-label">🛬 Airport</span><span className="info-value">{selectedNavaid.associatedAirport}</span></div>
              )}
              {selectedNavaid.magneticVariationDeg != null && (
                <div className="info-row"><span className="info-label">🧭 Mag. Variation</span><span className="info-value">{selectedNavaid.magneticVariationDeg.toFixed(1)}°</span></div>
              )}
              {selectedNavaid.usageType && (
                <div className="info-row"><span className="info-label">📶 Usage</span><span className="info-value">{selectedNavaid.usageType}</span></div>
              )}
              {selectedNavaid.power && (
                <div className="info-row"><span className="info-label">⚡ Power</span><span className="info-value">{selectedNavaid.power}</span></div>
              )}
              <div className="info-row"><span className="info-label">🌍 Country</span><span className="info-value">{selectedNavaid.isoCountry}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Airports;
