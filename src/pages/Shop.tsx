import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Aircraft } from '../types';
import { aircraftService } from '../services/aircraftService';
import AircraftCard from '../components/AircraftCard';
import './Shop.css';

const Shop: React.FC = () => {
  const { player, ownedAircraft, purchaseAircraft } = usePlayer();
  const [allAircraft, setAllAircraft] = useState<Aircraft[]>([]);
  const [filteredAircraft, setFilteredAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passenger' | 'cargo' | 'both'>('all');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'affordable'>('all');

  useEffect(() => {
    loadAircraft();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allAircraft, filter, budgetFilter, player]);

  const loadAircraft = async () => {
    setLoading(true);
    try {
      const aircraftData = await aircraftService.getAllAircraft();
      setAllAircraft(aircraftData);
    } catch (error) {
      console.error('Error loading aircraft:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allAircraft];

    // Filtre par type
    if (filter !== 'all') {
      filtered = filtered.filter(a => a.type === filter);
    }

    // Filtre par budget
    if (budgetFilter === 'affordable' && player) {
      filtered = filtered.filter(a => a.price <= player.money);
    }

    setFilteredAircraft(filtered);
  };

  const handleBuy = async (aircraftId: string) => {
    const aircraft = allAircraft.find(a => a.id === aircraftId);
    if (!aircraft || !player) return;

    if (player.money < aircraft.price) {
      alert('Not enough money to purchase this aircraft!');
      return;
    }

    const confirmMessage = `Purchase ${aircraft.name} for $${aircraft.price.toLocaleString()}?\n\nYour balance: $${player.money.toLocaleString()}\nAfter purchase: $${(player.money - aircraft.price).toLocaleString()}`;

    if (confirm(confirmMessage)) {
      const success = await purchaseAircraft(aircraftId, aircraft.price);
      if (success) {
        alert('Aircraft purchased successfully!');
      } else {
        alert('Failed to purchase aircraft. Please try again.');
      }
    }
  };

  const isOwned = (aircraftId: string) => {
    return ownedAircraft.some(a => a.id === aircraftId);
  };

  const canAfford = (price: number) => {
    return player ? player.money >= price : false;
  };

  if (loading) {
    return <div className="loading">Loading shop...</div>;
  }

  return (
    <div className="shop-container">
      <div className="shop-header">
        <h1>🛒 Aircraft Shop</h1>
        <p className="subtitle">Expand your fleet with new aircraft</p>
      </div>

      <div className="shop-balance">
        <span className="balance-label">Your Balance:</span>
        <span className="balance-amount">${player?.money.toLocaleString() || 0}</span>
      </div>

      <div className="shop-filters">
        <div className="filter-group">
          <label>Type:</label>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'passenger' ? 'active' : ''}`}
              onClick={() => setFilter('passenger')}
            >
              👥 Passenger
            </button>
            <button
              className={`filter-btn ${filter === 'cargo' ? 'active' : ''}`}
              onClick={() => setFilter('cargo')}
            >
              📦 Cargo
            </button>
            <button
              className={`filter-btn ${filter === 'both' ? 'active' : ''}`}
              onClick={() => setFilter('both')}
            >
              🔄 Multi-purpose
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>Budget:</label>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${budgetFilter === 'all' ? 'active' : ''}`}
              onClick={() => setBudgetFilter('all')}
            >
              All Prices
            </button>
            <button
              className={`filter-btn ${budgetFilter === 'affordable' ? 'active' : ''}`}
              onClick={() => setBudgetFilter('affordable')}
            >
              💰 Affordable
            </button>
          </div>
        </div>
      </div>

      <div className="shop-count">
        Showing {filteredAircraft.length} aircraft
      </div>

      {filteredAircraft.length === 0 ? (
        <div className="no-aircraft">
          <div className="no-aircraft-icon">🔍</div>
          <h2>No aircraft found</h2>
          <p>Try adjusting your filters</p>
        </div>
      ) : (
        <div className="aircraft-grid">
          {filteredAircraft.map((aircraft) => {
            const owned = isOwned(aircraft.id);
            return (
              <div key={aircraft.id} className="aircraft-wrapper">
                {owned && <div className="owned-badge">✓ Owned</div>}
                <AircraftCard
                  aircraft={aircraft}
                  isOwned={false}
                  onBuy={owned ? undefined : handleBuy}
                  canAfford={canAfford(aircraft.price)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="shop-info">
        <h3>💡 Shopping Tips</h3>
        <ul>
          <li>Consider your mission types when choosing aircraft</li>
          <li>Larger aircraft can carry more but cost more to operate</li>
          <li>Multi-purpose aircraft offer flexibility for different missions</li>
          <li>You can sell aircraft from your hangar for 70% of the purchase price</li>
        </ul>
      </div>
    </div>
  );
};

export default Shop;
