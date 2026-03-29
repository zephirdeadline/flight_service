import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { usePopup } from '../context/PopupContext';
import { MarketAircraft } from '../types';
import { marketService } from '../services/marketService';
import './Shop.css';

const Shop: React.FC = () => {
  const { player, currentAirport, refreshPlayer } = usePlayer();
  const popup = usePopup();
  const [allMarketAircraft, setAllMarketAircraft] = useState<MarketAircraft[]>([]);
  const [filteredAircraft, setFilteredAircraft] = useState<MarketAircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passenger' | 'cargo' | 'both'>('all');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'affordable'>('all');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'new' | 'used'>('all');

  useEffect(() => {
    loadMarketAircraft();
  }, [player]);

  useEffect(() => {
    applyFilters();
  }, [allMarketAircraft, filter, budgetFilter, conditionFilter, player]);

  const loadMarketAircraft = async () => {
    if (!player) return;

    setLoading(true);
    try {
      const marketData = await marketService.getMarketAircraft(player.id);
      setAllMarketAircraft(marketData);
    } catch (error) {
      console.error('Error loading market aircraft:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allMarketAircraft];

    // Filtre par type
    if (filter !== 'all') {
      filtered = filtered.filter(a => a.aircraft.type === filter);
    }

    // Filtre par budget
    if (budgetFilter === 'affordable' && player) {
      filtered = filtered.filter(a => a.price <= player.money);
    }

    // Filtre par condition
    if (conditionFilter === 'new') {
      filtered = filtered.filter(a => {
        const isNew = a.condition === 100 && a.flightHours < 0.01;
        return isNew;
      });
    } else if (conditionFilter === 'used') {
      filtered = filtered.filter(a => {
        const isUsed = a.condition < 100 || a.flightHours >= 0.01;
        return isUsed;
      });
    }

    setFilteredAircraft(filtered);
  };

  const handleBuy = async (marketOfferId: string) => {
    const marketOffer = allMarketAircraft.find(a => a.id === marketOfferId);
    if (!marketOffer || !player) return;

    if (player.money < marketOffer.price) {
      popup.showError(
        'Not Enough Money',
        'You need more money to purchase this aircraft!'
      );
      return;
    }

    const catalogPrice = marketOffer.aircraft.price;
    const discount = catalogPrice > 0 ? Math.round(((catalogPrice - marketOffer.price) / catalogPrice) * 100) : 0;
    const isNew = marketOffer.condition === 100 && marketOffer.flightHours < 0.01;

    const conditionInfo = isNew
      ? '🆕 Condition: New (100%)'
      : `📊 Condition: ${marketOffer.condition}%\n⏱️ Flight Hours: ${marketOffer.flightHours.toFixed(1)}h`;

    const discountInfo = discount > 0 ? `💰 Discount: ${discount}% off catalog price` : '';
    const locationInfo = `📍 Location: ${marketOffer.location.icao} - ${marketOffer.location.name} (${marketOffer.distance} NM away)`;

    const confirmMessage = `${conditionInfo}\n${discountInfo ? discountInfo + '\n' : ''}${locationInfo}\n\nYour balance: $${player.money.toLocaleString()}\nAfter purchase: $${(player.money - marketOffer.price).toLocaleString()}`;

    popup.showConfirm(
      `Purchase ${marketOffer.aircraft.name}?`,
      confirmMessage,
      async () => {
        try {
          await marketService.purchaseMarketAircraft(
            player.id,
            marketOffer.aircraft.id,
            marketOffer.price,
            marketOffer.location.id,
            marketOffer.condition,
            marketOffer.flightHours
          );
          popup.showSuccess(
            'Purchase Successful!',
            `${marketOffer.aircraft.name} is now yours!\nIt will be available at ${marketOffer.location.icao}`
          );
          await refreshPlayer();
          loadMarketAircraft();
        } catch (error) {
          console.error('Purchase failed:', error);
          popup.showError(
            'Purchase Failed',
            'Failed to purchase aircraft. Please try again.'
          );
        }
      }
    );
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

      {currentAirport && (
        <div className="shop-delivery-info">
          <div className="delivery-icon">🌍</div>
          <div className="delivery-text">
            <strong>Your Location:</strong>{' '}
            <span className="delivery-airport">{currentAirport.icao} - {currentAirport.name}</span>
            <br />
            <small>Market shows aircraft within 1000 NM • Daily refreshed offers</small>
          </div>
        </div>
      )}

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

        <div className="filter-group">
          <label>Condition:</label>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${conditionFilter === 'all' ? 'active' : ''}`}
              onClick={() => setConditionFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${conditionFilter === 'new' ? 'active' : ''}`}
              onClick={() => setConditionFilter('new')}
            >
              🆕 New
            </button>
            <button
              className={`filter-btn ${conditionFilter === 'used' ? 'active' : ''}`}
              onClick={() => setConditionFilter('used')}
            >
              📊 Used
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
          <h2>No aircraft available</h2>
          <p>Try adjusting your filters or check back tomorrow for new offers!</p>
        </div>
      ) : (
        <div className="market-grid">
          {filteredAircraft.map((marketOffer) => {
            const isNew = marketOffer.condition === 100 && marketOffer.flightHours < 0.01;
            const catalogPrice = marketOffer.aircraft.price;
            const discount = catalogPrice > 0 ? Math.round(((catalogPrice - marketOffer.price) / catalogPrice) * 100) : 0;
            const getTypeIcon = (type: string) => {
              switch (type) {
                case 'passenger': return '👥';
                case 'cargo': return '📦';
                case 'both': return '🔄';
                default: return '✈️';
              }
            };

            return (
              <div key={marketOffer.id} className="market-card">
                {/* Badges */}
                <div className="market-badges">
                  <div className={`condition-badge ${isNew ? 'new' : 'used'}`}>
                    {isNew ? '🆕 NEW' : '📊 USED'}
                  </div>
                  {discount > 0 && (
                    <div className="discount-badge">-{discount}%</div>
                  )}
                </div>

                {/* Header */}
                <div className="market-card-header">
                  <div className="aircraft-type-icon">{getTypeIcon(marketOffer.aircraft.type)}</div>
                  <div className="aircraft-info">
                    <h3>{marketOffer.aircraft.name}</h3>
                    <p>{marketOffer.aircraft.manufacturer}</p>
                  </div>
                </div>

                {/* Condition Bar */}
                <div className="condition-section">
                  <div className="condition-bar-container">
                    <div
                      className={`condition-bar-fill ${
                        marketOffer.condition >= 90 ? 'excellent' :
                        marketOffer.condition >= 75 ? 'good' :
                        marketOffer.condition >= 60 ? 'fair' : 'poor'
                      }`}
                      style={{ width: `${marketOffer.condition}%` }}
                    />
                  </div>
                  <div className="condition-info">
                    <span className="condition-percent">{marketOffer.condition}%</span>
                    <span className="flight-hours">⏱️ {marketOffer.flightHours.toFixed(1)}h</span>
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="market-specs">
                  <div className="spec-item">
                    <div className="spec-icon">👥/📦</div>
                    <div className="spec-value">
                      {marketOffer.aircraft.type === 'cargo'
                        ? `${marketOffer.aircraft.capacity.toLocaleString()} kg`
                        : `${marketOffer.aircraft.capacity} pax`}
                    </div>
                  </div>
                  <div className="spec-item">
                    <div className="spec-icon">📏</div>
                    <div className="spec-value">{marketOffer.aircraft.range} NM</div>
                  </div>
                  <div className="spec-item">
                    <div className="spec-icon">⚡</div>
                    <div className="spec-value">{marketOffer.aircraft.cruiseSpeed} kts</div>
                  </div>
                </div>

                {/* Location */}
                <div className="market-location">
                  <div className="location-icon">📍</div>
                  <div className="location-details">
                    <div className="location-name">{marketOffer.location.icao} - {marketOffer.location.name}</div>
                    <div className="location-distance">{marketOffer.distance} NM away</div>
                  </div>
                </div>

                {/* Price */}
                <div className="market-price">
                  {discount > 0 ? (
                    <>
                      <div className="price-original">${catalogPrice.toLocaleString()}</div>
                      <div className="price-current">${marketOffer.price.toLocaleString()}</div>
                    </>
                  ) : (
                    <div className="price-current">${marketOffer.price.toLocaleString()}</div>
                  )}
                </div>

                {/* Buy Button */}
                <button
                  className={`market-buy-button ${canAfford(marketOffer.price) ? '' : 'disabled'}`}
                  onClick={() => handleBuy(marketOffer.id)}
                  disabled={!canAfford(marketOffer.price)}
                >
                  {canAfford(marketOffer.price) ? '🛒 Purchase' : '💸 Not enough money'}
                </button>
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
