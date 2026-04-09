import React, { useEffect, useRef, useState } from 'react';
import type { AirspaceCrossing } from '../services/airspaceService';
import { AIRSPACE_TYPE_NAMES, ICAO_CLASS_NAMES } from '../services/airspaceService';
import './ElevationProfile.css';

export interface ProfilePoint {
  distNm: number;
  elevFt: number | null;
}

export interface WaypointMarker {
  distNm: number;
  name: string;
}

interface Props {
  points: ProfilePoint[];
  waypoints: WaypointMarker[];
  crossings: AirspaceCrossing[];
  loading: boolean;
  onClose: () => void;
  onRegenerate: () => void;
}

const ElevationProfile: React.FC<Props> = ({ points, waypoints, crossings, loading, onClose, onRegenerate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<{ yMin: number; yMax: number; padTop: number; padLeft: number; chartH: number; chartW: number } | null>(null);

  const [manualMin, setManualMin] = useState<string>('');
  const [manualMax, setManualMax] = useState<string>('');
  const customMin = manualMin !== '' ? Number(manualMin) : null;
  const customMax = manualMax !== '' ? Number(manualMax) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const W = container.clientWidth;
    const H = 180;
    canvas.width = W;
    canvas.height = H;
    if (overlayRef.current) { overlayRef.current.width = W; overlayRef.current.height = H; }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PAD = { top: 20, right: 24, bottom: 38, left: 58 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    const validPoints = points.filter((p): p is { distNm: number; elevFt: number } => p.elevFt !== null);
    if (validPoints.length < 2) {
      ctx.fillStyle = '#2a3548';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(loading ? 'Chargement des données d\'élévation…' : 'Pas assez de données', W / 2, H / 2);
      return;
    }

    const totalNm = points[points.length - 1].distNm;
    const elevations = validPoints.map(p => p.elevFt);
    const maxElev = Math.max(...elevations);
    const minElev = Math.min(...elevations);
    const elevRange = Math.max(maxElev - minElev, 500);
    const yMin = customMin !== null ? customMin : Math.max(0, minElev - elevRange * 0.12);
    const yMax = customMax !== null ? customMax : maxElev + elevRange * 0.18;

    scaleRef.current = { yMin, yMax, padTop: PAD.top, padLeft: PAD.left, chartH, chartW };

    const xS = (nm: number) => PAD.left + (nm / totalNm) * chartW;
    const yS = (ft: number) => PAD.top + chartH - ((ft - yMin) / (yMax - yMin)) * chartH;

    // Grid
    const numY = 4;
    for (let i = 0; i <= numY; i++) {
      const ft = yMin + (yMax - yMin) * (i / numY);
      const y = yS(ft);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#3a5070';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      const label = ft >= 1000 ? `${(ft / 1000).toFixed(1)}k ft` : `${Math.round(ft)} ft`;
      ctx.fillText(label, PAD.left - 5, y + 3);
    }

    // Waypoint markers
    waypoints.forEach(({ distNm, name }) => {
      const x = xS(distNm);
      ctx.strokeStyle = 'rgba(243,156,18,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      const truncated = name.length > 6 ? name.slice(0, 6) : name;
      ctx.fillText(truncated, x, PAD.top + chartH + 13);
    });

    // Airspace crossing bands
    for (const c of crossings) {
      const x1 = xS(c.entryDistNm);
      const x2 = xS(c.exitDistNm);
      const yTop = Math.max(PAD.top, yS(Math.min(c.upperFt, yMax)));
      const yBot = Math.min(PAD.top + chartH, yS(Math.max(c.lowerFt, yMin)));
      if (yBot <= yTop) continue;

      // Fill
      ctx.fillStyle = c.color + '28';
      ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);

      // Border top & bottom
      ctx.strokeStyle = c.color + 'aa';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(x1, yTop); ctx.lineTo(x2, yTop);
      ctx.moveTo(x1, yBot); ctx.lineTo(x2, yBot);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label centré dans la bande
      const bandH = yBot - yTop;
      if (bandH > 14 && x2 - x1 > 20) {
        const typeName = AIRSPACE_TYPE_NAMES[c.airspaceType] ?? '';
        const cls = ICAO_CLASS_NAMES[c.icaoClass] ? `${typeName} ${ICAO_CLASS_NAMES[c.icaoClass]}` : typeName;
        const label = c.name.length > 18 ? cls || c.name.slice(0, 14) + '…' : c.name;
        ctx.font = `bold ${Math.min(9, bandH * 0.45)}px monospace`;
        ctx.fillStyle = c.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, (x1 + x2) / 2, (yTop + yBot) / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // Area gradient
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    grad.addColorStop(0, 'rgba(52,152,219,0.45)');
    grad.addColorStop(1, 'rgba(52,152,219,0.04)');

    ctx.beginPath();
    ctx.moveTo(xS(validPoints[0].distNm), yS(yMin));
    validPoints.forEach(p => ctx.lineTo(xS(p.distNm), yS(p.elevFt)));
    ctx.lineTo(xS(validPoints[validPoints.length - 1].distNm), yS(yMin));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Elevation line
    ctx.beginPath();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    validPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(xS(p.distNm), yS(p.elevFt));
      else ctx.lineTo(xS(p.distNm), yS(p.elevFt));
    });
    ctx.stroke();

    // In-progress leading point
    if (loading && points.length > 0) {
      const last = validPoints[validPoints.length - 1];
      ctx.beginPath();
      ctx.arc(xS(last.distNm), yS(last.elevFt), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#3498db';
      ctx.fill();
    }

    // Max elevation dot + label
    const maxPt = validPoints.reduce((a, b) => a.elevFt > b.elevFt ? a : b);
    const maxX = xS(maxPt.distNm);
    const maxY = yS(maxPt.elevFt);
    ctx.beginPath();
    ctx.arc(maxX, maxY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = maxX > W - 80 ? 'right' : 'center';
    ctx.fillText(`${maxPt.elevFt.toLocaleString()} ft`, maxX, maxY - 7);

    // Min elevation dot (only if significantly lower)
    if (maxElev - minElev > 500) {
      const minPt = validPoints.reduce((a, b) => a.elevFt < b.elevFt ? a : b);
      const minX = xS(minPt.distNm);
      const minY = yS(minPt.elevFt);
      ctx.beginPath();
      ctx.arc(minX, minY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#27ae60';
      ctx.fill();
      ctx.font = '9px monospace';
      ctx.fillStyle = '#27ae60';
      ctx.textAlign = minX > W - 80 ? 'right' : 'center';
      ctx.fillText(`${minPt.elevFt.toLocaleString()} ft`, minX, minY + 13);
    }

    // Axes
    ctx.strokeStyle = '#2a3548';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + chartH);
    ctx.lineTo(PAD.left + chartW, PAD.top + chartH);
    ctx.stroke();

    // X-axis NM labels
    ctx.fillStyle = '#2a3f58';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    const xStep = totalNm <= 50 ? 10 : totalNm <= 150 ? 25 : totalNm <= 400 ? 50 : 100;
    for (let nm = 0; nm <= totalNm; nm += xStep) {
      ctx.fillText(`${nm}`, xS(nm), PAD.top + chartH + 25);
    }
    ctx.fillText('NM', PAD.left + chartW, PAD.top + chartH + 25);

  }, [points, waypoints, crossings, loading, customMin, customMax]);

  const validPoints = points.filter(p => p.elevFt !== null);
  const totalNm = points.length > 0 ? points[points.length - 1].distNm : 0;
  const maxElev = validPoints.length > 0 ? Math.max(...validPoints.map(p => p.elevFt!)) : null;
  const minElev = validPoints.length > 0 ? Math.min(...validPoints.map(p => p.elevFt!)) : null;

  return (
    <div className="elevation-profile" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <div className="elevation-profile-header">
        <span className="elevation-profile-title">📊 Profil d'élévation</span>
        {loading && (
          <span className="elevation-profile-loading">
            {validPoints.length} / {points.length} pts
            <span className="elevation-profile-spinner" />
          </span>
        )}
        {!loading && maxElev !== null && (
          <span className="elevation-profile-stats">
            <span className="elev-stat elev-max">▲ {maxElev.toLocaleString()} ft ({Math.round(maxElev / 3.28084).toLocaleString()} m)</span>
            <span className="elev-stat elev-min">▼ {minElev!.toLocaleString()} ft ({Math.round(minElev! / 3.28084).toLocaleString()} m)</span>
            <span className="elev-stat">{totalNm.toFixed(0)} NM · {validPoints.length} pts</span>
          </span>
        )}
        <div className="elevation-profile-scale">
          <label className="elevation-profile-scale-label">Min</label>
          <input
            className="elevation-profile-scale-input"
            type="number"
            placeholder="auto"
            value={manualMin}
            onChange={e => setManualMin(e.target.value)}
            title="Altitude minimale de l'axe Y (ft)"
          />
          <label className="elevation-profile-scale-label">Max</label>
          <input
            className="elevation-profile-scale-input"
            type="number"
            placeholder="auto"
            value={manualMax}
            onChange={e => setManualMax(e.target.value)}
            title="Altitude maximale de l'axe Y (ft)"
          />
          <label className="elevation-profile-scale-label">ft</label>
          {(manualMin !== '' || manualMax !== '') && (
            <button
              className="elevation-profile-btn"
              onClick={() => { setManualMin(''); setManualMax(''); }}
              title="Réinitialiser l'axe"
            >⟳ auto</button>
          )}
        </div>
        <button className="elevation-profile-btn" onClick={onRegenerate} title="Recalculer">↻</button>
        <button className="elevation-profile-btn" onClick={onClose} title="Fermer">✕</button>
      </div>
      <div ref={containerRef} className="elevation-profile-canvas-wrap"
        onMouseMove={(e) => {
          const overlay = overlayRef.current;
          const scale = scaleRef.current;
          if (!overlay || !scale) return;
          const rect = overlay.getBoundingClientRect();
          const py = e.clientY - rect.top;
          const { yMin, yMax, padTop, padLeft, chartH, chartW } = scale;
          if (py < padTop || py > padTop + chartH) { overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height); return; }
          const ft = yMin + (yMax - yMin) * (1 - (py - padTop) / chartH);
          const m = Math.round(ft / 3.28084);
          const ctx = overlay.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          // Ligne horizontale
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(padLeft, py);
          ctx.lineTo(padLeft + chartW, py);
          ctx.stroke();
          ctx.setLineDash([]);
          // Label flottant à côté du curseur
          const px = e.clientX - rect.left;
          const label = `${Math.round(ft).toLocaleString()} ft / ${m.toLocaleString()} m`;
          ctx.font = 'bold 10px monospace';
          const tw = ctx.measureText(label).width;
          const lw = tw + 10;
          const lh = 16;
          const lx = px + 12 + lw > overlay.width ? px - lw - 8 : px + 12;
          const ly = py - lh / 2;
          ctx.fillStyle = 'rgba(15,20,30,0.88)';
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(lx, ly, lw, lh, 3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#e0eeff';
          ctx.textAlign = 'left';
          ctx.fillText(label, lx + 5, py + 4);
        }}
        onMouseLeave={() => overlayRef.current?.getContext('2d')?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height)}
      >
        <canvas ref={canvasRef} className="elevation-profile-canvas" />
        <canvas ref={overlayRef} className="elevation-profile-overlay" />
      </div>
    </div>
  );
};

export default ElevationProfile;
