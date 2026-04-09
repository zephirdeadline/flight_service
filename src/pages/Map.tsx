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
  name: string;
  note?: string;
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

const formatNavaidFreq = (nav: Navaid): string => {
  if (nav.frequencyKhz === 0) return '—';
  return nav.type.includes('NDB') ? `${nav.frequencyKhz} kHz` : `${(nav.frequencyKhz / 1000).toFixed(3)} MHz`;
};

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

// Distance from point (px,py) to segment (ax,ay)-(bx,by) in pixels
const pointToSegmentDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
};

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
  const [navaidPopup, setNavaidPopup] = useState<{ navaid: Navaid; x: number; y: number } | null>(null);
  const [airportPopup, setAirportPopup] = useState<{ airport: Airport; x: number; y: number } | null>(null);
  const [noteEditor, setNoteEditor] = useState<{ wpIndex: number; x: number; y: number; value: string } | null>(null);

  const [cruiseSpeed, setCruiseSpeed] = useState(120);
  const speedInitializedRef = useRef(false);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const isMeasuringRef = useRef(false);
  const measurePointsRef = useRef<{ lat: number; lon: number }[]>([]);
  const [measurePointCount, setMeasurePointCount] = useState(0);
  const [measureResult, setMeasureResult] = useState<{ nm: number; km: number; bearing: number } | null>(null);

  const mousePosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Drag-insert on a leg
  const dragInsertRef = useRef<{ legIndex: number; wp: Waypoint } | null>(null);
  // Drag-move of an existing waypoint
  const dragMoveRef = useRef<{ wpIndex: number; original: Waypoint; current: Waypoint; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressNextClickRef = useRef(false);

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

  useEffect(() => {
    if (!speedInitializedRef.current && lastData?.airspeed_indicated && lastData.airspeed_indicated > 10) {
      speedInitializedRef.current = true;
      setCruiseSpeed(Math.round(lastData.airspeed_indicated));
    }
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
    const di = dragInsertRef.current;
    const dm = dragMoveRef.current;
    const wpBase = flightPlanRef.current;
    // Build display array: apply drag-move or drag-insert preview
    let wp: Waypoint[];
    if (dm) {
      wp = wpBase.map((w, i) => (i === dm.wpIndex ? dm.current : w));
    } else if (di) {
      wp = [...wpBase.slice(0, di.legIndex + 1), di.wp, ...wpBase.slice(di.legIndex + 1)];
    } else {
      wp = wpBase;
    }
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
        const isInsertPreview = di !== null && i === di.legIndex + 1;
        const isMovePreview = dm !== null && i === dm.wpIndex;
        ctx.globalAlpha = isInsertPreview ? 0.55 : 1;

        // Circle
        ctx.beginPath();
        ctx.fillStyle = isInsertPreview ? '#3498db' : isMovePreview ? '#2ecc71' : '#f39c12';
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

        // Note indicator: small amber dot top-right + truncated note text
        if (wp[i].note) {
          ctx.globalAlpha = isInsertPreview ? 0.55 : 1;
          // Dot
          ctx.beginPath();
          ctx.fillStyle = '#f1c40f';
          ctx.arc(p.x + 7, p.y - 7, 3, 0, Math.PI * 2);
          ctx.fill();
          // Text
          const noteText = wp[i].note!.length > 22 ? wp[i].note!.slice(0, 22) + '…' : wp[i].note!;
          ctx.font = 'italic 9px sans-serif';
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.strokeText(noteText, p.x + 11, p.y + 7);
          ctx.fillStyle = '#b8860b';
          ctx.fillText(noteText, p.x + 11, p.y + 7);
        }

        ctx.globalAlpha = 1;
      });
    }

    // ── Measurement ───────────────────────────────────────────────────────────
    const mpts = measurePointsRef.current;
    if (mpts.length > 0) {
      const p0 = project(mpts[0].lat, mpts[0].lon);
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#1abc9c';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', p0.x, p0.y);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      if (mpts.length === 2) {
        const p1 = project(mpts[1].lat, mpts[1].lon);
        ctx.save();
        ctx.strokeStyle = '#1abc9c';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#1abc9c';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', p1.x, p1.y);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        const mnm = haversineNm(mpts[0].lat, mpts[0].lon, mpts[1].lat, mpts[1].lon);
        const mbrg = bearingDeg(mpts[0].lat, mpts[0].lon, mpts[1].lat, mpts[1].lon);
        const mmx = (p0.x + p1.x) / 2;
        const mmy = (p0.y + p1.y) / 2;
        const ml1 = `${mnm.toFixed(1)} NM`;
        const ml2 = `${(mnm * 1.852).toFixed(1)} km · ${Math.round(mbrg).toString().padStart(3, '0')}°`;
        ctx.font = 'bold 12px sans-serif';
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 3;
        ctx.strokeText(ml1, mmx + 6, mmy - 5);
        ctx.strokeText(ml2, mmx + 6, mmy + 9);
        ctx.fillStyle = '#1abc9c';
        ctx.fillText(ml1, mmx + 6, mmy - 5);
        ctx.fillStyle = '#a8f0e0';
        ctx.fillText(ml2, mmx + 6, mmy + 9);
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

  // Returns a project() function based on current map state
  const getProjector = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const zoom = zoomRef.current;
    const tz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
    const ts = TILE_SIZE * Math.pow(2, zoom - tz);
    const cTileX = lon2tile(mapCenterRef.current.lon, tz);
    const cTileY = lat2tile(mapCenterRef.current.lat, tz);
    const W = canvas.width, H = canvas.height;
    return (lat: number, lon: number) => ({
      x: (lon2tile(lon, tz) - cTileX) * ts + W / 2,
      y: (lat2tile(lat, tz) - cTileY) * ts + H / 2,
    });
  }, []);

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

  const exportFlightPlanPDF = () => {
    const wp = flightPlanRef.current;
    if (wp.length === 0) return;

    const spd = cruiseSpeed > 0 ? cruiseSpeed : 120;

    const formatCoord = (val: number, pos: string, neg: string) => {
      const d = Math.abs(val);
      const deg = Math.floor(d);
      const min = ((d - deg) * 60).toFixed(2);
      return `${deg}° ${min}' ${val >= 0 ? pos : neg}`;
    };

    const formatDuration = (nm: number): string => {
      const totalMin = (nm / spd) * 60;
      const h = Math.floor(totalMin / 60);
      const m = Math.round(totalMin % 60);
      return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
    };

    let cumulNm = 0;
    let cumulMin = 0;
    const rows = wp.map((w, i) => {
      const legNm = i === 0 ? 0 : haversineNm(wp[i - 1].lat, wp[i - 1].lon, w.lat, w.lon);
      const brg = i === 0 ? null : bearingDeg(wp[i - 1].lat, wp[i - 1].lon, w.lat, w.lon);
      cumulNm += legNm;
      cumulMin += i === 0 ? 0 : (legNm / spd) * 60;
      return { w, i, legNm, brg, cumulNm, cumulMin };
    });

    const totalNm = cumulNm;
    const totalKm = (totalNm * 1.852).toFixed(1);
    const totalH = Math.floor(cumulMin / 60);
    const totalM = Math.round(cumulMin % 60);
    const totalTime = totalH > 0 ? `${totalH}h${totalM.toString().padStart(2, '0')}` : `${totalM} min`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const tableRows = rows.map(({ w, i, legNm, brg, cumulNm: cumul }) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="bold">${w.name}</td>
        <td class="mono">${formatCoord(w.lat, 'N', 'S')}</td>
        <td class="mono">${formatCoord(w.lon, 'E', 'W')}</td>
        <td class="center">${brg !== null ? `${Math.round(brg).toString().padStart(3, '0')}°` : '—'}</td>
        <td class="center">${i === 0 ? '—' : legNm.toFixed(1)}</td>
        <td class="center">${i === 0 ? '—' : formatDuration(legNm)}</td>
        <td class="center">${cumul.toFixed(1)}</td>
        <td class="center">${i === 0 ? '—' : formatDuration(cumul)}</td>
        <td class="note">${w.note ?? ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Plan de vol</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; border-bottom: 2px solid #1a3a5a; padding-bottom: 10px; }
  .header-left h1 { font-size: 20px; font-weight: 700; color: #1a3a5a; letter-spacing: 1px; }
  .header-left p { font-size: 11px; color: #555; margin-top: 2px; }
  .header-right { text-align: right; font-size: 11px; color: #555; }
  .summary { display: flex; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
  .summary-item { background: #f0f4f8; border-left: 3px solid #1a3a5a; padding: 6px 12px; border-radius: 0 4px 4px 0; }
  .summary-label { font-size: 9px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-value { font-size: 14px; font-weight: 700; color: #1a3a5a; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1a3a5a; color: #fff; }
  thead th { padding: 7px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th.center { text-align: center; }
  tbody tr:nth-child(even) { background: #f5f8fb; }
  tbody tr:first-child td { border-top: none; }
  td { padding: 6px 8px; border-bottom: 1px solid #dde4ed; vertical-align: middle; }
  td.center { text-align: center; }
  td.bold { font-weight: 700; color: #1a3a5a; }
  td.mono { font-family: monospace; font-size: 10px; }
  td.note { font-style: italic; color: #555; font-size: 10px; max-width: 120px; }
  td.time { color: #1a6a3a; font-weight: 600; }
  tfoot tr { background: #1a3a5a; color: #fff; font-weight: 700; }
  tfoot td { padding: 7px 8px; border: none; text-align: center; }
  tfoot td.left { text-align: left; }
  .dep-arr { display: flex; gap: 8px; font-size: 13px; font-weight: 700; color: #1a3a5a; margin-bottom: 12px; align-items: center; }
  .dep-arr .arrow { color: #888; font-size: 16px; }
  footer { margin-top: 16px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #dde; padding-top: 8px; }
  @media print { body { padding: 10px; } @page { margin: 10mm; size: A4 landscape; } }
</style>
</head>
<body>
<header>
  <div class="header-left">
    <h1>✈ PLAN DE VOL</h1>
    <p>Tableau de route — Flight Service</p>
  </div>
  <div class="header-right">
    <div>${dateStr}</div>
    <div style="margin-top:4px;font-weight:700;color:#1a3a5a;">Vitesse de croisière : ${spd} kts</div>
  </div>
</header>

<div class="dep-arr">
  <span>${wp[0].name}</span>
  <span class="arrow">→</span>
  <span>${wp[wp.length - 1].name}</span>
</div>

<div class="summary">
  <div class="summary-item">
    <div class="summary-label">Waypoints</div>
    <div class="summary-value">${wp.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Distance totale</div>
    <div class="summary-value">${totalNm.toFixed(1)} NM</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Distance (km)</div>
    <div class="summary-value">${totalKm} km</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Temps de vol estimé</div>
    <div class="summary-value">${totalTime}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Vitesse de croisière</div>
    <div class="summary-value">${spd} kts</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th class="center" style="width:28px">#</th>
      <th style="width:72px">Waypoint</th>
      <th style="width:120px">Latitude</th>
      <th style="width:120px">Longitude</th>
      <th class="center" style="width:48px">Route</th>
      <th class="center" style="width:58px">Leg (NM)</th>
      <th class="center" style="width:58px">ETE leg</th>
      <th class="center" style="width:58px">Total (NM)</th>
      <th class="center" style="width:58px">ETE total</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
  <tfoot>
    <tr>
      <td class="left" colspan="5">Total</td>
      <td>${totalNm.toFixed(1)} NM</td>
      <td>${totalTime}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tfoot>
</table>

<footer>Généré par Flight Service · ${dateStr} · Vitesse de croisière ${spd} kts</footer>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 300);
  };

  const toggleMeasure = () => {
    const next = !isMeasuringRef.current;
    isMeasuringRef.current = next;
    setIsMeasuring(next);
    if (!next) {
      measurePointsRef.current = [];
      setMeasurePointCount(0);
      setMeasureResult(null);
      draw();
    }
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

  // Left mousedown: drag-move waypoint (priority) or drag-insert on leg (edit mode only)
  const handleLeftMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !isEditingPlanRef.current) return;
    const wp = flightPlanRef.current;
    if (wp.length === 0) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const proj = getProjector();
    if (!proj) return;

    const HIT_WP = 14;  // px radius for waypoint hit
    const HIT_LEG = 10; // px from segment line

    // 1. Check if on an existing waypoint → drag-move
    for (let i = 0; i < wp.length; i++) {
      const { x, y } = proj(wp[i].lat, wp[i].lon);
      if (Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= HIT_WP) {
        dragMoveRef.current = { wpIndex: i, original: wp[i], current: wp[i], startX: px, startY: py, moved: false };
        suppressNextClickRef.current = true;
        return;
      }
    }

    // 2. Check if on a leg → drag-insert
    if (wp.length < 2) return;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = proj(wp[i].lat, wp[i].lon);
      const b = proj(wp[i + 1].lat, wp[i + 1].lon);
      if (pointToSegmentDist(px, py, a.x, a.y, b.x, b.y) <= HIT_LEG) {
        const ll = pixelToLatLon(px, py);
        if (!ll) return;
        dragInsertRef.current = { legIndex: i, wp: { lat: ll.lat, lon: ll.lon, name: '…' } };
        suppressNextClickRef.current = true;
        return;
      }
    }
  };

  // Left click: navaid popup (always) or add waypoint (edit mode)
  const handleClick = (e: React.MouseEvent) => {
    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return; }
    if (e.button !== 0) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Check click on a navaid/airport marker — only open popup when NOT in edit/measure mode
    if (!isEditingPlanRef.current && !isMeasuringRef.current) {
      if (navaidsCache) {
        const proj = getProjector();
        const zoom = zoomRef.current;
        if (proj) {
          const HIT = 14;
          for (const nav of navaidsCache) {
            const isVor = nav.type.startsWith('VOR') || nav.type === 'VORTAC' || nav.type === 'TACAN';
            if (zoom < 8.5 && !isVor) continue;
            if (zoom < 6) continue;
            const { x, y } = proj(nav.latitude, nav.longitude);
            if (Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= HIT) {
              setNavaidPopup({ navaid: nav, x: px, y: py });
              return;
            }
          }
        }
      }

      if (airportsCache) {
        const proj = getProjector();
        const zoom = zoomRef.current;
        if (proj) {
          const HIT = 14;
          for (const airport of airportsCache) {
            if (zoom < 7 && airport.type !== 'large_airport') continue;
            if (zoom < 8.5 && airport.type === 'small_airport') continue;
            const { x, y } = proj(airport.latitude, airport.longitude);
            if (Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= HIT) {
              setAirportPopup({ airport, x: px, y: py });
              setNavaidPopup(null);
              return;
            }
          }
        }
      }
    }

    // Close any open popup on click elsewhere
    if (navaidPopup) { setNavaidPopup(null); return; }
    if (airportPopup) { setAirportPopup(null); return; }

    // Measure mode: place A then B
    if (isMeasuringRef.current) {
      const snapped = findNearestSnap(px, py);
      const ll = snapped ? { lat: snapped.lat, lon: snapped.lon } : pixelToLatLon(px, py);
      if (!ll) return;
      const pts = measurePointsRef.current;
      if (pts.length >= 2) {
        measurePointsRef.current = [ll];
        setMeasurePointCount(1);
        setMeasureResult(null);
      } else {
        measurePointsRef.current = [...pts, ll];
        const newCount = measurePointsRef.current.length;
        setMeasurePointCount(newCount);
        if (newCount === 2) {
          const [a, b] = measurePointsRef.current;
          const nm = haversineNm(a.lat, a.lon, b.lat, b.lon);
          setMeasureResult({ nm, km: nm * 1.852, bearing: bearingDeg(a.lat, a.lon, b.lat, b.lon) });
        }
      }
      draw();
      return;
    }

    if (!isEditingPlanRef.current) return;

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
    // Confirm drag-move on left button release
    if (e.button === 0 && dragMoveRef.current) {
      const dm = dragMoveRef.current;
      if (dm.moved) {
        // It was a real drag → apply new position
        flightPlanRef.current[dm.wpIndex] = { ...dm.current, note: dm.original.note };
        dragMoveRef.current = null;
        updatePlanInfo();
        draw();
      } else {
        // It was a click → open note editor; suppressNextClickRef stays true so handleClick skips
        dragMoveRef.current = null;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setNoteEditor({
          wpIndex: dm.wpIndex,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          value: dm.original.note ?? '',
        });
      }
      return;
    }

    // Confirm drag-insert on left button release
    if (e.button === 0 && dragInsertRef.current) {
      const { legIndex, wp: newWp } = dragInsertRef.current;
      if (newWp.name !== '…') {
        flightPlanRef.current.splice(legIndex + 1, 0, newWp);
      } else {
        flightPlanRef.current.splice(legIndex + 1, 0, { ...newWp, name: `WPT${flightPlanRef.current.length + 1}` });
      }
      dragInsertRef.current = null;
      updatePlanInfo();
      draw();
      return;
    }
    if (e.button === 0 && dragInsertRef.current === null) {
      // cancelled (e.g. dragged back off)
    }
    if (e.button !== 2) return;
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    if (dragMoveRef.current) { dragMoveRef.current = null; draw(); }
    if (dragInsertRef.current) {
      dragInsertRef.current = null;
      draw();
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    mousePosRef.current = { x: px, y: py };

    // Drag-move: update existing waypoint position
    if (dragMoveRef.current) {
      const dm = dragMoveRef.current;
      const dist = Math.sqrt((px - dm.startX) ** 2 + (py - dm.startY) ** 2);
      if (dist > 4) {
        const snapped = findNearestSnap(px, py);
        const ll = pixelToLatLon(px, py);
        dragMoveRef.current = {
          ...dm,
          moved: true,
          current: snapped ?? (ll ? { lat: ll.lat, lon: ll.lon, name: dm.original.name, note: dm.original.note } : dm.current),
        };
        draw();
      }
      return;
    }

    // Drag-insert: update preview waypoint position
    if (dragInsertRef.current) {
      const snapped = findNearestSnap(px, py);
      if (snapped) {
        dragInsertRef.current = { ...dragInsertRef.current, wp: snapped };
      } else {
        const ll = pixelToLatLon(px, py);
        if (ll) dragInsertRef.current = { ...dragInsertRef.current, wp: { lat: ll.lat, lon: ll.lon, name: '…' } };
      }
      draw();
      return;
    }

    // Pan
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
    : isMeasuring
      ? 'map-canvas-container--measuring'
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
                {planInfo.count >= 2 && (
                  <>
                    <label className="map-speed-label">
                      <span>kts</span>
                      <input
                        className="map-speed-input"
                        type="number"
                        min={10}
                        max={999}
                        value={cruiseSpeed}
                        onChange={(e) => setCruiseSpeed(Math.max(10, Math.min(999, Number(e.target.value))))}
                        title="Vitesse de croisière pour le calcul des temps"
                      />
                    </label>
                    <button className="map-plan-export" onClick={exportFlightPlanPDF} title="Exporter le plan de vol en PDF">
                      📄 PDF
                    </button>
                  </>
                )}
                <button className="map-plan-clear" onClick={clearPlan}>
                  Effacer plan
                </button>
              </>
            )}
          </div>

          {/* Measure tool */}
          <div className="map-measure-controls">
            <button
              className={`map-measure-btn ${isMeasuring ? 'map-measure-btn--active' : ''}`}
              onClick={toggleMeasure}
              title="Mesurer la distance entre 2 points"
            >
              📏 {isMeasuring ? 'Mesure active' : 'Mesurer'}
            </button>
            {isMeasuring && (
              <span className="map-measure-status">
                {measureResult
                  ? `${measureResult.nm.toFixed(1)} NM · ${measureResult.km.toFixed(1)} km · ${Math.round(measureResult.bearing).toString().padStart(3, '0')}°`
                  : measurePointCount === 0
                    ? 'Cliquez sur A'
                    : 'Cliquez sur B'}
              </span>
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
        onMouseDown={(e) => { handleLeftMouseDown(e); handleMouseDown(e); }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="map-canvas" />

        {navaidPopup && (() => {
          const { navaid: nav, x, y } = navaidPopup;
          const color = navaidColor(nav.type);
          // Clamp so popup doesn't go off-screen (approx popup size 220x260)
          const containerW = containerRef.current?.clientWidth ?? 800;
          const containerH = containerRef.current?.clientHeight ?? 600;
          const left = Math.min(x + 14, containerW - 235);
          const top = Math.min(y - 10, containerH - 280);
          return (
            <div className="navaid-popup" style={{ left, top }}>
              <button className="navaid-popup-close" onClick={() => setNavaidPopup(null)}>✕</button>
              <div className="navaid-popup-header" style={{ borderColor: color }}>
                <span className="navaid-popup-ident" style={{ background: color }}>{nav.ident}</span>
                <span className="navaid-popup-type" style={{ color }}>{nav.type}</span>
              </div>
              <div className="navaid-popup-name">{nav.name}</div>
              <div className="navaid-popup-rows">
                <div className="navaid-popup-row">
                  <span>📡 Freq</span>
                  <strong style={{ color }}>{formatNavaidFreq(nav)}</strong>
                </div>
                {nav.associatedAirport && (
                  <div className="navaid-popup-row">
                    <span>🛬 Airport</span><strong>{nav.associatedAirport}</strong>
                  </div>
                )}
                <div className="navaid-popup-row">
                  <span>🗺️ Coords</span>
                  <span>{nav.latitude.toFixed(4)}°, {nav.longitude.toFixed(4)}°</span>
                </div>
                {nav.elevationFt != null && (
                  <div className="navaid-popup-row">
                    <span>⛰️ Elev</span><span>{nav.elevationFt} ft</span>
                  </div>
                )}
                {nav.magneticVariationDeg != null && (
                  <div className="navaid-popup-row">
                    <span>🧭 Var</span><span>{nav.magneticVariationDeg.toFixed(1)}°</span>
                  </div>
                )}
                {nav.usageType && (
                  <div className="navaid-popup-row">
                    <span>📶 Usage</span><span>{nav.usageType}</span>
                  </div>
                )}
                {nav.power && (
                  <div className="navaid-popup-row">
                    <span>⚡ Power</span><span>{nav.power}</span>
                  </div>
                )}
                <div className="navaid-popup-row">
                  <span>🌍 Country</span><span>{nav.isoCountry}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {airportPopup && (() => {
          const { airport: ap, x, y } = airportPopup;
          const containerW = containerRef.current?.clientWidth ?? 800;
          const containerH = containerRef.current?.clientHeight ?? 600;
          const left = Math.min(x + 14, containerW - 235);
          const top = Math.min(y - 10, containerH - 260);
          const typeColor = ap.type === 'large_airport' ? '#af0909' : ap.type === 'medium_airport' ? '#005f28' : '#0300be';
          const typeLabel = ap.type === 'large_airport' ? 'Large' : ap.type === 'medium_airport' ? 'Medium' : 'Small';
          return (
            <div className="navaid-popup" style={{ left, top }}>
              <button className="navaid-popup-close" onClick={() => setAirportPopup(null)}>✕</button>
              <div className="navaid-popup-header" style={{ borderColor: typeColor }}>
                <span className="navaid-popup-ident" style={{ background: typeColor }}>{ap.icao || ap.id}</span>
                {ap.iataCode && <span className="navaid-popup-ident" style={{ background: '#2980b9' }}>{ap.iataCode}</span>}
                <span className="navaid-popup-type" style={{ color: typeColor }}>{typeLabel}</span>
              </div>
              <div className="navaid-popup-name">{ap.name}</div>
              <div className="navaid-popup-rows">
                <div className="navaid-popup-row">
                  <span>📍 City</span><strong>{ap.city}, {ap.country}</strong>
                </div>
                <div className="navaid-popup-row">
                  <span>🗺️ Coords</span>
                  <span>{ap.latitude.toFixed(4)}°, {ap.longitude.toFixed(4)}°</span>
                </div>
                <div className="navaid-popup-row">
                  <span>⛰️ Elev</span><span>{ap.elevation} ft</span>
                </div>
                <div className="navaid-popup-row">
                  <span>✈️ Scheduled</span><span>{ap.scheduledService ? '✅ Yes' : '❌ No'}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {noteEditor && (() => {
          const containerW = containerRef.current?.clientWidth ?? 800;
          const containerH = containerRef.current?.clientHeight ?? 600;
          const left = Math.min(noteEditor.x + 14, containerW - 230);
          const top = Math.min(noteEditor.y - 10, containerH - 130);
          const wp = flightPlanRef.current[noteEditor.wpIndex];
          const saveNote = (val: string) => {
            flightPlanRef.current[noteEditor.wpIndex] = { ...wp, note: val.trim() || undefined };
            updatePlanInfo();
            draw();
            setNoteEditor(null);
          };
          return (
            <div className="note-editor" style={{ left, top }}>
              <div className="note-editor-header">
                <span>📝 {wp?.name}</span>
                <button onClick={() => setNoteEditor(null)}>✕</button>
              </div>
              <textarea
                className="note-editor-input"
                autoFocus
                value={noteEditor.value}
                placeholder="Ajouter une note..."
                onChange={(e) => setNoteEditor({ ...noteEditor, value: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(noteEditor.value); } if (e.key === 'Escape') setNoteEditor(null); }}
              />
              <div className="note-editor-footer">
                <span className="note-editor-hint">Enter pour valider · Échap pour annuler</span>
                <button className="note-editor-save" onClick={() => saveNote(noteEditor.value)}>OK</button>
              </div>
            </div>
          );
        })()}

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
