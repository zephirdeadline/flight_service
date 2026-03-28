import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { maintenanceService } from '../services/maintenanceService';
import AircraftCard from '../components/AircraftCard';
import './Hangar.css';

const Hangar: React.FC = () => {
  const {
    ownedAircraft,
    selectedAircraft,
    selectAircraft,
    sellAircraft,
    startMaintenance,
    getAircraftMaintenance,
    player,
    loading,
  } = usePlayer();

  const handleSelect = async (aircraftId: string) => {
    await selectAircraft(aircraftId);
  };

  const handleSell = async (aircraftId: string) => {
    const aircraft = ownedAircraft.find(a => a.id === aircraftId);
    if (!aircraft) return;

    const sellPrice = Math.floor(aircraft.price * 0.7);
    const confirmMessage = `Sell ${aircraft.name} for $${sellPrice.toLocaleString()}?\n\nYou'll get 70% of the original price.`;

    if (confirm(confirmMessage)) {
      await sellAircraft(aircraftId);
    }
  };

  const handleMaintenance = async (aircraftId: string) => {
    const aircraft = ownedAircraft.find(a => a.id === aircraftId);
    const maintenance = getAircraftMaintenance(aircraftId);

    if (!aircraft || !maintenance || !player) return;

    const cost = maintenanceService.calculateMaintenanceCost(aircraft, maintenance);
    const maintenanceHours = maintenanceService.calculateMaintenanceTime(maintenance.flightHours);

    const confirmMessage = `Start maintenance for ${aircraft.name}?\n\nCost: $${cost.toLocaleString()}\nEstimated time: ${maintenanceHours} hours\n\nYour balance: $${player.money.toLocaleString()}`;

    if (player.money < cost) {
      alert('Not enough money for maintenance!');
      return;
    }

    if (confirm(confirmMessage)) {
      const success = await startMaintenance(aircraftId, 'routine');
      if (success) {
        alert(`Maintenance started! Your ${aircraft.name} will be ready in ${maintenanceHours} hours.`);
      } else {
        alert('Failed to start maintenance. Please try again.');
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading hangar...</div>;
  }

  return (
    <div className="hangar-container">
      <div className="hangar-header">
        <h1>🏠 My Hangar</h1>
        <p className="subtitle">Manage your fleet of aircraft</p>
      </div>

      <div className="hangar-stats">
        <div className="hangar-stat">
          <span className="stat-label">Total Aircraft:</span>
          <span className="stat-value">{ownedAircraft.length}</span>
        </div>
        <div className="hangar-stat">
          <span className="stat-label">Fleet Value:</span>
          <span className="stat-value">
            ${ownedAircraft.reduce((sum, a) => sum + a.price, 0).toLocaleString()}
          </span>
        </div>
      </div>

      {selectedAircraft && (
        <div className="selected-aircraft-banner">
          <div className="banner-icon">✈️</div>
          <div className="banner-content">
            <div className="banner-label">Currently Selected:</div>
            <div className="banner-aircraft">{selectedAircraft.name}</div>
          </div>
        </div>
      )}

      {ownedAircraft.length === 0 ? (
        <div className="empty-hangar">
          <div className="empty-icon">🏗️</div>
          <h2>Your hangar is empty</h2>
          <p>Visit the shop to purchase your first aircraft!</p>
        </div>
      ) : (
        <div className="aircraft-grid">
          {ownedAircraft.map((aircraft) => (
            <AircraftCard
              key={aircraft.id}
              aircraft={aircraft}
              isOwned={true}
              isSelected={selectedAircraft?.id === aircraft.id}
              onSelect={handleSelect}
              onSell={handleSell}
              onMaintenance={handleMaintenance}
              maintenance={getAircraftMaintenance(aircraft.id)}
            />
          ))}
        </div>
      )}

      <div className="hangar-info">
        <h3>💡 Tips</h3>
        <ul>
          <li>Select an aircraft before accepting missions</li>
          <li>Monitor aircraft condition - maintenance is required when condition is low</li>
          <li>Aircraft in maintenance cannot fly until service is complete</li>
          <li>Regular maintenance prevents critical failures and expensive repairs</li>
          <li>You can sell aircraft for 70% of their original value</li>
          <li>Different aircraft have different maintenance costs and schedules</li>
        </ul>
      </div>
    </div>
  );
};

export default Hangar;
