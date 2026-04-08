import React from 'react';
import { Mission } from '../types';
import './MissionCard.css';

interface MissionCardProps {
  mission: Mission;
  onAccept?: (missionId: string) => void;
  disabledReason?: string;
}

const MissionCard: React.FC<MissionCardProps> = ({ mission, onAccept, disabledReason }) => {
  const disabled = !!disabledReason;

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

        {mission.passengers && (() => {
          const totalWeight = mission.passengers.list.reduce((s, p) => s + p.weight + p.baggage, 0);
          return (
            <div className="detail-item">
              <span className="detail-label">Passengers:</span>
              <span className="detail-value">{mission.passengers.count} pax · {totalWeight} kg</span>
            </div>
          );
        })()}

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

      {mission.passengers && (
        <details className="pax-details">
          <summary>Détail passagers</summary>
          <div className="pax-details-list">
            <div className="pax-details-header">
              <span>Pax</span>
              <span>Corps</span>
              <span>🧳 Bagages</span>
              <span>Total</span>
            </div>
            {mission.passengers.list.map((p, i) => (
              <div key={i} className="pax-details-row">
                <span>#{i + 1}</span>
                <span>{p.weight} kg</span>
                <span>{p.baggage} kg</span>
                <span className="pax-details-total">{p.weight + p.baggage} kg</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {onAccept && (
        <button
          className={`accept-button ${disabled ? 'disabled-reason' : ''}`}
          onClick={handleAccept}
          disabled={disabled}
          title={disabledReason}
        >
          {disabled ? disabledReason : 'Accept Mission'}
        </button>
      )}
    </div>
  );
};

export default MissionCard;
