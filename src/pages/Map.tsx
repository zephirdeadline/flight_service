import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSimConnect } from '../context/SimConnectContext';
import { airportService } from '../services/airportService';
import type { Airport } from '../types';
import './Map.css';

interface TrailPoint {
  lat: number;
  lon: number;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 15;
const MAX_TRAIL = 2000;

const tileCache = new Map<string, HTMLImageElement>();
let airportsCache: Airport[] | null = null;
let airportsFetching = false;

const lon2tile = (lon: number, z: number) => ((lon + 180) / 360) * Math.pow(2, z);
const lat2tile = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};
const tile2lat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
const tile2lon = (x: number, z: number) => (x / Math.pow(2, z)) * 360 - 180;

const FlightMap: React.FC = () => {
  const { lastData, isConnected } = useSimConnect();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const zoomRef = useRef(6);
  const lastDataRef = useRef(lastData);
  const redrawPendingRef = useRef(false);

  // Map center (used when not following)
  const mapCenterRef = useRef({ lat: 46.0, lon: 2.0 });
  const followRef = useRef(true);
  const [isFollowing, setIsFollowing] = useState(true);

  // Mouse position on canvas (for zoom-on-cursor)
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Pan drag state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    lastDataRef.current = lastData;
  }, [lastData]);

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
      tileCache.set(key, img);
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

    // Update map center from aircraft if following
    if (followRef.current && data) {
      mapCenterRef.current = { lat: data.latitude, lon: data.longitude };
    }

    const centerLat = mapCenterRef.current.lat;
    const centerLon = mapCenterRef.current.lon;

    const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
    const scale = Math.pow(2, zoom - tz);
    const ts = TILE_SIZE * scale;

    const cTileX = lon2tile(centerLon, tz);
    const cTileY = lat2tile(centerLat, tz);

    const project = (lat: number, lon: number) => ({
      x: (lon2tile(lon, tz) - cTileX) * ts + W / 2,
      y: (lat2tile(lat, tz) - cTileY) * ts + H / 2,
    });

    ctx.fillStyle = '#aad3df';
    ctx.fillRect(0, 0, W, H);

    // OSM tiles
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
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        const clampedY = Math.max(0, Math.min(maxTile - 1, ty));
        const img = getTile(wrappedX, clampedY, tz, scheduleRedraw);
        if (img) ctx.drawImage(img, px, py, ts, ts);
      }
    }

    // ── Airports ──────────────────────────────────────────────────────────────
    if (zoom >= 5 && airportsCache) {
      const margin = 40;
      for (const airport of airportsCache) {
        if (zoom < 7 && airport.type !== 'large_airport') continue;
        if (zoom < 8.5 && airport.type === 'small_airport') continue;

        const { x, y } = project(airport.latitude, airport.longitude);
        if (x < -margin || x > W + margin || y < -margin || y > H + margin) continue;

        const dotRadius = zoom >= 9 ? 9 : 7;
        let dotColor: string;
        let strokeColor: string;
        if (airport.type === 'large_airport') {
          dotColor = '#af0909';
          strokeColor = '#ffffff';
        } else if (airport.type === 'medium_airport') {
          dotColor = '#005f28';
          strokeColor = '#ffffff';
        } else {
          dotColor = '#0300be';
          strokeColor = 'rgba(255,255,255,0.6)';
        }

        ctx.beginPath();
        ctx.fillStyle = dotColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        {
          ctx.font = `bold ${airport.type === 'large_airport' ? 11 : 10}px monospace`;
          ctx.fillStyle = '#1a2535';
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2.5;
          ctx.strokeText(airport.id, x + dotRadius + 2, y + 4);
          ctx.fillText(airport.id, x + dotRadius + 2, y + 4);
        }
      }
    }

    // ── Trail ─────────────────────────────────────────────────────────────────
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
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

    // ── Aircraft marker ───────────────────────────────────────────────────────
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
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.6, size * 0.75);
      ctx.lineTo(0, size * 0.25);
      ctx.lineTo(-size * 0.6, size * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // OSM attribution
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(W - 192, H - 16, 192, 16);
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.fillText('© OpenStreetMap contributors', W - 188, H - 4);
  }, [getTile]);

  // Pan the map by pixel delta (converts to lat/lon offset)
  const panByPixels = useCallback((dx: number, dy: number) => {
    const zoom = zoomRef.current;
    const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
    const scale = Math.pow(2, zoom - tz);
    const ts = TILE_SIZE * scale;

    const dTileX = -dx / ts;
    const dTileY = -dy / ts;

    const currentTileY = lat2tile(mapCenterRef.current.lat, tz);
    const newTileY = currentTileY + dTileY;
    const newLat = tile2lat(newTileY, tz);
    const dLon = (dTileX / Math.pow(2, tz)) * 360;

    mapCenterRef.current = {
      lat: Math.max(-85, Math.min(85, newLat)),
      lon: mapCenterRef.current.lon + dLon,
    };
  }, []);

  // Sync mapCenter with aircraft when switching to follow mode
  const toggleFollow = () => {
    const next = !followRef.current;
    followRef.current = next;
    setIsFollowing(next);
    if (next && lastDataRef.current) {
      mapCenterRef.current = {
        lat: lastDataRef.current.latitude,
        lon: lastDataRef.current.longitude,
      };
    }
    draw();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    // Disable follow when user manually pans
    if (followRef.current) {
      followRef.current = false;
      setIsFollowing(false);
      if (lastDataRef.current) {
        mapCenterRef.current = {
          lat: lastDataRef.current.latitude,
          lon: lastDataRef.current.longitude,
        };
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button !== 2) return;
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panByPixels(dx, dy);
    draw();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const factor = e.deltaY > 0 ? 0.93 : 1.07;
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    if (newZoom === oldZoom) return;

    // Pixel position of cursor on canvas
    const { x: mx, y: my } = mousePosRef.current;
    const W = canvas.width;
    const H = canvas.height;

    // Compute lat/lon under the cursor before zoom
    const oldTz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(oldZoom)));
    const oldScale = Math.pow(2, oldZoom - oldTz);
    const oldTs = TILE_SIZE * oldScale;
    const cTileX = lon2tile(mapCenterRef.current.lon, oldTz);
    const cTileY = lat2tile(mapCenterRef.current.lat, oldTz);
    const mouseTileX = (mx - W / 2) / oldTs + cTileX;
    const mouseTileY = (my - H / 2) / oldTs + cTileY;
    const mouseLon = tile2lon(mouseTileX, oldTz);
    const mouseLat = tile2lat(mouseTileY, oldTz);

    zoomRef.current = newZoom;

    // After zoom, shift mapCenter so the same lat/lon stays under cursor
    const newTz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(newZoom)));
    const newScale = Math.pow(2, newZoom - newTz);
    const newTs = TILE_SIZE * newScale;
    const newCenterTileX = lon2tile(mouseLon, newTz) - (mx - W / 2) / newTs;
    const newCenterTileY = lat2tile(mouseLat, newTz) - (my - H / 2) / newTs;
    mapCenterRef.current = {
      lat: Math.max(-85, Math.min(85, tile2lat(newCenterTileY, newTz))),
      lon: tile2lon(newCenterTileX, newTz),
    };

    // Disable follow when user zooms off-center
    if (followRef.current) {
      const data = lastDataRef.current;
      if (data) {
        const dist = Math.abs(mouseLat - data.latitude) + Math.abs(mouseLon - data.longitude);
        if (dist > 0.01) {
          followRef.current = false;
          setIsFollowing(false);
        }
      }
    }

    draw();
  };

  const clearTrail = () => {
    trailRef.current = [];
    draw();
  };

  useEffect(() => {
    if (airportsCache || airportsFetching) return;
    airportsFetching = true;
    airportService.getAllAirports().then((airports) => {
      airportsCache = airports;
      airportsFetching = false;
      draw();
    });
  }, [draw]);

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

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <div className="map-toolbar-left">
          <h2 className="map-title">Flight Map</h2>
          <div className="map-legend">
            <span className="legend-dot legend-large" />
            <span className="legend-label">Large</span>
            <span className="legend-dot legend-medium" />
            <span className="legend-label">Medium</span>
            <span className="legend-dot legend-small" />
            <span className="legend-label">Small</span>
          </div>
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
          <button
            className={`map-follow-btn ${isFollowing ? 'map-follow-btn--active' : ''}`}
            onClick={toggleFollow}
            title={isFollowing ? 'Désactiver le suivi' : 'Centrer sur l\'avion'}
          >
            {isFollowing ? '✈️ Suivi actif' : '✈️ Suivre l\'avion'}
          </button>
          <span className="map-hint">Clic droit pour déplacer</span>
          <button className="map-clear-btn" onClick={clearTrail}>
            Effacer trajectoire
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`map-canvas-container ${isDragging ? 'map-canvas-container--dragging' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
      >
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
