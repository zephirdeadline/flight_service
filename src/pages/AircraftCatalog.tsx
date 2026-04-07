import React, { useState, useEffect, useMemo } from 'react';
import { Aircraft } from '../types';
import { aircraftService } from '../services/aircraftService';
import './AircraftCatalog.css';

const TYPE_LABEL: Record<string, string> = {
  passenger: '👥 Passenger',
  cargo: '📦 Cargo',
  both: '🔄 Multi-purpose',
};

const AircraftCatalog: React.FC = () => {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passenger' | 'cargo' | 'both'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    aircraftService.getAllAircraft()
      .then(setAircraft)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return aircraft.filter(ac => {
      if (filter !== 'all' && ac.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return ac.name.toLowerCase().includes(q) || ac.manufacturer.toLowerCase().includes(q);
      }
      return true;
    });
  }, [aircraft, filter, search]);

  if (loading) return <div className="loading">Loading aircraft catalog...</div>;

  return (
    <div className="catalog-container">
      <div className="catalog-header">
        <h1>✈️ Aircraft Catalog</h1>
        <p className="subtitle">{aircraft.length} aircraft available</p>
      </div>

      <div className="catalog-controls">
        <input
          className="catalog-search"
          type="text"
          placeholder="Search by name or manufacturer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-buttons">
          {(['all', 'passenger', 'cargo', 'both'] as const).map(t => (
            <button
              key={t}
              className={`filter-btn ${filter === t ? 'active' : ''}`}
              onClick={() => setFilter(t)}
            >
              {t === 'all' ? 'All' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="catalog-count">{filtered.length} aircraft</div>

      <div className="catalog-list">
        {filtered.map(ac => (
          <div key={ac.id} className="catalog-card">
            <div
              className="catalog-card-header"
              onClick={() => setExpanded(expanded === ac.id ? null : ac.id)}
            >
              <div className="catalog-card-title">
                <span className="catalog-type-badge">{TYPE_LABEL[ac.type]}</span>
                <div>
                  <h3>{ac.name}</h3>
                  <p className="catalog-manufacturer">{ac.manufacturer} · <span className="catalog-id">{ac.id}</span></p>
                </div>
              </div>
              <div className="catalog-card-summary">
                <span className="catalog-price">${ac.price.toLocaleString()}</span>
                <span className="catalog-quick-specs">
                  {ac.range} NM · {ac.cruiseSpeed} kts · {ac.type === 'cargo' ? `${ac.capacity.toLocaleString()} kg` : `${ac.capacity} pax`}
                </span>
                <span className="catalog-expand-icon">{expanded === ac.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expanded === ac.id && (
              <div className="catalog-card-details">
                <div className="specs-grid">
                  <div className="specs-section">
                    <h4>Performance</h4>
                    <div className="specs-rows">
                      <div className="spec-row">
                        <span>Cruise Speed</span><span>{ac.cruiseSpeed} kts</span>
                      </div>
                      <div className="spec-row">
                        <span>Max Speed</span><span>{ac.maxSpeed} kts</span>
                      </div>
                      <div className="spec-row">
                        <span>Range</span><span>{ac.range} NM</span>
                      </div>
                      <div className="spec-row">
                        <span>Service Ceiling</span><span>{ac.serviceCeiling.toLocaleString()} ft</span>
                      </div>
                      <div className="spec-row">
                        <span>Rate of Climb</span><span>{ac.rateOfClimb} ft/min</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-section">
                    <h4>Weight & Dimensions</h4>
                    <div className="specs-rows">
                      <div className="spec-row">
                        <span>Empty Weight</span><span>{ac.emptyWeight.toLocaleString()} kg</span>
                      </div>
                      <div className="spec-row">
                        <span>Max Takeoff Weight</span><span>{ac.maxTakeoffWeight.toLocaleString()} kg</span>
                      </div>
                      <div className="spec-row">
                        <span>Wingspan</span><span>{ac.wingspan} m</span>
                      </div>
                      <div className="spec-row">
                        <span>Length</span><span>{ac.length} m</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-section">
                    <h4>Fuel</h4>
                    <div className="specs-rows">
                      <div className="spec-row">
                        <span>Fuel Capacity</span><span>{ac.fuelCapacity.toLocaleString()} L</span>
                      </div>
                      <div className="spec-row">
                        <span>Fuel Consumption</span><span>{ac.fuelConsumption} L/h</span>
                      </div>
                    </div>
                  </div>

                  <div className="specs-section">
                    <h4>Capacity & Maintenance</h4>
                    <div className="specs-rows">
                      <div className="spec-row">
                        <span>{ac.type === 'cargo' ? 'Cargo' : 'Passengers'}</span>
                        <span>{ac.type === 'cargo' ? `${ac.capacity.toLocaleString()} kg` : `${ac.capacity} pax`}</span>
                      </div>
                      <div className="spec-row">
                        <span>Maintenance Cost</span><span>${ac.maintenanceCostPerHour}/h</span>
                      </div>
                      <div className="spec-row">
                        <span>Max Hours Before Maintenance</span><span>{ac.maxFlightHoursBeforeMaintenance} h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AircraftCatalog;
