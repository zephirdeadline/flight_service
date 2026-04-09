import type { Navaid } from '../types';

export const NAVAID_COLORS: Record<string, string> = {
  'VOR':     '#8e44ad',
  'VOR-DME': '#8e44ad',
  'VORTAC':  '#8e44ad',
  'TACAN':   '#1a5276',
  'NDB':     '#e67e22',
  'NDB-DME': '#e67e22',
  'DME':     '#7d3c98',
};

export const navaidColor = (type: string) => NAVAID_COLORS[type] ?? '#7f8c8d';

export const formatNavaidFreq = (nav: Navaid): string => {
  if (nav.frequencyKhz === 0) return '—';
  return nav.type.includes('NDB')
    ? `${nav.frequencyKhz} kHz`
    : `${(nav.frequencyKhz / 1000).toFixed(3)} MHz`;
};
