import { haversineNm, bearingDeg } from '../utils/mapGeo';
import type { Waypoint } from '../utils/flightPlanStore';

const formatCoord = (val: number, pos: string, neg: string): string => {
  const d = Math.abs(val);
  const deg = Math.floor(d);
  const min = ((d - deg) * 60).toFixed(2);
  return `${deg}° ${min}' ${val >= 0 ? pos : neg}`;
};

const formatDuration = (nm: number, spd: number): string => {
  const totalMin = (nm / spd) * 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
};

export const exportFlightPlanPDF = (wp: Waypoint[], cruiseSpeed: number): void => {
  if (wp.length < 2) return;

  const spd = cruiseSpeed > 0 ? cruiseSpeed : 120;

  // Each row shows the leg departing FROM that waypoint toward the next
  const rows = wp.map((w, i) => {
    const isLast = i === wp.length - 1;
    const legNm = isLast ? 0 : haversineNm(w.lat, w.lon, wp[i + 1].lat, wp[i + 1].lon);
    const brg = isLast ? null : bearingDeg(w.lat, w.lon, wp[i + 1].lat, wp[i + 1].lon);
    return { w, i, legNm, brg, isLast };
  });

  const totalNm = rows.reduce((s, r) => s + r.legNm, 0);
  const totalKm = (totalNm * 1.852).toFixed(1);
  const totalMin = (totalNm / spd) * 60;
  const totalH = Math.floor(totalMin / 60);
  const totalM = Math.round(totalMin % 60);
  const totalTime = totalH > 0 ? `${totalH}h${totalM.toString().padStart(2, '0')}` : `${totalM} min`;
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  let runningNm = 0;
  const tableRows = rows.map(({ w, i, legNm, brg, isLast }) => {
    runningNm += legNm;
    const cumulAfter = runningNm;
    return `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="bold">${w.name}</td>
        <td class="mono">${formatCoord(w.lat, 'N', 'S')}</td>
        <td class="mono">${formatCoord(w.lon, 'E', 'W')}</td>
        <td class="center">${brg !== null ? `${Math.round(brg).toString().padStart(3, '0')}°` : '—'}</td>
        <td class="center">${isLast ? '—' : legNm.toFixed(1)}</td>
        <td class="center">${isLast ? '—' : formatDuration(legNm, spd)}</td>
        <td class="center">${cumulAfter.toFixed(1)}</td>
        <td class="center">${formatDuration(cumulAfter, spd)}</td>
        <td class="note">${w.note ?? ''}</td>
      </tr>`;
  }).join('');

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
      <th class="center" style="width:48px">Cap suivant</th>
      <th class="center" style="width:58px">Leg (NM)</th>
      <th class="center" style="width:58px">Durée leg</th>
      <th class="center" style="width:58px">Dist. cumul.</th>
      <th class="center" style="width:58px">Temps cumul.</th>
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
