import React from 'react';
import { Aircraft, AircraftMaintenance } from '../types';
import './AircraftCard.css';

interface AircraftCardProps {
  aircraft: Aircraft;
  isOwned?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  onMaintenance?: () => void;
  canAfford?: boolean;
  maintenance?: AircraftMaintenance;
}

const AircraftCard: React.FC<AircraftCardProps> = ({
  aircraft,
  isOwned = false,
  isSelected = false,
  onSelect,
  onBuy,
  onSell,
  onMaintenance,
  canAfford = true,
  maintenance,
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'passenger':
        return '👥';
      case 'cargo':
        return '📦';
      case 'both':
        return '🔄';
      default:
        return '✈️';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'passenger':
        return 'Passenger';
      case 'cargo':
        return 'Cargo';
      case 'both':
        return 'Multi-purpose';
      default:
        return type;
    }
  };

  return (
    <div className={`aircraft-card ${isSelected ? 'selected' : ''} ${aircraft.type}`}>
      {isSelected && <div className="selected-badge">✓ Selected</div>}

      <div className="aircraft-header">
        <h3 className="aircraft-name">{aircraft.name}</h3>
        <div className="aircraft-manufacturer">{aircraft.manufacturer}</div>
      </div>

      <div className="aircraft-type">
        <span className="type-icon">{getTypeIcon(aircraft.type)}</span>
        <span className="type-label">{getTypeLabel(aircraft.type)}</span>
      </div>

      <div className="aircraft-specs">
        <div className="spec-item">
          <span className="spec-icon">👥/📦</span>
          <div className="spec-info">
            <span className="spec-label">Capacity</span>
            <span className="spec-value">
              {aircraft.type === 'cargo' ? `${aircraft.capacity.toLocaleString()} kg` : `${aircraft.capacity} pax`}
            </span>
          </div>
        </div>

        <div className="spec-item">
          <span className="spec-icon">📏</span>
          <div className="spec-info">
            <span className="spec-label">Range</span>
            <span className="spec-value">{aircraft.range} NM</span>
          </div>
        </div>

        <div className="spec-item">
          <span className="spec-icon">⚡</span>
          <div className="spec-info">
            <span className="spec-label">Cruise Speed</span>
            <span className="spec-value">{aircraft.cruiseSpeed} kts</span>
          </div>
        </div>
      </div>

      {maintenance && (
        <div className={`aircraft-maintenance ${
          maintenance.isUnderMaintenance ? 'under-maintenance' :
          maintenance.condition < 30 ? 'critical' :
          maintenance.condition < 60 ? 'warning' : 'good'
        }`}>
          <div className="maintenance-header">
            <span className="maintenance-icon">
              {maintenance.isUnderMaintenance ? '🔧' :
               maintenance.condition < 30 ? '⚠️' :
               maintenance.condition < 60 ? '⚡' : '✅'}
            </span>
            <span className="maintenance-label">
              {maintenance.isUnderMaintenance ? 'En maintenance' : 'État'}
            </span>
          </div>
          <div className="maintenance-details">
            <div className="condition-bar">
              <div
                className="condition-fill"
                style={{ width: `${maintenance.condition}%` }}
              />
            </div>
            <div className="condition-text">{maintenance.condition}%</div>
          </div>
          <div className="flight-hours-text">
            {maintenance.flightHours}h / {aircraft.maxFlightHoursBeforeMaintenance}h
          </div>
        </div>
      )}

      <div className="aircraft-price">
        <span className="price-label">Price</span>
        <span className="price-amount">${aircraft.price.toLocaleString()}</span>
      </div>

      <div className="aircraft-actions">
        {isOwned && onSelect && (
          <button
            className={`select-button ${isSelected ? 'selected' : ''} ${maintenance?.isUnderMaintenance ? 'disabled' : ''}`}
            onClick={onSelect}
            disabled={isSelected || maintenance?.isUnderMaintenance}
          >
            {maintenance?.isUnderMaintenance ? '🔧 In Maintenance' : isSelected ? 'Selected' : 'Select'}
          </button>
        )}

        {isOwned && onMaintenance && maintenance && !maintenance.isUnderMaintenance && (
          <button
            className="maintenance-button"
            onClick={onMaintenance}
            disabled={maintenance.condition > 90}
          >
            🔧 Maintenance
          </button>
        )}

        {isOwned && onSell && !isSelected && (
          <button
            className="sell-button"
            onClick={onSell}
          >
            Sell (${Math.floor(aircraft.price * 0.7).toLocaleString()})
          </button>
        )}

        {!isOwned && onBuy && (
          <button
            className="buy-button"
            onClick={onBuy}
            disabled={!canAfford}
          >
            {canAfford ? 'Buy' : 'Not enough money'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AircraftCard;
