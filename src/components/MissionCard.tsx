import React from 'react';
import { Mission } from '../types';
import './MissionCard.css';

interface MissionCardProps {
  mission: Mission;
  onAccept?: (missionId: string) => void;
  disabled?: boolean;
}

const MissionCard: React.FC<MissionCardProps> = ({ mission, onAccept, disabled = false }) => {
  const handleAccept = () => {
    if (onAccept && !disabled) {
      onAccept(mission.id);
    }
  };

  return (
    <div className={`mission-card ${mission.type}`}>
      <div className="mission-header">
        <div className="mission-type">
          <span className="type-icon">
            {mission.type === 'passenger' ? '👥' : '📦'}
          </span>
          <span className="type-label">
            {mission.type === 'passenger' ? 'Passenger' : 'Cargo'}
          </span>
        </div>
        <div className="mission-reward">
          <span className="reward-amount">${mission.reward.toLocaleString()}</span>
        </div>
      </div>

      <div className="mission-route">
        <div className="airport-info">
          <div className="airport-icao">{mission.fromAirport.icao}</div>
          <div className="airport-name">{mission.fromAirport.city}</div>
        </div>
        <div className="route-arrow">✈️ →</div>
        <div className="airport-info">
          <div className="airport-icao">{mission.toAirport.icao}</div>
          <div className="airport-name">{mission.toAirport.city}</div>
        </div>
      </div>

      <div className="mission-details">
        <div className="detail-item">
          <span className="detail-label">Distance:</span>
          <span className="detail-value">{mission.distance} NM</span>
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
            <span className="detail-value">{mission.cargo.weight} kg</span>
          </div>
        )}
      </div>

      {mission.cargo && (
        <div className="cargo-description">{mission.cargo.description}</div>
      )}

      {onAccept && (
        <button
          className="accept-button"
          onClick={handleAccept}
          disabled={disabled}
        >
          Accept Mission
        </button>
      )}
    </div>
  );
};

export default MissionCard;
