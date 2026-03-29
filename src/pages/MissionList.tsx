import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { usePopup } from '../context/PopupContext';
import { Mission, Airport } from '../types';
import { missionService } from '../services/missionService';
import { airportService } from '../services/airportService';
import { activeMissionService } from '../services/activeMissionService';
import MissionCard from '../components/MissionCard';
import './MissionList.css';

const MissionList: React.FC = () => {
  const { player, currentAirport, selectedAircraft, updateMoney, getAircraftMaintenance } = usePlayer();
  const popup = usePopup();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filteredMissions, setFilteredMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passenger' | 'cargo'>('all');

  // Track which airport's missions are being displayed
  const [displayedAirport, setDisplayedAirport] = useState<Airport | null>(null);
  const skipAutoReloadRef = useRef(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Airport[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchingMissions, setSearchingMissions] = useState(false);

  // Check for active missions
  const [hasActiveMission, setHasActiveMission] = useState(false);

  useEffect(() => {
    checkActiveMissions();
  }, [player]);

  const checkActiveMissions = async () => {
    if (!player) return;

    try {
      const activeMissions = await activeMissionService.getActiveMissions(player.id);
      setHasActiveMission(activeMissions.length > 0);
    } catch (error) {
      console.error('Error checking active missions:', error);
    }
  };

  useEffect(() => {
    if (!skipAutoReloadRef.current) {
      loadMissions();
    }
  }, [currentAirport?.id]);

  useEffect(() => {
    applyFilter();
  }, [missions, filter]);

  // Debounce airport search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchAirports();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchAirports = async () => {
    if (searchQuery.trim().length < 2) return;

    setSearching(true);
    try {
      const results = await airportService.searchAirports(searchQuery);
      setSearchResults(results.filter(a => a.id !== currentAirport?.id));
    } catch (error) {
      console.error('Error searching airports:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchMissionsFromAirport = async (airport: Airport) => {
    if (!player) return;

    if (player.money < 100) {
      return;
    }

    // IMPORTANT: Mettre le ref à true EN PREMIER, avant tout setState
    skipAutoReloadRef.current = true;

    setSearchingMissions(true);
    try {
      const searchedMissions = await missionService.searchMissionsFromAirport(
        player.id,
        airport.id
      );

      setDisplayedAirport(airport);
      setMissions(searchedMissions);
      setSearchQuery('');
      setSearchResults([]);

      // Just update money without full refresh to avoid re-loading missions
      await updateMoney(-100);
    } catch (error) {
      console.error('Error searching missions:', error);
    } finally {
      setSearchingMissions(false);
    }
  };

  const loadMissions = async () => {
    if (!currentAirport) return;

    setLoading(true);
    skipAutoReloadRef.current = false;
    try {
      const missionsData = await missionService.getMissionsByAirport(currentAirport.id);
      setMissions(missionsData);
      setDisplayedAirport(currentAirport);
    } catch (error) {
      console.error('Error loading missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    if (filter === 'all') {
      setFilteredMissions(missions);
    } else {
      setFilteredMissions(missions.filter(m => m.type === filter));
    }
  };

  const handleAcceptMission = async (missionId: string) => {
    if (!player || !selectedAircraft || !player.selectedAircraftId) {
      return;
    }

    // Vérifier que l'avion n'est pas en maintenance
    const maintenance = getAircraftMaintenance(player.selectedAircraftId);
    if (maintenance && maintenance.isUnderMaintenance) {
      popup.showError(
        'Aircraft Under Maintenance',
        `${selectedAircraft.name} is currently undergoing maintenance and cannot fly.\n\nPlease wait for the maintenance to complete or select another aircraft.`
      );
      return;
    }

    // Vérifier qu'on est bien à l'aéroport actuel
    if (displayedAirport && displayedAirport.id !== currentAirport?.id) {
      return;
    }

    // Vérifier qu'il n'y a pas déjà une mission active
    if (hasActiveMission) {
      return;
    }

    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    // Vérifier si l'avion peut faire cette mission
    if (mission.requiredAircraftType) {
      const canDoMission =
        selectedAircraft.type === mission.requiredAircraftType ||
        selectedAircraft.type === 'both';

      if (!canDoMission) {
        return;
      }
    }

    // Vérifier la portée
    if (selectedAircraft.range < mission.distance) {
      return;
    }

    // Vérifier la capacité
    if (mission.passengers && selectedAircraft.capacity < mission.passengers.count) {
      return;
    }

    try {
      // Accepter la mission avec l'ID de l'owned aircraft (player_aircraft.id)
      await activeMissionService.acceptMission(player.id, mission, player.selectedAircraftId);

      // Retirer la mission de la liste
      setMissions(missions.filter(m => m.id !== missionId));

      // Marquer qu'on a maintenant une mission active
      setHasActiveMission(true);
    } catch (error) {
      console.error('Error accepting mission:', error);
    }
  };

  if (!currentAirport) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="missions-container">
      <div className="missions-header">
        <h1>Available Missions</h1>
        <p className="subtitle">
          From {displayedAirport?.icao || currentAirport.icao} - {displayedAirport?.name || currentAirport.name}
        </p>
        {displayedAirport && displayedAirport.id !== currentAirport.id && (
          <button className="back-to-current-btn" onClick={loadMissions}>
            ← Back to {currentAirport.name} missions
          </button>
        )}
      </div>

      {!selectedAircraft && (
        <div className="warning-banner">
          ⚠️ No aircraft selected! Please select an aircraft from your hangar before accepting missions.
        </div>
      )}

      {displayedAirport && displayedAirport.id !== currentAirport?.id && (
        <div className="warning-banner" style={{ background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' }}>
          ℹ️ Viewing missions from {displayedAirport.icao}. You must be at this airport to accept missions.
        </div>
      )}

      {hasActiveMission && (
        <div className="warning-banner" style={{ background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)' }}>
          ⚠️ You already have an active mission! Complete or cancel it before accepting a new one.
        </div>
      )}

      {/* Search for missions from specific airport */}
      <div className="mission-search-section">
        <h3>🔍 Search Missions From Another Airport</h3>
        <p className="search-info">See what missions are available at other airports - Cost: $100 per search</p>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search airport by ICAO, name, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searching && <div className="search-spinner">Searching...</div>}
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((airport) => (
              <div key={airport.id} className="search-result-item">
                <div className="airport-info">
                  <strong>{airport.icao}</strong> - {airport.name}
                  <div className="airport-location">{airport.city}, {airport.country}</div>
                </div>
                <button
                  className="search-mission-btn"
                  onClick={() => handleSearchMissionsFromAirport(airport)}
                  disabled={searchingMissions}
                >
                  {searchingMissions ? 'Searching...' : 'View Missions ($100)'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="missions-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Missions ({missions.length})
        </button>
        <button
          className={`filter-btn ${filter === 'passenger' ? 'active' : ''}`}
          onClick={() => setFilter('passenger')}
        >
          👥 Passenger ({missions.filter(m => m.type === 'passenger').length})
        </button>
        <button
          className={`filter-btn ${filter === 'cargo' ? 'active' : ''}`}
          onClick={() => setFilter('cargo')}
        >
          📦 Cargo ({missions.filter(m => m.type === 'cargo').length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading missions...</div>
      ) : filteredMissions.length === 0 ? (
        <div className="no-missions">
          <div className="no-missions-icon">✈️</div>
          <h2>No missions available</h2>
          <p>Check back later for new opportunities!</p>
        </div>
      ) : (
        <div className="missions-grid">
          {filteredMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onAccept={handleAcceptMission}
              disabled={!selectedAircraft || (displayedAirport?.id !== currentAirport?.id) || hasActiveMission}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MissionList;
