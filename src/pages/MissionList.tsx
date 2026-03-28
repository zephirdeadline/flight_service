import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Mission } from '../types';
import { missionService } from '../services/missionService';
import MissionCard from '../components/MissionCard';
import './MissionList.css';

const MissionList: React.FC = () => {
  const { player, currentAirport, selectedAircraft } = usePlayer();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filteredMissions, setFilteredMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passenger' | 'cargo'>('all');

  useEffect(() => {
    loadMissions();
  }, [currentAirport]);

  useEffect(() => {
    applyFilter();
  }, [missions, filter]);

  const loadMissions = async () => {
    if (!currentAirport) return;

    setLoading(true);
    try {
      const missionsData = await missionService.getMissionsByAirport(currentAirport.id);
      setMissions(missionsData);
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
    if (!player || !selectedAircraft) {
      alert('Please select an aircraft before accepting a mission!');
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
        alert(`This mission requires a ${mission.requiredAircraftType} aircraft!`);
        return;
      }
    }

    // Vérifier la portée
    if (selectedAircraft.range < mission.distance) {
      alert('Your selected aircraft does not have enough range for this mission!');
      return;
    }

    // Vérifier la capacité
    if (mission.passengers && selectedAircraft.capacity < mission.passengers.count) {
      alert('Your selected aircraft does not have enough capacity for this mission!');
      return;
    }

    const confirmMessage = `Accept mission from ${mission.fromAirport.icao} to ${mission.toAirport.icao}?\n\nReward: $${mission.reward.toLocaleString()}`;

    if (confirm(confirmMessage)) {
      alert('Mission accepted! (Flight simulation not yet implemented)\n\nFor demo purposes, the mission is automatically completed.');

      // Compléter la mission (cela mettra à jour l'argent et changera l'aéroport)
      try {
        await missionService.completeMission(missionId, player.id, currentAirport.id);
        // Note: dans une vraie app, on utiliserait le context pour updater
        // Pour le moment, on simule juste
        window.location.reload(); // Recharger pour voir les changements
      } catch (error) {
        console.error('Error completing mission:', error);
      }
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
          From {currentAirport.icao} - {currentAirport.name}
        </p>
      </div>

      {!selectedAircraft && (
        <div className="warning-banner">
          ⚠️ No aircraft selected! Please select an aircraft from your hangar before accepting missions.
        </div>
      )}

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
              disabled={!selectedAircraft}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MissionList;
