import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import Header from './components/Header';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import MissionList from './pages/MissionList';
import ActiveMissions from './pages/ActiveMissions';
import Hangar from './pages/Hangar';
import Shop from './pages/Shop';
import Airports from './pages/Airports';
import './App.css';

const AppContent: React.FC = () => {
  const { player, loading } = usePlayer();
  const [needsSetup, setNeedsSetup] = useState(true);

  useEffect(() => {
    // Vérifier si le joueur a été initialisé
    if (!loading) {
      setNeedsSetup(!player || !player.currentAirportId || player.ownedAircraftIds.length === 0);
    }
  }, [player, loading]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">✈️</div>
        <div className="loading-text">Loading Flight Service...</div>
      </div>
    );
  }

  // Si le joueur n'est pas configuré, rediriger vers Setup
  if (needsSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // Sinon, afficher l'application normale avec Header
  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/missions" element={<MissionList />} />
          <Route path="/active-missions" element={<ActiveMissions />} />
          <Route path="/hangar" element={<Hangar />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/airports" element={<Airports />} />
          <Route path="/setup" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <PlayerProvider>
        <AppContent />
      </PlayerProvider>
    </Router>
  );
}

export default App;
