import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { simConnectService } from '../services/simConnectService';
import type { AircraftPosition } from '../types';
import './Data.css';

export default function Data() {
  const [data, setData] = useState<AircraftPosition | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    autoConnect();
    return () => {
      simConnectService.stopStreaming();
    };
  }, []);

  const autoConnect = async () => {
    try {
      const already = await simConnectService.isConnected();
      if (already) {
        setIsConnected(true);
        const streaming = await simConnectService.isStreaming();
        if (!streaming) await simConnectService.startStreaming();
        return;
      }
      setLoading(true);
      await simConnectService.connect();
      await simConnectService.startStreaming();
      setIsConnected(true);
    } catch (err) {
      setError(`MSFS not detected: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await simConnectService.connect();
      await simConnectService.startStreaming();
      setIsConnected(true);
    } catch (err) {
      setError(`Failed to connect: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await simConnectService.stopStreaming();
      await simConnectService.disconnect();
      setIsConnected(false);
      setData(null);
    } catch (err) {
      setError(`Failed to disconnect: ${err}`);
    }
  };

  const handleRefresh = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const position = await simConnectService.getPosition();
      console.log('[SimConnect] Position fetched:', position);
      setData(position);
    } catch (err) {
      setError(`Failed to get data: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Écouter les événements de données depuis le backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<AircraftPosition>('simconnect-data', (event) => {
        console.log('[SimConnect] Data received:', event.payload);
        setData(event.payload);
        setError(null);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const renderGauge = (value: number, max: number, label: string, unit: string) => {
    const percentage = Math.min((value / max) * 100, 100);
    return (
      <div className="gauge">
        <div className="gauge-label">{label}</div>
        <div className="gauge-bar">
          <div
            className="gauge-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="gauge-value">{value.toFixed(1)} {unit}</div>
      </div>
    );
  };

  const renderEngine = (engineNum: number, rpm: number, fuelFlow: number) => {
    if (rpm === 0 && fuelFlow === 0) return null;
    return (
      <div key={engineNum} className="engine-card">
        <h4>Engine {engineNum}</h4>
        {renderGauge(rpm, 3000, 'RPM', 'rpm')}
        {renderGauge(fuelFlow, 30, 'Fuel Flow', 'gph')}
      </div>
    );
  };

  return (
    <div className="data-page">
      <div className="data-header">
        <h1>✈️ Aircraft Data</h1>
        <div className="data-controls">
          {!isConnected ? (
            <button onClick={handleConnect} disabled={loading} className="btn-connect">
              {loading ? 'Connecting...' : '🔌 Connect to Simulator'}
            </button>
          ) : (
            <>
              <button onClick={handleRefresh} disabled={loading} className="btn-refresh">
                🔄 Refresh
              </button>
              <button onClick={handleDisconnect} className="btn-disconnect">
                ⏹️ Disconnect
              </button>
              <span className="connection-status connected">● Connected</span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="data-error">
          ⚠️ {error}
        </div>
      )}

      {!isConnected && !error && (
        <div className="data-placeholder">
          <p>Connect to Flight Simulator 2024 to view real-time aircraft data</p>
        </div>
      )}

      {isConnected && !data && (
        <div className="data-loading">
          Loading data...
        </div>
      )}

      {data && (
        <div className="data-content">
          {/* Position & Navigation */}
          <section className="data-section">
            <h2>📍 Position & Navigation</h2>
            <div className="data-grid">
              <div className="data-item">
                <span className="label">Latitude</span>
                <span className="value">{data.latitude.toFixed(6)}°</span>
              </div>
              <div className="data-item">
                <span className="label">Longitude</span>
                <span className="value">{data.longitude.toFixed(6)}°</span>
              </div>
              <div className="data-item">
                <span className="label">Altitude MSL</span>
                <span className="value">{data.altitude.toFixed(0)} ft</span>
              </div>
              <div className="data-item">
                <span className="label">Altitude AGL</span>
                <span className="value">{data.plane_alt_above_ground.toFixed(0)} ft</span>
              </div>
              <div className="data-item">
                <span className="label">Heading</span>
                <span className="value">{data.heading.toFixed(0)}°</span>
              </div>
              <div className="data-item">
                <span className="label">Ground Speed</span>
                <span className="value">{data.ground_velocity.toFixed(1)} kts</span>
              </div>
              <div className="data-item">
                <span className="label">Airspeed (IAS)</span>
                <span className="value">{data.airspeed_indicated.toFixed(1)} kts</span>
              </div>
              <div className="data-item">
                <span className="label">Airspeed (TAS)</span>
                <span className="value">{data.airspeed_true.toFixed(1)} kts</span>
              </div>
              <div className="data-item">
                <span className="label">Vertical Speed</span>
                <span className={`value ${data.vertical_speed > 0 ? 'positive' : data.vertical_speed < 0 ? 'negative' : ''}`}>
                  {data.vertical_speed > 0 ? '+' : ''}{data.vertical_speed.toFixed(0)} fpm
                </span>
              </div>
            </div>
          </section>

          {/* État du vol */}
          <section className="data-section">
            <h2>🛬 Flight Status</h2>
            <div className="status-grid">
              <div className={`status-badge ${data.sim_on_ground ? 'on-ground' : 'airborne'}`}>
                {data.sim_on_ground ? '🛬 On Ground' : '✈️ Airborne'}
              </div>
              <div className={`status-badge ${data.crash_flag ? 'crashed' : 'ok'}`}>
                {data.crash_flag ? '💥 Crashed' : '✅ OK'}
              </div>
              <div className={`status-badge ${data.gear_handle_position ? 'gear-down' : 'gear-up'}`}>
                {data.gear_handle_position ? '⬇️ Gear Down' : '⬆️ Gear Up'}
              </div>
            </div>
          </section>

          {/* Fuel */}
          <section className="data-section">
            <h2>⛽ Fuel</h2>
            <div className="fuel-gauges">
              {renderGauge(data.fuel_total_quantity, 100, 'Total', 'gal')}
              {renderGauge(data.fuel_tank_left_main, 50, 'Left Tank', 'gal')}
              {renderGauge(data.fuel_tank_right_main, 50, 'Right Tank', 'gal')}
              {data.fuel_tank_center > 0 && renderGauge(data.fuel_tank_center, 100, 'Center Tank', 'gal')}
            </div>
            <div className="data-item">
              <span className="label">Fuel Weight</span>
              <span className="value">{data.fuel_weight.toFixed(1)} kg</span>
            </div>
          </section>

          {/* Moteurs */}
          <section className="data-section">
            <h2>🔧 Engines ({data.number_of_engines.toFixed(0)})</h2>
            <div className="engines-grid">
              {renderEngine(1, data.engine_1_rpm, data.engine_1_fuel_flow)}
              {renderEngine(2, data.engine_2_rpm, data.engine_2_fuel_flow)}
              {renderEngine(3, data.engine_3_rpm, data.engine_3_fuel_flow)}
              {renderEngine(4, data.engine_4_rpm, data.engine_4_fuel_flow)}
              {renderEngine(5, data.engine_5_rpm, data.engine_5_fuel_flow)}
              {renderEngine(6, data.engine_6_rpm, data.engine_6_fuel_flow)}
              {renderEngine(7, data.engine_7_rpm, data.engine_7_fuel_flow)}
              {renderEngine(8, data.engine_8_rpm, data.engine_8_fuel_flow)}
            </div>
          </section>

          {/* Poids */}
          <section className="data-section">
            <h2>⚖️ Weight & Balance</h2>
            <div className="data-grid">
              <div className="data-item highlight">
                <span className="label">Total Weight</span>
                <span className="value">{data.total_weight.toFixed(0)} kg</span>
              </div>
              <div className="data-item">
                <span className="label">Empty Weight</span>
                <span className="value">{data.empty_weight.toFixed(0)} kg</span>
              </div>
              <div className="data-item">
                <span className="label">Payload</span>
                <span className="value">{(data.total_weight - data.empty_weight - data.fuel_weight).toFixed(0)} kg</span>
              </div>
            </div>
          </section>

          {/* Payload Stations */}
          {data.payload_station_count > 0 && (
            <section className="data-section">
              <h2>📦 Payload Stations ({data.payload_station_count.toFixed(0)})</h2>
              <div className="payload-list">
                {[
                  data.payload_station_weight_1,
                  data.payload_station_weight_2,
                  data.payload_station_weight_3,
                  data.payload_station_weight_4,
                  data.payload_station_weight_5,
                  data.payload_station_weight_6,
                  data.payload_station_weight_7,
                  data.payload_station_weight_8,
                  data.payload_station_weight_9,
                  data.payload_station_weight_10,
                ].slice(0, data.payload_station_count).map((weight, i) => (
                  <div key={i + 1} className="payload-station">
                    <span className="station-name">Station {i + 1}</span>
                    <span className="station-weight">{weight.toFixed(1)} kg</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Warnings */}
          <section className="data-section">
            <h2>⚠️ Warnings</h2>
            <div className="warnings-grid">
              <div className={`warning-item ${data.stall_warning ? 'active' : 'inactive'}`}>
                {data.stall_warning ? '🔴' : '🟢'} Stall Warning
              </div>
              <div className={`warning-item ${data.overspeed_warning ? 'active' : 'inactive'}`}>
                {data.overspeed_warning ? '🔴' : '🟢'} Overspeed Warning
              </div>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
