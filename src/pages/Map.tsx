import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSimConnect } from '../context/SimConnectContext';
import { airportService } from '../services/airportService';
import { navaidService } from '../services/navaidService';
import type { Airport, Navaid } from '../types';
import './Map.css';

interface TrailPoint {
  lat: number;
  lon: number;
}

interface Waypoint {
  lat: number;
  lon: number;
  name: string; // airport ident or custom label
}

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 15;
const MAX_TRAIL = 2000;
const SNAP_PX = 18; // pixels radius to snap to an airport

const tileCache = new Map<string, HTMLImageElement>();
let airportsCache: Airport[] | null = null;
let airportsFetching = false;
let navaidsCache: Navaid[] | null = null;
let navaidsFetching = false;

const FLIGHT_PLAN_KEY = 'flightPlan';
let flightPlanModule: Waypoint[] = (() => {
  try {
    const saved = localStorage.getItem(FLIGHT_PLAN_KEY);
    return saved ? (JSON.parse(saved) as Waypoint[]) : [];
  } catch {
    return [];
  }
})();
const saveFlightPlan = () => {
  try { localStorage.setItem(FLIGHT_PLAN_KEY, JSON.stringify(flightPlanModule)); } catch {}
};

const NAVAID_COLORS: Record<string, string> = {
  'VOR':     '#8e44ad',
  'VOR-DME': '#8e44ad',
  'VORTAC':  '#8e44ad',
  'TACAN':   '#1a5276',
  'NDB':     '#e67e22',
  'NDB-DME': '#e67e22',
  'DME':     '#7d3c98',
};
const navaidColor = (type: string) => NAVAID_COLORS[type] ?? '#7f8c8d';

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

const bearingDeg = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
};

const haversineNm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const FlightMap: React.FC = () => {
  const { lastData, isConnected } = useSimConnect();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const zoomRef = useRef(6);
  const lastDataRef = useRef(lastData);
  const redrawPendingRef = useRef(false);

  const mapCenterRef = useRef({ lat: 46.0, lon: 2.0 });
  const followRef = useRef(true);
  const [isFollowing, setIsFollowing] = useState(true);

  const mousePosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Flight plan (module-level for session persistence, localStorage for cross-restart)
  const flightPlanRef = useRef<Waypoint[]>(flightPlanModule);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const isEditingPlanRef = useRef(false);
  const [planInfo, setPlanInfo] = useState<{ count: number; totalNm: number }>(() => {
    const wp = flightPlanModule;
    let total = 0;
    for (let i = 1; i < wp.length; i++) {
      total += haversineNm(wp[i - 1].lat, wp[i - 1].lon, wp[i].lat, wp[i].lon);
    }
    return { count: wp.length, totalNm: Math.round(total) };
  });

  useEffect(() => {
    lastDataRef.current = lastData;
  }, [lastData]);

  const updatePlanInfo = () => {
    const wp = flightPlanRef.current;
    flightPlanModule = wp; // keep module in sync
    saveFlightPlan();      // persist to localStorage
    let total = 0;
    for (let i = 1; i < wp.length; i++) {
      total += haversineNm(wp[i - 1].lat, wp[i - 1].lon, wp[i].lat, wp[i].lon);
    }
    setPlanInfo({ count: wp.length, totalNm: Math.round(total) });
  };

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

        ctx.font = `bold ${airport.type === 'large_airport' ? 11 : 10}px monospace`;
        ctx.fillStyle = '#1a2535';
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(airport.id, x + dotRadius + 2, y + 4);
        ctx.fillText(airport.id, x + dotRadius + 2, y + 4);
      }
    }

    // ── Navaids ───────────────────────────────────────────────────────────────
    if (zoom >= 6 && navaidsCache) {
      const margin = 40;
      for (const nav of navaidsCache) {
        // Zoom-based filter: only VOR-family at low zoom, all from 8.5
        const isVor = nav.type.startsWith('VOR') || nav.type === 'VORTAC' || nav.type === 'TACAN';
        if (zoom < 8.5 && !isVor) continue;

        const { x, y } = project(nav.latitude, nav.longitude);
        if (x < -margin || x > W + margin || y < -margin || y > H + margin) continue;

        const color = navaidColor(nav.type);
        const r = 7;

        ctx.save();
        ctx.translate(x, y);

        if (nav.type.startsWith('VOR') || nav.type === 'VORTAC') {
          // Hexagon for VOR types
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            i === 0 ? ctx.moveTo(r * Math.cos(a), r * Math.sin(a)) : ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
          }
          ctx.closePath();
          ctx.fillStyle = color + '33';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.fill();
          ctx.stroke();
        } else if (nav.type.startsWith('NDB')) {
          // Circle with inner dot for NDB
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = color + '33';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          // Diamond for DME / TACAN
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.fillStyle = color + '33';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();

        // Ident label
        ctx.font = 'bold 10px monospace';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(nav.ident, x + r + 2, y + 4);
        ctx.fillStyle = color;
        ctx.fillText(nav.ident, x + r + 2, y + 4);
      }
    }

    // ── Flight plan ───────────────────────────────────────────────────────────
    const wp = flightPlanRef.current;
    if (wp.length > 0) {
      const pts = wp.map((w) => project(w.lat, w.lon));

      // Leg lines
      if (pts.length > 1) {
        ctx.save();
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Distance + bearing label on each leg
        ctx.font = 'bold 11px sans-serif';
        for (let i = 1; i < wp.length; i++) {
          const nm = haversineNm(wp[i - 1].lat, wp[i - 1].lon, wp[i].lat, wp[i].lon);
          const brg = bearingDeg(wp[i - 1].lat, wp[i - 1].lon, wp[i].lat, wp[i].lon);
          const mx = (pts[i - 1].x + pts[i].x) / 2;
          const my = (pts[i - 1].y + pts[i].y) / 2;
          const line1 = `${Math.round(nm)} NM`;
          const line2 = `${Math.round(brg).toString().padStart(3, '0')}°`;
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 3;
          ctx.strokeText(line1, mx + 4, my - 5);
          ctx.strokeText(line2, mx + 4, my + 8);
          ctx.fillStyle = '#e67e22';
          ctx.fillText(line1, mx + 4, my - 5);
          ctx.fillStyle = '#f5cba7';
          ctx.fillText(line2, mx + 4, my + 8);
        }
      }

      // Waypoint markers
      pts.forEach((p, i) => {
        // Circle
        ctx.beginPath();
        ctx.fillStyle = '#f39c12';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Index number inside circle
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p.x, p.y);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Name label
        ctx.font = 'bold 11px monospace';
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText(wp[i].name, p.x + 11, p.y - 6);
        ctx.fillStyle = '#e67e22';
        ctx.fillText(wp[i].name, p.x + 11, p.y - 6);
      });
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

  // Convert canvas pixel to lat/lon
  const pixelToLatLon = useCallback((px: number, py: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const zoom = zoomRef.current;
    const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
    const scale = Math.pow(2, zoom - tz);
    const ts = TILE_SIZE * scale;
    const cTileX = lon2tile(mapCenterRef.current.lon, tz);
    const cTileY = lat2tile(mapCenterRef.current.lat, tz);
    const tileX = (px - canvas.width / 2) / ts + cTileX;
    const tileY = (py - canvas.height / 2) / ts + cTileY;
    return { lat: tile2lat(tileY, tz), lon: tile2lon(tileX, tz) };
  }, []);

  // Find nearest visible airport or navaid within SNAP_PX pixels
  const findNearestSnap = useCallback((px: number, py: number): Waypoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const W = canvas.width;
    const H = canvas.height;
    const zoom = zoomRef.current;
    const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
    const scale = Math.pow(2, zoom - tz);
    const ts = TILE_SIZE * scale;
    const cTileX = lon2tile(mapCenterRef.current.lon, tz);
    const cTileY = lat2tile(mapCenterRef.current.lat, tz);

    const proj = (lat: number, lon: number) => ({
      x: (lon2tile(lon, tz) - cTileX) * ts + W / 2,
      y: (lat2tile(lat, tz) - cTileY) * ts + H / 2,
    });

    let bestDist = SNAP_PX;
    let best: Waypoint | null = null;

    // Check airports
    if (airportsCache) {
      for (const airport of airportsCache) {
        if (zoom < 7 && airport.type !== 'large_airport') continue;
        if (zoom < 8.5 && airport.type === 'small_airport') continue;
        const { x, y } = proj(airport.latitude, airport.longitude);
        const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (d < bestDist) {
          bestDist = d;
          best = { lat: airport.latitude, lon: airport.longitude, name: airport.id };
        }
      }
    }

    // Check navaids
    if (navaidsCache) {
      for (const nav of navaidsCache) {
        const isVor = nav.type.startsWith('VOR') || nav.type === 'VORTAC' || nav.type === 'TACAN';
        if (zoom < 8.5 && !isVor) continue;
        if (zoom < 6) continue;
        const { x, y } = proj(nav.latitude, nav.longitude);
        const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (d < bestDist) {
          bestDist = d;
          best = { lat: nav.latitude, lon: nav.longitude, name: nav.ident };
        }
      }
    }

    return best;
  }, []);

  const panByPixels = useCallback((dx: number, dy: number) => {
    const zoom = zoomRef.current;
    const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
    const scale = Math.pow(2, zoom - tz);
    const ts = TILE_SIZE * scale;
    const dTileX = -dx / ts;
    const dTileY = -dy / ts;
    const currentTileY = lat2tile(mapCenterRef.current.lat, tz);
    const newTileY = currentTileY + dTileY;
    const dLon = (dTileX / Math.pow(2, tz)) * 360;
    mapCenterRef.current = {
      lat: Math.max(-85, Math.min(85, tile2lat(newTileY, tz))),
      lon: mapCenterRef.current.lon + dLon,
    };
  }, []);

  const toggleFollow = () => {
    const next = !followRef.current;
    followRef.current = next;
    setIsFollowing(next);
    if (next && lastDataRef.current) {
      mapCenterRef.current = { lat: lastDataRef.current.latitude, lon: lastDataRef.current.longitude };
    }
    draw();
  };

  const toggleEditPlan = () => {
    const next = !isEditingPlanRef.current;
    isEditingPlanRef.current = next;
    setIsEditingPlan(next);
  };

  const clearPlan = () => {
    flightPlanRef.current = [];
    flightPlanModule = [];
    updatePlanInfo();
    draw();
  };

  const undoLastWaypoint = () => {
    flightPlanRef.current.pop();
    updatePlanInfo();
    draw();
  };

  // Left click: add waypoint (only in edit mode)
  const handleClick = (e: React.MouseEvent) => {
    if (e.button !== 0 || !isEditingPlanRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const snapped = findNearestSnap(px, py);
    let wp: Waypoint;
    if (snapped) {
      wp = snapped;
    } else {
      const ll = pixelToLatLon(px, py);
      if (!ll) return;
      const idx = flightPlanRef.current.length + 1;
      wp = { lat: ll.lat, lon: ll.lon, name: `WPT${idx}` };
    }

    flightPlanRef.current.push(wp);
    updatePlanInfo();
    draw();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2) return;
    e.preventDefault();

    // Check if right-click hits a waypoint — delete it if so
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const canvas = canvasRef.current;
    if (canvas && flightPlanRef.current.length > 0) {
      const zoom = zoomRef.current;
      const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
      const ts = TILE_SIZE * Math.pow(2, zoom - tz);
      const cTileX = lon2tile(mapCenterRef.current.lon, tz);
      const cTileY = lat2tile(mapCenterRef.current.lat, tz);
      const proj = (lat: number, lon: number) => ({
        x: (lon2tile(lon, tz) - cTileX) * ts + canvas.width / 2,
        y: (lat2tile(lat, tz) - cTileY) * ts + canvas.height / 2,
      });

      const HIT_RADIUS = 14;
      const idx = flightPlanRef.current.findIndex((wp) => {
        const { x, y } = proj(wp.lat, wp.lon);
        return Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= HIT_RADIUS;
      });

      if (idx !== -1) {
        flightPlanRef.current.splice(idx, 1);
        updatePlanInfo();
        draw();
        return; // don't start panning
      }
    }

    // No waypoint hit → start panning
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    if (followRef.current) {
      followRef.current = false;
      setIsFollowing(false);
      if (lastDataRef.current) {
        mapCenterRef.current = { lat: lastDataRef.current.latitude, lon: lastDataRef.current.longitude };
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

    const { x: mx, y: my } = mousePosRef.current;
    const W = canvas.width;
    const H = canvas.height;

    const oldTz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(oldZoom)));
    const oldTs = TILE_SIZE * Math.pow(2, oldZoom - oldTz);
    const cTileX = lon2tile(mapCenterRef.current.lon, oldTz);
    const cTileY = lat2tile(mapCenterRef.current.lat, oldTz);
    const mouseLon = tile2lon((mx - W / 2) / oldTs + cTileX, oldTz);
    const mouseLat = tile2lat((my - H / 2) / oldTs + cTileY, oldTz);

    zoomRef.current = newZoom;

    const newTz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(newZoom)));
    const newTs = TILE_SIZE * Math.pow(2, newZoom - newTz);
    mapCenterRef.current = {
      lat: Math.max(-85, Math.min(85, tile2lat(lat2tile(mouseLat, newTz) - (my - H / 2) / newTs, newTz))),
      lon: tile2lon(lon2tile(mouseLon, newTz) - (mx - W / 2) / newTs, newTz),
    };

    if (followRef.current) {
      const data = lastDataRef.current;
      if (data && Math.abs(mouseLat - data.latitude) + Math.abs(mouseLon - data.longitude) > 0.01) {
        followRef.current = false;
        setIsFollowing(false);
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
    if (navaidsCache || navaidsFetching) return;
    navaidsFetching = true;
    navaidService.getAllNavaids().then((navaids) => {
      navaidsCache = navaids;
      navaidsFetching = false;
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
    if (!lastData) { draw(); return; }
    const { latitude, longitude } = lastData;
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || Math.abs(last.lat - latitude) > 0.001 || Math.abs(last.lon - longitude) > 0.001) {
      trail.push({ lat: latitude, lon: longitude });
      if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL);
    }
    draw();
  }, [lastData, draw]);

  const cursorClass = isDragging
    ? 'map-canvas-container--dragging'
    : isEditingPlan
      ? 'map-canvas-container--editing'
      : '';

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
            <span className="legend-sep" />
            <span className="legend-navaid legend-vor" />
            <span className="legend-label">VOR</span>
            <span className="legend-navaid legend-ndb" />
            <span className="legend-label">NDB</span>
            <span className="legend-navaid legend-dme" />
            <span className="legend-label">DME</span>
          </div>
        </div>

        <div className="map-data-row">
          {lastData ? (
            <>
              <span className="map-data-item"><span className="map-data-label">LAT</span>{lastData.latitude.toFixed(4)}°</span>
              <span className="map-data-item"><span className="map-data-label">LON</span>{lastData.longitude.toFixed(4)}°</span>
              <span className="map-data-item"><span className="map-data-label">ALT</span>{Math.round(lastData.altitude).toLocaleString()} ft</span>
              <span className="map-data-item"><span className="map-data-label">HDG</span>{Math.round(lastData.heading)}°</span>
              <span className="map-data-item"><span className="map-data-label">IAS</span>{Math.round(lastData.airspeed_indicated)} kts</span>
              <span className="map-data-item">
                <span className="map-data-label">VS</span>
                {lastData.vertical_speed > 0 ? '+' : ''}{Math.round(lastData.vertical_speed)} ft/min
              </span>
            </>
          ) : (
            <span className="map-no-data">
              {isConnected ? 'En attente des données...' : 'SimConnect déconnecté — lancez MSFS'}
            </span>
          )}
        </div>

        <div className="map-toolbar-right">
          {/* Flight plan controls */}
          <div className="map-plan-controls">
            <button
              className={`map-plan-btn ${isEditingPlan ? 'map-plan-btn--active' : ''}`}
              onClick={toggleEditPlan}
              title="Clic gauche pour ajouter un waypoint"
            >
              {isEditingPlan ? '✏️ Édition' : '✏️ Plan de vol'}
            </button>
            {planInfo.count > 0 && (
              <>
                <span className="map-plan-info">
                  {planInfo.count} WPT · {planInfo.totalNm} NM
                </span>
                <button className="map-plan-undo" onClick={undoLastWaypoint} title="Supprimer le dernier waypoint">
                  ↩
                </button>
                <button className="map-plan-clear" onClick={clearPlan}>
                  Effacer plan
                </button>
              </>
            )}
          </div>

          <div className="map-toolbar-sep" />

          <button
            className={`map-follow-btn ${isFollowing ? 'map-follow-btn--active' : ''}`}
            onClick={toggleFollow}
          >
            {isFollowing ? '✈️ Suivi actif' : '✈️ Suivre'}
          </button>
          <button className="map-clear-btn" onClick={clearTrail}>
            Effacer trace
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`map-canvas-container ${cursorClass}`}
        onWheel={handleWheel}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="map-canvas" />
        {isEditingPlan && (
          <div className="map-edit-hint">
            Clic gauche pour ajouter un waypoint · Snap automatique sur les aéroports
          </div>
        )}
        {!lastData && (
          <div className="map-overlay">
            <div className="map-overlay-icon">✈️</div>
            <div className="map-overlay-text">
              {isConnected ? 'En attente des données SimConnect...' : 'Connectez-vous à Flight Simulator pour voir la carte'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightMap;
