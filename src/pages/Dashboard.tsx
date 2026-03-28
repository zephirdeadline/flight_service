import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { player, currentAirport, selectedAircraft, ownedAircraft } = usePlayer();

  if (!player || !currentAirport) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome back, {player.name}!</h1>
        <p className="subtitle">Ready for your next flight?</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card money">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Total Money</div>
            <div className="stat-value">${player.money.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-card missions">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">Completed Missions</div>
            <div className="stat-value">{player.completedMissions.length}</div>
          </div>
        </div>

        <div className="stat-card hours">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <div className="stat-label">Flight Hours</div>
            <div className="stat-value">{player.totalFlightHours.toFixed(1)}</div>
          </div>
        </div>

        <div className="stat-card fleet">
          <div className="stat-icon">✈️</div>
          <div className="stat-content">
            <div className="stat-label">Fleet Size</div>
            <div className="stat-value">{ownedAircraft.length}</div>
          </div>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-card current-location">
          <h2>📍 Current Location</h2>
          <div className="location-details">
            <div className="location-icao">{currentAirport.icao}</div>
            <div className="location-name">{currentAirport.name}</div>
            <div className="location-city">
              {currentAirport.city}, {currentAirport.country}
            </div>
          </div>
        </div>

        <div className="info-card selected-aircraft">
          <h2>✈️ Selected Aircraft</h2>
          {selectedAircraft ? (
            <div className="aircraft-details">
              <div className="aircraft-name">{selectedAircraft.name}</div>
              <div className="aircraft-manufacturer">{selectedAircraft.manufacturer}</div>
              <div className="aircraft-quick-specs">
                <div className="quick-spec">
                  <span className="quick-spec-label">Range:</span>
                  <span className="quick-spec-value">{selectedAircraft.range} NM</span>
                </div>
                <div className="quick-spec">
                  <span className="quick-spec-label">Speed:</span>
                  <span className="quick-spec-value">{selectedAircraft.cruiseSpeed} kts</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-aircraft">
              <p>No aircraft selected</p>
              <button onClick={() => navigate('/hangar')} className="select-aircraft-btn">
                Go to Hangar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="quick-actions">
        <button
          className="action-button primary"
          onClick={() => navigate('/missions')}
        >
          <span className="action-icon">🎯</span>
          <span className="action-text">Browse Missions</span>
        </button>

        <button
          className="action-button secondary"
          onClick={() => navigate('/hangar')}
        >
          <span className="action-icon">🏠</span>
          <span className="action-text">Manage Hangar</span>
        </button>

        <button
          className="action-button secondary"
          onClick={() => navigate('/shop')}
        >
          <span className="action-icon">🛒</span>
          <span className="action-text">Buy Aircraft</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
