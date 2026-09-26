/**
 * Jersey colors for player tiles (F1-style: the player's cutout on his team's color).
 * `on` is the text color that reads on the tile.
 */

export interface TeamTile {
  tile: string;
  on: string;
}

const LIGHT_TEXT = '#FFFFFF';
const DARK_TEXT = '#15151E';

const TILES: Record<string, string> = {
  ANA: '#F47A38',
  BOS: '#FFB81C',
  BUF: '#003087',
  CGY: '#C8102E',
  CAR: '#CE1126',
  CHI: '#CF0A2C',
  COL: '#6F263D',
  CBJ: '#002654',
  DAL: '#006847',
  DET: '#CE1126',
  EDM: '#FF4C00',
  FLA: '#C8102E',
  LAK: '#1C1C1C',
  MIN: '#154734',
  MTL: '#AF1E2D',
  NSH: '#FFB81C',
  NJD: '#CE1126',
  NYI: '#00539B',
  NYR: '#0038A8',
  OTT: '#DA1A32',
  PHI: '#F74902',
  PIT: '#111111',
  SJS: '#006D75',
  SEA: '#001628',
  STL: '#002F87',
  TBL: '#002868',
  TOR: '#00205B',
  UTA: '#69B3E7',
  VAN: '#00205B',
  VGK: '#B4975A',
  WSH: '#041E42',
  WPG: '#041E42',
  ARI: '#8C2633',
};

const FALLBACK = '#5F5F6B';

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (start: number) => {
    const c = parseInt(value.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

export function teamTile(team: string | null | undefined): TeamTile {
  const tile = TILES[(team ?? '').toUpperCase()] ?? FALLBACK;
  return { tile, on: luminance(tile) > 0.4 ? DARK_TEXT : LIGHT_TEXT };
}
