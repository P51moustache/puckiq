/**
 * NHL team colors for all 32 teams
 * Primaries are brightened for visibility on dark backgrounds.
 * Secondaries are real team accent colors used as fallback when primaries clash.
 */

export interface TeamColors {
  primary: string;
  secondary: string;
}

const TEAM_COLORS: Record<string, TeamColors> = {
  // Atlantic Division
  BOS: { primary: '#FFB81C', secondary: '#000000' },
  BUF: { primary: '#004FBF', secondary: '#FFB81C' },
  DET: { primary: '#CE1126', secondary: '#FFFFFF' },
  FLA: { primary: '#C8102E', secondary: '#B9975B' },
  MTL: { primary: '#AF1E2D', secondary: '#3048A5' },
  OTT: { primary: '#C52032', secondary: '#C69214' },
  TBL: { primary: '#0060A8', secondary: '#FFFFFF' },
  TOR: { primary: '#005DAA', secondary: '#FFFFFF' },

  // Metropolitan Division
  CAR: { primary: '#CC0000', secondary: '#A2AAAD' },
  CBJ: { primary: '#004A9A', secondary: '#CE1126' },
  NJD: { primary: '#CE1126', secondary: '#FFFFFF' },
  NYI: { primary: '#00539B', secondary: '#F47D30' },
  NYR: { primary: '#0038A8', secondary: '#CE1126' },
  PHI: { primary: '#F74902', secondary: '#000000' },
  PIT: { primary: '#FFB81C', secondary: '#000000' },
  WSH: { primary: '#C8102E', secondary: '#FFFFFF' },

  // Central Division
  ARI: { primary: '#8C2633', secondary: '#E2D6B5' },
  UTA: { primary: '#69B3E7', secondary: '#000000' },
  CHI: { primary: '#CF0A2C', secondary: '#FFD100' },
  COL: { primary: '#832D49', secondary: '#236192' },
  DAL: { primary: '#006847', secondary: '#8F8F8C' },
  MIN: { primary: '#1D6B4F', secondary: '#DDCBA4' },
  NSH: { primary: '#FFB81C', secondary: '#041E42' },
  STL: { primary: '#004BB5', secondary: '#FCB514' },
  WPG: { primary: '#004C97', secondary: '#AC162C' },

  // Pacific Division
  ANA: { primary: '#F47A38', secondary: '#B9975B' },
  CGY: { primary: '#D2001C', secondary: '#FAAF19' },
  EDM: { primary: '#FF4C00', secondary: '#003E6B' },
  LAK: { primary: '#A2AAAD', secondary: '#111111' },
  SEA: { primary: '#99D9D9', secondary: '#355464' },
  SJS: { primary: '#006D75', secondary: '#EA7200' },
  VAN: { primary: '#005DAA', secondary: '#00843D' },
  VGK: { primary: '#B4975A', secondary: '#333F42' },
};

const DEFAULT_COLORS: TeamColors = { primary: '#60a5fa', secondary: '#334e8d' };

/** App background color for contrast calculations */
const APP_BACKGROUND = '#071023';

/** WCAG AA minimum contrast ratio for normal text */
const MIN_CONTRAST_RATIO = 4.5;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function lightenColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, r + (255 - r) * amount),
    Math.min(255, g + (255 - g) * amount),
    Math.min(255, b + (255 - b) * amount),
  );
}

/**
 * Get team colors by abbreviation
 * Returns default accent colors if team not found
 */
export function getTeamColors(abbrev: string): TeamColors {
  return TEAM_COLORS[abbrev] || DEFAULT_COLORS;
}

/**
 * Get a team color that meets WCAG AA contrast against the app background.
 * Lightens dark team colors (NYR, TOR, TBL, BUF, etc.) for text readability.
 * Use this for team-colored TEXT — not for backgrounds or gradients.
 */
export function getAccessibleTextColor(abbrev: string): string {
  const colors = TEAM_COLORS[abbrev] || DEFAULT_COLORS;
  const primary = colors.primary;

  // If primary already has sufficient contrast, use it
  if (contrastRatio(primary, APP_BACKGROUND) >= MIN_CONTRAST_RATIO) {
    return primary;
  }

  // Try secondary color
  if (contrastRatio(colors.secondary, APP_BACKGROUND) >= MIN_CONTRAST_RATIO) {
    return colors.secondary;
  }

  // Lighten primary until it passes contrast check
  let lightened = primary;
  for (let step = 0.1; step <= 0.9; step += 0.05) {
    lightened = lightenColor(primary, step);
    if (contrastRatio(lightened, APP_BACKGROUND) >= MIN_CONTRAST_RATIO) {
      return lightened;
    }
  }

  return lightened;
}
