import React, { useCallback, useEffect, useRef } from 'react';
import { useSimConnect } from '../context/SimConnectContext';
import './Map.css';

interface TrailPoint {
  lat: number;
  lon: number;
}

// OSM slippy map constants
const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 15;
const MAX_TRAIL = 2000;

// Module-level tile cache (persists across renders)
const tileCache = new Map<string, HTMLImageElement>();

// Web Mercator projection: lat/lon → fractional tile coordinates
const lon2tile = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z);
const lat2tile = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};

const FlightMap: React.FC = () => {
  const { lastData, isConnected } = useSimConnect();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const zoomRef = useRef(6); // OSM zoom level (float, supports fractional)
  const lastDataRef = useRef(lastData);
  const redrawPendingRef = useRef(false);

  useEffect(() => {
    lastDataRef.current = lastData;
  }, [lastData]);

  // Fetch an OSM tile, draw it when loaded, return cached image if ready
  const getTile = useCallback(
    (tx: number, ty: number, tz: number, scheduleRedraw: () => void): HTMLImageElement | null => {
      const key = `${tz}/${tx}/${ty}`;
      const cached = tileCache.get(key);
      if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `https://tile.openstreetmap.org/${tz}/${tx}/${ty}.png`;
      img.onload = () => {
        tileCache.set(key, img);
        scheduleRedraw();
      };
      tileCache.set(key, img); // store as pending
      return null;
    },
    [],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const data = lastDataRef.current;
    const zoom = zoomRef.current;

    const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
    const scale = Math.pow(2, zoom - tz); // sub-level scale factor
    const ts = TILE_SIZE * scale; // scaled tile size in pixels

    const centerLat = data?.latitude ?? 46.0;
    const centerLon = data?.longitude ?? 2.0;

    // Fractional tile position of the center point
    const cTileX = lon2tile(centerLon, tz);
    const cTileY = lat2tile(centerLat, tz);

    // Project lat/lon to canvas pixel coords (centered on aircraft)
    const project = (lat: number, lon: number) => ({
      x: (lon2tile(lon, tz) - cTileX) * ts + W / 2,
      y: (lat2tile(lat, tz) - cTileY) * ts + H / 2,
    });

    // Ocean background (shows while tiles load)
    ctx.fillStyle = '#aad3df';
    ctx.fillRect(0, 0, W, H);

    // Draw tiles
    const maxTile = Math.pow(2, tz);
    const startTX = Math.floor(cTileX - W / (2 * ts));
    const startTY = Math.floor(cTileY - H / (2 * ts));
    const endTX = Math.ceil(cTileX + W / (2 * ts));
    const endTY = Math.ceil(cTileY + H / (2 * ts));

    const scheduleRedraw = () => {
      if (!redrawPendingRef.current) {
        redrawPendingRef.current = true;
        requestAnimationFrame(() => {
          redrawPendingRef.current = false;
          draw();
        });
      }
    };

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const px = (tx - cTileX) * ts + W / 2;
        const py = (ty - cTileY) * ts + H / 2;

        // Wrap longitude, clamp latitude
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        const clampedY = Math.max(0, Math.min(maxTile - 1, ty));

        const img = getTile(wrappedX, clampedY, tz, scheduleRedraw);
        if (img) {
          ctx.drawImage(img, px, py, ts, ts);
        }
      }
    }

    // Trail
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Draw trail with gradient opacity: older = more transparent
      for (let i = 1; i < trail.length; i++) {
        const p0 = project(trail[i - 1].lat, trail[i - 1].lon);
        const p1 = project(trail[i].lat, trail[i].lon);
        const alpha = 0.2 + 0.8 * (i / trail.length);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(231, 76, 60, ${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Aircraft marker
    if (data) {
      const { x: cx, y: cy } = project(data.latitude, data.longitude);
      const headingRad = (data.heading * Math.PI) / 180;
      const size = 14;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(headingRad);

      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.fillStyle = '#e74c3c';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.moveTo(0, -size);                      // nose
      ctx.lineTo(size * 0.6, size * 0.75);       // right wing
      ctx.lineTo(0, size * 0.25);                // tail notch
      ctx.lineTo(-size * 0.6, size * 0.75);      // left wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // OSM attribution (required by tile usage policy)
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(W - 192, H - 16, 192, 16);
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.fillText('© OpenStreetMap contributors', W - 188, H - 4);
  }, [getTile]);

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });
    observer.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();

    return () => observer.disconnect();
  }, [draw]);

  // Append trail point and redraw on new SimConnect data
  useEffect(() => {
    if (!lastData) {
      draw();
      return;
    }

    const { latitude, longitude } = lastData;
    const trail = trailRef.current;
    const last = trail[trail.length - 1];

    if (!last || Math.abs(last.lat - latitude) > 0.001 || Math.abs(last.lon - longitude) > 0.001) {
      trail.push({ lat: latitude, lon: longitude });
      if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL);
    }

    draw();
  }, [lastData, draw]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * factor));
    draw();
  };

  const clearTrail = () => {
    trailRef.current = [];
    draw();
  };

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <div className="map-toolbar-left">
          <h2 className="map-title">Flight Map</h2>
          {trailRef.current.length > 0 && (
            <span className="map-trail-count">{trailRef.current.length} pts</span>
          )}
        </div>

        <div className="map-data-row">
          {lastData ? (
            <>
              <span className="map-data-item">
                <span className="map-data-label">LAT</span>
                {lastData.latitude.toFixed(4)}°
              </span>
              <span className="map-data-item">
                <span className="map-data-label">LON</span>
                {lastData.longitude.toFixed(4)}°
              </span>
              <span className="map-data-item">
                <span className="map-data-label">ALT</span>
                {Math.round(lastData.altitude).toLocaleString()} ft
              </span>
              <span className="map-data-item">
                <span className="map-data-label">HDG</span>
                {Math.round(lastData.heading)}°
              </span>
              <span className="map-data-item">
                <span className="map-data-label">IAS</span>
                {Math.round(lastData.airspeed_indicated)} kts
              </span>
              <span className="map-data-item">
                <span className="map-data-label">VS</span>
                {lastData.vertical_speed > 0 ? '+' : ''}
                {Math.round(lastData.vertical_speed)} ft/min
              </span>
            </>
          ) : (
            <span className="map-no-data">
              {isConnected ? 'En attente des données...' : 'SimConnect déconnecté — lancez MSFS'}
            </span>
          )}
        </div>

        <div className="map-toolbar-right">
          <span className="map-hint">Scroll pour zoomer</span>
          <button className="map-clear-btn" onClick={clearTrail}>
            Effacer trajectoire
          </button>
        </div>
      </div>

      <div ref={containerRef} className="map-canvas-container" onWheel={handleWheel}>
        <canvas ref={canvasRef} className="map-canvas" />
        {!lastData && (
          <div className="map-overlay">
            <div className="map-overlay-icon">✈️</div>
            <div className="map-overlay-text">
              {isConnected
                ? 'En attente des données SimConnect...'
                : 'Connectez-vous à Flight Simulator pour voir la carte'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightMap;
