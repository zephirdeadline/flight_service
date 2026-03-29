import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import './Header.css';

const Header: React.FC = () => {
  const { player, currentAirport } = usePlayer();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="app-title">Flight Service Career</h1>
          {currentAirport && (
            <div className="current-location">
              <span className="location-icon">📍</span>
              <span className="location-text">
                {currentAirport.icao} - {currentAirport.name}
              </span>
            </div>
          )}
        </div>

        <nav className="header-nav">
          <Link to="/" className={isActive('/') ? 'nav-link active' : 'nav-link'}>
            Dashboard
          </Link>
          <Link to="/missions" className={isActive('/missions') ? 'nav-link active' : 'nav-link'}>
            Missions
          </Link>
          <Link to="/active-missions" className={isActive('/active-missions') ? 'nav-link active' : 'nav-link'}>
            Active
          </Link>
          <Link to="/hangar" className={isActive('/hangar') ? 'nav-link active' : 'nav-link'}>
            Hangar
          </Link>
          <Link to="/shop" className={isActive('/shop') ? 'nav-link active' : 'nav-link'}>
            Shop
          </Link>
          <Link to="/airports" className={isActive('/airports') ? 'nav-link active' : 'nav-link'}>
            Airports
          </Link>
          <Link to="/cheat" className={isActive('/cheat') ? 'nav-link cheat-link active' : 'nav-link cheat-link'}>
            🎮 Cheat
          </Link>
        </nav>

        <div className="header-right">
          <div className="money-display">
            <span className="money-icon">💰</span>
            <span className="money-amount">
              ${player?.money.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
